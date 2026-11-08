"use client";

/*
 * Demo-mode pipeline state (persisted as "chamba-pipeline-demo"). Never touches Supabase.
 * Only what changed during the demo is stored; everything else comes from ./demo-seed relative to
 * the page load (DEMO_T0). It is wiped whenever the app leaves demo mode, re-enters it (enterDemo
 * emits "reset"; ./demo-reset hears it even where this module isn't loaded), or after 24 h without
 * changes.
 */
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { ApplicationPipeline, RecruiterNote } from "@/lib/data/types";
import { onLive } from "@/lib/live/events";
import { useApp } from "@/lib/store";
import { DEMO_PIPELINE_KEY } from "./demo-reset";
import { seedRecruiterNotes, seedRecruiterPipelines } from "./demo-seed";

/** Seeds are relative to this (module load ≈ page load). */
export const DEMO_T0 = Date.now();

export type DemoPipelineState = {
  /** Candidate side, by jobId: applications made / withdrawn during this demo. */
  mine: Record<string, ApplicationPipeline>;
  /** Company side, by application id ("a1"…): applicants the demo company acted on. */
  apps: Record<string, ApplicationPipeline>;
  /** Company side, by application id: the notes list once it was edited (else the seeded notes). */
  notes: Record<string, RecruiterNote[]>;
  updatedAt: number;
};

const EMPTY: DemoPipelineState = { mine: {}, apps: {}, notes: {}, updatedAt: 0 };
const STALE_MS = 24 * 60 * 60 * 1000;

export const useDemoPipeline = create<DemoPipelineState>()(
  persist(() => EMPTY, {
    name: DEMO_PIPELINE_KEY,
    storage: createJSONStorage(() => localStorage),
    version: 1,
    partialize: (s) => ({ mine: s.mine, apps: s.apps, notes: s.notes, updatedAt: s.updatedAt }),
  }),
);

export function resetDemoPipeline() {
  useDemoPipeline.setState(EMPTY, true);
}

export function patchDemo(fn: (s: DemoPipelineState) => Partial<DemoPipelineState>) {
  useDemoPipeline.setState((s) => ({ ...fn(s), updatedAt: Date.now() }));
}

// ------------------------------------------------------------------ reads (company side)

/** A demo applicant's pipeline: what the demo company did to it, else the seed. */
export function demoRecruiterPipeline(s: Pick<DemoPipelineState, "apps">, id: string): ApplicationPipeline | null {
  return s.apps[id] ?? seedRecruiterPipelines(DEMO_T0)[id] ?? null;
}

export function demoRecruiterNotes(s: Pick<DemoPipelineState, "notes">, id: string): RecruiterNote[] {
  return s.notes[id] ?? seedRecruiterNotes(DEMO_T0)[id] ?? [];
}

// ------------------------------------------------------------------ lifecycle

if (typeof window !== "undefined") {
  // enterDemo / exitDemo / sign-out / account switch.
  onLive("reset", resetDemoPipeline);
  // Leaving demo mode by any other path.
  useApp.subscribe((s, prev) => {
    if (prev.mode === "demo" && s.mode !== "demo" && useApp.persist.hasHydrated()) resetDemoPipeline();
  });
  // A page load outside the demo (exited on a page that didn't load this module), or a stale demo.
  const check = () => {
    const { mode } = useApp.getState();
    const { updatedAt } = useDemoPipeline.getState();
    if (updatedAt && (mode !== "demo" || Date.now() - updatedAt > STALE_MS)) resetDemoPipeline();
  };
  if (useApp.persist.hasHydrated()) check();
  else useApp.persist.onFinishHydration(check);
}

"use client";

/*
 * The candidate's side of the pipeline: my applications with their status, interview, company
 * message and timeline. Both modes, one shape (ApplicationPipeline):
 *  - live: ONE query (applications + embedded application_events, RLS = mine) shared by every hook,
 *    refetched on focus (when older than 20 s), after apply/withdraw and on refresh().
 *  - demo / visitor: derived from the store's `applications` + deterministic seeds (./demo-seed);
 *    applications made or withdrawn during the demo are remembered in ./demo-store. Never Supabase.
 * Apply / withdraw stay in the store (`useApp().apply`, `.withdraw`) — this module observes them, so
 * the change shows here at once (optimistic, `pending: true` until the server confirms).
 */
import { useEffect, useMemo } from "react";
import { create } from "zustand";
import type { Application, ApplicationPipeline } from "@/lib/data/types";
import { onLive } from "@/lib/live/events";
import { useApp, useHydrated, type WriteResult } from "@/lib/store";
import { newCandidatePipeline, seedCandidatePipeline, withdrawnPipeline } from "./demo-seed";
import { DEMO_T0, patchDemo, useDemoPipeline } from "./demo-store";
import { fetchMyPipelines } from "./live";

export type MyPipelinesResult = {
  /** Newest first. Live: also applications made on another device since the session loaded. */
  data: ApplicationPipeline[];
  /** First load in progress (before hydration, or live before the first answer). */
  loading: boolean;
  /** Spanish; set when the last load failed (data then keeps the previous list, if any). */
  error?: string;
  /** A background refetch is running (data on screen is the previous one). */
  refreshing: boolean;
  /** Live: refetch now. Demo: no-op. */
  refresh: () => Promise<void>;
};

export type MyPipelineResult = Omit<MyPipelinesResult, "data"> & {
  /** Null when I haven't applied to this vacancy (or, while loading, not known yet). */
  data: ApplicationPipeline | null;
};

// ------------------------------------------------------------------ live cache

type LiveMine = {
  status: "idle" | "loading" | "ready" | "error";
  userId: string | null;
  list: ApplicationPipeline[];
  error?: string;
  fetchedAt: number;
  refreshing: boolean;
};
const LIVE_IDLE: LiveMine = { status: "idle", userId: null, list: [], fetchedAt: 0, refreshing: false };
const useLiveMine = create<LiveMine>()(() => LIVE_IDLE);

/** Changes seen in the store this session (live), by jobId: when it was applied / withdrawn here. */
type Observed = { appliedAt?: number; withdrawnAt?: number };
const useObserved = create<{ byJob: Record<string, Observed> }>()(() => ({ byJob: {} }));

const STALE_MS = 20_000;
let seq = 0;
let flight: { userId: string; promise: Promise<void> } | null = null;

function loadLive(userId: string, force = false): Promise<void> {
  const st = useLiveMine.getState();
  const fresh = st.userId === userId && st.status === "ready" && Date.now() - st.fetchedAt < STALE_MS;
  if (!force && fresh) return Promise.resolve();
  if (flight && flight.userId === userId && !force) return flight.promise;
  const mySeq = ++seq;
  useLiveMine.setState((s) =>
    s.userId === userId && s.status === "ready" ? { refreshing: true } : { status: "loading", userId, list: [], error: undefined, refreshing: false },
  );
  const promise = (async () => {
    const r = await fetchMyPipelines(userId);
    if (mySeq !== seq) return; // superseded (newer fetch, reset, other user)
    if (r.error !== undefined) {
      useLiveMine.setState((s) => (s.status === "ready" ? { refreshing: false, error: r.error } : { status: "error", error: r.error, refreshing: false }));
      return;
    }
    useLiveMine.setState({ status: "ready", userId, list: r.data, error: undefined, fetchedAt: Date.now(), refreshing: false });
    // Server truth arrived: drop the optimistic marks it already reflects.
    const byJob = new Map(r.data.map((p) => [p.jobId, p]));
    useObserved.setState((s) => ({
      byJob: Object.fromEntries(
        Object.entries(s.byJob).flatMap(([jobId, o]) => {
          const p = byJob.get(jobId);
          if (!p) return [[jobId, o]];
          const keep: Observed = {};
          if (o.withdrawnAt && p.status !== "cerrada") keep.withdrawnAt = o.withdrawnAt;
          return keep.withdrawnAt ? [[jobId, keep]] : [];
        }),
      ),
    }));
  })();
  flight = { userId, promise };
  return promise.finally(() => {
    if (flight?.promise === promise) flight = null;
  });
}

/** Live: refetch my applications now (no-op in demo). */
export function refreshMyPipelines(): Promise<void> {
  const s = useApp.getState();
  return s.mode === "live" && s.userId ? loadLive(s.userId, true) : Promise.resolve();
}

let refreshTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleRefresh(delay = 1200) {
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => {
    refreshTimer = null;
    void refreshMyPipelines();
  }, delay);
}

// ------------------------------------------------------------------ store observer

function diffApplications(prev: Application[], next: Application[]) {
  const before = new Map(prev.map((a) => [a.jobId, a]));
  const added: string[] = [];
  const withdrawn: string[] = [];
  for (const a of next) {
    const b = before.get(a.jobId);
    if (!b) added.push(a.jobId);
    else if (b.status !== "cerrada" && a.status === "cerrada") withdrawn.push(a.jobId);
  }
  const nextIds = new Set(next.map((a) => a.jobId));
  const removed = prev.filter((a) => !nextIds.has(a.jobId)).map((a) => a.jobId);
  return { added, withdrawn, removed };
}

if (typeof window !== "undefined") {
  useApp.subscribe((s, prev) => {
    if (s.applications === prev.applications || !useApp.persist.hasHydrated()) return;
    // A different user / mode replaced the list wholesale: not something this user just did.
    if (s.mode !== prev.mode || s.userId !== prev.userId) return;
    const { added, withdrawn, removed } = diffApplications(prev.applications, s.applications);
    if (!added.length && !withdrawn.length && !removed.length) return;
    const now = Date.now();
    if (s.mode === "live") {
      useObserved.setState((o) => {
        const byJob = { ...o.byJob };
        for (const id of added) byJob[id] = { ...byJob[id], appliedAt: now };
        for (const id of withdrawn) byJob[id] = { ...byJob[id], withdrawnAt: now };
        for (const id of removed) delete byJob[id];
        return { byJob };
      });
      scheduleRefresh();
      return;
    }
    // Demo / visitor: remember it (persisted) so the timeline keeps the real time of the action.
    patchDemo((d) => {
      const mine = { ...d.mine };
      for (const id of added) mine[id] = newCandidatePipeline(id, now);
      for (const id of withdrawn) {
        const app = s.applications.find((a) => a.jobId === id);
        const current = mine[id] ?? (app ? seedCandidatePipeline({ ...app, status: prev.applications.find((a) => a.jobId === id)?.status ?? "enviada" }, DEMO_T0) : null);
        if (current) mine[id] = withdrawnPipeline(current, now);
      }
      for (const id of removed) delete mine[id];
      return { mine };
    });
  });

  onLive("reset", () => {
    seq++;
    flight = null;
    if (refreshTimer) clearTimeout(refreshTimer);
    refreshTimer = null;
    useLiveMine.setState(LIVE_IDLE, true);
    useObserved.setState({ byJob: {} }, true);
  });
}

// ------------------------------------------------------------------ derivation

const byNewest = (a: ApplicationPipeline, b: ApplicationPipeline) => Date.parse(b.appliedAt) - Date.parse(a.appliedAt);

function demoList(apps: Application[], mine: Record<string, ApplicationPipeline>): ApplicationPipeline[] {
  return apps
    .map((a) => {
      const o = mine[a.jobId];
      return o && o.status === a.status ? o : seedCandidatePipeline(a, DEMO_T0);
    })
    .toSorted(byNewest);
}

function liveList(apps: Application[], fetched: ApplicationPipeline[], observed: Record<string, Observed>): ApplicationPipeline[] {
  const byJob = new Map(fetched.map((p) => [p.jobId, p]));
  const out: ApplicationPipeline[] = [];
  for (const a of apps) {
    const f = byJob.get(a.jobId);
    byJob.delete(a.jobId);
    const o = observed[a.jobId];
    if (!f) {
      // Applied here and the refetch hasn't landed yet, or the first load is still running: what the
      // store knows (status only), never invented details.
      const at = o?.appliedAt ?? DEMO_T0 - a.minutesAgo * 60_000;
      let p: ApplicationPipeline = { ...newCandidatePipeline(a.jobId, at), id: `pending-${a.jobId}`, status: a.status };
      if (a.status === "cerrada") {
        p = o?.withdrawnAt
          ? withdrawnPipeline({ ...p, status: "enviada" }, o.withdrawnAt)
          : { ...p, closedBy: null, closedAt: null };
      }
      out.push(o ? { ...p, pending: true } : p);
    } else if (a.status === "cerrada" && f.status !== "cerrada" && o?.withdrawnAt) {
      out.push({ ...withdrawnPipeline(f, o.withdrawnAt), pending: true });
    } else out.push(f);
  }
  // On the server but not in the store yet (applied on another device).
  out.push(...byJob.values());
  return out.toSorted(byNewest);
}

// ------------------------------------------------------------------ hooks

/** All my applications as pipelines (newest first). */
export function useMyPipelines(): MyPipelinesResult {
  const hydrated = useHydrated();
  const mode = useApp((s) => s.mode);
  const userId = useApp((s) => s.userId);
  const apps = useApp((s) => s.applications);
  const mine = useDemoPipeline((s) => s.mine);
  const liveState = useLiveMine();
  const observed = useObserved((s) => s.byJob);
  const live = mode === "live";

  useEffect(() => {
    if (!live || !userId) return;
    void loadLive(userId);
    const onFocus = () => {
      if (document.visibilityState === "visible") void loadLive(userId);
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [live, userId]);

  return useMemo((): MyPipelinesResult => {
    if (!hydrated) return { data: [], loading: true, refreshing: false, refresh: refreshMyPipelines };
    if (!live) return { data: demoList(apps, mine), loading: false, refreshing: false, refresh: refreshMyPipelines };
    const mineState = liveState.userId === userId ? liveState : LIVE_IDLE;
    const ready = mineState.status === "ready";
    return {
      data: liveList(apps, ready ? mineState.list : [], observed),
      loading: !ready && mineState.status !== "error",
      error: mineState.error,
      refreshing: mineState.refreshing,
      refresh: refreshMyPipelines,
    };
  }, [hydrated, live, apps, mine, liveState, userId, observed]);
}

/** My application to one vacancy (null if I haven't applied). Shares useMyPipelines' single query. */
export function useMyPipeline(jobId: string | null | undefined): MyPipelineResult {
  const all = useMyPipelines();
  return useMemo(
    () => ({ ...all, data: jobId ? (all.data.find((p) => p.jobId === jobId) ?? null) : null }),
    [all, jobId],
  );
}

/**
 * Withdraw through the store (optimistic, rolls back + toasts on error) and refetch the pipeline
 * once it landed. Same as calling `useApp.getState().withdraw(jobId)` directly; this one just
 * resolves after the refreshed timeline is in.
 */
export async function withdrawApplication(jobId: string): Promise<WriteResult> {
  const r = await useApp.getState().withdraw(jobId);
  if (!r.error) await refreshMyPipelines();
  return r;
}

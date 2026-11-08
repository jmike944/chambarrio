"use client";

import { useCallback } from "react";
import { motion, type MotionStyle } from "motion/react";
import { HugeiconsIcon } from "@hugeicons/react";
import { AlertCircleIcon, RefreshIcon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { rotateTone, type BlockTone } from "@/components/chamba/primitives";
import { springs } from "@/components/chamba/motion";
import { ApplicantCard, ApplicantCardSkeleton, type ApplicantCardProps } from "@/components/empresa/applicant-card";
import { HARD_SM, OUTLINE, WHITE_BUTTON } from "@/components/empresa/workwear";
import { rememberOrder } from "@/components/empresa/applicant-toolbar";
import { applicantHref, personFirst, usePlaceFor } from "@/components/empresa/pipeline/pipeline-kit";
import { PipelineQuickAction } from "@/components/empresa/pipeline/quick-action";
import type { MyJob } from "@/lib/data/catalog";
import type { PipelineSummary } from "@/lib/data/types";
import type { ApplicantProfile } from "@/lib/live/applicant-profiles";
import { useCan } from "@/lib/team";
import { cn } from "@/lib/utils";

/*
 * The grid of applicant cards shared by the vacancy page and /empresa/candidatos: pastel per
 * position (never repeating a neighbour), cards glide to their new spot when the order or the
 * filters change, a skeleton shaped like the cards, and the "only the basics loaded" note.
 */

/** Pastel per position; skips `avoid` (e.g. the vacancy's own block) so the grid never echoes it. */
export function applicantTones(count: number, { avoid, start = 0 }: { avoid?: BlockTone; start?: number } = {}): BlockTone[] {
  const out: BlockTone[] = [];
  let k = start;
  for (let i = 0; i < count; i++) {
    let t = rotateTone(k++);
    if (t === avoid) t = rotateTone(k++);
    out.push(t);
  }
  return out;
}

type CardExtras = Partial<Omit<ApplicantCardProps, "applicant" | "tone" | "index">>;

export function ApplicantGrid({
  applicants,
  label,
  avoidTone,
  toneStart = 0,
  cardProps,
  className,
}: {
  applicants: readonly ApplicantProfile[];
  /** Accessible name of the list ("7 postulantes, más completos primero"). */
  label: string;
  avoidTone?: BlockTone;
  /** Where the pastel rotation starts (to keep neighbours distinct across several grids). */
  toneStart?: number;
  cardProps?: (a: ApplicantProfile, i: number) => CardExtras;
  className?: string;
}) {
  const tones = applicantTones(applicants.length, {
    avoid: avoidTone,
    start: toneStart,
  });
  return (
    // pt/gap-y leave room for the "Perfil completo" stamp that sticks out of each card's top edge.
    <ul aria-label={label} className={cn("grid gap-x-4 gap-y-8 pt-4", className)}>
      {applicants.map((a, i) => (
        <motion.li
          key={a.id}
          layout="position"
          transition={springs.soft}
          className="animate-rise min-w-0"
          style={{ "--i": Math.min(i, 8) } as MotionStyle}
        >
          <ApplicantCard applicant={a} tone={tones[i]} index={i} {...cardProps?.(a, i)} />
        </motion.li>
      ))}
    </ul>
  );
}

/** Loading placeholder for an ApplicantGrid. */
export function ApplicantGridSkeleton({ count = 3, className }: { count?: number; className?: string }) {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className={cn("grid gap-x-4 gap-y-8 pt-4", className)}>
      <span className="sr-only">Cargando postulantes…</span>
      {Array.from({ length: count }, (_, i) => (
        <ApplicantCardSkeleton key={i} />
      ))}
    </div>
  );
}

/** The detailed profiles failed (live): the cards fall back to the basic rows; offer a retry. */
export function ApplicantDetailNote({ onRetry, className }: { onRetry: () => void; className?: string }) {
  return (
    <div
      role="status"
      className={cn(
        "block-durazno flex flex-wrap items-center gap-x-3 gap-y-2 rounded-tile p-3 pl-4",
        OUTLINE,
        HARD_SM,
        className,
      )}
    >
      <HugeiconsIcon icon={AlertCircleIcon} className="size-5 shrink-0" strokeWidth={2.2} />
      <p className="min-w-0 flex-1 text-[0.92rem] leading-snug font-semibold">
        No pudimos cargar los perfiles completos. Por ahora ves lo básico de cada postulante.
      </p>
      <Button size="sm" className={cn("h-10 px-3.5", WHITE_BUTTON)} onClick={onRetry}>
        <HugeiconsIcon icon={RefreshIcon} strokeWidth={2.2} />
        Reintentar
      </Button>
    </div>
  );
}

/**
 * Card extras for the hiring pipeline: the step (from the pipeline summary), the quick next action,
 * and "Ver perfil completo" (which remembers the visible order of that vacancy for prev / next).
 */
export function usePipelineCardProps({
  byId,
  jobs,
  visible,
}: {
  byId: Record<string, PipelineSummary>;
  jobs: readonly MyJob[];
  /** The list as shown (after filters and sort). */
  visible: readonly ApplicantProfile[];
}): (a: ApplicantProfile) => CardExtras {
  const placeFor = usePlaceFor();
  // No quick action on an application I can't work (my own, or out of my branches).
  const { workApplication } = useCan();
  return useCallback(
    (a: ApplicantProfile): CardExtras => {
      const p = byId[a.id];
      const jobId = a.jobId ?? p?.jobId;
      if (!jobId) return {};
      const job = jobs.find((j) => j.id === jobId);
      return {
        pipeline: p ?? null,
        profileHref: applicantHref(jobId, a.id),
        onOpenProfile: () =>
          rememberOrder(
            jobId,
            visible.filter((v) => (v.jobId ?? byId[v.id]?.jobId) === jobId).map((v) => v.id),
          ),
        action:
          p && workApplication({ id: a.id, jobId }) ? (
            <PipelineQuickAction summary={p} first={personFirst(a)} defaultPlace={placeFor(job)} />
          ) : undefined,
      };
    },
    [byId, jobs, visible, placeFor, workApplication],
  );
}

/** "más completos primero" etc., for list labels. */
export const SORT_PHRASE = {
  completos: "más completos primero",
  cercanos: "más cercanos primero",
  recientes: "más recientes primero",
  etapa: "por etapa, nuevos primero",
} as const;

"use client";

import { useMemo } from "react";
import type { IconSvgElement } from "@hugeicons/react";
import {
  Calendar03Icon,
  CancelCircleIcon,
  CheckmarkBadge01Icon,
  Logout03Icon,
  SparklesIcon,
  ViewIcon,
} from "@hugeicons/core-free-icons";
import { useMyCompany, type MyJob } from "@/lib/data/catalog";
import type { ApplicationStatus, Branch, PipelineActor, PipelineSummary } from "@/lib/data/types";
import type { ApplicantProfile } from "@/lib/live/applicant-profiles";
import {
  STEP_META,
  defaultInterviewPlace,
  fmtDayTime,
  fmtRelative,
  isPast,
  stepOf,
  type PipelineStep,
} from "@/lib/pipeline";
import { useEmployerLocations } from "@/lib/store";
import { branchIdOf } from "@/app/empresa/sucursales/branch-kit";
import { cn } from "@/lib/utils";

/*
 * Small shared pieces of the recruiter's pipeline UI (applicant cards, the applicant page, the
 * dashboards): step chips, the per-card "what's next" line, person labels, the interview place
 * default of a vacancy and the applicant page URL. Everything reads the pipeline layer
 * (@/lib/pipeline); nothing here writes.
 */

/** URL of the full applicant page. */
export const applicantHref = (jobId: string, applicationId: string) => `/empresa/vacantes/${jobId}/postulantes/${applicationId}`;

/** Dot / accent color of each step (pastel block colors read on ink and on white). */
export const STEP_COLOR: Record<PipelineStep, string> = {
  enviada: "var(--block-sol)",
  vista: "var(--block-cielo)",
  entrevista: "var(--block-limon)",
  contratada: "var(--block-menta)",
  descartada: "var(--block-lila)",
  retirada: "var(--block-durazno)",
};

export const STEP_ICON: Record<PipelineStep, IconSvgElement> = {
  enviada: SparklesIcon,
  vista: ViewIcon,
  entrevista: Calendar03Icon,
  contratada: CheckmarkBadge01Icon,
  descartada: CancelCircleIcon,
  retirada: Logout03Icon,
};

/** Plural labels for the list filters ("Nuevos", "Vistos"…). */
export const STEP_FILTER_LABEL: Record<PipelineStep, string> = {
  enviada: "Nuevos",
  vista: "Vistos",
  entrevista: "Entrevista",
  contratada: "Contratados",
  descartada: "Descartados",
  retirada: "Se retiraron",
};

/** Ink pill with the step's colored dot ("● Nueva"). Readable on every block and in dark mode. */
export function StepChip({
  step,
  size = "md",
  pending,
  className,
}: {
  step: PipelineStep;
  size?: "sm" | "md" | "lg";
  /** Optimistic change not confirmed yet. */
  pending?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border-2 border-ink bg-ink font-bold whitespace-nowrap text-white",
        size === "sm" ? "h-7 px-2 text-[0.8rem]" : size === "lg" ? "h-10 px-3.5 text-[1rem]" : "h-8 px-2.5 text-[0.85rem]",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn("shrink-0 rounded-full", size === "lg" ? "size-3" : "size-2.5", pending && "animate-pulse")}
        style={{ background: STEP_COLOR[step] }}
      />
      {STEP_META[step].recruiterLabel}
      {pending ? <span className="sr-only"> (guardando)</span> : null}
    </span>
  );
}

/** "Jorge Ramírez" while unlocked, else "Postulante · Saltillo 2000" (the dot never starts a line). */
export function personLabel(a: Pick<ApplicantProfile, "unlocked" | "name" | "colonia"> | null | undefined, fallback = "Postulante"): string {
  if (a?.unlocked && a.name) return a.name;
  return a?.colonia ? `Postulante · ${a.colonia}` : fallback;
}

/** First name while unlocked, else "esta persona". */
export function personFirst(a: Pick<ApplicantProfile, "unlocked" | "name"> | null | undefined): string {
  return a?.unlocked && a.name ? a.name.split(" ")[0] : "esta persona";
}

type SummaryLike = Pick<PipelineSummary, "status" | "closedBy" | "interviewAt" | "hiredAt" | "closedAt" | "seenAt" | "appliedAt">;

/** The step of a summary, or of a bare status (no closedBy → Descartada). */
export function stepFor(p: { status: ApplicationStatus; closedBy?: PipelineActor | null } | null | undefined): PipelineStep | null {
  return p ? stepOf(p) : null;
}

/**
 * "hace 5 min" for something that already happened. The ticking clock can lag a just-saved item by
 * up to a minute; clamp so it reads "justo ahora" instead of "en un momento".
 */
export function ago(t: string, now: number): string {
  return fmtRelative(t, { now: Math.max(now, Date.parse(t) || 0) });
}

/** Interview time is over (with 1 h of grace, the length of a typical interview). */
export function interviewDone(p: Pick<SummaryLike, "interviewAt">, now: number): boolean {
  return !!p.interviewAt && !!now && isPast(p.interviewAt, { now, graceMs: 60 * 60_000 });
}

/**
 * One line for a card / row: when the interview is, when they were hired… Null when the step
 * itself is the message ("Nueva", "Vista": the card shows a button instead).
 */
export function stepLine(p: SummaryLike, now: number): string | null {
  const step = stepOf(p);
  const rel = (t: string | null) => (t && now ? ago(t, now) : "");
  switch (step) {
    case "entrevista":
      if (!p.interviewAt) return "Entrevista sin fecha: agenda el día y la hora";
      if (!now) return "Entrevista agendada";
      return interviewDone(p, now)
        ? `La entrevista fue ${rel(p.interviewAt)}. ¿Cómo le fue?`
        : `Entrevista ${fmtDayTime(p.interviewAt, { now })}`;
    case "contratada":
      return p.hiredAt ? `Contratada ${rel(p.hiredAt)}` : "Contratada";
    case "descartada":
      return p.closedAt ? `Descartada ${rel(p.closedAt)}` : "Descartada";
    case "retirada":
      return p.closedAt ? `Se retiró ${rel(p.closedAt)}` : "Se retiró";
    default:
      return null;
  }
}

/** (vacancy) → its prefilled interview place ("Logística Zapalinamé · CEDIS Santa Mónica · …"). */
export function usePlaceFor(): (job: Pick<MyJob, "branchId"> | null | undefined) => string {
  const locations = useEmployerLocations();
  const companyName = useMyCompany().company?.name ?? null;
  return useMemo(
    () => (job) => {
      const id = job ? branchIdOf(job, locations) : undefined;
      const branch = id ? locations.find((l) => l.id === id) : undefined;
      return branch ? defaultInterviewPlace(branch, companyName) : "";
    },
    [locations, companyName],
  );
}

/** The branch of a vacancy, the company name and the prefilled interview place. */
export function useJobPlace(job: Pick<MyJob, "branchId"> | null | undefined): {
  branch: Branch | undefined;
  companyName: string | null;
  defaultPlace: string;
} {
  const locations = useEmployerLocations();
  const companyName = useMyCompany().company?.name ?? null;
  return useMemo(() => {
    const branch = job ? locations.find((l) => l.id === branchIdOf(job, locations)) : undefined;
    return { branch, companyName, defaultPlace: branch ? defaultInterviewPlace(branch, companyName) : "" };
  }, [job, locations, companyName]);
}

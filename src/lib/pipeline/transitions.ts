/*
 * The company-side state machine, mirroring the database guard trigger
 * (supabase/migrations/20261107233000_hiring_pipeline.sql), so demo mode behaves like live and live
 * can show the result optimistically. Pure.
 */
import type { ApplicationPipeline, ApplicationStatus, PipelineEvent, PipelineSummary } from "@/lib/data/types";
import type { Database } from "@/lib/supabase/database.types";
import { DEFAULT_DECLINE_MESSAGE, DEFAULT_UNHIRE_MESSAGE, PIPELINE_LIMITS } from "./steps";

/** What the company can do. `message` = companyMessage shown to the candidate (and in the email). */
export type InterviewInput = {
  /** ISO instant (use fromZonedInput(date, time) from a picker). */
  at: string;
  /** Null/empty → the candidate sees the vacancy's branch. */
  place?: string | null;
  /** What to bring / who to ask for. */
  note?: string | null;
  /** Optional extra message. On a reschedule, leave undefined to keep the current one. */
  message?: string | null;
};

export type PipelineChange =
  | { kind: "seen" }
  | ({ kind: "interview" } & InterviewInput)
  | { kind: "hire"; message?: string | null }
  | { kind: "decline"; message?: string | null }
  | { kind: "reopen" };

/** Columns the company writes; the trigger stamps seen_at / hired_at / closed_* and logs the event. */
export type ApplicationPatch = Pick<
  Database["public"]["Tables"]["applications"]["Update"],
  "status" | "interview_at" | "interview_place" | "interview_note" | "company_message"
>;

export type TransitionResult =
  | { next: ApplicationPipeline; patch: ApplicationPatch | null; statusChanged: boolean; error?: undefined }
  | { error: string; next?: undefined; patch?: undefined; statusChanged?: undefined };

export const PIPELINE_MSG = {
  withdrawn: "Esta persona retiró su postulación. Ya no puedes cambiarla.",
  notFound: "No encontramos esa postulación.",
  interviewWhen: "Elige el día y la hora de la entrevista.",
  interviewPast: "Esa hora ya pasó. Elige otra.",
  interviewFar: "Elige una fecha dentro de los próximos 6 meses.",
  place: `El lugar puede tener hasta ${PIPELINE_LIMITS.place} letras.`,
  note: `Las indicaciones pueden tener hasta ${PIPELINE_LIMITS.note} letras.`,
  message: `El mensaje puede tener hasta ${PIPELINE_LIMITS.message} letras.`,
  noteEmpty: "Escribe la nota.",
  noteLong: "La nota puede tener hasta 1,000 letras.",
} as const;

const clean = (s: string | null | undefined) => s?.trim() || null;

/** Inline validation for the interview form (same checks the action runs). Null when OK. */
export function validateInterview(input: InterviewInput, now = Date.now()): string | null {
  const at = Date.parse(input.at);
  if (!Number.isFinite(at)) return PIPELINE_MSG.interviewWhen;
  if (at < now - 5 * 60_000) return PIPELINE_MSG.interviewPast;
  if (at > now + 183 * 24 * 3_600_000) return PIPELINE_MSG.interviewFar;
  if ((clean(input.place)?.length ?? 0) > PIPELINE_LIMITS.place) return PIPELINE_MSG.place;
  if ((clean(input.note)?.length ?? 0) > PIPELINE_LIMITS.note) return PIPELINE_MSG.note;
  if ((clean(input.message)?.length ?? 0) > PIPELINE_LIMITS.message) return PIPELINE_MSG.message;
  return null;
}

/** Inline validation for a message (hire / decline). Null when OK. */
export function validateMessage(message: string | null | undefined): string | null {
  return (clean(message)?.length ?? 0) > PIPELINE_LIMITS.message ? PIPELINE_MSG.message : null;
}

/** Inline validation for a recruiter note. Null when OK. */
export function validateNote(body: string): string | null {
  const v = body.trim();
  if (!v) return PIPELINE_MSG.noteEmpty;
  if (v.length > PIPELINE_LIMITS.noteBody) return PIPELINE_MSG.noteLong;
  return null;
}

/** The status a declined application goes back to on "reopen": the last one before closing. */
function reopenTarget(p: ApplicationPipeline): ApplicationStatus {
  const before = p.events.filter((e) => e.status !== "cerrada").at(-1)?.status;
  if (before === "entrevista" && !p.interview) return "vista";
  if (!before || before === "enviada") return "vista";
  return before;
}

/**
 * Applies a company change to the current pipeline. `patch: null` = nothing to do (already there).
 * Errors are Spanish and user-facing.
 */
export function transition(current: ApplicationPipeline, change: PipelineChange, now = Date.now()): TransitionResult {
  const at = new Date(now).toISOString();
  const withdrawn = current.status === "cerrada" && current.closedBy === "candidato";
  if (withdrawn) return change.kind === "seen" ? { next: current, patch: null, statusChanged: false } : { error: PIPELINE_MSG.withdrawn };

  const event = (status: ApplicationStatus, interviewAt?: string | null): PipelineEvent =>
    interviewAt === undefined ? { status, actor: "empresa", at } : { status, actor: "empresa", at, interviewAt };
  // What the guard does to the stamps for any company status change.
  const stamps = (status: ApplicationStatus): Partial<ApplicationPipeline> => ({
    seenAt: status !== "enviada" ? (current.seenAt ?? at) : current.seenAt,
    hiredAt: status === "contratada" ? (current.status === "contratada" ? current.hiredAt : at) : current.status === "contratada" ? null : current.hiredAt,
    closedBy: status === "cerrada" ? (current.status === "cerrada" ? current.closedBy : "empresa") : null,
    closedAt: status === "cerrada" ? (current.status === "cerrada" ? current.closedAt : at) : null,
  });

  switch (change.kind) {
    case "seen": {
      if (current.status !== "enviada") return { next: current, patch: null, statusChanged: false };
      return {
        next: { ...current, status: "vista", ...stamps("vista"), events: [...current.events, event("vista")] },
        patch: { status: "vista" },
        statusChanged: true,
      };
    }

    case "interview": {
      const invalid = validateInterview(change, now);
      if (invalid) return { error: invalid };
      const iso = new Date(Date.parse(change.at)).toISOString();
      const place = clean(change.place);
      const note = clean(change.note);
      const statusChanged = current.status !== "entrevista";
      const timeChanged = current.interview?.at ? Date.parse(current.interview.at) !== Date.parse(iso) : true;
      // A reschedule keeps the current message unless a new one is given; a new interview replaces it.
      const message = change.message === undefined && !statusChanged ? current.companyMessage : clean(change.message);
      if (!statusChanged && !timeChanged && place === current.interview?.place && note === current.interview?.note && message === current.companyMessage) {
        return { next: current, patch: null, statusChanged: false };
      }
      const patch: ApplicationPatch = { status: "entrevista", interview_at: iso, interview_place: place, interview_note: note };
      if (message !== current.companyMessage) patch.company_message = message;
      return {
        next: {
          ...current,
          status: "entrevista",
          ...stamps("entrevista"),
          interview: { at: iso, place, note },
          companyMessage: message,
          events: statusChanged || timeChanged ? [...current.events, event("entrevista", iso)] : current.events,
        },
        patch,
        statusChanged,
      };
    }

    case "hire": {
      const invalid = validateMessage(change.message);
      if (invalid) return { error: invalid };
      const message = clean(change.message);
      if (current.status === "contratada") {
        if (change.message === undefined || message === current.companyMessage) return { next: current, patch: null, statusChanged: false };
        return { next: { ...current, companyMessage: message }, patch: { company_message: message }, statusChanged: false };
      }
      return {
        next: { ...current, status: "contratada", ...stamps("contratada"), companyMessage: message, events: [...current.events, event("contratada")] },
        patch: { status: "contratada", company_message: message },
        statusChanged: true,
      };
    }

    case "decline": {
      const invalid = validateMessage(change.message);
      if (invalid) return { error: invalid };
      const message = clean(change.message) ?? (current.status === "contratada" ? DEFAULT_UNHIRE_MESSAGE : DEFAULT_DECLINE_MESSAGE);
      if (current.status === "cerrada") {
        if (change.message === undefined || message === current.companyMessage) return { next: current, patch: null, statusChanged: false };
        return { next: { ...current, companyMessage: message }, patch: { company_message: message }, statusChanged: false };
      }
      return {
        next: { ...current, status: "cerrada", ...stamps("cerrada"), companyMessage: message, events: [...current.events, event("cerrada")] },
        patch: { status: "cerrada", company_message: message },
        statusChanged: true,
      };
    }

    case "reopen": {
      if (current.status !== "cerrada") return { next: current, patch: null, statusChanged: false };
      const target = reopenTarget(current);
      return {
        next: {
          ...current,
          status: target,
          ...stamps(target),
          companyMessage: null,
          events: [...current.events, event(target, target === "entrevista" ? (current.interview?.at ?? null) : undefined)],
        },
        patch: { status: target, company_message: null },
        statusChanged: true,
      };
    }
  }
}

/** The list row of a pipeline. */
export function toSummary(p: ApplicationPipeline): PipelineSummary {
  return {
    id: p.id,
    jobId: p.jobId,
    status: p.status,
    appliedAt: p.appliedAt,
    seenAt: p.seenAt,
    hiredAt: p.hiredAt,
    closedBy: p.closedBy,
    closedAt: p.closedAt,
    interviewAt: p.interview?.at ?? null,
    interviewPlace: p.interview?.place ?? null,
    ...(p.pending ? { pending: true } : {}),
  };
}

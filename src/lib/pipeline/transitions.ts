/*
 * The company-side state machine, mirroring the database guard trigger
 * (supabase/migrations/20261107223917_hiring_pipeline.sql), so demo mode behaves like live and live
 * can show the result optimistically. Pure.
 */
import type { ApplicationPipeline, ApplicationStatus, PipelineEvent, PipelineSummary } from "@/lib/data/types";
import type { Database } from "@/lib/supabase/database.types";
import { DECLINE_UNDO_MS, DEFAULT_DECLINE_MESSAGE, DEFAULT_UNHIRE_MESSAGE, PIPELINE_LIMITS } from "./steps";

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
  stale: "Esta postulación cambió hace un momento. Ya la actualizamos: revísala antes de seguir.",
} as const;

const clean = (s: string | null | undefined) => s?.trim() || null;

/**
 * Inline validation for the interview form (same checks the action runs). Null when OK.
 * `keepAt`: the interview's current time; keeping it (fixing only the place or the instructions)
 * never fails as "Esa hora ya pasó".
 */
export function validateInterview(input: InterviewInput, now = Date.now(), keepAt?: string | null): string | null {
  const at = Date.parse(input.at);
  if (!Number.isFinite(at)) return PIPELINE_MSG.interviewWhen;
  const kept = !!keepAt && Date.parse(keepAt) === at;
  if (!kept && at < now - 5 * 60_000) return PIPELINE_MSG.interviewPast;
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

/** The message the application had before the decline (its event keeps it, when known). */
const messageBeforeClose = (p: ApplicationPipeline) => p.events.filter((e) => e.status !== "cerrada").at(-1)?.message ?? null;

/** A company decline still undoable without a trace (the server also checks its email didn't start going out). */
export function declineUndoable(p: Pick<ApplicationPipeline, "status" | "closedBy" | "closedAt">, now = Date.now()): boolean {
  if (p.status !== "cerrada" || p.closedBy !== "empresa" || !p.closedAt) return false;
  return now - Date.parse(p.closedAt) < DECLINE_UNDO_MS;
}

/** Sets the message on the latest event with this status (a message edited in place). */
function withLastMessage(events: PipelineEvent[], status: ApplicationStatus, message: string | null): PipelineEvent[] {
  const i = events.findLastIndex((e) => e.status === status);
  return i === -1 ? events : events.map((e, k) => (k === i ? { ...e, message } : e));
}

/**
 * Applies a company change to the current pipeline. `patch: null` = nothing to do (already there).
 * Errors are Spanish and user-facing.
 */
export function transition(current: ApplicationPipeline, change: PipelineChange, now = Date.now()): TransitionResult {
  const at = new Date(now).toISOString();
  const withdrawn = current.status === "cerrada" && current.closedBy === "candidato";
  if (withdrawn) return change.kind === "seen" ? { next: current, patch: null, statusChanged: false } : { error: PIPELINE_MSG.withdrawn };

  const event = (
    status: ApplicationStatus,
    interviewAt?: string | null,
    extra: Pick<PipelineEvent, "change" | "message"> = {},
  ): PipelineEvent => {
    const e: PipelineEvent = interviewAt === undefined ? { status, actor: "empresa", at } : { status, actor: "empresa", at, interviewAt };
    if (extra.change) e.change = extra.change;
    if (extra.message) e.message = extra.message;
    return e;
  };
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
      const statusChanged = current.status !== "entrevista";
      const invalid = validateInterview(change, now, statusChanged ? null : current.interview?.at);
      if (invalid) return { error: invalid };
      const iso = new Date(Date.parse(change.at)).toISOString();
      const place = clean(change.place);
      const note = clean(change.note);
      const timeChanged = current.interview?.at ? Date.parse(current.interview.at) !== Date.parse(iso) : true;
      // A reschedule keeps the current message unless a new one is given; a new interview replaces it.
      const message = change.message === undefined && !statusChanged ? current.companyMessage : clean(change.message);
      const placeChanged = place !== (current.interview?.place ?? null);
      const notesChanged = note !== (current.interview?.note ?? null) || message !== current.companyMessage;
      if (!statusChanged && !timeChanged && !placeChanged && !notesChanged) {
        return { next: current, patch: null, statusChanged: false };
      }
      const patch: ApplicationPatch = { status: "entrevista", interview_at: iso, interview_place: place, interview_note: note };
      if (message !== current.companyMessage) patch.company_message = message;
      // Like the server: every change the candidate should know about is its own event (and email).
      const kind = statusChanged ? null : timeChanged ? "hora" : placeChanged ? "lugar" : "indicaciones";
      return {
        next: {
          ...current,
          status: "entrevista",
          ...stamps("entrevista"),
          interview: { at: iso, place, note },
          companyMessage: message,
          events: [...current.events, event("entrevista", iso, { change: kind, message })],
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
        // A message after the hire reaches the candidate (event + email); clearing it doesn't.
        const events = message ? [...current.events, event("contratada", undefined, { change: "mensaje", message })] : current.events;
        return { next: { ...current, companyMessage: message, events }, patch: { company_message: message }, statusChanged: false };
      }
      return {
        next: {
          ...current,
          status: "contratada",
          ...stamps("contratada"),
          companyMessage: message,
          events: [...current.events, event("contratada", undefined, { message })],
        },
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
        return {
          next: { ...current, companyMessage: message, events: withLastMessage(current.events, "cerrada", message) },
          patch: { company_message: message },
          statusChanged: false,
        };
      }
      return {
        next: {
          ...current,
          status: "cerrada",
          ...stamps("cerrada"),
          companyMessage: message,
          events: [...current.events, event("cerrada", undefined, { message })],
        },
        patch: { status: "cerrada", company_message: message },
        statusChanged: true,
      };
    }

    case "reopen": {
      if (current.status !== "cerrada") return { next: current, patch: null, statusChanged: false };
      const target = reopenTarget(current);
      const message = messageBeforeClose(current);
      // "Deshacer" right away: the decline is erased (its email never went out). Later: a reopen
      // the candidate is told about ("retomó tu postulación").
      const lastClose = current.events.findLastIndex((e) => e.status === "cerrada");
      const events = declineUndoable(current, now)
        ? current.events.filter((_, i) => i !== lastClose)
        : [...current.events, event(target, target === "entrevista" ? (current.interview?.at ?? null) : undefined, { change: "reabierta", message })];
      return {
        next: { ...current, status: target, ...stamps(target), companyMessage: message, events },
        patch: { status: target, company_message: message },
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

"use client";

/*
 * Pipeline reads/writes against Supabase (live mode only; never imported for its side effects, never
 * called in demo). No store access here: every function returns { data } | { error } with a Spanish,
 * user-facing message and never throws. The hooks in ./candidate and ./recruiter call these.
 */
import { getSupabase } from "@/lib/supabase/client";
import type { Tables } from "@/lib/supabase/database.types";
import type { ApplicationPipeline, PipelineActor, PipelineEvent, PipelineSummary, RecruiterNote } from "@/lib/data/types";
import { friendlyError, MSG, type Result, type WriteResult } from "@/lib/live/backend";
import { PIPELINE_MSG, type ApplicationPatch } from "./transitions";

type AppRow = Pick<
  Tables<"applications">,
  | "id"
  | "job_id"
  | "status"
  | "created_at"
  | "seen_at"
  | "interview_at"
  | "interview_place"
  | "interview_note"
  | "company_message"
  | "hired_at"
  | "closed_by"
  | "closed_at"
>;
type EventRow = Pick<Tables<"application_events">, "id" | "status" | "actor" | "interview_at" | "created_at">;
type DbError = { message?: string; code?: string; details?: string | null; hint?: string | null } | null | undefined;

const APP_COLS =
  "id, job_id, status, created_at, seen_at, interview_at, interview_place, interview_note, company_message, hired_at, closed_by, closed_at";
const EVENT_COLS = "id, status, actor, interview_at, created_at";
const SUMMARY_COLS = "id, job_id, status, created_at, seen_at, interview_at, interview_place, hired_at, closed_by, closed_at";

// ------------------------------------------------------------------ errors

/** Pipeline-specific errors (guard trigger, checks, RLS) → friendly Spanish; else the shared mapping. */
export function pipelineError(e: DbError, fallback: string = MSG.save): string {
  if (!e) return fallback;
  const m = `${e.message ?? ""} ${e.details ?? ""}`.toLowerCase();
  if (m.includes("retiró su postulación") || m.includes("retiro su postulacion")) return PIPELINE_MSG.withdrawn;
  if (m.includes("solo la empresa puede cambiar")) return "Solo la empresa puede cambiar el estado de la postulación.";
  if (e.code === "23514") {
    if (m.includes("interview_place")) return PIPELINE_MSG.place;
    if (m.includes("interview_note")) return PIPELINE_MSG.note;
    if (m.includes("company_message")) return PIPELINE_MSG.message;
    if (m.includes("body")) return PIPELINE_MSG.noteLong;
  }
  if (e.code === "22007" || e.code === "22008") return PIPELINE_MSG.interviewWhen;
  return friendlyError(e, fallback);
}

/** The pipeline columns/table aren't in the API schema (migration not applied / stale cache). */
const isSchemaMiss = (e: DbError) =>
  !!e && (e.code === "PGRST200" || e.code === "PGRST204" || e.code === "42703" || e.code === "42P01" || /schema cache|does not exist/i.test(e.message ?? ""));

// ------------------------------------------------------------------ mapping

const asActor = (v: string | null | undefined): PipelineActor | null => (v === "empresa" || v === "candidato" ? v : null);

/** A timeline from the row's stamps, for rows without logged events (older rows, schema fallback). */
function synthesizeEvents(r: AppRow): PipelineEvent[] {
  const out: PipelineEvent[] = [{ status: "enviada", actor: "candidato", at: r.created_at }];
  if (r.seen_at) out.push({ status: "vista", actor: "empresa", at: r.seen_at });
  if (r.interview_at && (r.status === "entrevista" || r.hired_at || r.closed_at)) {
    // When it was scheduled isn't stored on the row; place it right after it was seen.
    out.push({ status: "entrevista", actor: "empresa", at: r.seen_at ?? r.created_at, interviewAt: r.interview_at });
  }
  if (r.hired_at) out.push({ status: "contratada", actor: "empresa", at: r.hired_at });
  if (r.status === "cerrada" && r.closed_at) out.push({ status: "cerrada", actor: asActor(r.closed_by) ?? "empresa", at: r.closed_at });
  return out.toSorted((a, b) => Date.parse(a.at) - Date.parse(b.at));
}

function toEvents(rows: EventRow[] | null | undefined, r: AppRow): PipelineEvent[] {
  if (!rows?.length) return synthesizeEvents(r);
  return rows
    .toSorted((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at) || a.id - b.id)
    .map((e): PipelineEvent => {
      const base = { status: e.status, actor: asActor(e.actor) ?? "empresa", at: e.created_at };
      return e.status === "entrevista" ? { ...base, interviewAt: e.interview_at } : base;
    });
}

export function rowToPipeline(r: AppRow, events?: EventRow[] | null): ApplicationPipeline {
  return {
    id: r.id,
    jobId: r.job_id,
    status: r.status,
    appliedAt: r.created_at,
    seenAt: r.seen_at,
    interview: r.interview_at ? { at: r.interview_at, place: r.interview_place, note: r.interview_note } : null,
    companyMessage: r.company_message,
    hiredAt: r.hired_at,
    closedBy: r.status === "cerrada" ? (asActor(r.closed_by) ?? "empresa") : null,
    closedAt: r.status === "cerrada" ? r.closed_at : null,
    events: toEvents(events, r),
  };
}

function rowToSummary(r: Omit<AppRow, "interview_note" | "company_message">): PipelineSummary {
  return {
    id: r.id,
    jobId: r.job_id,
    status: r.status,
    appliedAt: r.created_at,
    seenAt: r.seen_at,
    hiredAt: r.hired_at,
    closedBy: r.status === "cerrada" ? (asActor(r.closed_by) ?? "empresa") : null,
    closedAt: r.status === "cerrada" ? r.closed_at : null,
    interviewAt: r.interview_at,
    interviewPlace: r.interview_place,
  };
}

/** A row without the pipeline columns (schema fallback). */
const basicRow = (r: { id: string; job_id: string; status: AppRow["status"]; created_at: string }): AppRow => ({
  ...r,
  seen_at: null,
  interview_at: null,
  interview_place: null,
  interview_note: null,
  company_message: null,
  hired_at: null,
  closed_by: null,
  closed_at: null,
});

// ------------------------------------------------------------------ reads

/** All my applications (candidate) with their timelines. One request. Newest first. */
export async function fetchMyPipelines(userId: string): Promise<Result<ApplicationPipeline[]>> {
  const sb = getSupabase();
  if (!sb) return { error: MSG.unavailable };
  try {
    const { data, error } = await sb
      .from("applications")
      .select(`${APP_COLS}, application_events(${EVENT_COLS})`)
      .eq("candidate_id", userId)
      .order("created_at", { ascending: false });
    if (!error) return { data: (data ?? []).map((r) => rowToPipeline(r, r.application_events)) };
    if (!isSchemaMiss(error)) return { error: pipelineError(error, MSG.load) };
    // Older schema: statuses only, timeline made up from what's there.
    const plain = await sb.from("applications").select("id, job_id, status, created_at").eq("candidate_id", userId).order("created_at", { ascending: false });
    if (plain.error) return { error: pipelineError(plain.error, MSG.load) };
    return { data: (plain.data ?? []).map((r) => rowToPipeline(basicRow(r))) };
  } catch (e) {
    return { error: pipelineError(e as DbError, MSG.load) };
  }
}

/** One application with its timeline (company or candidate, whatever RLS allows). Null = not found / not mine. */
export async function fetchPipeline(applicationId: string): Promise<Result<ApplicationPipeline | null>> {
  const sb = getSupabase();
  if (!sb) return { error: MSG.unavailable };
  if (!UUID.test(applicationId)) return { data: null };
  try {
    const { data, error } = await sb
      .from("applications")
      .select(`${APP_COLS}, application_events(${EVENT_COLS})`)
      .eq("id", applicationId)
      .maybeSingle();
    if (error) return { error: pipelineError(error, MSG.load) };
    return { data: data ? rowToPipeline(data, data.application_events) : null };
  } catch (e) {
    return { error: pipelineError(e as DbError, MSG.load) };
  }
}

/** Light rows of every application to these vacancies (company). One request. Newest first. */
export async function fetchSummaries(jobIds: string[]): Promise<Result<PipelineSummary[]>> {
  const sb = getSupabase();
  if (!sb) return { error: MSG.unavailable };
  if (jobIds.length === 0) return { data: [] };
  try {
    const { data, error } = await sb.from("applications").select(SUMMARY_COLS).in("job_id", jobIds).order("created_at", { ascending: false });
    if (error) return { error: pipelineError(error, MSG.load) };
    return { data: (data ?? []).map(rowToSummary) };
  } catch (e) {
    return { error: pipelineError(e as DbError, MSG.load) };
  }
}

/** Private notes on an application (company). Newest first. */
export async function fetchNotes(applicationId: string, myId: string | null): Promise<Result<RecruiterNote[]>> {
  const sb = getSupabase();
  if (!sb) return { error: MSG.unavailable };
  if (!UUID.test(applicationId)) return { data: [] };
  try {
    const { data, error } = await sb
      .from("application_notes")
      .select("id, body, created_at, author_id")
      .eq("application_id", applicationId)
      .order("created_at", { ascending: false });
    if (error) return { error: pipelineError(error, MSG.load) };
    return { data: (data ?? []).map((n) => ({ id: n.id, body: n.body, at: n.created_at, mine: !!myId && n.author_id === myId })) };
  } catch (e) {
    return { error: pipelineError(e as DbError, MSG.load) };
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ------------------------------------------------------------------ writes

/** Company update of an application. The guard trigger stamps the times and checks who may do what. */
export async function updateApplication(applicationId: string, patch: ApplicationPatch): Promise<WriteResult> {
  const sb = getSupabase();
  if (!sb) return { error: MSG.unavailable };
  try {
    const { data, error } = await sb.from("applications").update(patch).eq("id", applicationId).select("id");
    if (error) return { error: pipelineError(error) };
    return data?.length ? {} : { error: PIPELINE_MSG.notFound };
  } catch (e) {
    return { error: pipelineError(e as DbError) };
  }
}

/** `restore`: put back a note deleted a moment ago (same id and time, so it lands where it was). */
export async function insertNote(
  applicationId: string,
  body: string,
  restore?: { id: string; at: string },
): Promise<Result<RecruiterNote>> {
  const sb = getSupabase();
  if (!sb) return { error: MSG.unavailable };
  try {
    const { data, error } = await sb
      .from("application_notes")
      .insert({ application_id: applicationId, body, ...(restore ? { id: restore.id, created_at: restore.at } : {}) })
      .select("id, body, created_at")
      .single();
    if (error) {
      if (error.code === "42501" || /row-level security/i.test(error.message)) return { error: "Solo la empresa de esta vacante puede escribir notas." };
      if (error.code === "23503") return { error: PIPELINE_MSG.notFound };
      return { error: pipelineError(error) };
    }
    return { data: { id: data.id, body: data.body, at: data.created_at, mine: true } };
  } catch (e) {
    return { error: pipelineError(e as DbError) };
  }
}

export async function deleteNote(noteId: string): Promise<WriteResult> {
  const sb = getSupabase();
  if (!sb) return { error: MSG.unavailable };
  try {
    const { data, error } = await sb.from("application_notes").delete().eq("id", noteId).select("id");
    if (error) return { error: pipelineError(error, "No pudimos borrar la nota. Intenta de nuevo.") };
    return data?.length ? {} : { error: "Solo puedes borrar tus propias notas." };
  } catch (e) {
    return { error: pipelineError(e as DbError, "No pudimos borrar la nota. Intenta de nuevo.") };
  }
}

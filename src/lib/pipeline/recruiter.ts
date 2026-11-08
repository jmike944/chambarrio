"use client";

/*
 * The company's side of the pipeline (the whole team's). Both modes, one shape:
 *  - live: public.applications (+ application_events, application_notes) under RLS. Actions update
 *    the row; the guard trigger stamps seen/hired/closed, logs the timeline and queues the candidate's
 *    email. Optimistic everywhere (detail + lists), rolled back + toast.error on failure. Who did each
 *    company step comes from application_event_actors() (never a column of the events select).
 *  - demo: ./demo-store seeded from the 16 mock applicants (every step represented), fully
 *    interactive, same rules (./transitions mirrors the trigger). Steps and notes are attributed to the
 *    demo team member the demo is acting as ("Ver como"). Never touches Supabase.
 * A member never works their own application (they applied to their own company): no notes, no moves.
 *
 * Actions never throw; they resolve { error?: string } and have already toasted the error.
 */
import { useEffect, useMemo } from "react";
import { create } from "zustand";
import { toast } from "sonner";
import { APPLICANTS } from "@/lib/data/applicants";
import { useMyCompany, type MyJob } from "@/lib/data/catalog";
import { JOB_BY_ID } from "@/lib/data/jobs";
import type { ApplicationPipeline, ApplicationStatus, PipelineEvent, PipelineSummary, RecruiterNote, TeamActor } from "@/lib/data/types";
import { onLive } from "@/lib/live/events";
import { getStoredMembership, isOwnApplication, scopeOf, useApp, useHydrated, useOwnApplicationIds, useStoredMembership, type WriteResult } from "@/lib/store";
import { fetchEventActors, useTeamPeople } from "@/lib/team/hooks";
import { DEMO_OWNER_ID, meId, useDemoTeam } from "@/lib/team/demo";
import { canSeeBranch } from "@/lib/team/permissions";
import { demoRecruiterNotes, demoRecruiterPipeline, patchDemo, useDemoPipeline } from "./demo-store";
import { deleteNote as deleteNoteLive, fetchNotes, fetchPipeline, fetchSummaries, insertNote, updateApplication } from "./live";
import { stepOf, type PipelineStep } from "./steps";
import { PIPELINE_MSG, toSummary, transition, validateNote, type InterviewInput, type PipelineChange } from "./transitions";

const STALE_MS = 30_000;

// ------------------------------------------------------------------ live caches

type AppEntry = {
  status: "loading" | "ready" | "error";
  /** Null + ready = not found / not one of my vacancies. */
  data: ApplicationPipeline | null;
  /** Event id → the member who made that company step (application_event_actors). */
  actors?: Record<number, string>;
  notes: RecruiterNote[];
  notesError?: string;
  error?: string;
  fetchedAt: number;
  refreshing: boolean;
};
type ListEntry = { status: "loading" | "ready" | "error"; list: PipelineSummary[]; error?: string; fetchedAt: number; refreshing: boolean };
type LiveCache = { apps: Record<string, AppEntry>; lists: Record<string, ListEntry> };

const useLiveCache = create<LiveCache>()(() => ({ apps: {}, lists: {} }));
const cache = () => useLiveCache.getState();
const setApp = (id: string, e: AppEntry) => useLiveCache.setState((s) => ({ apps: { ...s.apps, [id]: e } }));
const setList = (key: string, e: ListEntry) => useLiveCache.setState((s) => ({ lists: { ...s.lists, [key]: e } }));

let resetSeq = 0;
/** Per application / global: bumped on every write so answers that started before it are dropped. */
const appMut = new Map<string, number>();
let listMut = 0;
const appToken = new Map<string, number>();
const listToken = new Map<string, number>();
const appFlights = new Map<string, Promise<void>>();
const listFlights = new Map<string, Promise<void>>();
/** Mounted hooks per key (refetched on "applicants" / after writes). */
const activeApps = new Map<string, number>();
const activeLists = new Map<string, string[]>();
const activeListCount = new Map<string, number>();

function bump(id: string) {
  appMut.set(id, (appMut.get(id) ?? 0) + 1);
  listMut++;
}

function loadApp(id: string, force = false): Promise<void> {
  const e = cache().apps[id];
  if (!force && e && e.status !== "error" && (e.status === "loading" || Date.now() - e.fetchedAt < STALE_MS)) return appFlights.get(id) ?? Promise.resolve();
  if (!force && appFlights.has(id)) return appFlights.get(id)!;
  const token = (appToken.get(id) ?? 0) + 1;
  appToken.set(id, token);
  const mut = appMut.get(id) ?? 0;
  const rs = resetSeq;
  setApp(id, e?.status === "ready" ? { ...e, refreshing: true } : { status: "loading", data: null, notes: [], fetchedAt: 0, refreshing: false });
  const p = (async () => {
    // Who did what: a failed lookup only means no names on the timeline.
    const [pipe, notes, actors] = await Promise.all([fetchPipeline(id), fetchNotes(id, useApp.getState().userId), fetchEventActors([id])]);
    if (rs !== resetSeq || appToken.get(id) !== token) return;
    const cur = cache().apps[id];
    if ((appMut.get(id) ?? 0) !== mut) {
      // A write landed meanwhile; this answer may predate it. Ask again.
      if (cur) setApp(id, { ...cur, refreshing: false });
      void loadApp(id, true);
      return;
    }
    if (pipe.error !== undefined) {
      setApp(id, cur?.data ? { ...cur, error: pipe.error, refreshing: false } : { status: "error", data: null, notes: [], error: pipe.error, fetchedAt: 0, refreshing: false });
      return;
    }
    setApp(id, {
      status: "ready",
      data: pipe.data,
      actors: actors.data ? Object.fromEntries(actors.data) : (cur?.actors ?? {}),
      notes: notes.error !== undefined ? (cur?.notes ?? []) : notes.data,
      notesError: notes.error,
      fetchedAt: Date.now(),
      refreshing: false,
    });
  })();
  appFlights.set(id, p);
  return p.finally(() => {
    if (appFlights.get(id) === p) appFlights.delete(id);
  });
}

function loadList(key: string, jobIds: string[], force = false): Promise<void> {
  const e = cache().lists[key];
  if (!force && e && e.status !== "error" && (e.status === "loading" || Date.now() - e.fetchedAt < STALE_MS)) return listFlights.get(key) ?? Promise.resolve();
  if (!force && listFlights.has(key)) return listFlights.get(key)!;
  const token = (listToken.get(key) ?? 0) + 1;
  listToken.set(key, token);
  const mut = listMut;
  const rs = resetSeq;
  setList(key, e?.status === "ready" ? { ...e, refreshing: true } : { status: "loading", list: [], fetchedAt: 0, refreshing: false });
  const p = (async () => {
    const r = await fetchSummaries(jobIds);
    if (rs !== resetSeq || listToken.get(key) !== token) return;
    const cur = cache().lists[key];
    if (listMut !== mut) {
      if (cur) setList(key, { ...cur, refreshing: false });
      void loadList(key, jobIds, true);
      return;
    }
    if (r.error !== undefined) {
      setList(key, cur?.status === "ready" ? { ...cur, error: r.error, refreshing: false } : { status: "error", list: [], error: r.error, fetchedAt: 0, refreshing: false });
      return;
    }
    setList(key, { status: "ready", list: r.data, fetchedAt: Date.now(), refreshing: false });
  })();
  listFlights.set(key, p);
  return p.finally(() => {
    if (listFlights.get(key) === p) listFlights.delete(key);
  });
}

function refetchActive() {
  for (const id of activeApps.keys()) void loadApp(id, true);
  for (const [key, jobIds] of activeLists) void loadList(key, jobIds, true);
  // Not on screen: refetched next time they mount.
  useLiveCache.setState((s) => ({
    apps: Object.fromEntries(Object.entries(s.apps).map(([k, v]) => [k, activeApps.has(k) ? v : { ...v, fetchedAt: 0 }])),
    lists: Object.fromEntries(Object.entries(s.lists).map(([k, v]) => [k, activeLists.has(k) ? v : { ...v, fetchedAt: 0 }])),
  }));
}

/**
 * After our own writes: confirm with the server what's on screen, once for a burst of taps (five
 * "Marcar como vista" in a row → one list request). Only the pipeline rows: every list and counter
 * takes its status from them (withPipelineStatus), so the applicant lists and profiles (one RPC per
 * vacancy, and freshly signed photo links) aren't refetched for a status change.
 */
const confirmIds = new Set<string>();
let confirmTimer: ReturnType<typeof setTimeout> | null = null;
const CONFIRM_DELAY_MS = 700;

function scheduleConfirm(applicationId: string) {
  confirmIds.add(applicationId);
  if (confirmTimer) clearTimeout(confirmTimer);
  confirmTimer = setTimeout(() => {
    confirmTimer = null;
    const ids = new Set(confirmIds);
    confirmIds.clear();
    const lists = cache().lists;
    for (const id of ids) if (activeApps.has(id)) void loadApp(id, true);
    for (const [key, jobIds] of activeLists) {
      if (lists[key]?.list.some((r) => ids.has(r.id))) void loadList(key, jobIds, true);
    }
    // Not on screen: refetched next time they mount.
    useLiveCache.setState((s) => ({
      apps: Object.fromEntries(Object.entries(s.apps).map(([k, v]) => [k, ids.has(k) && !activeApps.has(k) ? { ...v, fetchedAt: 0 } : v])),
      lists: Object.fromEntries(
        Object.entries(s.lists).map(([k, v]) => [k, !activeLists.has(k) && v.list.some((r) => ids.has(r.id)) ? { ...v, fetchedAt: 0 } : v]),
      ),
    }));
  }, CONFIRM_DELAY_MS);
}

if (typeof window !== "undefined") {
  onLive("reset", () => {
    resetSeq++;
    appFlights.clear();
    listFlights.clear();
    confirmIds.clear();
    if (confirmTimer) clearTimeout(confirmTimer);
    confirmTimer = null;
    useLiveCache.setState({ apps: {}, lists: {} }, true);
  });
  // Someone else's change (a new applicant, an unlock…): refetch what's mounted.
  onLive("applicants", refetchActive);
}

// ------------------------------------------------------------------ optimistic plumbing

type Snapshot = { app?: AppEntry; lists: Record<string, ListEntry> };

function snapshot(id: string): Snapshot {
  const s = cache();
  return {
    app: s.apps[id],
    lists: Object.fromEntries(Object.entries(s.lists).filter(([, e]) => e.list.some((r) => r.id === id))),
  };
}

function restore(id: string, snap: Snapshot) {
  useLiveCache.setState((s) => {
    const apps = { ...s.apps };
    if (snap.app) apps[id] = snap.app;
    return { apps, lists: { ...s.lists, ...snap.lists } };
  });
}

/** Writes a pipeline into the detail entry and every cached list row with that id. */
function applyLocal(p: ApplicationPipeline) {
  const row = toSummary(p);
  useLiveCache.setState((s) => {
    const cur = s.apps[p.id];
    const apps = cur ? { ...s.apps, [p.id]: { ...cur, data: p } } : s.apps;
    const lists = Object.fromEntries(
      Object.entries(s.lists).map(([k, e]) => [k, e.list.some((r) => r.id === p.id) ? { ...e, list: e.list.map((r) => (r.id === p.id ? row : r)) } : e]),
    );
    return { apps, lists };
  });
}

function setNotesLocal(id: string, fn: (notes: RecruiterNote[]) => RecruiterNote[]) {
  useLiveCache.setState((s) => {
    const cur = s.apps[id];
    return cur ? { apps: { ...s.apps, [id]: { ...cur, notes: fn(cur.notes) } } } : {};
  });
}

function fail(error: string): { error: string } {
  toast.error(error);
  return { error };
}

const isLive = () => useApp.getState().mode === "live";

/** A member's own application (they applied to their own company): the team's notes and moves are off. */
const OWN_MSG = "Esta es tu propia postulación: la revisa alguien más del equipo.";

/** Demo: the demo member the app is acting as (the dueño unless "Ver como"). */
const demoMe = () => meId(useDemoTeam.getState());

/** Demo: the applicant's vacancy is in the viewed member's branch scope ("Ver como" a reclutador). */
function demoInScope(applicationId: string): boolean {
  const app = APPLICANTS.find((a) => a.id === applicationId);
  const job = app ? JOB_BY_ID[app.jobId] : undefined;
  return !!job && canSeeBranch(getStoredMembership(), job.branchId);
}

/** Demo: the steps a change added, tagged with who made them (as live's actor_user_id). */
function tagNewEvents(before: ApplicationPipeline, next: ApplicationPipeline): ApplicationPipeline {
  if (next.events.length <= before.events.length) return next;
  const me = demoMe();
  return {
    ...next,
    events: next.events.map((e, i) => (i >= before.events.length && e.actor === "empresa" ? { ...e, actorUserId: me } : e)),
  };
}

// ------------------------------------------------------------------ actions

async function run(applicationId: string, change: PipelineChange): Promise<WriteResult> {
  if (isOwnApplication(applicationId)) {
    // "Seen" runs by itself when the page opens: nothing to say there.
    return change.kind === "seen" ? { error: OWN_MSG } : fail(OWN_MSG);
  }
  if (!isLive()) {
    const current = demoInScope(applicationId) ? demoRecruiterPipeline(useDemoPipeline.getState(), applicationId) : null;
    if (!current) return change.kind === "seen" ? { error: PIPELINE_MSG.notFound } : fail(PIPELINE_MSG.notFound);
    const t = transition(current, change);
    if (t.error !== undefined) return fail(t.error);
    if (t.patch) patchDemo((d) => ({ apps: { ...d.apps, [applicationId]: tagNewEvents(current, t.next) } }));
    return {};
  }

  let current = cache().apps[applicationId]?.data ?? null;
  if (!current) {
    const r = await fetchPipeline(applicationId);
    if (r.error !== undefined) return fail(r.error);
    if (!r.data) return fail(PIPELINE_MSG.notFound);
    current = r.data;
  }
  const t = transition(current, change);
  if (t.error !== undefined) return fail(t.error);
  if (!t.patch) return {};

  const snap = snapshot(applicationId);
  bump(applicationId);
  applyLocal({ ...t.next, pending: true });
  // Only from the status this change was computed from: a stale screen (the candidate withdrew,
  // another tab moved it) writes nothing instead of overwriting.
  const r = await updateApplication(applicationId, t.patch, current.status);
  bump(applicationId);
  if (r.error) {
    restore(applicationId, snap);
    if (r.stale) {
      // Show the real state, and say what it is when it's a withdrawal.
      await loadApp(applicationId, true);
      for (const [key, jobIds] of activeLists) if (cache().lists[key]?.list.some((x) => x.id === applicationId)) void loadList(key, jobIds, true);
      // "Seen" runs by itself when the page opens: if it had moved on already, there's nothing to say.
      if (change.kind === "seen") return { error: r.error };
      const now = cache().apps[applicationId]?.data;
      return fail(now?.status === "cerrada" && now.closedBy === "candidato" ? PIPELINE_MSG.withdrawn : r.error);
    }
    void loadApp(applicationId, true); // e.g. "retiró su postulación": show the real state
    return fail(r.error);
  }
  applyLocal(t.next);
  scheduleConfirm(applicationId);
  return {};
}

/** Marks it as seen (enviada → vista). No-op on any other status. Call it when the company opens the applicant. */
export function markSeen(applicationId: string): Promise<WriteResult> {
  return run(applicationId, { kind: "seen" });
}

/**
 * Sets the interview (→ entrevista). Calling it again on an "entrevista" changes it: a new time,
 * place or instructions each log a timeline event and email the candidate (live, v3 trigger).
 */
export function scheduleInterview(applicationId: string, input: InterviewInput): Promise<WriteResult> {
  return run(applicationId, { kind: "interview", ...input });
}

/** → contratada, with an optional message (next steps). On a hired one, updates the message only. */
export function hire(applicationId: string, message?: string | null): Promise<WriteResult> {
  return run(applicationId, { kind: "hire", message });
}

/** → cerrada by the company with a courteous message (blank → DEFAULT_DECLINE_MESSAGE). */
export function decline(applicationId: string, message?: string | null): Promise<WriteResult> {
  return run(applicationId, { kind: "decline", message });
}

/** Undo a decline: back to the step before it (not possible once the candidate withdrew). */
export function reopen(applicationId: string): Promise<WriteResult> {
  return run(applicationId, { kind: "reopen" });
}

const tmpId = (p: string) => `${p}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** Adds a private note (newest first). Resolves the saved note. */
export async function addNote(applicationId: string, body: string): Promise<WriteResult & { note?: RecruiterNote }> {
  if (isOwnApplication(applicationId)) return fail(OWN_MSG);
  const invalid = validateNote(body);
  if (invalid) return fail(invalid);
  const text = body.trim();
  if (!isLive()) {
    if (!demoInScope(applicationId)) return fail(PIPELINE_MSG.notFound);
    const note: RecruiterNote = { id: tmpId("n"), body: text, at: new Date().toISOString(), mine: true, authorId: demoMe() };
    patchDemo((d) => ({ notes: { ...d.notes, [applicationId]: [note, ...demoRecruiterNotes(d, applicationId)] } }));
    return { note };
  }
  const temp: RecruiterNote = {
    id: tmpId("tmp"),
    body: text,
    at: new Date().toISOString(),
    mine: true,
    authorId: useApp.getState().userId,
    pending: true,
  };
  bump(applicationId);
  setNotesLocal(applicationId, (ns) => [temp, ...ns]);
  const r = await insertNote(applicationId, text);
  bump(applicationId);
  if (r.error !== undefined) {
    setNotesLocal(applicationId, (ns) => ns.filter((n) => n.id !== temp.id));
    return fail(r.error);
  }
  setNotesLocal(applicationId, (ns) => ns.map((n) => (n.id === temp.id ? r.data : n)));
  return { note: r.data };
}

/** Deletes one of my notes. */
export async function deleteNote(applicationId: string, noteId: string): Promise<WriteResult> {
  if (!isLive()) {
    const note = demoRecruiterNotes(useDemoPipeline.getState(), applicationId).find((n) => n.id === noteId);
    // Each person deletes only their own notes (as live's RLS).
    if (note && (note.authorId ?? DEMO_OWNER_ID) !== demoMe()) return fail("Solo puedes borrar tus propias notas.");
    patchDemo((d) => ({ notes: { ...d.notes, [applicationId]: demoRecruiterNotes(d, applicationId).filter((n) => n.id !== noteId) } }));
    return {};
  }
  if (noteId.startsWith("tmp-")) return {}; // still saving; it can be deleted once it's in
  const list = cache().apps[applicationId]?.notes ?? [];
  const index = list.findIndex((n) => n.id === noteId);
  const removed = list[index];
  bump(applicationId);
  setNotesLocal(applicationId, (ns) => ns.filter((n) => n.id !== noteId));
  const r = await deleteNoteLive(noteId);
  bump(applicationId);
  if (r.error) {
    if (removed) setNotesLocal(applicationId, (ns) => (ns.some((n) => n.id === noteId) ? ns : [...ns.slice(0, index), removed, ...ns.slice(index)]));
    return fail(r.error);
  }
  return {};
}

/** Puts back a note deleted a moment ago ("Deshacer"): same id, text and time, so it returns to its place. */
export async function restoreNote(applicationId: string, note: RecruiterNote): Promise<WriteResult> {
  const back: RecruiterNote = { id: note.id, body: note.body, at: note.at, mine: note.mine, authorId: note.authorId };
  // Newest first, like every notes list.
  const insertSorted = (ns: RecruiterNote[], n: RecruiterNote) =>
    ns.some((x) => x.id === n.id) ? ns : [...ns, n].toSorted((a, b) => Date.parse(b.at) - Date.parse(a.at));
  if (!isLive()) {
    patchDemo((d) => ({ notes: { ...d.notes, [applicationId]: insertSorted(demoRecruiterNotes(d, applicationId), back) } }));
    return {};
  }
  bump(applicationId);
  setNotesLocal(applicationId, (ns) => insertSorted(ns, { ...back, pending: true }));
  const r = await insertNote(applicationId, note.body, { id: note.id, at: note.at });
  bump(applicationId);
  if (r.error !== undefined) {
    setNotesLocal(applicationId, (ns) => ns.filter((n) => n.id !== note.id));
    return fail(r.error);
  }
  setNotesLocal(applicationId, (ns) => ns.map((n) => (n.id === note.id ? r.data : n)));
  return {};
}

export type PipelineActions = {
  markSeen: () => Promise<WriteResult>;
  scheduleInterview: (input: InterviewInput) => Promise<WriteResult>;
  hire: (message?: string | null) => Promise<WriteResult>;
  decline: (message?: string | null) => Promise<WriteResult>;
  reopen: () => Promise<WriteResult>;
  addNote: (body: string) => Promise<WriteResult & { note?: RecruiterNote }>;
  deleteNote: (noteId: string) => Promise<WriteResult>;
  restoreNote: (note: RecruiterNote) => Promise<WriteResult>;
};

const NO_ID = async () => ({ error: PIPELINE_MSG.notFound });

/** The actions bound to one application id. */
export function pipelineActions(applicationId: string | null | undefined): PipelineActions {
  if (!applicationId) {
    return {
      markSeen: NO_ID,
      scheduleInterview: NO_ID,
      hire: NO_ID,
      decline: NO_ID,
      reopen: NO_ID,
      addNote: NO_ID,
      deleteNote: NO_ID,
      restoreNote: NO_ID,
    };
  }
  return {
    markSeen: () => markSeen(applicationId),
    scheduleInterview: (input) => scheduleInterview(applicationId, input),
    hire: (message) => hire(applicationId, message),
    decline: (message) => decline(applicationId, message),
    reopen: () => reopen(applicationId),
    addNote: (body) => addNote(applicationId, body),
    deleteNote: (noteId) => deleteNote(applicationId, noteId),
    restoreNote: (note) => restoreNote(applicationId, note),
  };
}

// ------------------------------------------------------------------ hooks

function useFocusRefresh(enabled: boolean, cb: () => void) {
  useEffect(() => {
    if (!enabled) return;
    const onFocus = () => {
      if (document.visibilityState === "visible") cb();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [enabled, cb]);
}

export type ApplicationPipelineResult = {
  /**
   * Company side: each company step's `by` names the team member who made it (null/absent when unknown:
   * show nothing or "La empresa"). Notes carry `by` too ("Tú" when isMe).
   */
  data: ApplicationPipeline | null;
  /** The vacancy (any status) from useMyCompany(); null while it loads or if it isn't mine. */
  job: MyJob | null;
  /** Newest first. Always [] on my own application (the team's notes about me aren't mine to read). */
  notes: RecruiterNote[];
  notesError?: string;
  loading: boolean;
  error?: string;
  /** Loaded, and there's no such application among my vacancies (or my branches). */
  notFound: boolean;
  /**
   * I'm this application's candidate (a member who applied to their own company). Show it read-only:
   * hide the notes panel and the action bar (the actions refuse anyway).
   */
  isOwn: boolean;
  refreshing: boolean;
  refresh: () => Promise<void>;
  actions: PipelineActions;
};

/** Company-side names on the timeline and the notes. */
function withPeople(
  data: ApplicationPipeline | null,
  notes: RecruiterNote[],
  actors: Record<number, string> | undefined,
  people: { nameOf: (id: string | null | undefined) => string | null; isMe: (id: string | null | undefined) => boolean },
): { data: ApplicationPipeline | null; notes: RecruiterNote[] } {
  const actor = (userId: string | null | undefined): TeamActor | null =>
    userId ? { userId, name: people.nameOf(userId), isMe: people.isMe(userId) } : null;
  const events = data?.events.map((e): PipelineEvent => {
    if (e.actor !== "empresa") return e;
    const userId = e.actorUserId ?? (e.id !== undefined ? actors?.[e.id] : undefined) ?? null;
    return userId ? { ...e, actorUserId: userId, by: actor(userId) } : e;
  });
  return {
    data: data && events ? { ...data, events } : data,
    notes: notes.map((n) => (n.authorId ? { ...n, by: actor(n.authorId) } : n)),
  };
}

/** One applicant's full pipeline for the company's applicant page (+ its vacancy and the team's notes). */
export function useApplicationPipeline(applicationId: string | null | undefined): ApplicationPipelineResult {
  const hydrated = useHydrated();
  const live = useApp((s) => s.mode === "live");
  const my = useMyCompany();
  const entry = useLiveCache((s) => (applicationId ? s.apps[applicationId] : undefined));
  const demoApps = useDemoPipeline((s) => s.apps);
  const demoNotes = useDemoPipeline((s) => s.notes);
  const people = useTeamPeople();
  const demoViewer = useDemoTeam((s) => meId(s));
  const ownIds = useOwnApplicationIds();
  const id = applicationId ?? null;
  const isOwn = !!id && ownIds.includes(id);

  useEffect(() => {
    if (!live || !id) return;
    activeApps.set(id, (activeApps.get(id) ?? 0) + 1);
    void loadApp(id);
    return () => {
      const n = (activeApps.get(id) ?? 1) - 1;
      if (n <= 0) activeApps.delete(id);
      else activeApps.set(id, n);
    };
  }, [live, id]);
  const onFocus = useMemo(() => () => (id ? void loadApp(id) : undefined), [id]);
  useFocusRefresh(live && !!id, onFocus);

  return useMemo((): ApplicationPipelineResult => {
    const actions = pipelineActions(id);
    const refresh = () => (live && id ? loadApp(id, true) : Promise.resolve());
    const jobOf = (p: ApplicationPipeline | null) => (p ? (my.jobs.find((j) => j.id === p.jobId) ?? null) : null);
    if (!hydrated || !id) {
      return { data: null, job: null, notes: [], loading: !hydrated, notFound: hydrated && !id, isOwn: false, refreshing: false, refresh, actions };
    }
    if (!live) {
      const seeded = demoRecruiterPipeline({ apps: demoApps }, id);
      // "Ver como" a branch-limited reclutador: another branch's applicant isn't there for them.
      const data = seeded && my.jobs.some((j) => j.id === seeded.jobId) ? seeded : null;
      const notes = data
        ? demoRecruiterNotes({ notes: demoNotes }, id).map((n) => ({ ...n, authorId: n.authorId ?? DEMO_OWNER_ID, mine: (n.authorId ?? DEMO_OWNER_ID) === demoViewer }))
        : [];
      const named = withPeople(data, notes, undefined, people);
      return {
        data: named.data,
        job: jobOf(data),
        notes: named.notes,
        loading: false,
        notFound: !data,
        isOwn: false,
        refreshing: false,
        refresh,
        actions,
      };
    }
    const status = entry?.status ?? "loading";
    const named = withPeople(entry?.data ?? null, isOwn ? [] : (entry?.notes ?? []), entry?.actors, people);
    return {
      data: named.data,
      job: jobOf(entry?.data ?? null),
      notes: named.notes,
      notesError: isOwn ? undefined : entry?.notesError,
      loading: status === "loading",
      error: entry?.error,
      notFound: status === "ready" && !entry?.data,
      isOwn,
      refreshing: entry?.refreshing ?? false,
      refresh,
      actions,
    };
  }, [hydrated, live, id, entry, demoApps, demoNotes, my.jobs, people, demoViewer, isOwn]);
}

export type PipelineCounts = Record<PipelineStep, number> & { total: number; active: number };

export type PipelineSummaryResult = {
  /** Newest first. */
  data: PipelineSummary[];
  byId: Record<string, PipelineSummary>;
  counts: PipelineCounts;
  loading: boolean;
  error?: string;
  refreshing: boolean;
  refresh: () => Promise<void>;
};

/** Counts per step; `active` = still in process (enviada + vista + entrevista). */
export function countSteps(list: Pick<PipelineSummary, "status" | "closedBy">[]): PipelineCounts {
  const c: PipelineCounts = { enviada: 0, vista: 0, entrevista: 0, contratada: 0, descartada: 0, retirada: 0, total: list.length, active: 0 };
  for (const r of list) c[stepOf(r)]++;
  c.active = c.enviada + c.vista + c.entrevista;
  return c;
}

/** Interviews still ahead (or started less than `graceMs` ago, default 2 h), soonest first. */
export function upcomingInterviews(list: PipelineSummary[], now = Date.now(), graceMs = 2 * 3_600_000): PipelineSummary[] {
  return list
    .filter((r) => r.status === "entrevista" && r.interviewAt && Date.parse(r.interviewAt) + graceMs >= now)
    .toSorted((a, b) => Date.parse(a.interviewAt!) - Date.parse(b.interviewAt!));
}

/**
 * Overlays the pipeline status on rows from useApplicants / useApplicantProfiles (their demo
 * statuses are not synced with the pipeline, and live they refetch a moment later).
 */
export function withPipelineStatus<T extends { id: string; status: ApplicationStatus | null }>(rows: T[], byId: Record<string, PipelineSummary>): T[] {
  return rows.map((r) => {
    const p = byId[r.id];
    return p && p.status !== r.status ? { ...r, status: p.status } : r;
  });
}

const EMPTY_LIST: PipelineSummary[] = [];

/**
 * Light status rows for one vacancy's applicants (or, without jobId, all my vacancies) — for list
 * chips, counters and "próximas entrevistas". Live: one query for all the vacancies.
 */
export function usePipelineSummary(jobId?: string | null): PipelineSummaryResult {
  const hydrated = useHydrated();
  const live = useApp((s) => s.mode === "live");
  const my = useMyCompany();
  const demoApps = useDemoPipeline((s) => s.apps);
  const limited = scopeOf(useStoredMembership()) !== null;
  // A branch-limited member never asks for another branch's vacancy (RLS would just return nothing).
  const outOfScope = !!jobId && limited && (my.status !== "ready" || !my.jobs.some((j) => j.id === jobId));
  const jobIds = useMemo(
    () => (outOfScope ? [] : jobId ? [jobId] : my.jobs.map((j) => j.id).toSorted()),
    [outOfScope, jobId, my.jobs],
  );
  const key = jobIds.join(",");
  const ready = live && (jobId ? true : my.status === "ready");
  const entry = useLiveCache((s) => s.lists[key]);

  useEffect(() => {
    if (!ready || !key) return;
    const ids = key.split(",");
    activeLists.set(key, ids);
    activeListCount.set(key, (activeListCount.get(key) ?? 0) + 1);
    void loadList(key, ids);
    return () => {
      const n = (activeListCount.get(key) ?? 1) - 1;
      if (n <= 0) {
        activeListCount.delete(key);
        activeLists.delete(key);
      } else activeListCount.set(key, n);
    };
  }, [ready, key]);
  const onFocus = useMemo(() => () => (key ? void loadList(key, key.split(",")) : undefined), [key]);
  useFocusRefresh(ready && !!key, onFocus);

  return useMemo((): PipelineSummaryResult => {
    const refresh = () => (ready && key ? loadList(key, key.split(","), true) : Promise.resolve());
    const done = (data: PipelineSummary[], rest: Partial<PipelineSummaryResult> = {}): PipelineSummaryResult => ({
      data,
      byId: Object.fromEntries(data.map((r) => [r.id, r])),
      counts: countSteps(data),
      loading: false,
      refreshing: false,
      refresh,
      ...rest,
    });
    if (!hydrated) return done(EMPTY_LIST, { loading: true });
    if (!live) {
      const mine = new Set(my.jobs.map((j) => j.id));
      const rows = APPLICANTS.filter((a) => mine.has(a.jobId) && (!jobId || a.jobId === jobId))
        .map((a) => demoRecruiterPipeline({ apps: demoApps }, a.id))
        .filter((p): p is ApplicationPipeline => !!p)
        .map(toSummary)
        .toSorted((a, b) => Date.parse(b.appliedAt) - Date.parse(a.appliedAt));
      return done(rows);
    }
    if ((!jobId || outOfScope) && my.status !== "ready") return done(EMPTY_LIST, { loading: my.status === "loading", error: my.error });
    if (!key) return done(EMPTY_LIST);
    const status = entry?.status ?? "loading";
    return done(entry?.list ?? EMPTY_LIST, { loading: status === "loading", error: entry?.error, refreshing: entry?.refreshing ?? false });
  }, [hydrated, live, jobId, outOfScope, my.status, my.error, my.jobs, key, ready, entry, demoApps]);
}

/*
 * Deterministic demo pipelines (no Supabase, no randomness). Everything is relative to `t0` (the
 * moment the page loaded), so the showcase always reads "hace 5 h" / "mañana 10:00".
 *  - Candidate (Mariana): the store's demo applications → enviada / vista / entrevista with dates.
 *  - Company (Logística Zapalinamé): the 16 mock applicants spread over every step.
 */
import { APPLICANTS } from "@/lib/data/applicants";
import { BRANCH_BY_ID, COMPANY_BY_ID, JOB_BY_ID } from "@/lib/data/jobs";
import type { Application, ApplicationPipeline, ApplicationStatus, PipelineEvent, RecruiterNote } from "@/lib/data/types";
import { DEMO_OWNER_ID, DEMO_RECRUITER_ID } from "@/lib/team/demo";
import { defaultInterviewPlace } from "./places";
import { DEFAULT_DECLINE_MESSAGE } from "./steps";
import { nextWorkdayAt } from "./time";

const MIN = 60_000;
const HOUR = 60 * MIN;
const iso = (ms: number) => new Date(ms).toISOString();

/** The place of a mock vacancy ("Farmacias Bienestar · Sucursal Lourdes"). */
function placeOf(jobId: string): string | null {
  const job = JOB_BY_ID[jobId];
  const branch = job ? BRANCH_BY_ID[job.branchId] : undefined;
  return branch ? defaultInterviewPlace(branch, COMPANY_BY_ID[job.companyId]?.name) : null;
}

type Seed = {
  status: ApplicationStatus;
  /** Minutes before t0 they applied. */
  appliedMin: number;
  /** Fractions of the time since applying (0–1) at which each step happened. */
  seenFrac?: number;
  scheduledFrac?: number;
  /** Interview instant (ISO). */
  interviewAt?: string;
  note?: string | null;
  doneFrac?: number;
  closedBy?: "empresa" | "candidato";
  message?: string | null;
};

/**
 * Who did each company step in the demo team (company side only; the candidate's own view never gets
 * actors): the reclutador schedules the interviews, the dueño does the rest.
 */
const DEMO_ACTOR: Partial<Record<ApplicationStatus, string>> = {
  vista: DEMO_OWNER_ID,
  entrevista: DEMO_RECRUITER_ID,
  contratada: DEMO_OWNER_ID,
  cerrada: DEMO_OWNER_ID,
};

/** The company side of the demo: tag every company step with the demo member who made it. */
function withDemoActors(p: ApplicationPipeline): ApplicationPipeline {
  return { ...p, events: p.events.map((e) => (e.actor === "empresa" ? { ...e, actorUserId: DEMO_ACTOR[e.status] ?? DEMO_OWNER_ID } : e)) };
}

/** Builds a consistent pipeline (stamps + timeline) from a seed. */
function build(id: string, jobId: string, s: Seed, t0: number): ApplicationPipeline {
  const applied = t0 - s.appliedMin * MIN;
  const span = t0 - applied;
  const when = (f: number) => applied + Math.round(span * f);
  const events: PipelineEvent[] = [{ status: "enviada", actor: "candidato", at: iso(applied) }];
  const reached = (st: ApplicationStatus) => ["vista", "entrevista", "contratada", "cerrada"].includes(st);
  const seenAt = reached(s.status) && s.closedBy !== "candidato" ? when(s.seenFrac ?? 0.3) : s.seenFrac !== undefined ? when(s.seenFrac) : null;
  if (seenAt !== null) events.push({ status: "vista", actor: "empresa", at: iso(seenAt) });
  const interview = s.interviewAt ? { at: s.interviewAt, place: placeOf(jobId), note: s.note ?? null } : null;
  if (interview) events.push({ status: "entrevista", actor: "empresa", at: iso(when(s.scheduledFrac ?? 0.5)), interviewAt: interview.at });
  let hiredAt: string | null = null;
  let closedAt: string | null = null;
  if (s.status === "contratada") {
    hiredAt = iso(when(s.doneFrac ?? 0.9));
    events.push({ status: "contratada", actor: "empresa", at: hiredAt });
  }
  if (s.status === "cerrada") {
    closedAt = iso(when(s.doneFrac ?? 0.8));
    events.push({ status: "cerrada", actor: s.closedBy ?? "empresa", at: closedAt });
  }
  return {
    id,
    jobId,
    status: s.status,
    appliedAt: iso(applied),
    seenAt: seenAt === null ? null : iso(seenAt),
    interview,
    companyMessage: s.message ?? null,
    hiredAt,
    closedBy: s.status === "cerrada" ? (s.closedBy ?? "empresa") : null,
    closedAt,
    events,
  };
}

// ------------------------------------------------------------------ candidate (Mariana)

/** Per-vacancy flavour for the curated demo applications (store.ts demoSeed). */
const CANDIDATE_NOTES: Record<string, string> = {
  "auxiliar-farmacia": "Trae tu INE, CURP y comprobante de domicilio. Pregunta por Laura en el mostrador.",
};

/** The id a demo candidate application gets (the store only knows jobIds). */
export const demoCandidateId = (jobId: string) => `demo-${jobId}`;

/**
 * A demo candidate application as a full pipeline. Status comes from the store; dates are derived
 * from `minutesAgo`. "entrevista" → the next working day at 10:00 at the vacancy's branch.
 */
export function seedCandidatePipeline(app: Application, t0: number): ApplicationPipeline {
  const appliedMin = Math.max(1, app.minutesAgo);
  const base: Seed = { status: app.status, appliedMin };
  switch (app.status) {
    case "vista":
      base.seenFrac = 0.6;
      break;
    case "entrevista":
      base.seenFrac = 0.15;
      base.scheduledFrac = 0.6;
      base.interviewAt = nextWorkdayAt(t0, 10, 0);
      base.note = CANDIDATE_NOTES[app.jobId] ?? "Trae tu INE y llega 10 minutos antes.";
      break;
    case "contratada":
      base.seenFrac = 0.1;
      base.scheduledFrac = 0.3;
      base.interviewAt = iso(t0 - Math.round(appliedMin * 0.4) * MIN);
      base.doneFrac = 0.8;
      base.message = "¡Bienvenido(a) al equipo! Te llamamos para acordar tu primer día.";
      break;
    case "cerrada":
      base.seenFrac = 0.3;
      base.closedBy = "empresa";
      base.doneFrac = 0.8;
      base.message = DEFAULT_DECLINE_MESSAGE;
      break;
  }
  return build(demoCandidateId(app.jobId), app.jobId, base, t0);
}

/** A demo application made during this demo session: just sent. */
export function newCandidatePipeline(jobId: string, at: number): ApplicationPipeline {
  return {
    id: demoCandidateId(jobId),
    jobId,
    status: "enviada",
    appliedAt: iso(at),
    seenAt: null,
    interview: null,
    companyMessage: null,
    hiredAt: null,
    closedBy: null,
    closedAt: null,
    events: [{ status: "enviada", actor: "candidato", at: iso(at) }],
  };
}

/** The candidate withdrew (status → cerrada by "candidato"), keeping what the company had set. */
export function withdrawnPipeline(p: ApplicationPipeline, at: number): ApplicationPipeline {
  if (p.status === "cerrada") return p;
  return {
    ...p,
    status: "cerrada",
    closedBy: "candidato",
    closedAt: iso(at),
    events: [...p.events, { status: "cerrada", actor: "candidato", at: iso(at) }],
  };
}

// ------------------------------------------------------------------ company (Logística Zapalinamé)

/** Step of each mock applicant (APPLICANTS in @/lib/data/applicants). Unknown ids → enviada. */
function recruiterSeed(id: string, appliedMin: number, t0: number): Seed {
  switch (id) {
    case "a2":
      return { status: "vista", appliedMin, seenFrac: 0.5 };
    case "a3":
      return {
        status: "entrevista",
        appliedMin,
        seenFrac: 0.2,
        scheduledFrac: 0.5,
        interviewAt: nextWorkdayAt(t0, 11, 0),
        note: "Trae tu licencia de montacargas vigente e INE. Pregunta por Rogelio en la caseta.",
      };
    case "a4":
      return { status: "vista", appliedMin, seenFrac: 0.7 };
    case "a6":
      return {
        status: "contratada",
        appliedMin,
        seenFrac: 0.1,
        scheduledFrac: 0.25,
        interviewAt: iso(t0 - 6 * HOUR),
        note: "Trae tu INE y licencia de montacargas.",
        doneFrac: 0.95,
        message: "¡Bienvenido al equipo! Preséntate el lunes a las 7:00 en CEDIS Santa Mónica con tu INE, CURP y RFC.",
      };
    case "a7":
      return { status: "vista", appliedMin, seenFrac: 0.6 };
    case "a9":
      return {
        status: "entrevista",
        appliedMin,
        seenFrac: 0.3,
        scheduledFrac: 0.7,
        interviewAt: nextWorkdayAt(t0, 10, 0),
        note: "Trae tu INE y CURP. Pregunta por Recursos Humanos en la entrada.",
      };
    case "a10":
      return { status: "vista", appliedMin, seenFrac: 0.4 };
    case "a11":
      return { status: "cerrada", appliedMin, seenFrac: 0.2, doneFrac: 0.6, closedBy: "empresa", message: DEFAULT_DECLINE_MESSAGE };
    case "a12":
      return { status: "cerrada", appliedMin, doneFrac: 0.7, closedBy: "candidato" };
    case "a13":
      return { status: "vista", appliedMin, seenFrac: 0.5 };
    case "a15":
      return {
        status: "entrevista",
        appliedMin,
        seenFrac: 0.1,
        scheduledFrac: 0.4,
        interviewAt: nextWorkdayAt(t0, 12, 30, 3),
        note: "Trae tu INE y comprobante de domicilio.",
      };
    default:
      return { status: "enviada", appliedMin };
  }
}

const RECRUITER_CACHE = new Map<number, Record<string, ApplicationPipeline>>();

/** Every mock applicant as a pipeline, by application id ("a1"…"a16"). Memoized per t0. */
export function seedRecruiterPipelines(t0: number): Record<string, ApplicationPipeline> {
  let out = RECRUITER_CACHE.get(t0);
  if (!out) {
    out = Object.fromEntries(
      APPLICANTS.map((a) => [a.id, withDemoActors(build(a.id, a.jobId, recruiterSeed(a.id, Math.max(1, a.minutesAgo), t0), t0))]),
    );
    RECRUITER_CACHE.clear();
    RECRUITER_CACHE.set(t0, out);
  }
  return out;
}

/**
 * A few private notes so the notes panel isn't empty in the demo, by both demo team members. `mine` is
 * recomputed for whoever the demo is acting as (useApplicationPipeline); here it's the dueño's view.
 */
export function seedRecruiterNotes(t0: number): Record<string, RecruiterNote[]> {
  const owner = { mine: true, authorId: DEMO_OWNER_ID };
  const recruiter = { mine: false, authorId: DEMO_RECRUITER_ID };
  return {
    a3: [{ id: "n-a3-1", body: "Tiene licencia federal vigente. Preguntar si puede rolar turno nocturno.", at: iso(t0 - 3 * HOUR), ...owner }],
    a6: [
      { id: "n-a6-2", body: "Muy buena entrevista. Ya manejó Crown y Yale.", at: iso(t0 - 5 * HOUR), ...recruiter },
      { id: "n-a6-1", body: "Llegó puntual y con papeles completos.", at: iso(t0 - 6 * HOUR), ...owner },
    ],
    a9: [{ id: "n-a9-1", body: "Experiencia en inventarios cíclicos con escáner.", at: iso(t0 - 1 * HOUR), ...owner }],
  };
}

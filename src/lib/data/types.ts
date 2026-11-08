import type { LatLng } from "@/lib/geo";

export type CategoryId =
  | "produccion"
  | "almacen"
  | "montacargas"
  | "chofer"
  | "restaurante"
  | "caja"
  | "ventas"
  | "limpieza"
  | "mantenimiento"
  | "construccion"
  | "seguridad"
  | "oficina";

export type PayPeriod = "semana" | "quincena" | "mes" | "dia";
export type Shift = "Matutino" | "Vespertino" | "Nocturno" | "Mixto" | "Rotativo";
export type EmploymentType = "Tiempo completo" | "Medio tiempo" | "Temporal" | "Fines de semana";
export type Experience = "Sin experiencia" | "6 meses" | "1 año" | "2 años o más";
export type CompanySize = "Micro" | "Pequeña" | "Mediana" | "Grande";

/** One physical site of a company (sucursal, planta, bodega). Vacancies belong to a branch. */
export type Branch = {
  id: string;
  /** Short display name: "CEDIS Santa Mónica", "Sucursal Centro"… */
  name: string;
  colonia: string;
  location: LatLng;
};

export type Company = {
  id: string;
  name: string;
  kind: string;
  size: CompanySize;
  verified: boolean;
  /** At least one; the first is the main site (matriz). */
  locations: Branch[];
  about: string;
  employees: string;
  /** Digits; the fallback contact when a vacancy has no phone of its own. */
  phone?: string;
  /**
   * Pyme / Industrial see every applicant's name, phone, photo and CV right away; "por-vacante" only
   * after unlocking the vacancy. Unknown (demo companies) = por-vacante.
   */
  plan?: "por-vacante" | "pyme" | "industrial";
};

export type Job = {
  id: string;
  title: string;
  companyId: string;
  /** Which of the company's locations this vacancy is at. location/colonia mirror that branch. */
  branchId: string;
  category: CategoryId;
  pay: number;
  payMax?: number;
  period: PayPeriod;
  shift: Shift;
  schedule: string;
  type: EmploymentType;
  experience: Experience;
  benefits: string[];
  requirements: string[];
  description: string;
  location: LatLng;
  colonia: string;
  postedMinutesAgo: number;
  openings: number;
  applicants: number;
  urgent?: boolean;
  phone: string;
  /**
   * Paused or closed: no longer takes applications. Live, only its applicants (and its company) can
   * still read it (20261108041320_candidate_reads_after_close.sql).
   */
  closed?: boolean;
};

export type ApplicationStatus = "enviada" | "vista" | "entrevista" | "contratada" | "cerrada";

export type Application = {
  /** Live: the application's id (from the session load; absent until then, and in the demo). */
  id?: string;
  jobId: string;
  status: ApplicationStatus;
  /** minutes since applying, for seeded demo data */
  minutesAgo: number;
};

// ------------------------------------------------------------------ hiring pipeline
// The shapes of @/lib/pipeline (both modes). Timestamps are ISO-8601 instants (UTC); format them
// with @/lib/pipeline/time, which always shows Saltillo time (America/Monterrey).

/** Who made a change to an application. */
export type PipelineActor = "candidato" | "empresa";

/** The interview the company set. `at` is an ISO instant; place/note are free text from the company. */
export type InterviewDetails = {
  at: string;
  /** ≤ 160 chars, e.g. "CEDIS Santa Mónica · Parque Industrial Santa Mónica". */
  place: string | null;
  /** ≤ 500 chars: what to bring, who to ask for. */
  note: string | null;
};

/** One entry of an application's timeline (oldest first in `ApplicationPipeline.events`). */
/**
 * What an event that isn't a plain step change was: a new interview time, place or instructions, a
 * message after the hire, or a declined application opened again ("Reabrir"; an immediate "Deshacer"
 * leaves no trace). Older rows don't say; ./pipeline/steps eventChange() infers it.
 */
export type PipelineEventChange = "hora" | "lugar" | "indicaciones" | "mensaje" | "reabierta";

/**
 * Company side only: the team member behind a step or a note. `name` is null when unknown (someone
 * whose profile has no name and who left); show "Tú" / "ti" when `isMe`. Candidates never get this.
 */
export type TeamActor = { userId: string; name: string | null; isMe: boolean };

export type PipelineEvent = {
  /** Live: application_events.id (absent on timelines made up from the row's stamps). */
  id?: number;
  status: ApplicationStatus;
  actor: PipelineActor;
  at: string;
  /** Company side only: which member made this company step (live: application_event_actors()). */
  actorUserId?: string | null;
  /**
   * Company side only, filled by useApplicationPipeline(): that member resolved to a name. null/absent =
   * no name to show (candidate steps, older rows, the candidate's own view): say nothing, or "La empresa".
   */
  by?: TeamActor | null;
  /** For "entrevista" events: the interview time set (a reschedule logs a new event). */
  interviewAt?: string | null;
  change?: PipelineEventChange | null;
  /** The company's message as it was at this step (hire / decline / interview), when known. */
  message?: string | null;
};

/** Everything both sides see about one application. */
export type ApplicationPipeline = {
  /** Application id (live: uuid; demo: "a1"… on the company side, "demo-<jobId>" on the candidate side). */
  id: string;
  jobId: string;
  status: ApplicationStatus;
  appliedAt: string;
  /** First time the company opened it (stays set once seen). */
  seenAt: string | null;
  /** Kept after the interview (contratada / cerrada still carry it as history). */
  interview: InterviewDetails | null;
  /** Next steps or a courteous "no", ≤ 500 chars. Written with the latest status change. */
  companyMessage: string | null;
  hiredAt: string | null;
  /** Set only while status is "cerrada": "empresa" = declined, "candidato" = withdrawn. */
  closedBy: PipelineActor | null;
  closedAt: string | null;
  /** Oldest first. */
  events: PipelineEvent[];
  /** true while an optimistic change hasn't been confirmed by the server yet. */
  pending?: boolean;
};

/** The light per-application row for lists and counters (company side). */
export type PipelineSummary = Pick<
  ApplicationPipeline,
  "id" | "jobId" | "status" | "appliedAt" | "seenAt" | "hiredAt" | "closedBy" | "closedAt" | "pending"
> & {
  interviewAt: string | null;
  interviewPlace: string | null;
};

/** A private note of the company about an applicant (never visible to the candidate). */
export type RecruiterNote = {
  id: string;
  /** 1–1000 chars. */
  body: string;
  at: string;
  /** Written by the signed-in user (only own notes can be deleted). */
  mine: boolean;
  /** application_notes.author_id (demo: the demo member who wrote it). */
  authorId?: string | null;
  /** Filled by useApplicationPipeline(): the author resolved to a name ("Tú" when isMe). */
  by?: TeamActor | null;
  /** Optimistic: not saved yet. */
  pending?: boolean;
};

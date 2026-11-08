/*
 * The hiring pipeline's steps, copy and rules (es-MX). Pure: safe in server components.
 *
 *   Enviada → Vista → Entrevista → Contratada        (the main track)
 *   + Descartada (cerrada by the company) / Retirada (cerrada by the candidate)
 *
 * The database stores 5 statuses; "cerrada" splits into two steps by `closedBy`.
 */
import type { BlockTone } from "@/components/chamba/primitives";
import type { ApplicationPipeline, ApplicationStatus, PipelineActor } from "@/lib/data/types";

export type PipelineStep = "enviada" | "vista" | "entrevista" | "contratada" | "descartada" | "retirada";

/** The main track, in order (index 0–3). */
export const MAIN_STEPS = ["enviada", "vista", "entrevista", "contratada"] as const;
export type MainStep = (typeof MAIN_STEPS)[number];

export type StepMeta = {
  key: PipelineStep;
  /** Neutral chip label. */
  label: string;
  /** Chip label on the candidate side ("La vieron", "No quedó"…). */
  candidateLabel: string;
  /** Chip label on the company side ("Nueva", "Se retiró"…). */
  recruiterLabel: string;
  /** Headline for the candidate's status card. */
  candidateTitle: string;
  /** "What happens next", for the candidate. */
  candidateNext: string;
  /** What the company should do now. */
  recruiterNext: string;
  /** Typical wait at this step, for the candidate (null at the end). */
  typical: string | null;
  /** Suggested block colour (no pink). */
  tone: BlockTone;
  /** Contratada / Descartada / Retirada. */
  terminal: boolean;
  /** Position on the main track; off-track steps use -1 (see `trackIndex`). */
  index: number;
};

export const STEP_META: Record<PipelineStep, StepMeta> = {
  enviada: {
    key: "enviada",
    label: "Enviada",
    candidateLabel: "Enviada",
    recruiterLabel: "Nueva",
    candidateTitle: "Tu postulación llegó",
    candidateNext: "La empresa la va a revisar. Te avisamos en cuanto la vean.",
    recruiterNext: "Revisa su perfil. Si te interesa, agenda una entrevista.",
    typical: "Casi siempre la revisan en 1 a 3 días.",
    tone: "sol",
    terminal: false,
    index: 0,
  },
  vista: {
    key: "vista",
    label: "Vista",
    candidateLabel: "La vieron",
    recruiterLabel: "Vista",
    candidateTitle: "La empresa vio tu postulación",
    candidateNext: "Si les interesa tu perfil, te proponen una entrevista. Ten tu teléfono a la mano.",
    recruiterNext: "Agenda una entrevista o descarta con un mensaje amable.",
    typical: "Suelen responder en 2 a 5 días.",
    tone: "cielo",
    terminal: false,
    index: 1,
  },
  entrevista: {
    key: "entrevista",
    label: "Entrevista",
    candidateLabel: "Entrevista",
    recruiterLabel: "Entrevista",
    candidateTitle: "¡Tienes entrevista!",
    candidateNext: "Llega 10 minutos antes con tu INE. Si no puedes ir, llama o manda SMS a la empresa.",
    recruiterNext: "Después de la entrevista, contrata o descarta con un mensaje.",
    typical: "Después de la entrevista suelen avisar en 1 a 7 días.",
    tone: "limon",
    terminal: false,
    index: 2,
  },
  contratada: {
    key: "contratada",
    label: "Contratada",
    candidateLabel: "¡Contratada!",
    recruiterLabel: "Contratada",
    candidateTitle: "¡Te contrataron!",
    candidateNext: "La empresa te va a contactar para acordar tu primer día.",
    recruiterNext: "Ponte de acuerdo con la persona para su primer día.",
    typical: null,
    tone: "menta",
    terminal: true,
    index: 3,
  },
  descartada: {
    key: "descartada",
    label: "Descartada",
    candidateLabel: "No quedó",
    recruiterLabel: "Descartada",
    candidateTitle: "Esta vez no quedaste",
    candidateNext: "No te desanimes: cada postulación cuenta y hay más chamba cerca de tu casa.",
    recruiterNext: "La persona ve tu mensaje en su postulación. Puedes reabrirla si cambias de opinión.",
    typical: null,
    tone: "lila",
    terminal: true,
    index: -1,
  },
  retirada: {
    key: "retirada",
    label: "Retirada",
    candidateLabel: "Retirada",
    recruiterLabel: "Se retiró",
    candidateTitle: "Retiraste tu postulación",
    candidateNext: "Ya no sigues en este proceso. Busca otras vacantes cerca de ti.",
    recruiterNext: "Esta persona retiró su postulación.",
    typical: null,
    tone: "durazno",
    terminal: true,
    index: -1,
  },
};

/** All six steps in display order (main track, then the two closings). */
export const PIPELINE_STEPS: StepMeta[] = [
  STEP_META.enviada,
  STEP_META.vista,
  STEP_META.entrevista,
  STEP_META.contratada,
  STEP_META.descartada,
  STEP_META.retirada,
];

type StatusLike = { status: ApplicationStatus; closedBy?: PipelineActor | null };

/** Status (+ who closed it) → step. A "cerrada" without closedBy counts as Descartada. */
export function stepOf(p: StatusLike): PipelineStep {
  if (p.status !== "cerrada") return p.status;
  return p.closedBy === "candidato" ? "retirada" : "descartada";
}

export function stepMeta(p: StatusLike): StepMeta {
  return STEP_META[stepOf(p)];
}

/**
 * How far along the main track it got (0–3), also for closed ones: a declined application that had
 * an interview → 2. Use it to draw the progress bar with the closing step after it.
 */
export function trackIndex(p: Pick<ApplicationPipeline, "status" | "seenAt" | "interview" | "hiredAt" | "events">): number {
  if (p.status !== "cerrada") return STEP_META[p.status].index;
  let reached = 0;
  for (const e of p.events) if (e.status !== "cerrada") reached = Math.max(reached, STEP_META[e.status].index);
  if (p.hiredAt) reached = Math.max(reached, 3);
  else if (p.interview) reached = Math.max(reached, 2);
  else if (p.seenAt) reached = Math.max(reached, 1);
  return reached;
}

export const isClosed = (p: StatusLike) => p.status === "cerrada";
export const isWithdrawn = (p: StatusLike) => p.status === "cerrada" && p.closedBy === "candidato";

/** The candidate may withdraw anything not closed yet (also after being hired, to turn it down). */
export const canWithdraw = (p: StatusLike) => p.status !== "cerrada";

/** Which company actions make sense now (the actions themselves re-check and are no-ops otherwise). */
export function recruiterCan(p: StatusLike & { interview?: unknown }) {
  const withdrawn = isWithdrawn(p);
  const open = p.status !== "cerrada";
  return {
    /** Only from "enviada" (opening the applicant page should call markSeen). */
    markSeen: p.status === "enviada",
    scheduleInterview: open && p.status !== "contratada" && p.status !== "entrevista",
    reschedule: p.status === "entrevista",
    hire: open && p.status !== "contratada",
    decline: open,
    /** Undo a decline (back to the step before it). Never after the candidate withdrew. */
    reopen: p.status === "cerrada" && !withdrawn,
    notes: true,
  };
}

// ------------------------------------------------------------------ limits & copy

/** Same limits as the database checks. */
export const PIPELINE_LIMITS = { place: 160, note: 500, message: 500, noteBody: 1000 } as const;

/**
 * Un-hire: a "cerrada" by the company right after "contratada" (the guard clears hired_at, so the
 * timeline is the only trace). It must never read as "no quedaste".
 */
export function wasHiredBeforeClose(p: Pick<ApplicationPipeline, "status" | "closedBy"> & { events?: ApplicationPipeline["events"] }): boolean {
  if (p.status !== "cerrada" || p.closedBy === "candidato" || !p.events?.length) return false;
  const before = p.events.filter((e) => e.status !== "cerrada").at(-1);
  return before?.status === "contratada";
}

/** Candidate-side copy of an un-hire (instead of Descartada's "Esta vez no quedaste"). */
export const UNHIRE_COPY = {
  label: "Cancelada",
  title: "Se canceló tu contratación",
  next: "No te desanimes: hay más chamba cerca de tu casa.",
} as const;

/** Sent when the company cancels a hire without writing a message. */
export const DEFAULT_UNHIRE_MESSAGE =
  "Lamentamos avisarte que ya no vamos a seguir con tu contratación. Gracias por tu tiempo y disculpa las molestias.";

/** Banner over a rescheduled interview (candidate) and its preview (company). No final period: the old time follows. */
export const RESCHEDULE_NOTICE = "¡Ojo! La empresa cambió la hora.";

/** Sent when the company declines without writing a message. */
export const DEFAULT_DECLINE_MESSAGE =
  "Gracias por tu interés y por tu tiempo. Esta vez elegimos a otra persona, pero te invitamos a postularte a nuestras otras vacantes.";

/** One-tap texts for the company (quick-fill chips; editable before sending). */
export const MESSAGE_TEMPLATES = {
  interviewNote: [
    "Trae tu INE, CURP y comprobante de domicilio.",
    "Pregunta por Recursos Humanos en la entrada.",
    "Trae tu solicitud elaborada o CV impreso.",
  ],
  hire: [
    "¡Bienvenido(a) al equipo! Te llamamos para acordar tu primer día.",
    "Preséntate el lunes a las 8:00 con tu INE, CURP, RFC y número de seguro social.",
  ],
  unhire: [
    DEFAULT_UNHIRE_MESSAGE,
    "Hubo un cambio y el puesto ya no está disponible. Gracias por tu tiempo; te avisamos si se vuelve a abrir.",
  ],
  decline: [
    DEFAULT_DECLINE_MESSAGE,
    "Gracias por venir a la entrevista. Por ahora buscamos a alguien con más experiencia. Tu perfil queda en cuenta para futuras vacantes.",
    "Gracias por postularte. Ya cubrimos la vacante, pero te avisaremos si se abre otra.",
  ],
} as const;

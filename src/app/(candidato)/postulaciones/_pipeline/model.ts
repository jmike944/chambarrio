/*
 * Candidate-side view model of an application's pipeline: timeline rows, interview state, the
 * "needs attention" order and copy. Pure (no hooks): shared by the job detail, /postulaciones and
 * /notificaciones. Times always read in Saltillo (helpers from @/lib/pipeline/time).
 */
import type { ApplicationPipeline } from "@/lib/data/types";
import { MAIN_STEPS, STEP_META, UNHIRE_COPY, stepOf, trackIndex, wasHiredBeforeClose, type PipelineStep } from "@/lib/pipeline/steps";
import { capitalize, fmtDate, fmtDayTime, fmtRelative, fmtTime, isPast, relativeDayWord, toMs } from "@/lib/pipeline/time";
import type { BlockTone } from "@/components/chamba/primitives";

export type CSSVars = React.CSSProperties & Record<`--${string}`, string | number>;

const HOUR = 60 * 60_000;

/** "Hoy, 3:12 p.m." · "Ayer, 9:40 a.m." · "jue 5 nov" (a short, human stamp for timeline rows). */
export function whenLabel(at: string | number, now: number): string {
  const word = relativeDayWord(at, now);
  if (word === "hoy" || word === "ayer") return `${capitalize(word)}, ${fmtTime(at)}`;
  return fmtDate(at, { now });
}

/**
 * "hace 5 min" for something that already happened. `now` ticks once a minute, so an event from a
 * second ago can be "after" it: clamp, never "en un momento".
 */
export const ago = (at: string | number, now: number, cap = false) => fmtRelative(Math.min(toMs(at), now), { now, capitalize: cap });

/** Dot colour per step, for status chips on white (the chip text stays ink). */
export const STEP_DOT: Record<PipelineStep, string> = {
  enviada: "var(--maiz)",
  vista: "var(--cielo)",
  entrevista: "var(--nopal)",
  contratada: "var(--nopal)",
  descartada: "var(--uva-ink)",
  retirada: "var(--chile)",
};

/** Candidate-facing short status ("La vieron", "Entrevista", "No quedó", "Cancelada"…). */
export const stepLabel = (p: Pick<ApplicationPipeline, "status" | "closedBy"> & { events?: ApplicationPipeline["events"] }) =>
  wasHiredBeforeClose(p) ? UNHIRE_COPY.label : STEP_META[stepOf(p)].candidateLabel;

/**
 * Headline of the candidate's status card. Differs from the step's title once the interview time
 * has passed (no more "¡Tienes entrevista!") and when a hire was cancelled (never "no quedaste").
 */
export function candidateTitle(p: ApplicationPipeline, now: number): string {
  if (wasHiredBeforeClose(p)) return UNHIRE_COPY.title;
  // "¿Cómo te fue?" is the ticket's own question right below; the header just says where it stands.
  if (now && interviewState(p, now) === "past") return "Ya fue tu entrevista";
  return STEP_META[stepOf(p)].candidateTitle;
}

// ------------------------------------------------------------------ interview

export type InterviewState = "none" | "upcoming" | "today" | "past";

/** An interview counts as "now" for an hour after it starts. */
export const INTERVIEW_GRACE_MS = HOUR;

export function interviewState(p: Pick<ApplicationPipeline, "status" | "interview">, now: number): InterviewState {
  if (p.status !== "entrevista" || !p.interview) return "none";
  if (isPast(p.interview.at, { now, graceMs: INTERVIEW_GRACE_MS })) return "past";
  return relativeDayWord(p.interview.at, now) === "hoy" ? "today" : "upcoming";
}

/** The previous interview time when the company changed it (null if it was never rescheduled). */
export function rescheduledFrom(p: Pick<ApplicationPipeline, "status" | "interview" | "events">): string | null {
  if (p.status !== "entrevista" || !p.interview) return null;
  const times = p.events.filter((e) => e.status === "entrevista" && e.interviewAt).map((e) => e.interviewAt as string);
  if (times.length < 2) return null;
  // The last event set the current time; the one before is what it replaced.
  const prev = times[times.length - 2];
  return toMs(prev) !== toMs(p.interview.at) ? prev : null;
}

// ------------------------------------------------------------------ timeline

export type TimelineRow = {
  key: string;
  title: string;
  /** Secondary line ("Para el lunes 9 nov, 10:00 a.m.", "Casi siempre en 1 a 3 días."). */
  detail?: string;
  /** When it happened (done/current rows). */
  at?: string;
  state: "done" | "current" | "todo";
  /** Position on the main track (1–4) of a step still ahead; reschedule rows don't shift it. */
  n?: number;
};

const FUTURE_TITLE: Record<(typeof MAIN_STEPS)[number], string> = {
  enviada: "Te postulas",
  vista: "La empresa la ve",
  entrevista: "Entrevista",
  contratada: "¡Te contratan!",
};

/**
 * The real timeline: what happened (from the events, oldest first) with the latest as "current",
 * then the steps still ahead on the main track (quiet). Closed applications end at the closing.
 */
export function timelineOf(p: ApplicationPipeline, now: number): TimelineRow[] {
  const rows: TimelineRow[] = [];
  let interviews = 0;
  p.events.forEach((e, i) => {
    const key = `${e.status}-${i}`;
    switch (e.status) {
      case "enviada":
        rows.push({ key, title: "Enviaste tu postulación", at: e.at, state: "done" });
        break;
      case "vista":
        rows.push({ key, title: "La empresa la vio", at: e.at, state: "done" });
        break;
      case "entrevista": {
        const when = e.interviewAt ? fmtDayTime(e.interviewAt, { now }) : null;
        rows.push(
          interviews === 0
            ? { key, title: "Te invitaron a entrevista", detail: when ? `Para ${when}` : undefined, at: e.at, state: "done" }
            : { key, title: "Cambiaron la hora de tu entrevista", detail: when ? `Ahora: ${when}` : undefined, at: e.at, state: "done" },
        );
        interviews++;
        break;
      }
      case "contratada":
        rows.push({ key, title: "¡Te contrataron!", at: e.at, state: "done" });
        break;
      case "cerrada":
        rows.push({
          key,
          title:
            e.actor === "candidato"
              ? "Retiraste tu postulación"
              : p.events[i - 1]?.status === "contratada"
                ? "Cancelaron tu contratación"
                : "Esta vez no quedaste",
          at: e.at,
          state: "done",
        });
        break;
    }
  });
  if (rows.length === 0) rows.push({ key: "enviada-0", title: "Enviaste tu postulación", at: p.appliedAt, state: "done" });
  rows[rows.length - 1].state = "current";

  const step = stepOf(p);
  if (!STEP_META[step].terminal) {
    const reached = trackIndex(p);
    MAIN_STEPS.forEach((s, i) => {
      if (i <= reached) return;
      rows.push({
        key: `todo-${s}`,
        title: FUTURE_TITLE[s],
        // The typical wait already shows in "¿Qué sigue?" next to the timeline; the interview step
        // has no such tile, so it says what comes after here.
        detail: i === reached + 1 && step === "entrevista" ? "Te avisan aquí después de tu entrevista." : undefined,
        state: "todo",
        n: i + 1,
      });
    });
  }
  return rows;
}

// ------------------------------------------------------------------ attention order

/**
 * Lower = needs attention first: upcoming interviews (soonest first), a fresh hire, an interview
 * that just happened, seen, sent, then the closed ones.
 */
export function attention(p: ApplicationPipeline, now: number): [number, number] {
  const step = stepOf(p);
  const last = toMs(p.events.at(-1)?.at ?? p.appliedAt);
  if (step === "entrevista" && p.interview) {
    const st = interviewState(p, now);
    if (st !== "past") return [0, toMs(p.interview.at)];
    return [2, -last];
  }
  const rank: Record<PipelineStep, number> = { contratada: 1, entrevista: 2, vista: 3, enviada: 4, descartada: 5, retirada: 6 };
  return [rank[step], -last];
}

export function byAttention(now: number) {
  return (a: ApplicationPipeline, b: ApplicationPipeline) => {
    const [ra, ta] = attention(a, now);
    const [rb, tb] = attention(b, now);
    return ra - rb || ta - tb;
  };
}

/** Pastel per step (the panel colour). Neighbours that would repeat get the next pastel. */
export const STEP_TONE: Record<PipelineStep, BlockTone> = {
  enviada: STEP_META.enviada.tone,
  vista: STEP_META.vista.tone,
  entrevista: STEP_META.entrevista.tone,
  contratada: STEP_META.contratada.tone,
  descartada: STEP_META.descartada.tone,
  retirada: STEP_META.retirada.tone,
};

const ALT: BlockTone[] = ["sol", "cielo", "limon", "menta", "durazno", "lila"];

/** Step tones for a list, nudged so adjacent cards never share one (and avoiding `avoid`). */
export function listTones(steps: PipelineStep[], avoid: BlockTone[] = []): BlockTone[] {
  const out: BlockTone[] = [];
  steps.forEach((s, i) => {
    const taken = new Set<BlockTone>([out[i - 1], ...(i === 0 ? avoid : [])].filter(Boolean) as BlockTone[]);
    let tone = STEP_TONE[s];
    let k = ALT.indexOf(tone);
    while (taken.has(tone)) tone = ALT[++k % ALT.length];
    out.push(tone);
  });
  return out;
}

/** Was it applied within the last `ms` (for the "¡Ya quedó!" confirmation after a reload)? */
export const appliedRecently = (p: Pick<ApplicationPipeline, "appliedAt" | "status">, now: number, ms = 30 * 60_000) =>
  p.status === "enviada" && now > 0 && now - toMs(p.appliedAt) < ms;

"use client";

import { useId, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import {
  Calendar03Icon,
  CancelCircleIcon,
  CheckmarkBadge01Icon,
  Clock01Icon,
  Location01Icon,
  Note01Icon,
  Tick02Icon,
} from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { BLOCK_CLASS, type BlockTone } from "@/components/chamba/primitives";
import { confetti } from "@/components/chamba/motion";
import { FIELD, HARD, HARD_SM, INK_BUTTON, OUTLINE, WHITE_BUTTON, WORK_CONFETTI } from "@/components/empresa/workwear";
import type { InterviewDetails } from "@/lib/data/types";
import {
  DEFAULT_DECLINE_MESSAGE,
  DEFAULT_UNHIRE_MESSAGE,
  MESSAGE_TEMPLATES,
  PIPELINE_LIMITS,
  PIPELINE_MSG,
  RESCHEDULE_NOTICE,
  STEP_META,
  UNHIRE_COPY,
  addDaysToKey,
  capitalize,
  decline,
  fmtDate,
  fmtDayTime,
  fmtDayTimeLong,
  fmtTime,
  fromZonedInput,
  hire,
  mtyWall,
  reopen,
  scheduleInterview,
  toZonedInput,
  defaultInterviewInput,
  todayInputKey,
  useNow,
  validateInterview,
  validateMessage,
} from "@/lib/pipeline";
import { cn } from "@/lib/utils";

/*
 * The recruiter's three pipeline dialogs, shared by the applicant page and the applicant cards:
 * agendar / reprogramar entrevista, contratar, descartar. Each one previews what the candidate will
 * read, validates inline (same rules as the action), and confirms only after the action resolved
 * without an error (the actions toast their own errors). Demo and live: the actions decide.
 */

const TEXTAREA = cn(FIELD, "block h-auto min-h-24 w-full resize-none py-3 leading-snug field-sizing-content");
const LABEL = "mb-2 flex items-baseline justify-between gap-3 text-[0.95rem] font-bold";
/** Ink on light; lime on the dark popover (ink would vanish into it). */
const SUBMIT = cn(
  "w-full text-[1.02rem] font-bold",
  INK_BUTTON,
  HARD_SM,
  "dark:border-ink dark:bg-limon dark:text-ink dark:hover:bg-limon/90 dark:[&_svg]:text-ink",
);
/** Picked day / time chip. */
const CHIP_ON = "bg-ink text-white dark:border-limon dark:bg-limon dark:text-ink";

/**
 * Workwear dialog: colored header strip + scrolling body + footer with the action.
 * These dialogs open from state (no DialogTrigger), so Radix has nothing to give focus back to on
 * close: return it to whatever opened the dialog, or to `returnFocus` when that control is gone
 * (e.g. "Agendar entrevista" disappears once the interview is set).
 */
function Shell({
  open,
  onOpenChange,
  tone,
  icon,
  title,
  description,
  busy,
  returnFocus,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tone: BlockTone;
  icon: IconSvgElement;
  title: React.ReactNode;
  description: React.ReactNode;
  busy?: boolean;
  returnFocus?: React.RefObject<HTMLElement | null>;
  /** A <Form>: scrolling fields + the footer with the action. */
  children: React.ReactNode;
}) {
  const opener = useRef<HTMLElement | null>(null);
  return (
    <Dialog open={open} onOpenChange={(o) => (busy ? undefined : onOpenChange(o))}>
      <DialogContent
        onOpenAutoFocus={() => {
          // Still the control that opened it (focus moves into the dialog right after this).
          const el = document.activeElement;
          opener.current = el instanceof HTMLElement && el !== document.body ? el : null;
        }}
        onCloseAutoFocus={(e) => {
          const back = opener.current?.isConnected ? opener.current : (returnFocus?.current ?? null);
          opener.current = null;
          if (!back) return;
          e.preventDefault();
          back.focus();
        }}
        className={cn(
          "flex max-h-[min(92dvh,52rem)] flex-col gap-0 overflow-hidden rounded-panel p-0 ring-0 sm:max-w-lg [&>[data-slot=dialog-close]]:top-3.5 [&>[data-slot=dialog-close]]:right-3.5 [&>[data-slot=dialog-close]]:text-ink [&>[data-slot=dialog-close]]:hover:bg-white/60",
          OUTLINE,
          HARD,
          "dark:border-white/25",
        )}
      >
        <div className={cn("relative isolate flex shrink-0 items-center gap-3.5 border-b-2 border-ink px-5 pt-5 pb-4 pr-14 sm:px-6", BLOCK_CLASS[tone])}>
          <span aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-dots opacity-60" />
          <span className="grid size-12 shrink-0 -rotate-6 place-items-center rounded-[0.9rem] border-2 border-ink bg-white text-ink">
            <HugeiconsIcon icon={icon} className="size-6" strokeWidth={2} />
          </span>
          <div className="min-w-0">
            <DialogTitle className="font-display text-[1.35rem] leading-[1.08] font-extrabold tracking-[-0.03em]">{title}</DialogTitle>
            <DialogDescription className="mt-1 text-[0.92rem] leading-snug text-muted-foreground">{description}</DialogDescription>
          </div>
        </div>
        {children}
      </DialogContent>
    </Dialog>
  );
}

/** The dialog's form: scrolling fields, then the footer (always visible) with the action. */
function Form({ onSubmit, children, footer }: { onSubmit: (e: React.FormEvent) => void; children: React.ReactNode; footer: React.ReactNode }) {
  return (
    <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pt-4 pb-5 sm:px-6">{children}</div>
      <div className="shrink-0 border-t-2 border-dashed border-border px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6">{footer}</div>
    </form>
  );
}

/** One-tap template chips that fill a text field. */
function TemplateChips({ items, onPick, label }: { items: readonly string[]; onPick: (t: string) => void; label: string }) {
  return (
    <div role="group" aria-label={label} className="no-scrollbar -mx-5 mt-2.5 flex gap-2 overflow-x-auto px-5 pb-1 sm:-mx-6 sm:px-6">
      {items.map((t) => (
        <button
          key={t}
          type="button"
          onClick={() => onPick(t)}
          className="press inline-flex min-h-10 max-w-[15rem] shrink-0 items-center rounded-full border-2 border-dashed border-ink/50 px-3 text-left text-[0.85rem] leading-tight font-semibold outline-none hover:bg-tile focus-visible:ring-3 focus-visible:ring-ring/50 dark:border-white/40"
        >
          <span className="line-clamp-2">{t}</span>
        </button>
      ))}
    </div>
  );
}

function Counter({ n, max }: { n: number; max: number }) {
  return (
    <span className={cn("text-[0.8rem] font-semibold tabular-nums", n > max ? "text-destructive" : "text-muted-foreground")}>
      {n}/{max}
    </span>
  );
}

/** "Así lo verá Jorge": a miniature of the candidate's status card (same copy they get). */
function Preview({
  who,
  tone,
  title,
  banner,
  children,
}: {
  who: string;
  tone: BlockTone;
  title: string;
  /** The orange strip the candidate sees over a rescheduled interview. */
  banner?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <figure className="mt-5">
      <figcaption className="mb-2 text-[0.75rem] font-extrabold tracking-[0.12em] text-muted-foreground uppercase">
        Así lo verá {who}
      </figcaption>
      <div className={cn("overflow-hidden rounded-tile", BLOCK_CLASS[tone], OUTLINE, HARD_SM)}>
        {banner ? (
          <p className="border-b-2 border-ink bg-block-mandarina px-4 py-2 text-[0.88rem] leading-snug font-semibold text-ink">{banner}</p>
        ) : null}
        <div className="p-4">
          <p className="font-display text-[1.15rem] leading-tight font-extrabold tracking-[-0.02em]">{title}</p>
          <div className="mt-1.5 space-y-1.5 text-[0.92rem] leading-snug">{children}</div>
        </div>
      </div>
    </figure>
  );
}

function ErrorLine({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <p id={id} role="alert" className="mt-2 text-[0.9rem] font-semibold text-destructive">
      {children}
    </p>
  );
}

// ------------------------------------------------------------------ interview

export type InterviewDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  applicationId: string;
  /** "Jorge" or "esta persona". */
  first: string;
  /** The current interview when rescheduling (status "entrevista"). */
  interview?: InterviewDetails | null;
  /** Prefill for the place (the vacancy's branch). */
  defaultPlace: string;
  /** Focus goes here on close when the control that opened the dialog is gone. */
  returnFocus?: React.RefObject<HTMLElement | null>;
  /** Called after it saved. */
  onDone?: () => void;
};

const TIME_CHIPS = ["09:00", "10:00", "11:00", "12:00", "13:00", "16:00", "17:00"];
const weekdayOf = (key: string) => new Date(`${key}T12:00:00Z`).getUTCDay();

export function InterviewDialog(props: InterviewDialogProps) {
  const reschedule = !!props.interview;
  return (
    <Shell
      open={props.open}
      onOpenChange={props.onOpenChange}
      tone="limon"
      icon={Calendar03Icon}
      returnFocus={props.returnFocus}
      title={reschedule ? "Cambiar la entrevista" : "Agendar entrevista"}
      description={
        reschedule
          ? `Ahora es ${fmtDayTime(props.interview!.at)}; si cambias el día o la hora, ${props.first} ve el nuevo horario.`
          : `Elige día, hora y lugar. ${capitalize(props.first)} lo ve en su postulación.`
      }
    >
      <InterviewForm {...props} />
    </Shell>
  );
}

function InterviewForm({ applicationId, first, interview, defaultPlace, onOpenChange, onDone }: InterviewDialogProps) {
  const reschedule = !!interview;
  // Ticking clock (dialogs open after hydration, so it's never 0 here).
  const now = useNow(15_000);
  const [initial] = useState(() => (interview ? toZonedInput(interview.at) : defaultInterviewInput()));
  const [date, setDate] = useState(initial.date);
  const [time, setTime] = useState(initial.time);
  const [place, setPlace] = useState(interview ? (interview.place ?? defaultPlace) : defaultPlace);
  const [note, setNote] = useState(interview?.note ?? "");
  const [busy, setBusy] = useState(false);
  const [tried, setTried] = useState(false);
  const errId = useId();
  const ids = { date: useId(), time: useId(), place: useId(), note: useId() };

  const today = todayInputKey(now);
  const lateToday = mtyWall(now).hour >= 18;
  const days = useMemo(() => {
    const out: string[] = [];
    let k = lateToday ? addDaysToKey(today, 1) : today;
    while (out.length < 5) {
      if (weekdayOf(k) !== 0) out.push(k);
      k = addDaysToKey(k, 1);
    }
    return out;
  }, [today, lateToday]);
  const dayLabel = (k: string) => {
    if (k === today) return "Hoy";
    if (k === addDaysToKey(today, 1)) return "Mañana";
    const iso = fromZonedInput(k, "12:00");
    return iso ? capitalize(fmtDate(iso, { now })) : k;
  };

  /** Picking a day keeps the hour unless it's already gone on that day: then the next hour still open. */
  function pickDate(k: string) {
    setDate(k);
    const iso = fromZonedInput(k, time);
    if (!iso || Date.parse(iso) >= now) return;
    const open = TIME_CHIPS.find((t) => {
      const c = fromZonedInput(k, t);
      return !!c && Date.parse(c) >= now;
    });
    setTime(open ?? "");
  }

  const at = fromZonedInput(date, time);
  const error = at ? validateInterview({ at, place, note }, now) : PIPELINE_MSG.interviewWhen;
  const whenError = error === PIPELINE_MSG.interviewWhen || error === PIPELINE_MSG.interviewPast || error === PIPELINE_MSG.interviewFar;
  const showError = error && (tried || (whenError && !!at));
  const sameTime = interview && at ? Date.parse(interview.at) === Date.parse(at) : false;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setTried(true);
    if (error || !at) return;
    setBusy(true);
    const r = await scheduleInterview(applicationId, { at, place, note });
    setBusy(false);
    if (r.error) return;
    // fmtDayTime ends in "a.m." / "p.m.": no extra period.
    toast.success(reschedule ? (sameTime ? "Guardamos los cambios de la entrevista." : `Nueva fecha: ${fmtDayTime(at)}`) : `Entrevista agendada: ${fmtDayTime(at)}`, {
      description: `${capitalize(first)} lo ve en su postulación.`,
    });
    onOpenChange(false);
    onDone?.();
  }

  return (
    <Form
      onSubmit={submit}
      footer={
        <Button
          type="submit"
          size="xl"
          aria-disabled={busy || undefined}
          className={cn(SUBMIT, busy && "opacity-80")}
        >
          <HugeiconsIcon icon={Tick02Icon} className="size-5" strokeWidth={2.6} />
          {busy ? "Guardando…" : reschedule ? (sameTime ? "Guardar cambios" : "Guardar nuevo horario") : "Agendar entrevista"}
        </Button>
      }
    >
      {/* min-w-0: a fieldset is min-content wide by default, and Chrome's date input is wide. */}
      <fieldset className="min-w-0">
        <legend className={LABEL}>¿Qué día?</legend>
        <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 pb-1 sm:-mx-6 sm:px-6">
          {days.map((k) => {
            const on = k === date;
            return (
              <button
                key={k}
                type="button"
                aria-pressed={on}
                onClick={() => pickDate(k)}
                className={cn(
                  "press inline-flex h-11 shrink-0 items-center rounded-full border-2 border-ink px-3.5 text-[0.92rem] font-bold outline-none focus-visible:ring-4 focus-visible:ring-ring/50",
                  on ? CHIP_ON : "bg-white text-ink",
                )}
              >
                {dayLabel(k)}
              </button>
            );
          })}
        </div>
        <label htmlFor={ids.date} className="mt-2.5 block text-[0.85rem] font-semibold text-muted-foreground">
          U otra fecha
        </label>
        <input
          id={ids.date}
          type="date"
          value={date}
          min={today}
          max={addDaysToKey(today, 180)}
          onChange={(e) => pickDate(e.target.value)}
          aria-invalid={showError && whenError ? true : undefined}
          aria-describedby={showError ? errId : undefined}
          className={cn(FIELD, "mt-1.5 w-full max-w-full min-w-0 font-semibold [color-scheme:light]")}
        />
      </fieldset>

      <fieldset className="mt-5 min-w-0">
        <legend className={LABEL}>¿A qué hora?</legend>
        <div className="flex flex-wrap gap-2">
          {TIME_CHIPS.map((t) => {
            const iso = fromZonedInput(date, t);
            const past = !!iso && Date.parse(iso) < now;
            // A gone hour is never shown as picked (the error below says why the time doesn't work).
            const on = t === time && !past;
            return (
              <button
                key={t}
                type="button"
                aria-pressed={on}
                disabled={past}
                onClick={() => setTime(t)}
                className={cn(
                  "press inline-flex h-10 items-center rounded-full border-2 border-ink px-3 text-[0.88rem] font-bold tabular-nums outline-none focus-visible:ring-4 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-35",
                  on ? CHIP_ON : "bg-white text-ink",
                )}
              >
                {iso ? fmtTime(iso) : t}
              </button>
            );
          })}
        </div>
        <label htmlFor={ids.time} className="mt-2.5 block text-[0.85rem] font-semibold text-muted-foreground">
          U otra hora
        </label>
        <input
          id={ids.time}
          type="time"
          step={300}
          value={time}
          onChange={(e) => setTime(e.target.value)}
          aria-invalid={showError && whenError ? true : undefined}
          className={cn(FIELD, "mt-1.5 w-full max-w-full min-w-0 font-semibold tabular-nums [color-scheme:light]")}
        />
        <p className="mt-1.5 text-[0.82rem] text-muted-foreground">Hora de Saltillo.</p>
      </fieldset>

      <div className="mt-5">
        <label htmlFor={ids.place} className={LABEL}>
          <span>¿Dónde?</span>
          <Counter n={place.trim().length} max={PIPELINE_LIMITS.place} />
        </label>
        <div className="relative">
          <HugeiconsIcon
            icon={Location01Icon}
            className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-ink/60"
            strokeWidth={2}
          />
          <input
            id={ids.place}
            value={place}
            onChange={(e) => setPlace(e.target.value)}
            placeholder={defaultPlace || "Ej. Recepción de la planta"}
            autoComplete="off"
            className={cn(FIELD, "w-full pl-11")}
          />
        </div>
        {defaultPlace && place.trim() !== defaultPlace ? (
          <button
            type="button"
            onClick={() => setPlace(defaultPlace)}
            className="mt-2 text-[0.88rem] font-bold text-uva-ink underline underline-offset-4 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            Usar la sucursal de la vacante
          </button>
        ) : null}
      </div>

      <div className="mt-5">
        <label htmlFor={ids.note} className={LABEL}>
          <span>
            Indicaciones <span className="font-medium text-muted-foreground">(opcional)</span>
          </span>
          <Counter n={note.trim().length} max={PIPELINE_LIMITS.note} />
        </label>
        <textarea
          id={ids.note}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder="Qué traer, por quién preguntar…"
          className={TEXTAREA}
        />
        <TemplateChips
          label="Indicaciones rápidas"
          items={MESSAGE_TEMPLATES.interviewNote}
          onPick={(t) => setNote((n) => (n.includes(t) ? n : n.trim() ? `${n.trim()} ${t}` : t))}
        />
      </div>

      {at && !whenError ? (
        <Preview
          who={first === "esta persona" ? "la persona" : first}
          tone="limon"
          title={STEP_META.entrevista.candidateTitle}
          banner={
            reschedule && interview && !sameTime ? (
              <>
                {RESCHEDULE_NOTICE} Antes: <s className="decoration-2">{fmtDayTime(interview.at, { now })}</s>
              </>
            ) : null
          }
        >
          <p className="flex items-start gap-2 font-bold">
            <HugeiconsIcon icon={Clock01Icon} className="mt-0.5 size-4 shrink-0" strokeWidth={2.4} />
            {fmtDayTimeLong(at, { now, capitalize: true })}
          </p>
          {place.trim() || defaultPlace ? (
            <p className="flex items-start gap-2">
              <HugeiconsIcon icon={Location01Icon} className="mt-0.5 size-4 shrink-0" strokeWidth={2.4} />
              {place.trim() || defaultPlace}
            </p>
          ) : null}
          {note.trim() ? (
            <p className="flex items-start gap-2">
              <HugeiconsIcon icon={Note01Icon} className="mt-0.5 size-4 shrink-0" strokeWidth={2.4} />
              {note.trim()}
            </p>
          ) : null}
        </Preview>
      ) : null}

      {showError ? <ErrorLine id={errId}>{error}</ErrorLine> : null}
    </Form>
  );
}

// ------------------------------------------------------------------ hire

export type OutcomeDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  applicationId: string;
  first: string;
  /** Editing the message of an application already in that state. */
  editing?: boolean;
  /** The message it has now (editing). */
  message?: string | null;
  /** Decline: the interview already happened (preselects the "after the interview" message). */
  afterInterview?: boolean;
  /** Decline of a hired person (or editing that message): cancel-the-hire copy, never "no quedaste". */
  unhire?: boolean;
  /** Focus goes here on close when the control that opened the dialog is gone. */
  returnFocus?: React.RefObject<HTMLElement | null>;
  onDone?: () => void;
};

export function HireDialog(props: OutcomeDialogProps) {
  const { editing, first } = props;
  return (
    <Shell
      open={props.open}
      onOpenChange={props.onOpenChange}
      tone="menta"
      icon={CheckmarkBadge01Icon}
      returnFocus={props.returnFocus}
      title={editing ? "Mensaje de bienvenida" : `¿Contratar a ${first}?`}
      description={
        editing
          ? `${capitalize(first)} lo ve en su postulación, junto con su contratación.`
          : `Pasa a «Contratada». Déjale un mensaje con los siguientes pasos (opcional).`
      }
    >
      <HireForm {...props} />
    </Shell>
  );
}

function HireForm({ applicationId, first, editing, message: current, onOpenChange, onDone }: OutcomeDialogProps) {
  const [message, setMessage] = useState(current ?? "");
  const [busy, setBusy] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const id = useId();
  const errId = useId();
  const error = validateMessage(message);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || error) return;
    setBusy(true);
    const r = await hire(applicationId, message);
    setBusy(false);
    if (r.error) return;
    if (editing) toast.success("Guardamos tu mensaje.");
    else {
      confetti({ origin: btn.current, colors: WORK_CONFETTI, count: 48 });
      toast.success(first === "esta persona" ? "¡Contrataste a esta persona!" : `¡Contrataste a ${first}!`, {
        description: "Ponte de acuerdo para su primer día.",
      });
    }
    onOpenChange(false);
    onDone?.();
  }

  return (
    <Form
      onSubmit={submit}
      footer={
        <Button
          ref={btn}
          type="submit"
          size="xl"
          aria-disabled={busy || !!error || undefined}
          className={cn(SUBMIT, busy && "opacity-80")}
        >
          <HugeiconsIcon icon={CheckmarkBadge01Icon} className="size-5 text-limon" strokeWidth={2.4} />
          {busy ? "Guardando…" : editing ? "Guardar mensaje" : "Sí, contratar"}
        </Button>
      }
    >
      <label htmlFor={id} className={LABEL}>
        <span>
          Mensaje <span className="font-medium text-muted-foreground">(opcional)</span>
        </span>
        <Counter n={message.trim().length} max={PIPELINE_LIMITS.message} />
      </label>
      <textarea
        id={id}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={3}
        placeholder="Cuándo y a qué hora se presenta, qué papeles trae…"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errId : undefined}
        className={TEXTAREA}
      />
      <TemplateChips label="Mensajes rápidos" items={MESSAGE_TEMPLATES.hire} onPick={setMessage} />
      {/* Same text the candidate's card shows: their message, or the generic next step without one. */}
      <Preview who={first === "esta persona" ? "la persona" : first} tone="menta" title={STEP_META.contratada.candidateTitle}>
        <p>{message.trim() || STEP_META.contratada.candidateNext}</p>
      </Preview>
      {error ? <ErrorLine id={errId}>{error}</ErrorLine> : null}
    </Form>
  );
}

// ------------------------------------------------------------------ decline

type Choice = { title: string; text: string };

const DECLINE_CHOICES: readonly Choice[] = [
  { title: "Gracias por postularte", text: MESSAGE_TEMPLATES.decline[0] },
  { title: "Después de la entrevista", text: MESSAGE_TEMPLATES.decline[1] },
  { title: "Ya cubrimos la vacante", text: MESSAGE_TEMPLATES.decline[2] },
];

/** Cancelling a hire: the person was told "¡Te contrataron!", so nothing about "no quedaste". */
const UNHIRE_CHOICES: readonly Choice[] = [
  { title: "Ya no seguimos", text: MESSAGE_TEMPLATES.unhire[0] },
  { title: "El puesto ya no está", text: MESSAGE_TEMPLATES.unhire[1] },
];

export function DeclineDialog(props: OutcomeDialogProps) {
  const { editing, first, unhire } = props;
  return (
    <Shell
      open={props.open}
      onOpenChange={props.onOpenChange}
      tone="lila"
      icon={CancelCircleIcon}
      returnFocus={props.returnFocus}
      title={editing ? "Mensaje para la persona" : unhire ? `¿Cancelar la contratación de ${first}?` : `¿Descartar a ${first}?`}
      description={
        editing
          ? `${capitalize(first)} lo ve en su postulación.`
          : unhire
            ? "Ya le avisaste que quedó: explícale con un mensaje amable. Lo ve en su postulación. Puedes reabrirla después."
            : "Elige un mensaje amable. Así sabe que no siguió y puede buscar otra chamba. Puedes reabrirla después."
      }
    >
      <DeclineForm {...props} />
    </Shell>
  );
}

function DeclineForm({ applicationId, first, editing, message: current, afterInterview, unhire, onOpenChange, onDone }: OutcomeDialogProps) {
  const choices = unhire ? UNHIRE_CHOICES : DECLINE_CHOICES;
  const fallback = unhire ? DEFAULT_UNHIRE_MESSAGE : DEFAULT_DECLINE_MESSAGE;
  const start = current ? choices.findIndex((c) => c.text === current) : !unhire && afterInterview ? 1 : 0;
  const [choice, setChoice] = useState<number>(start);
  const [custom, setCustom] = useState(start === -1 ? (current ?? "") : "");
  const [busy, setBusy] = useState(false);
  const id = useId();
  const errId = useId();
  const groupId = useId();
  const radios = useRef<(HTMLButtonElement | null)[]>([]);
  const customRef = useRef<HTMLTextAreaElement>(null);
  const message = choice === -1 ? custom : choices[choice].text;
  const error = validateMessage(message);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || error) return;
    setBusy(true);
    const r = await decline(applicationId, message.trim() || fallback);
    setBusy(false);
    if (r.error) return;
    if (editing) toast.success("Guardamos tu mensaje.");
    else
      toast.success(
        unhire
          ? first === "esta persona"
            ? "Cancelaste la contratación."
            : `Cancelaste la contratación de ${first}.`
          : first === "esta persona"
            ? "Descartaste esta postulación."
            : `Descartaste a ${first}.`,
        {
          description: "Verá tu mensaje en su postulación.",
          // Long enough to read and react (the default 4 s isn't).
          duration: 10_000,
          action: {
            label: "Deshacer",
            onClick: () =>
              void reopen(applicationId).then((u) => {
                if (!u.error) toast.success("Listo, la reabriste.");
              }),
          },
        },
      );
    onOpenChange(false);
    onDone?.();
  }

  const options = [...choices.map((c, i) => ({ i, title: c.title, text: c.text })), { i: -1, title: "Escribir mi mensaje", text: "" }];

  /** Radio group keys: arrows move the selection (and focus), one Tab stop for the group. */
  function onRadioKey(e: React.KeyboardEvent, index: number) {
    const n = options.length;
    const to =
      e.key === "ArrowDown" || e.key === "ArrowRight"
        ? (index + 1) % n
        : e.key === "ArrowUp" || e.key === "ArrowLeft"
          ? (index - 1 + n) % n
          : e.key === "Home"
            ? 0
            : e.key === "End"
              ? n - 1
              : -1;
    if (to === -1) return;
    e.preventDefault();
    setChoice(options[to].i);
    radios.current[to]?.focus();
  }

  return (
    <Form
      onSubmit={submit}
      footer={
        <div className="grid gap-2 sm:grid-cols-[auto_1fr]">
          <Button
            type="button"
            size="lg"
            className={cn("hidden h-14 px-5 sm:inline-flex", WHITE_BUTTON)}
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            size="xl"
            aria-disabled={busy || !!error || undefined}
            className={cn(SUBMIT, busy && "opacity-80")}
          >
            {busy ? "Guardando…" : editing ? "Guardar mensaje" : unhire ? "Cancelar y enviar mensaje" : "Descartar y enviar mensaje"}
          </Button>
        </div>
      }
    >
      <p id={groupId} className={LABEL}>
        Mensaje
      </p>
      <div role="radiogroup" aria-labelledby={groupId} className="grid gap-2">
        {options.map((o, index) => {
          const on = choice === o.i;
          return (
            <button
              key={o.i}
              ref={(el) => {
                radios.current[index] = el;
              }}
              type="button"
              role="radio"
              aria-checked={on}
              tabIndex={on ? 0 : -1}
              onKeyDown={(e) => onRadioKey(e, index)}
              onClick={() => {
                setChoice(o.i);
                // Tapping "Escribir mi mensaje" goes straight to the text box (arrowing past it doesn't).
                if (o.i === -1) requestAnimationFrame(() => customRef.current?.focus());
              }}
              className={cn(
                "press flex w-full items-start gap-3 rounded-tile border-2 p-3 text-left outline-none focus-visible:ring-4 focus-visible:ring-ring/50",
                on ? "border-ink bg-block-lila text-ink shadow-[3px_3px_0_0_var(--ink)]" : "border-ink/25 bg-card hover:border-ink/60 dark:border-white/25",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border-2",
                  on ? "border-ink bg-ink" : "border-current opacity-50",
                )}
              >
                {on ? <span className="size-2 rounded-full bg-limon" /> : null}
              </span>
              <span className="min-w-0">
                <span className="block text-[0.95rem] leading-tight font-bold">{o.title}</span>
                {o.text ? (
                  <span className={cn("mt-1 block text-[0.85rem] leading-snug", on ? "text-ink/75" : "text-muted-foreground")}>
                    {o.text}
                  </span>
                ) : null}
              </span>
            </button>
          );
        })}
      </div>
      {choice === -1 ? (
        <div className="mt-3">
          <label htmlFor={id} className={LABEL}>
            <span>Tu mensaje</span>
            <Counter n={custom.trim().length} max={PIPELINE_LIMITS.message} />
          </label>
          <textarea
            id={id}
            ref={customRef}
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            rows={3}
            placeholder={fallback}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errId : undefined}
            className={TEXTAREA}
          />
        </div>
      ) : null}
      {/* The same title, message and closing line the candidate's card shows. */}
      <Preview
        who={first === "esta persona" ? "la persona" : first}
        tone="lila"
        title={unhire ? UNHIRE_COPY.title : STEP_META.descartada.candidateTitle}
      >
        <p>{message.trim() || fallback}</p>
        <p className="text-muted-foreground">{unhire ? UNHIRE_COPY.next : STEP_META.descartada.candidateNext}</p>
      </Preview>
      {error ? <ErrorLine id={errId}>{error}</ErrorLine> : null}
    </Form>
  );
}

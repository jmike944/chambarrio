"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowTurnBackwardIcon,
  Calendar03Icon,
  CalendarAdd01Icon,
  CancelCircleIcon,
  CheckmarkBadge01Icon,
  Edit02Icon,
  Location01Icon,
  Logout03Icon,
  MapsLocation01Icon,
  Message01Icon,
  Note01Icon,
  Tick02Icon,
  SquareLock02Icon,
  ViewIcon,
} from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/chamba/primitives";
import { HARD, HARD_SM, INK_BUTTON, OUTLINE, WHITE_BUTTON } from "@/components/empresa/workwear";
import { DeclineDialog, HireDialog, InterviewDialog } from "@/components/empresa/pipeline/pipeline-dialogs";
import { StepChip, interviewDone } from "@/components/empresa/pipeline/pipeline-kit";
import type { ApplicationPipeline, Branch } from "@/lib/data/types";
import {
  MAIN_STEPS,
  STEP_META,
  capitalize,
  fmtDate,
  fmtDayTime,
  fmtDayTimeLong,
  mapsLink,
  declineUndoable,
  recruiterCan,
  stepOf,
  trackIndex,
  wasHiredBeforeClose,
  type PipelineActions,
} from "@/lib/pipeline";
import { cn } from "@/lib/utils";

/*
 * The applicant page's one saturated block: where this application is (Enviada → Vista →
 * Entrevista → Contratada, or Descartada / Se retiró), what to do now, and every company action.
 * Opening the page marks a new application as seen (applicant-page); "Marcar como vista" stays as
 * the fallback when that write failed.
 *
 * Locked vacancy (payments on, not unlocked): "Marcar como vista" and "Descartar" stay free, but
 * scheduling or hiring would hand the person's day/time/place over without paying, so those open
 * the unlock dialog first and continue to the interview / hire dialog once it's unlocked.
 */

type Dialog = "interview" | "hire" | "decline" | null;

export function PipelineCard({
  data,
  first,
  defaultPlace,
  branch,
  companyName,
  actions,
  now,
  onLocked,
  noPhone,
  className,
}: {
  data: ApplicationPipeline;
  /** "Jorge" or "esta persona". */
  first: string;
  defaultPlace: string;
  branch?: Branch;
  companyName: string | null;
  actions: PipelineActions;
  now: number;
  /**
   * Set while the vacancy is locked and unlocking is possible: called instead of opening the
   * interview / hire dialog, with what to open once it's unlocked.
   */
  onLocked?: ((then: () => void) => void) | null;
  /** Neither the vacancy nor the company has a phone (the interview dialog warns). */
  noPhone?: boolean;
  className?: string;
}) {
  const [dialog, setDialog] = useState<Dialog>(null);
  const [busy, setBusy] = useState<"seen" | "reopen" | null>(null);
  const step = stepOf(data);
  const can = recruiterCan(data);
  const reached = trackIndex(data);
  const closed = step === "descartada" || step === "retirada";
  const interview = data.interview;
  const done = interview && now ? interviewDone({ interviewAt: interview.at }, now) : false;
  /** The interview time itself has passed (no grace): only then did they "have" it. */
  const interviewPast = !!interview && !!now && Date.parse(interview.at) < now;
  const unhired = wasHiredBeforeClose(data);
  const who = capitalize(first);
  const titleRef = useRef<HTMLHeadingElement>(null);
  /** Interview and hire need the vacancy unlocked (when unlocking exists); the rest is free. */
  const openPaid = (d: "interview" | "hire") => (onLocked ? onLocked(() => setDialog(d)) : setDialog(d));

  const title =
    step === "enviada"
      ? "Nueva postulación"
      : step === "vista"
        ? "Ya viste su postulación"
        : step === "entrevista"
          ? !interview
            ? "Entrevista sin fecha"
            : done
              ? "¿Cómo le fue en la entrevista?"
              : `Entrevista ${now ? fmtDayTime(interview.at, { now }) : ""}`.trim()
          : step === "contratada"
            ? first === "esta persona"
              ? "¡Contratación lista!"
              : `¡${who} ya es del equipo!`
            : step === "descartada"
              ? unhired
                ? "Contratación cancelada"
                : "Postulación descartada"
              : "Se retiró";

  const next =
    step === "enviada"
      ? `Revisa su perfil. Al marcarla como vista, ${first} sabe que ya la revisaste.`
      : step === "entrevista" && done
        ? "Si te convenció, contrátala. Si no, descártala con un mensaje amable."
        : STEP_META[step].recruiterNext;

  async function markSeen() {
    if (busy) return;
    setBusy("seen");
    const r = await actions.markSeen();
    setBusy(null);
    if (!r.error) toast.success("Marcada como vista.", { description: `${who} ve que ya revisaste su postulación.` });
  }

  async function reopen() {
    if (busy) return;
    // Within the undo window the decline is erased for the candidate (its email never goes out);
    // later, the candidate is told the company picked it up again.
    const quiet = declineUndoable(data);
    setBusy("reopen");
    const r = await actions.reopen();
    setBusy(null);
    if (!r.error) {
      toast.success("Reabriste la postulación.", {
        description: quiet
          ? "Vuelve a la etapa en la que estaba. No le llega ningún aviso del descarte."
          : `Vuelve a la etapa en la que estaba. ${who} recibe un aviso de que sigue en el proceso.`,
      });
    }
  }

  const map = interview ? mapsLink({ place: interview.place, branch, companyName }) : null;
  const secondary = cn("h-12 w-full px-4 text-[0.98rem] font-bold", WHITE_BUTTON);
  const declineBtn = (
    <Button
      size="lg"
      className="h-12 w-full border-2 border-white/45 bg-transparent px-4 text-[0.98rem] font-bold text-primary-foreground hover:bg-white/10 dark:bg-transparent"
      onClick={() => setDialog("decline")}
    >
      <HugeiconsIcon icon={CancelCircleIcon} className="size-5" strokeWidth={2.2} />
      Descartar
    </Button>
  );

  return (
    <section
      aria-labelledby="proceso-title"
      className={cn("block-uva relative isolate overflow-hidden rounded-panel p-5 sm:p-6", OUTLINE, HARD, className)}
    >
      <span aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-dots opacity-40 [mask-image:linear-gradient(to_bottom,black,transparent_60%)]" />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Eyebrow tone="lime">Proceso de contratación</Eyebrow>
        <span className="flex items-center gap-2">
          {data.pending ? (
            <span role="status" className="text-[0.85rem] font-semibold text-primary-foreground/80">
              Guardando…
            </span>
          ) : null}
          <StepChip step={step} pending={data.pending} className="border-white/30" />
        </span>
      </div>
      <h2
        id="proceso-title"
        ref={titleRef}
        tabIndex={-1}
        className="mt-2 font-display text-[1.75rem] leading-[1.04] font-extrabold tracking-[-0.035em] sm:text-[2rem]"
      >
        {title}
      </h2>

      {/* ------------------------------------------------ track */}
      <ol aria-label="Etapas" className="mt-4 grid grid-cols-4 gap-1.5">
        {MAIN_STEPS.map((s, i) => {
          // Past the interview step (hired / closed): it only counts as done if it actually happened.
          const skipped = s === "entrevista" && step !== "entrevista" && reached > i && !interviewPast;
          const isDone = !skipped && (i < reached || (i === reached && (closed || step === "contratada")));
          const current = !closed && i === reached && step !== "contratada";
          return (
            <li key={s} aria-current={current ? "step" : undefined} className="min-w-0">
              <span
                aria-hidden
                className={cn(
                  "block h-3 rounded-full border-2 border-ink",
                  isDone ? "bg-limon" : current ? "bg-white" : "bg-white/15",
                  current && "ring-3 ring-limon/70",
                )}
              />
              <span
                className={cn(
                  "mt-1.5 block truncate text-[0.78rem] leading-tight sm:text-[0.82rem]",
                  current || isDone ? "font-bold text-primary-foreground" : "text-primary-foreground/65",
                )}
              >
                <span className="sr-only">{isDone ? "Hecho: " : current ? "Ahora: " : skipped ? "Sin hacer: " : "Pendiente: "}</span>
                {STEP_META[s].label}
              </span>
            </li>
          );
        })}
      </ol>
      {closed ? (
        <p className="mt-3 inline-flex items-center gap-1.5 rounded-full border-2 border-ink bg-white px-3 py-1 text-[0.85rem] font-bold text-ink">
          <HugeiconsIcon icon={step === "retirada" ? Logout03Icon : CancelCircleIcon} className="size-4" strokeWidth={2.4} />
          {step === "retirada" ? "Se retiró" : unhired ? "Contratación cancelada" : "Descartada"}
          {data.closedAt ? <span className="font-semibold text-ink/65">· {fmtDate(data.closedAt, { now: now || undefined })}</span> : null}
        </p>
      ) : null}

      {step === "retirada" ? null : <p className="mt-4 text-[1rem] leading-snug text-primary-foreground/85">{next}</p>}

      {/* ------------------------------------------------ interview */}
      {interview ? (
        <div className={cn("mt-4 rounded-tile bg-white p-4 text-ink", OUTLINE, HARD_SM)}>
          <p className="flex items-center gap-1.5 text-[0.72rem] font-extrabold tracking-[0.12em] text-ink/65 uppercase">
            <HugeiconsIcon icon={Calendar03Icon} className="size-4" strokeWidth={2.4} />
            {step === "entrevista"
              ? done
                ? "Fue la entrevista"
                : "Entrevista"
              : interviewPast
                ? "Tuvo entrevista"
                : step === "contratada"
                  ? "Entrevista agendada"
                  : "Iba a tener entrevista"}
          </p>
          <p className="mt-1 font-display text-[1.25rem] leading-tight font-extrabold tracking-[-0.02em]">
            {now ? fmtDayTimeLong(interview.at, { now, capitalize: true }) : "—"}
          </p>
          <p className="mt-2 flex items-start gap-2 text-[0.95rem] leading-snug">
            <HugeiconsIcon icon={Location01Icon} className="mt-0.5 size-4.5 shrink-0" strokeWidth={2.2} />
            <span className="min-w-0">
              {interview.place || defaultPlace || "En tu sucursal"}
              {map ? (
                <>
                  {" "}
                  <a
                    href={map}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-bold whitespace-nowrap underline underline-offset-4 outline-none focus-visible:ring-3 focus-visible:ring-ink/40"
                  >
                    <HugeiconsIcon icon={MapsLocation01Icon} className="size-4" strokeWidth={2.2} />
                    Ver mapa
                  </a>
                </>
              ) : null}
            </span>
          </p>
          {interview.note ? (
            <p className="mt-1.5 flex items-start gap-2 text-[0.95rem] leading-snug">
              <HugeiconsIcon icon={Note01Icon} className="mt-0.5 size-4.5 shrink-0" strokeWidth={2.2} />
              <span className="min-w-0 whitespace-pre-line">{interview.note}</span>
            </p>
          ) : null}
          {can.reschedule ? (
            <Button size="lg" className={cn("mt-3 h-11 w-full px-4", INK_BUTTON)} onClick={() => setDialog("interview")}>
              <HugeiconsIcon icon={done ? CalendarAdd01Icon : Edit02Icon} className="size-4.5 text-limon" strokeWidth={2.2} />
              {done ? "Agendar otra entrevista" : "Cambiar fecha, hora o lugar"}
            </Button>
          ) : null}
        </div>
      ) : null}

      {/* ------------------------------------------------ message the candidate sees */}
      {data.companyMessage && (step === "contratada" || step === "descartada" || step === "entrevista") ? (
        <div className="mt-4 rounded-tile border-2 border-white/30 bg-white/10 p-4">
          <p className="flex items-center gap-1.5 text-[0.72rem] font-extrabold tracking-[0.12em] text-primary-foreground/75 uppercase">
            <HugeiconsIcon icon={Message01Icon} className="size-4" strokeWidth={2.4} />
            Tu mensaje para {first === "esta persona" ? "la persona" : first}
          </p>
          <p className="mt-1.5 text-[0.98rem] leading-snug whitespace-pre-line">{data.companyMessage}</p>
          {step === "contratada" || step === "descartada" ? (
            <button
              type="button"
              onClick={() => setDialog(step === "contratada" ? "hire" : "decline")}
              className="mt-2 inline-flex min-h-10 items-center gap-1.5 rounded-full text-[0.9rem] font-bold text-limon underline underline-offset-4 outline-none focus-visible:ring-3 focus-visible:ring-white/60"
            >
              <HugeiconsIcon icon={Edit02Icon} className="size-4" strokeWidth={2.2} />
              Editar mensaje
            </button>
          ) : null}
        </div>
      ) : null}

      {/* ------------------------------------------------ withdrawn: read-only */}
      {step === "retirada" ? (
        <div className="mt-4 flex items-start gap-3 rounded-tile border-2 border-dashed border-white/40 p-4">
          <HugeiconsIcon icon={Logout03Icon} className="mt-0.5 size-5 shrink-0 text-limon" strokeWidth={2.2} />
          <p className="text-[0.95rem] leading-snug">
            {/* fmtDayTime ends in "a.m." / "p.m.", so no period right after it. */}
            {data.events.filter((e) => e.status !== "cerrada").at(-1)?.status === "contratada" ? (
              <>
                {who} avisó que ya no va a tomar el trabajo{data.closedAt && now ? ` ${fmtDayTime(data.closedAt, { now })}` : ""}: puedes
                buscar a alguien más entre tus postulantes. Tus notas se quedan aquí.
              </>
            ) : (
              <>
                {who} retiró su postulación{data.closedAt && now ? ` ${fmtDayTime(data.closedAt, { now })}` : ""}: ya no puedes cambiar
                su estado. Tus notas se quedan aquí.
              </>
            )}
          </p>
        </div>
      ) : null}

      {/* ------------------------------------------------ actions */}
      {onLocked && (step === "enviada" || step === "vista" || step === "entrevista") ? (
        <p className="mt-4 flex items-start gap-2 rounded-tile border-2 border-dashed border-white/40 px-3 py-2.5 text-[0.9rem] leading-snug text-primary-foreground/90">
          <HugeiconsIcon icon={SquareLock02Icon} className="mt-0.5 size-4 shrink-0 text-limon" strokeWidth={2.4} />
          Para agendar la entrevista o contratar, desbloquea la vacante. Marcar como vista y descartar son gratis.
        </p>
      ) : null}
      {step !== "retirada" ? (
        <div className="mt-5 grid gap-2.5">
          {step === "enviada" ? (
            <Button
              size="xl"
              variant="lime"
              className={cn("w-full text-[1.05rem] font-bold", OUTLINE, HARD_SM, busy === "seen" && "opacity-80")}
              aria-disabled={!!busy || data.pending || undefined}
              onClick={() => void markSeen()}
            >
              <HugeiconsIcon icon={ViewIcon} className="size-5" strokeWidth={2.2} />
              {busy === "seen" ? "Guardando…" : "Marcar como vista"}
            </Button>
          ) : null}

          {step === "vista" || (step === "entrevista" && !interview) ? (
            <Button
              size="xl"
              variant="lime"
              className={cn("w-full text-[1.05rem] font-bold", OUTLINE, HARD_SM)}
              onClick={() => openPaid("interview")}
            >
              <HugeiconsIcon icon={onLocked ? SquareLock02Icon : CalendarAdd01Icon} className="size-5" strokeWidth={2.2} />
              Agendar entrevista
            </Button>
          ) : null}

          {step === "entrevista" && interview ? (
            <Button
              size="xl"
              variant="lime"
              className={cn("w-full text-[1.05rem] font-bold", OUTLINE, HARD_SM)}
              onClick={() => openPaid("hire")}
            >
              <HugeiconsIcon icon={onLocked ? SquareLock02Icon : CheckmarkBadge01Icon} className="size-5" strokeWidth={2.2} />
              Contratar
            </Button>
          ) : null}

          {step === "descartada" && can.reopen ? (
            <Button
              size="xl"
              variant="lime"
              className={cn("w-full text-[1.05rem] font-bold", OUTLINE, HARD_SM, busy === "reopen" && "opacity-80")}
              aria-disabled={!!busy || data.pending || undefined}
              onClick={() => void reopen()}
            >
              <HugeiconsIcon icon={ArrowTurnBackwardIcon} className="size-5" strokeWidth={2.2} />
              {busy === "reopen" ? "Reabriendo…" : "Reabrir postulación"}
            </Button>
          ) : null}

          {step === "enviada" ? (
            <>
              <div className="grid grid-cols-2 gap-2.5">
                <Button size="lg" className={secondary} onClick={() => openPaid("interview")}>
                  <HugeiconsIcon icon={onLocked ? SquareLock02Icon : CalendarAdd01Icon} className="size-5" strokeWidth={2.2} />
                  <span className="truncate">Entrevista</span>
                </Button>
                <Button size="lg" className={secondary} onClick={() => openPaid("hire")}>
                  <HugeiconsIcon icon={onLocked ? SquareLock02Icon : Tick02Icon} className="size-5" strokeWidth={2.4} />
                  Contratar
                </Button>
              </div>
              {declineBtn}
            </>
          ) : step === "vista" ? (
            <div className="grid grid-cols-2 gap-2.5">
              <Button size="lg" className={secondary} onClick={() => openPaid("hire")}>
                <HugeiconsIcon icon={onLocked ? SquareLock02Icon : Tick02Icon} className="size-5" strokeWidth={2.4} />
                Contratar
              </Button>
              {declineBtn}
            </div>
          ) : step === "entrevista" ? (
            declineBtn
          ) : step === "contratada" ? (
            <>
              {data.companyMessage ? null : (
                <Button size="lg" className={cn(secondary, "min-w-0")} onClick={() => setDialog("hire")}>
                  <HugeiconsIcon icon={Message01Icon} className="size-5" strokeWidth={2.2} />
                  <span className="truncate">Mensaje de bienvenida</span>
                </Button>
              )}
              <button
                type="button"
                onClick={() => setDialog("decline")}
                className="mx-auto inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-[0.9rem] font-semibold text-primary-foreground/80 underline underline-offset-4 outline-none hover:text-primary-foreground focus-visible:ring-3 focus-visible:ring-white/60"
              >
                ¿Ya no sigue? Cancelar contratación
              </button>
            </>
          ) : null}
        </div>
      ) : null}

      <InterviewDialog
        open={dialog === "interview"}
        onOpenChange={(o) => setDialog(o ? "interview" : null)}
        applicationId={data.id}
        first={first}
        interview={step === "entrevista" ? interview : null}
        defaultPlace={defaultPlace}
        again={step === "entrevista" && done}
        noPhone={noPhone}
        returnFocus={titleRef}
      />
      <HireDialog
        open={dialog === "hire"}
        onOpenChange={(o) => setDialog(o ? "hire" : null)}
        applicationId={data.id}
        first={first}
        editing={step === "contratada"}
        message={step === "contratada" ? data.companyMessage : null}
        returnFocus={titleRef}
      />
      <DeclineDialog
        open={dialog === "decline"}
        onOpenChange={(o) => setDialog(o ? "decline" : null)}
        applicationId={data.id}
        first={first}
        editing={step === "descartada"}
        message={step === "descartada" ? data.companyMessage : null}
        afterInterview={interviewPast}
        unhire={step === "contratada" || unhired}
        returnFocus={titleRef}
      />
    </section>
  );
}

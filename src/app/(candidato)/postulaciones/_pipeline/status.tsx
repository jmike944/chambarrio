"use client";

import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowRight01Icon, Clock01Icon, QuoteDownIcon, UserIcon } from "@hugeicons/core-free-icons";
import { Mascot, type MascotMood } from "@/components/chamba/art/mascot";
import { Scene } from "@/components/chamba/art/scenes";
import type { ApplicationPipeline } from "@/lib/data/types";
import {
  DEFAULT_DECLINE_MESSAGE,
  DEFAULT_UNHIRE_MESSAGE,
  MAIN_STEPS,
  STEP_META,
  UNHIRE_COPY,
  stepOf,
  trackIndex,
  wasHiredBeforeClose,
  type PipelineStep,
} from "@/lib/pipeline/steps";
import { cn } from "@/lib/utils";
import { BRING_ITEMS, Checklist, ContactCompany, FIRST_DAY_ITEMS, InterviewTicket, WHITE_BTN, type JobCtx } from "./interview";
import { ago, candidateTitle, interviewState, stepLabel, STEP_DOT, type CSSVars } from "./model";
import { useMyStrength } from "./profile";
import { SimilarJobs } from "./similar";
import { PipelineTimeline } from "./timeline";
import { WithdrawButton } from "./withdraw";

const TILE = "min-w-0 rounded-tile bg-white/55 p-3.5 sm:p-4";

export const STEP_MOOD: Record<PipelineStep, MascotMood> = {
  enviada: "feliz",
  vista: "wow",
  entrevista: "saluda",
  contratada: "festeja",
  descartada: "piensa",
  retirada: "duerme",
};

/** White status chip with the step's dot (ink text, reads on any pastel). */
export function StepChip({
  p,
  className,
}: {
  p: Pick<ApplicationPipeline, "status" | "closedBy"> & { events?: ApplicationPipeline["events"] };
  className?: string;
}) {
  const step = stepOf(p);
  return (
    <span
      className={cn(
        "inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full border-2 border-ink bg-white px-2.5 text-[0.8rem] font-bold whitespace-nowrap text-ink",
        className,
      )}
    >
      <span aria-hidden className="size-2 rounded-full ring-1 ring-ink/30" style={{ background: STEP_DOT[step] }} />
      {stepLabel(p)}
    </span>
  );
}

/** Four chunky segments: how far along the main track it got; closed ones end with a cross segment. */
export function MiniTrack({ p, inverse, className }: { p: ApplicationPipeline; inverse?: boolean; className?: string }) {
  const reached = trackIndex(p);
  const closed = p.status === "cerrada";
  return (
    <div
      role="img"
      aria-label={`Paso ${reached + 1} de ${MAIN_STEPS.length}: ${stepLabel(p)}`}
      className={cn("grid grid-cols-4 gap-1.5", className)}
    >
      {MAIN_STEPS.map((s, i) => (
        <span
          key={s}
          className={cn(
            "h-2.5 rounded-full border-2",
            inverse
              ? [
                  i < reached && "border-white bg-white",
                  i === reached && (closed ? "border-white bg-white/40" : "border-white bg-limon"),
                  i > reached && "border-dashed border-white/40",
                ]
              : [
                  "border-ink",
                  i < reached && "bg-ink",
                  i === reached && (closed ? "bg-ink/40" : "bg-limon"),
                  i > reached && (closed ? "border-dashed border-ink/25" : "border-dashed border-ink/35 bg-hatch"),
                ],
          )}
        />
      ))}
    </div>
  );
}

/** "Qué sigue": what happens now + the typical wait. */
function NextTile({ step, nudge = true, className }: { step: PipelineStep; nudge?: boolean; className?: string }) {
  const meta = STEP_META[step];
  const strength = useMyStrength();
  const showNudge = nudge && strength.low;
  return (
    <section className={cn(TILE, "flex flex-col", className)}>
      <h3 className="font-display text-[1.15rem] leading-tight font-extrabold tracking-[-0.02em]">¿Qué sigue?</h3>
      <p className="mt-1 text-[0.98rem] leading-snug">{meta.candidateNext}</p>
      {meta.typical ? (
        <p className="mt-2.5 flex items-start gap-2 rounded-xl bg-white/70 px-3 py-2 text-[0.92rem] leading-snug font-medium">
          <HugeiconsIcon icon={Clock01Icon} className="mt-0.5 size-4 shrink-0" strokeWidth={2.4} />
          {meta.typical}
        </p>
      ) : null}
      {showNudge ? (
        <Link
          href="/perfil"
          className="group press mt-auto flex items-center gap-3 rounded-xl pt-3 outline-none focus-visible:ring-3 focus-visible:ring-ink/30"
        >
          <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-full border-2 border-ink bg-white">
            <HugeiconsIcon icon={UserIcon} className="size-5" strokeWidth={2.2} />
          </span>
          <span className="min-w-0 flex-1 text-[0.92rem] leading-snug">
            <span className="block font-semibold underline decoration-2 underline-offset-4">Completa tu perfil para destacar</span>
            <span className="text-muted-foreground">Tu perfil va en {strength.value}%. Mientras esperas, súmale puntos.</span>
          </span>
          <HugeiconsIcon icon={ArrowRight01Icon} className="size-5 shrink-0 transition-transform group-hover:translate-x-0.5" strokeWidth={2.2} />
        </Link>
      ) : (
        // Wide only: next to the history, so this tile ends where the history does (no empty band).
        <div className="mt-auto hidden pt-3 @3xl:block">
          <p className="text-[0.72rem] font-extrabold tracking-[0.14em] uppercase opacity-70">Mientras esperas</p>
          <ul className="mt-1.5 space-y-1.5 text-[0.92rem] leading-snug">
            <li className="flex items-start gap-2">
              <span aria-hidden className="mt-[0.45rem] size-1.5 shrink-0 rotate-45 bg-ink" />
              Contesta los números que no conoces: puede ser la empresa.
            </li>
            <li className="flex items-start gap-2">
              <span aria-hidden className="mt-[0.45rem] size-1.5 shrink-0 rotate-45 bg-ink" />
              <span>
                No tienes que esperar:{" "}
                <Link href="/vacantes" className="font-semibold underline decoration-2 underline-offset-4 outline-none focus-visible:ring-3 focus-visible:ring-ink/30">
                  postúlate a otras vacantes cerca
                </Link>
                .
              </span>
            </li>
          </ul>
        </div>
      )}
    </section>
  );
}

function HistoryTile({ p, now, className }: { p: ApplicationPipeline; now: number; className?: string }) {
  return (
    <section aria-label="Historial" className={cn(TILE, className)}>
      <h3 className="mb-3 font-display text-[1.15rem] leading-tight font-extrabold tracking-[-0.02em]">Tu historial</h3>
      <PipelineTimeline p={p} now={now} />
    </section>
  );
}

function MessageTile({
  label,
  message,
  aside,
  children,
  className,
}: {
  label: string;
  message: string;
  /** Art beside the quote (the tile becomes a row). */
  aside?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <figure className={cn("min-w-0 rounded-tile border-2 border-ink bg-white p-4 text-ink shadow-[4px_4px_0_0_var(--ink)]", className)}>
      <div className="min-w-0 flex-1">
        <figcaption className="flex items-center gap-1.5 text-[0.72rem] font-bold tracking-[0.12em] text-ink/65 uppercase">
          <HugeiconsIcon icon={QuoteDownIcon} className="size-4" strokeWidth={2.2} />
          {label}
        </figcaption>
        <blockquote className="mt-1.5 font-display text-[1.15rem] leading-snug font-bold tracking-[-0.01em] sm:text-[1.3rem]">{message}</blockquote>
        {children}
      </div>
      {aside}
    </figure>
  );
}

/**
 * The state-aware body of "Tu postulación" (the caller draws the block and its header). Stacks on
 * a narrow container and splits into two equal-height columns from ~48rem (container query).
 */
export function PipelineStatus({
  p,
  now,
  job,
  company,
  branch,
  nudge = true,
}: { p: ApplicationPipeline; now: number; nudge?: boolean } & JobCtx) {
  const step = stepOf(p);
  const companyName = company?.name ?? null;
  const withdraw = <WithdrawButton p={p} jobTitle={job?.title} companyName={companyName} className="-ml-3 self-start" />;

  if (step === "enviada" || step === "vista") {
    return (
      <div className="@container">
        <div className="grid gap-3 @3xl:grid-cols-2">
          <HistoryTile p={p} now={now} />
          <div className="flex min-w-0 flex-col gap-2">
            <NextTile step={step} nudge={nudge} className="flex-1" />
            {withdraw}
          </div>
        </div>
      </div>
    );
  }

  if (step === "entrevista") {
    const st = interviewState(p, now);
    // Narrow: one column (ticket → qué llevar → contact → history). Wide: two balanced columns
    // (ticket + contact | checklist + history); the wrappers are `contents` until the split.
    return (
      <div className="@container">
        <div className="grid gap-3 @3xl:grid-cols-[1.12fr_0.88fr]">
          <div className="contents @3xl:flex @3xl:min-w-0 @3xl:flex-col @3xl:gap-3">
            <InterviewTicket p={p} now={now} job={job} company={company} branch={branch} />
            <ContactCompany
              p={p}
              now={now}
              job={job}
              company={company}
              title={st === "past" ? "¿Tienes dudas?" : "¿No puedes ir? Llama o manda SMS"}
              hint={st === "past" ? "Pregunta cómo va tu proceso." : undefined}
              smsBody={st === "past" ? `Hola, tuve entrevista para ${job?.title ?? "la vacante"}. ¿Ya saben algo de mi proceso? Gracias.` : undefined}
              className="order-3 @3xl:order-none"
            />
            {st === "past" ? null : <InterviewTips className="order-4 @3xl:order-none @3xl:flex-1" />}
          </div>
          <div className="contents @3xl:flex @3xl:min-w-0 @3xl:flex-col @3xl:gap-3">
            {st === "past" ? null : (
              <Checklist id={`${p.id}:llevar`} title="Qué llevar" items={BRING_ITEMS} className="order-2 @3xl:order-none" />
            )}
            <HistoryTile p={p} now={now} className="order-5 @3xl:order-none @3xl:flex-1" />
            <div className="order-6 @3xl:order-none">{withdraw}</div>
          </div>
        </div>
      </div>
    );
  }

  if (step === "contratada") {
    // Narrow: message → contact → first day → history. Wide: message across the top, then the
    // checklist and the history side by side (similar heights), contact across the bottom.
    return (
      <div className="@container">
        <div className="grid gap-3 @3xl:grid-cols-2">
          <MessageTile
            // Without a message from the company, the generic next step isn't labeled as theirs.
            label={!p.companyMessage?.trim() ? "Qué sigue" : companyName ? `Mensaje de ${companyName}` : "Mensaje de la empresa"}
            message={p.companyMessage?.trim() || STEP_META.contratada.candidateNext}
            className="flex items-center gap-4 @3xl:col-span-2"
            aside={<Scene name="contratado" className="hidden w-32 shrink-0 @lg:block @3xl:w-36" />}
          />
          <ContactCompany
            p={p}
            now={now}
            job={job}
            company={company}
            title="Confirma tu primer día"
            hint="Llama o manda SMS para acordar día y hora."
            smsBody={`Hola, gracias por contratarme para ${job?.title ?? "la vacante"}. ¿Qué día y a qué hora me presento? ¿Qué documentos llevo?`}
            className="@3xl:order-last @3xl:col-span-2"
          />
          <Checklist id={`${p.id}:primer-dia`} title="Tu primer día" items={FIRST_DAY_ITEMS} />
          <HistoryTile p={p} now={now} />
          {/* Quiet way out: turning the job down tells the company (no call needed). */}
          <div className="@3xl:order-last @3xl:col-span-2">{withdraw}</div>
        </div>
      </div>
    );
  }

  if (step === "descartada") {
    const unhired = wasHiredBeforeClose(p);
    return (
      <div className="@container">
        <div className="grid gap-3 @3xl:grid-cols-2">
          <div className="flex min-w-0 flex-col gap-3">
            <MessageTile
              label={companyName ? `Mensaje de ${companyName}` : "Mensaje de la empresa"}
              message={p.companyMessage?.trim() || (unhired ? DEFAULT_UNHIRE_MESSAGE : DEFAULT_DECLINE_MESSAGE)}
            >
              <p className="mt-3 text-[0.95rem] leading-snug text-ink/75">
                {unhired ? UNHIRE_COPY.next : STEP_META.descartada.candidateNext}
              </p>
            </MessageTile>
            <HistoryTile p={p} now={now} className="flex-1" />
          </div>
          <SimilarJobs category={job?.category} excludeId={p.jobId} className="h-full" />
        </div>
      </div>
    );
  }

  // retirada (also: turned the job down after being hired)
  const turnedDown = p.events.filter((e) => e.status !== "cerrada").at(-1)?.status === "contratada";
  return (
    <div className={cn(TILE, "flex flex-wrap items-center gap-x-4 gap-y-3")}>
      <p className="min-w-0 flex-1 basis-56 text-[0.98rem] leading-snug">
        {turnedDown
          ? `Le avisaste a ${companyName ?? "la empresa"} que ya no vas a tomar el trabajo${p.closedAt ? ` ${ago(p.closedAt, now)}` : ""}. Gracias por avisar a tiempo.`
          : `Retiraste tu postulación${p.closedAt ? ` ${ago(p.closedAt, now)}` : ""}. ${companyName ?? "La empresa"} ya no te tiene en su lista para esta vacante.`}
      </p>
      <Link href="/vacantes" className={cn(WHITE_BTN, "shrink-0")}>
        Ver vacantes cerca
        <HugeiconsIcon icon={ArrowRight01Icon} className="size-4" strokeWidth={2.4} />
      </Link>
    </div>
  );
}

const TIPS = [
  { title: "Llega 10 minutos antes", body: "Calcula el camión o el camino desde hoy." },
  { title: "Ropa limpia y cómoda", body: "No hace falta traje: como para un día de trabajo." },
  { title: "Celular en silencio", body: "Y con saldo, por si te llaman para ubicarte." },
];

/** Three short interview tips (a blue-collar interview, not an office one). */
function InterviewTips({ className }: { className?: string }) {
  return (
    <section aria-label="Consejos para tu entrevista" className={cn(TILE, className)}>
      <h3 className="font-display text-[1.1rem] leading-tight font-extrabold tracking-[-0.02em]">Para que te vaya bien</h3>
      <ul className="mt-2 space-y-2">
        {TIPS.map((t, i) => (
          <li key={t.title} className="flex items-start gap-2.5">
            <span aria-hidden className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-ink font-display text-[0.8rem] font-extrabold text-limon">
              {i + 1}
            </span>
            <span className="min-w-0 text-[0.92rem] leading-snug">
              <span className="font-semibold">{t.title}.</span> <span className="text-muted-foreground">{t.body}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Header of the "Tu postulación" block: eyebrow + title + chip + mini track, mascot at the right. */
export function StatusHeader({
  p,
  now,
  title,
  as: H = "h2",
  id,
  className,
}: {
  p: ApplicationPipeline;
  /** For the title once the interview passed (0 / omitted = before hydration). */
  now?: number;
  /** Replaces the step's title (e.g. while the "¡Ya quedó!" block above already says it arrived). */
  title?: string;
  as?: "h2" | "h3";
  id?: string;
  className?: string;
}) {
  const step = stepOf(p);
  return (
    <header className={cn("flex items-start gap-3", className)}>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2 text-[0.72rem] font-extrabold tracking-[0.14em] uppercase">
          Tu postulación
          <StepChip p={p} className="tracking-normal normal-case" />
          {p.pending ? <span className="font-semibold tracking-normal normal-case opacity-70">Guardando…</span> : null}
        </p>
        <H id={id} className="mt-2 font-display text-[1.6rem] leading-[1.05] font-extrabold tracking-[-0.03em] sm:text-[1.9rem]">
          {title ?? candidateTitle(p, now ?? 0)}
        </H>
        <MiniTrack p={p} className="mt-3 max-w-xs" />
      </div>
      <Mascot
        mood={STEP_MOOD[step]}
        prop={step === "contratada" ? "trofeo" : "casco"}
        size={84}
        className="-mt-1 -mr-1 w-[4.5rem] shrink-0 sm:w-[5.25rem]"
      />
    </header>
  );
}

/** Before applying: the four steps, briefly. */
export function NotAppliedSteps({ className }: { className?: string }) {
  const steps = [
    { title: "Te postulas", body: "Un toque y listo, sin currículum." },
    { title: "La empresa la ve", body: "Casi siempre en 1 a 3 días." },
    { title: "Entrevista", body: "Aquí te llega el día, la hora y el lugar." },
    { title: "¡Te contratan!", body: "A chambear cerca de tu casa." },
  ];
  return (
    <ol className={cn("grid gap-2", className)}>
      {steps.map((s, i) => (
        <li
          key={s.title}
          className={cn(
            "flex animate-rise items-start gap-3 rounded-tile p-2.5",
            i === 0 ? "border-2 border-ink bg-white text-ink shadow-[3px_3px_0_0_var(--ink)]" : "bg-white/45",
          )}
          style={{ "--i": i } as CSSVars}
        >
          <span
            aria-hidden
            className={cn(
              "grid size-9 shrink-0 place-items-center rounded-full font-display text-[1rem] font-extrabold",
              i === 0 ? "bg-limon text-ink ring-2 ring-ink" : "bg-ink text-white",
            )}
          >
            {i + 1}
          </span>
          <span className="min-w-0 pt-0.5">
            <span className="block leading-snug font-semibold">{s.title}</span>
            <span className={cn("block text-[0.9rem] leading-snug", i === 0 ? "text-ink/70" : "text-muted-foreground")}>{s.body}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

"use client";

import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Alert02Icon,
  ArrowRight01Icon,
  Calendar03Icon,
  CalendarAdd01Icon,
  Call02Icon,
  Location01Icon,
  Message01Icon,
  QuoteDownIcon,
  Tick02Icon,
} from "@hugeicons/core-free-icons";
import type { ApplicationPipeline, Branch, Company, Job } from "@/lib/data/types";
import { RESCHEDULE_NOTICE, STEP_META } from "@/lib/pipeline/steps";
import { capitalize, fmtDateLong, fmtDayTime, fmtRelative, fmtTime, relativeDayWord } from "@/lib/pipeline/time";
import { defaultInterviewPlace, mapsLink } from "@/lib/pipeline/places";
import { downloadIcs, formatPhoneMx } from "@/lib/pipeline/ics";
import { interviewIcsFor } from "@/lib/pipeline/ics-for";
import { useApp } from "@/lib/store";
import { cn } from "@/lib/utils";
import { useChecklist } from "./checklist";
import { interviewState, rescheduledFrom } from "./model";

export type JobCtx = { job?: Job | null; company?: Company | null; branch?: Branch | null };

const INK_BTN =
  "press inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-ink px-5 text-[0.98rem] font-semibold text-white outline-none hover:bg-ink/90 focus-visible:ring-3 focus-visible:ring-ink/40";
export const WHITE_BTN =
  "press inline-flex min-h-12 items-center justify-center gap-2 rounded-full border-2 border-ink bg-white px-4 text-[0.98rem] font-semibold text-ink outline-none hover:bg-block-limon focus-visible:ring-3 focus-visible:ring-ink/40";

/** The interview as a ticket: big day + time, place with a map link, the company's note, calendar. */
export function InterviewTicket({ p, now, job, company, branch }: { p: ApplicationPipeline; now: number } & JobCtx) {
  const iv = p.interview;
  if (!iv) return <NoTimeYet />;
  const st = interviewState(p, now);
  const companyName = company?.name ?? null;
  const place = iv.place ?? (branch ? defaultInterviewPlace(branch, companyName) : null);
  const map = mapsLink({ place: iv.place, branch, companyName });
  const word = relativeDayWord(iv.at, now);
  const when = st === "past" ? "Ya pasó" : word ? capitalize(word) : fmtRelative(iv.at, { now, capitalize: true });
  const changedFrom = rescheduledFrom(p);

  function addToCalendar() {
    const cal = interviewIcsFor(p, { job, company, branch });
    if (!cal) return;
    try {
      downloadIcs(cal.ics, cal.fileName);
      toast.success("Listo: ábrelo para guardarla en tu calendario", { description: "Te recuerda 1 hora antes." });
    } catch {
      toast.error("No pudimos crear el archivo del calendario. Anota la fecha y la hora.");
    }
  }

  return (
    <div className="relative min-w-0 rounded-tile border-2 border-ink bg-white text-ink shadow-[4px_4px_0_0_var(--ink)]">
      {changedFrom && st !== "past" ? (
        <p className="flex items-start gap-2 rounded-t-[calc(var(--radius-tile)-2px)] border-b-2 border-ink bg-block-mandarina px-4 py-2.5 text-[0.92rem] leading-snug font-semibold text-ink">
          <HugeiconsIcon icon={Alert02Icon} className="mt-0.5 size-[1.1rem] shrink-0" strokeWidth={2.4} />
          <span>
            {/* fmtDayTime ends in "a.m." / "p.m.": no period after it. */}
            {RESCHEDULE_NOTICE} Antes: <s className="decoration-2">{fmtDayTime(changedFrom, { now })}</s>
          </span>
        </p>
      ) : null}
      <div className="flex items-start gap-3.5 p-4 sm:p-5">
        <span aria-hidden className="grid size-12 shrink-0 -rotate-3 place-items-center rounded-xl bg-ink text-limon">
          <HugeiconsIcon icon={Calendar03Icon} className="size-6" strokeWidth={2.2} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 text-[0.72rem] font-extrabold tracking-[0.14em] uppercase">
            Tu entrevista
            <span
              className={cn(
                "inline-flex h-6 items-center gap-1.5 rounded-full px-2 tracking-[0.08em]",
                st === "today" ? "bg-chile text-white" : st === "past" ? "bg-ink/10" : "bg-block-limon ring-2 ring-ink",
              )}
            >
              {st === "today" ? <span aria-hidden className="size-1.5 animate-beat rounded-full bg-white" /> : null}
              {when}
            </span>
          </p>
          <p className="mt-1.5 font-display text-[1.3rem] leading-tight font-extrabold tracking-[-0.02em] sm:text-[1.45rem]">
            {fmtDateLong(iv.at, { now, capitalize: true })}
          </p>
          <p className="font-display text-[2.5rem] leading-none font-extrabold tracking-[-0.04em] tabular-nums sm:text-[2.9rem]">
            {fmtTime(iv.at)}
          </p>
        </div>
      </div>

      <div aria-hidden className="mx-4 border-t-2 border-dashed border-ink/25 sm:mx-5" />

      <div className="space-y-3 p-4 sm:p-5">
        {place ? (
          <div className="flex items-start gap-3">
            <span aria-hidden className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-full border-2 border-ink bg-block-sol">
              <HugeiconsIcon icon={Location01Icon} className="size-[1.1rem]" strokeWidth={2.2} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[0.72rem] font-bold tracking-[0.12em] text-ink/60 uppercase">Dónde</p>
              <p className="leading-snug font-semibold">{place}</p>
              {map ? (
                <a
                  href={map}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-flex min-h-11 items-center gap-1 font-semibold text-uva-ink underline decoration-2 underline-offset-4 outline-none hover:decoration-[3px] focus-visible:ring-3 focus-visible:ring-ink/30"
                >
                  Ver en el mapa
                  <HugeiconsIcon icon={ArrowRight01Icon} className="size-4" strokeWidth={2.4} />
                </a>
              ) : null}
            </div>
          </div>
        ) : null}

        {iv.note || p.companyMessage ? (
          <figure className="rounded-tile border-2 border-ink/15 bg-block-sol/45 p-3.5">
            <figcaption className="flex items-center gap-1.5 text-[0.72rem] font-bold tracking-[0.12em] text-ink/65 uppercase">
              <HugeiconsIcon icon={QuoteDownIcon} className="size-4" strokeWidth={2.2} />
              {companyName ? `Nota de ${companyName}` : "Nota de la empresa"}
            </figcaption>
            {iv.note ? <blockquote className="mt-1 text-[0.98rem] leading-snug font-medium">{iv.note}</blockquote> : null}
            {p.companyMessage ? <blockquote className="mt-1 text-[0.98rem] leading-snug font-medium">{p.companyMessage}</blockquote> : null}
          </figure>
        ) : null}

        {st === "past" ? (
          <div className="rounded-tile bg-block-cielo/60 p-3.5">
            <p className="font-display text-[1.15rem] leading-tight font-extrabold">¿Cómo te fue?</p>
            <p className="mt-1 text-[0.95rem] leading-snug">
              La empresa te avisa aquí. {STEP_META.entrevista.typical}
            </p>
          </div>
        ) : (
          <button type="button" onClick={addToCalendar} className={cn(INK_BTN, "w-full")}>
            <HugeiconsIcon icon={CalendarAdd01Icon} className="size-5 text-limon" strokeWidth={2.2} />
            Agregar a mi calendario
          </button>
        )}
      </div>
    </div>
  );
}

/** Entrevista without a day yet (old rows, or live still loading the details). */
function NoTimeYet() {
  return (
    <div className="rounded-tile border-2 border-ink bg-white p-4 text-ink shadow-[4px_4px_0_0_var(--ink)]">
      <p className="text-[0.72rem] font-extrabold tracking-[0.14em] uppercase">Tu entrevista</p>
      <p className="mt-1 font-display text-[1.25rem] leading-tight font-extrabold">Falta acordar el día y la hora</p>
      <p className="mt-1 text-[0.95rem] leading-snug text-ink/75">La empresa te llama o te manda SMS para acordar el día y la hora.</p>
    </div>
  );
}

// ------------------------------------------------------------------ checklists

export const BRING_ITEMS = [
  "INE (identificación oficial)",
  "CURP",
  "Comprobante de domicilio",
  "NSS (número de seguro social)",
  "RFC, si tienes",
  "Solicitud elaborada",
] as const;

export const FIRST_DAY_ITEMS = [
  "Confirma el día y la hora de entrada",
  "Llega 10 minutos antes",
  "INE, CURP y RFC",
  "NSS (número de seguro social)",
  "Comprobante de domicilio",
  "Pregunta tu horario y día de pago",
] as const;

/** Tappable checklist (ticks remembered on this device). */
export function Checklist({
  id,
  title,
  items,
  className,
}: {
  id: string;
  title: string;
  items: readonly string[];
  className?: string;
}) {
  const [checked, toggle] = useChecklist(id);
  const done = items.filter((i) => checked.includes(i)).length;
  return (
    <section aria-label={title} className={cn("@container min-w-0 rounded-tile bg-white/55 p-3.5 sm:p-4", className)}>
      <header className="mb-2.5 flex items-center justify-between gap-2">
        <h3 className="font-display text-[1.15rem] leading-tight font-extrabold tracking-[-0.02em]">{title}</h3>
        <span
          className={cn(
            "inline-flex h-7 shrink-0 items-center rounded-full px-2.5 text-[0.8rem] font-bold tabular-nums",
            done === items.length ? "bg-ink text-limon" : "bg-white text-ink ring-2 ring-ink/15",
          )}
        >
          {done === items.length ? "¡Todo listo!" : `${done} de ${items.length}`}
        </span>
      </header>
      <ul className="grid gap-1.5 @md:grid-cols-2">
        {items.map((item) => {
          const on = checked.includes(item);
          return (
            <li key={item}>
              <button
                type="button"
                role="checkbox"
                aria-checked={on}
                onClick={() => toggle(item)}
                className={cn(
                  "press flex min-h-11 w-full items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-left text-[0.95rem] leading-snug font-medium outline-none focus-visible:ring-3 focus-visible:ring-ink/30",
                  on ? "bg-white/80" : "hover:bg-white/60",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "grid size-6 shrink-0 place-items-center rounded-md border-2 border-ink transition-colors",
                    on ? "bg-ink text-limon" : "bg-white",
                  )}
                >
                  {on ? <HugeiconsIcon icon={Tick02Icon} className="size-4" strokeWidth={3} /> : null}
                </span>
                <span className={cn(on && "line-through decoration-2 opacity-60")}>{item}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// ------------------------------------------------------------------ contact

/** "¿No puedes ir? Llama o manda SMS" (or "Confirma tu primer día") with the vacancy's phone. */
export function ContactCompany({
  p,
  now,
  job,
  title,
  hint,
  smsBody,
  className,
}: {
  p: ApplicationPipeline;
  now: number;
  job?: Job | null;
  title: string;
  hint?: string;
  smsBody?: string;
  className?: string;
}) {
  const name = useApp((s) => s.name.trim());
  const phone = job?.phone?.replace(/\D/g, "") ?? "";
  if (!phone) return null;
  const at = p.interview?.at;
  const body =
    smsBody ??
    `Hola${name ? `, soy ${name}` : ""}. Tengo entrevista para ${job?.title ?? "la vacante"}${
      at ? ` ${fmtDayTime(at, { now })}` : ""
    } y no voy a poder llegar. ¿Podemos cambiar el día o la hora? Gracias.`;
  return (
    <section className={cn("@container min-w-0 rounded-tile bg-white/55 p-3.5 sm:p-4", className)}>
      <div className="flex flex-col gap-3 @2xl:flex-row @2xl:items-center @2xl:justify-between">
      <div className="min-w-0">
        <h3 className="font-display text-[1.1rem] leading-tight font-extrabold tracking-[-0.02em]">{title}</h3>
        <p className="mt-0.5 text-[0.9rem] leading-snug text-muted-foreground">
          {hint ?? "Avísale a la empresa con tiempo."} <span className="whitespace-nowrap">{formatPhoneMx(phone)}</span>
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2 @2xl:w-80 @2xl:shrink-0">
        <a href={`sms:+52${phone}?&body=${encodeURIComponent(body)}`} className={WHITE_BTN}>
          <HugeiconsIcon icon={Message01Icon} className="size-5" strokeWidth={2.2} />
          SMS
        </a>
        <a href={`tel:+52${phone}`} className={WHITE_BTN}>
          <HugeiconsIcon icon={Call02Icon} className="size-5" strokeWidth={2.2} />
          Llamar
        </a>
      </div>
      </div>
    </section>
  );
}

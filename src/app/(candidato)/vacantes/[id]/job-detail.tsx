"use client";

import Link from "next/link";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowLeft01Icon,
  Bicycle01Icon,
  Bookmark01Icon,
  Building06Icon,
  Bus01Icon,
  Call02Icon,
  Car01Icon,
  CheckListIcon,
  CheckmarkBadge01Icon,
  Clock01Icon,
  Location01Icon,
  Money03Icon,
  Note01Icon,
  Route01Icon,
  Tick02Icon,
  WalkingIcon,
  WhatsappIcon,
} from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Panel, StatTile, surface, type BlockTone } from "@/components/chamba/primitives";
import { CountUp, Reveal, StepList, Sticker, useConfetti } from "@/components/chamba/motion";
import { CategoryArt, CategoryIcon, CATEGORY_BLOCK } from "@/components/chamba/job-icons";
import { Scene } from "@/components/chamba/art/scenes";
import { Mascot } from "@/components/chamba/art/mascot";
import { Doodle } from "@/components/chamba/art/doodles";
import { CATEGORY_BY_ID } from "@/lib/data/categories";
import { COMPANY_BY_ID, JOB_BY_ID } from "@/lib/data/jobs";
import { bandColor, bandFor, BAND_LABEL, commuteOptions, distanceKm, formatKm, type CommuteMode } from "@/lib/geo";
import { formatMinutesAgo, formatMXN, formatNumber, formatPay, PERIOD_LONG } from "@/lib/format";
import { useApp } from "@/lib/store";
import { cn } from "@/lib/utils";

type CSSVars = React.CSSProperties & Record<`--${string}`, string | number>;

const MODE_ICON: Record<CommuteMode, typeof Car01Icon> = {
  caminando: WalkingIcon,
  bici: Bicycle01Icon,
  camion: Bus01Icon,
  auto: Car01Icon,
};

/** Workwear look: hard offset ink shadow (still reads on the dark canvas). */
const HARD = "shadow-[5px_5px_0_0_var(--ink)] dark:shadow-[5px_5px_0_0_rgb(0_0_0/0.65)]";
const HARD_SM = "shadow-[3px_3px_0_0_var(--ink)] dark:shadow-[3px_3px_0_0_rgb(0_0_0/0.65)]";
/** Hazard-tape stripes (static). */
const HAZARD: React.CSSProperties = {
  backgroundImage: "repeating-linear-gradient(-45deg, var(--ink) 0 12px, transparent 12px 24px)",
};
/**
 * Pastel order for the page's blocks; the hero's own tone is removed so neighbours never match.
 * No lila here: the rugged palette keeps lavender for at most one accent per screen.
 */
const PASTELS: BlockTone[] = ["sol", "cielo", "durazno", "menta", "limon"];
const CHIP_BG = ["bg-block-sol", "bg-block-cielo", "bg-block-menta", "bg-block-durazno", "bg-block-limon"];
const CONFETTI = ["var(--block-sol)", "var(--block-mandarina)", "var(--limon)", "var(--cielo)", "var(--primary)"];

function Fact({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={cn("min-w-0 rounded-tile border-2 border-border bg-tile p-3.5", className)}>
      <dt className="text-[0.72rem] font-bold tracking-[0.12em] text-muted-foreground uppercase">{label}</dt>
      <dd className="mt-1 text-[1rem] leading-snug font-semibold">{value}</dd>
    </div>
  );
}

/** Block section title: ink icon disc + chunky display heading. */
function BlockHeader({ icon, title, onCard }: { icon: typeof Car01Icon; title: string; onCard?: boolean }) {
  return (
    <header className="mb-4 flex items-center gap-3">
      <span className={cn("grid size-11 shrink-0 place-items-center rounded-full bg-ink text-white", onCard && "dark:bg-limon dark:text-ink")}>
        <HugeiconsIcon icon={icon} className="size-5" strokeWidth={2} />
      </span>
      <h2 className="font-display text-[1.35rem] leading-tight font-extrabold tracking-[-0.03em]">{title}</h2>
    </header>
  );
}

export function JobDetail({ jobId }: { jobId: string }) {
  const job = JOB_BY_ID[jobId];
  const company = COMPANY_BY_ID[job.companyId];
  const home = useApp((s) => s.home);
  const saved = useApp((s) => s.saved.includes(jobId));
  const applied = useApp((s) => s.applications.some((a) => a.jobId === jobId));
  const apply = useApp((s) => s.apply);
  const toggleSaved = useApp((s) => s.toggleSaved);
  const fire = useConfetti();

  const km = distanceKm(home, job.location);
  const band = bandFor(km);
  const commutes = commuteOptions(km);
  const fastest = commutes.reduce((a, b) => (b.minutes < a.minutes ? b : a), commutes[0]);
  const waText = encodeURIComponent(
    `Hola, vi la vacante de ${job.title} en Chambarrio y me interesa. ¿Sigue disponible?`,
  );
  const category = CATEGORY_BY_ID[job.category];

  const heroTone = CATEGORY_BLOCK[job.category];
  const tones = PASTELS.filter((t) => t !== heroTone);
  const successTone: BlockTone = heroTone === "limon" ? "menta" : "limon";
  const initials = company.name
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  function onApply(e: React.MouseEvent<HTMLButtonElement>) {
    apply(jobId);
    fire({ origin: e.currentTarget, count: 56, colors: CONFETTI });
    toast.success("¡Ya quedó! Postulación enviada", {
      description: `${company.name} ya tiene tu solicitud. Te avisamos por WhatsApp.`,
    });
  }

  function onSave() {
    toggleSaved(jobId);
    toast(saved ? "Quitada de tus guardadas" : "Guardada para después");
  }

  /** CTA cluster — lives on the violet action block (mobile bar; `stacked` in the narrower desktop aside). */
  const renderActions = (stacked = false) => (
    <div className="flex flex-col gap-2.5">
      <Button
        variant="lime"
        size="xl"
        className={cn("w-full border-2 border-ink text-[1.05rem] font-bold disabled:opacity-100", !applied && HARD_SM)}
        onClick={onApply}
        disabled={applied}
      >
        {applied ? (
          <>
            <HugeiconsIcon icon={Tick02Icon} className="size-5" strokeWidth={2.4} />
            Ya te postulaste
          </>
        ) : (
          "¡Postularme!"
        )}
      </Button>
      <div className={cn("grid gap-2.5", stacked ? "grid-cols-2" : "grid-cols-[1fr_1fr_auto]")}>
        <Button asChild variant="white" size="lg" className="border-2 border-ink bg-white text-ink hover:bg-white/90 dark:bg-white dark:text-ink dark:hover:bg-white/90">
          <a href={`https://wa.me/52${job.phone}?text=${waText}`} target="_blank" rel="noopener noreferrer">
            <HugeiconsIcon icon={WhatsappIcon} className="size-5 text-nopal" strokeWidth={2} />
            WhatsApp
          </a>
        </Button>
        <Button asChild variant="white" size="lg" className="border-2 border-ink bg-white text-ink hover:bg-white/90 dark:bg-white dark:text-ink dark:hover:bg-white/90">
          <a href={`tel:+52${job.phone}`}>
            <HugeiconsIcon icon={Call02Icon} className="size-5" strokeWidth={2} />
            Llamar
          </a>
        </Button>
        <Button
          variant="white"
          size={stacked ? "lg" : "icon-lg"}
          className={cn(
            "border-2 border-ink bg-white text-ink hover:bg-white/90 dark:bg-white dark:text-ink",
            saved && "bg-block-sol hover:bg-block-sol dark:bg-block-sol",
            stacked && "col-span-2 w-full",
          )}
          onClick={onSave}
          aria-pressed={saved}
          aria-label={saved ? "Quitar de guardadas" : "Guardar vacante"}
        >
          <HugeiconsIcon icon={Bookmark01Icon} className="size-5" strokeWidth={saved ? 2.6 : 2} />
          {stacked ? <span aria-hidden>{saved ? "Guardada" : "Guardar para después"}</span> : null}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="pt-5 pb-48 lg:pt-10 lg:pb-0">
      <Link
        href="/vacantes"
        className={cn(
          "press inline-flex h-11 items-center gap-2 rounded-full border-2 border-ink bg-card pr-4 pl-2.5 font-semibold outline-none hover:-translate-x-0.5 focus-visible:ring-3 focus-visible:ring-ring/50",
          HARD_SM,
        )}
      >
        <HugeiconsIcon icon={ArrowLeft01Icon} className="size-5" strokeWidth={2.2} />
        Vacantes
      </Link>

      <div className="mt-5 grid gap-5 lg:grid-cols-12">
        <div className="min-w-0 space-y-5 lg:col-span-8">
          {/* ------------------------------------------------ hero: category block + huge moving art */}
          <div className="relative animate-rise">
            <section
              aria-labelledby="vacante-titulo"
              className={cn(
                "relative isolate overflow-hidden rounded-panel border-2 border-ink p-5 pb-0 sm:p-7 sm:pb-0",
                surface(heroTone),
                HARD,
              )}
            >
              <span aria-hidden className="pointer-events-none absolute -top-10 -left-10 -z-20 size-48 rounded-full bg-dots text-ink/12" />
              <span
                aria-hidden
                className="pointer-events-none absolute -top-2 -right-7 -z-10 size-32 rotate-[8deg] sm:-top-4 sm:-right-4 sm:size-56"
              >
                <span className="block size-full animate-float">
                  <CategoryArt category={job.category} animated className="size-full" />
                </span>
              </span>
              <Doodle name="rayo" color="var(--block-mandarina)" className="pointer-events-none absolute top-[44%] right-4 -z-10 size-8 -rotate-12 sm:right-[30%]" />

              <div className="flex flex-wrap items-center gap-1.5 pr-28 sm:pr-48">
                <span className="inline-flex h-7 items-center gap-1.5 rounded-md border-2 border-ink bg-white/75 px-2 text-[0.72rem] font-extrabold tracking-[0.12em] uppercase">
                  <CategoryIcon category={job.category} size="xs" className="-ml-0.5 size-5!" />
                  {category.label}
                </span>
                {job.urgent ? (
                  <span className="inline-flex h-7 items-center gap-1.5 rounded-md bg-chile px-2 text-[0.72rem] font-extrabold tracking-[0.12em] text-white uppercase">
                    <span aria-hidden className="size-1.5 animate-beat rounded-full bg-white" />
                    Urge
                  </span>
                ) : null}
              </div>

              <h1
                id="vacante-titulo"
                lang="es"
                className="mt-3 pr-20 font-display text-[1.95rem] leading-[1.02] font-extrabold tracking-[-0.04em] hyphens-auto sm:pr-48 sm:text-[2.4rem] lg:text-[2.75rem]"
              >
                {job.title}
              </h1>
              <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[1.02rem] font-medium">
                {company.name}
                {company.verified ? (
                  <span className="inline-flex h-7 items-center gap-1 rounded-full bg-ink px-2.5 text-[0.8rem] font-semibold text-white">
                    <HugeiconsIcon icon={CheckmarkBadge01Icon} className="size-4 text-limon" strokeWidth={2} />
                    Verificada
                  </span>
                ) : null}
              </p>

              <p className="mt-6 font-display text-[2.6rem] leading-none font-extrabold tracking-[-0.045em] tabular-nums sm:text-[3.2rem]">
                {formatPay(job)}
              </p>
              <p className="mt-2 pr-24 text-[0.95rem] text-muted-foreground">
                {job.openings} {job.openings === 1 ? "lugar" : "lugares"} · {formatMinutesAgo(job.postedMinutesAgo)} · {job.colonia}
              </p>

              {/* hazard tape footer */}
              <div aria-hidden className="-mx-5 mt-6 h-5 border-t-2 border-ink bg-block-sol sm:-mx-7" style={HAZARD} />
            </section>

            {/* the one sticker of the view: distance from home */}
            <div className="absolute right-4 -bottom-9 z-10 sm:right-8">
              <Sticker variant="ink" size="md" rotate={8} dot className="[&_strong]:text-[1.45em] [&_strong]:whitespace-nowrap">
                <strong>{formatKm(km)}</strong>
                de tu casa
              </Sticker>
            </div>
          </div>

          {/* ------------------------------------------------ stat tiles in three pastels */}
          <div className="grid grid-cols-3 gap-2.5 pt-4 sm:gap-3">
            {[
              {
                label: "Sueldo",
                icon: Money03Icon,
                value: job.payMax ? `${formatMXN(job.pay)}+` : formatMXN(job.pay),
                hint: job.payMax ? `hasta ${formatNumber(job.payMax)}, ${PERIOD_LONG[job.period]}` : PERIOD_LONG[job.period],
              },
              { label: "Turno", icon: Clock01Icon, value: job.shift, hint: job.type },
              {
                label: "Queda a",
                icon: Location01Icon,
                value: (
                  <span className="inline-flex items-center gap-1.5">
                    <span aria-hidden className="size-2.5 shrink-0 rounded-full border border-ink" style={{ background: bandColor(band) }} />
                    {formatKm(km)}
                  </span>
                ),
                hint: BAND_LABEL[band],
              },
            ].map((s, i) => (
              <div key={s.label} className="min-w-0 animate-rise" style={{ "--i": i + 1 } as CSSVars}>
                <StatTile
                  tone={tones[i]}
                  icon={s.icon}
                  label={s.label}
                  value={<span className="block text-[1.2rem] leading-tight break-words sm:text-[1.7rem]">{s.value}</span>}
                  hint={s.hint}
                  className={cn("h-full border-2 border-ink p-3 sm:p-4", HARD_SM)}
                />
              </div>
            ))}
          </div>

          {/* ------------------------------------------------ success moment */}
          {applied ? (
            <Panel
              tone={successTone}
              aria-live="polite"
              className={cn("flex animate-pop-in flex-wrap items-center gap-x-4 gap-y-3 overflow-hidden border-2 border-ink sm:flex-nowrap sm:gap-x-6", HARD)}
            >
              <div className="w-24 shrink-0 sm:w-40">
                <Scene name="exito" className="w-full" />
              </div>
              <div className="min-w-0 flex-1 basis-40">
                <p className="text-[0.75rem] font-extrabold tracking-[0.14em] uppercase">¡Ya quedó!</p>
                <h2 className="mt-1 font-display text-[1.45rem] leading-[1.05] font-extrabold tracking-[-0.03em] sm:text-[1.8rem]">
                  Tu solicitud ya va en camino
                </h2>
                <p className="mt-1.5 text-[0.95rem] text-muted-foreground">
                  {company.name} te contacta por WhatsApp. Sigue el avance en tus postulaciones.
                </p>
                <Button asChild variant="white" size="lg" className="mt-3 hidden sm:inline-flex border-2 border-ink bg-white text-ink hover:bg-white/90 dark:bg-white dark:text-ink dark:hover:bg-white/90">
                  <Link href="/postulaciones">Ver mis postulaciones</Link>
                </Button>
              </div>
              <Button asChild variant="white" size="lg" className="w-full sm:hidden border-2 border-ink bg-white text-ink hover:bg-white/90 dark:bg-white dark:text-ink dark:hover:bg-white/90">
                <Link href="/postulaciones">Ver mis postulaciones</Link>
              </Button>
            </Panel>
          ) : null}

          {/* ------------------------------------------------ what you'll do */}
          <Reveal inView>
            <Panel className="border-2 border-ink shadow-[5px_5px_0_0_var(--ink)]! dark:shadow-[5px_5px_0_0_rgb(0_0_0/0.65)]!">
              <BlockHeader icon={Note01Icon} title="Qué vas a hacer" onCard />
              <p className="text-[1.05rem] leading-relaxed">{job.description}</p>
              <dl className="mt-5 grid grid-cols-2 gap-2.5">
                <Fact label="Horario" value={job.schedule} className="col-span-2" />
                <Fact label="Jornada" value={job.type} />
                <Fact label="Experiencia" value={job.experience} />
              </dl>
            </Panel>
          </Reveal>

          {/* ------------------------------------------------ requirements + benefits */}
          <Reveal inView>
            <Panel tone={tones[3]} className={cn("overflow-hidden border-2 border-ink", HARD)}>
              <BlockHeader icon={CheckListIcon} title="Qué piden" />
              <ul className="space-y-2">
                {job.requirements.map((r, i) => (
                  <li
                    key={r}
                    className="flex animate-rise items-start gap-3 rounded-tile bg-white/55 p-3 text-[1.02rem] leading-snug font-medium"
                    style={{ "--i": i } as CSSVars}
                  >
                    <span aria-hidden className="grid size-7 shrink-0 place-items-center rounded-md border-2 border-ink bg-block-sol text-ink">
                      <HugeiconsIcon icon={Tick02Icon} className="size-4" strokeWidth={3} />
                    </span>
                    <span className="pt-0.5">{r}</span>
                  </li>
                ))}
              </ul>

              <h3 className="mt-6 mb-3 font-display text-[1.15rem] font-extrabold">Prestaciones</h3>
              <ul className="flex flex-wrap gap-2.5">
                {job.benefits.map((b, i) => (
                  <li
                    key={b}
                    className="animate-pop-in"
                    style={{ "--i": i, rotate: `${i % 2 === 0 ? -2 : 2}deg` } as CSSVars}
                  >
                    <span
                      className={cn(
                        "inline-flex h-10 items-center gap-1.5 rounded-full border-2 border-ink px-3.5 text-[0.95rem] font-semibold text-ink",
                        CHIP_BG[i % CHIP_BG.length],
                        HARD_SM,
                      )}
                    >
                      <HugeiconsIcon icon={Tick02Icon} className="size-4" strokeWidth={2.6} />
                      {b}
                    </span>
                  </li>
                ))}
              </ul>
            </Panel>
          </Reveal>

          {/* ------------------------------------------------ commute */}
          <Reveal inView>
            <Panel tone={tones[4] ?? tones[1]} className={cn("border-2 border-ink", HARD)}>
              <BlockHeader icon={Route01Icon} title="Cómo llegar" />
              <ul className="grid gap-2 sm:grid-cols-2">
                {commutes.map((c) => {
                  const best = c.mode === fastest.mode;
                  return (
                    <li
                      key={c.mode}
                      className={cn(
                        "group relative flex items-center gap-3 rounded-tile border-2 p-3",
                        best ? "border-ink bg-white/80" : "border-transparent bg-white/45",
                      )}
                    >
                      <span className="grid size-11 shrink-0 place-items-center rounded-full bg-ink text-white">
                        <HugeiconsIcon icon={MODE_ICON[c.mode]} className="size-5 group-hover:animate-wiggle" strokeWidth={2} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[1.02rem] leading-tight font-semibold">{c.label}</span>
                        <span className="block text-sm text-muted-foreground tabular-nums">
                          {c.costPerDay === 0 ? "Gratis" : `${formatMXN(c.costPerDay)} al día`}
                        </span>
                      </span>
                      <span className="shrink-0 text-right font-display text-[1.35rem] leading-none font-extrabold tabular-nums">
                        {c.minutes}
                        <span className="ml-0.5 font-sans text-sm font-semibold">min</span>
                      </span>
                      {best ? (
                        <span className="absolute -top-2.5 left-3 rounded-md bg-ink px-1.5 py-0.5 text-[0.65rem] font-bold tracking-[0.12em] text-limon uppercase">
                          Más rápido
                        </span>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
              <p className="mt-3 text-sm text-muted-foreground">Tiempos estimados por calle, ida. Costos de ida y vuelta.</p>
            </Panel>
          </Reveal>

          {/* ------------------------------------------------ what happens next */}
          <Reveal inView>
            <Panel className="border-2 border-ink shadow-[5px_5px_0_0_var(--ink)]! dark:shadow-[5px_5px_0_0_rgb(0_0_0/0.65)]!">
              <div aria-hidden className="pointer-events-none absolute -top-12 right-3 sm:right-6">
                <Mascot mood={applied ? "festeja" : "saluda"} prop="casco" size={84} />
              </div>
              <BlockHeader icon={Clock01Icon} title="¿Qué sigue?" onCard />
              <StepList
                current={applied ? 1 : 0}
                steps={[
                  { title: "Enviada", body: applied ? "Tu solicitud ya llegó." : "Un toque y listo, sin currículum." },
                  { title: "La empresa la ve", body: "Revisan tu perfil, casi siempre en 1–2 días." },
                  { title: "Entrevista", body: "Te escriben por WhatsApp para agendar." },
                  { title: "¡Contratado!", body: "A chambear cerca de tu casa." },
                ]}
              />
            </Panel>
          </Reveal>

          {/* ------------------------------------------------ company */}
          <Reveal inView>
            <Panel tone={tones[0]} className={cn("border-2 border-ink", HARD)}>
              <div className="flex items-center gap-3.5">
                <Avatar className="size-14 border-2 border-ink">
                  <AvatarFallback className="bg-ink font-display text-lg font-extrabold text-limon">{initials || "E"}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-[0.72rem] font-bold tracking-[0.12em] text-muted-foreground uppercase">
                    <HugeiconsIcon icon={Building06Icon} className="size-4" strokeWidth={2} />
                    Sobre la empresa
                  </p>
                  <h2 className="font-display text-[1.35rem] leading-tight font-extrabold tracking-[-0.03em]">{company.name}</h2>
                </div>
              </div>
              <ul className="mt-4 flex flex-wrap gap-2 text-[0.9rem] font-semibold">
                {[company.kind, company.employees, company.colonia].map((t) => (
                  <li key={t} className="inline-flex h-8 items-center rounded-full bg-white/60 px-3">
                    {t}
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-[1.02rem] leading-relaxed">{company.about}</p>
            </Panel>
          </Reveal>
        </div>

        {/* ------------------------------------------------ desktop action block (the one saturated block) */}
        <aside className="hidden min-w-0 lg:col-span-4 lg:block">
          <section
            aria-label="Postúlate"
            className={cn("sticky top-10 isolate overflow-hidden rounded-panel border-2 border-ink p-6 block-uva", HARD)}
          >
            <span aria-hidden className="pointer-events-none absolute -right-12 -bottom-12 -z-10 size-48 rounded-full bg-dots text-white/10" />
            <p className="text-[0.75rem] font-extrabold tracking-[0.14em] text-limon uppercase">¡Ándale, no la dejes ir!</p>
            <p className="mt-2 font-display text-[1.6rem] leading-[1.05] font-extrabold tracking-[-0.03em]">
              <CountUp value={job.applicants} className="text-limon" /> personas ya se postularon
            </p>
            <p className="mt-1.5 mb-5 text-primary-foreground/80">Contacta directo a {company.name}</p>
            {renderActions(true)}
          </section>
        </aside>
      </div>

      {/* Mobile sticky action block above the pill nav */}
      <div className="fixed inset-x-0 bottom-24 z-30 px-3 lg:hidden">
        <div className={cn("mx-auto max-w-xl rounded-[1.75rem] border-2 border-ink p-2.5 block-uva", HARD)}>
          {renderActions()}
        </div>
      </div>
    </div>
  );
}

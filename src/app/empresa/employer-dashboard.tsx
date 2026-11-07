"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowRight01Icon,
  Add01Icon,
  Clock01Icon,
  Invoice01Icon,
  LockIcon,
  Location01Icon,
  Tick02Icon,
  UserMultipleIcon,
  Briefcase01Icon,
  Call02Icon,
  Message01Icon,
  StarIcon,
  Store01Icon,
} from "@hugeicons/core-free-icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AvatarStack, BLOCK_CLASS, Eyebrow, HeroCard, Panel, PanelHeader, SectionLabel, StatTile } from "@/components/chamba/primitives";
import { CountUp, Sticker } from "@/components/chamba/motion";
import { CategoryArt, CategoryIcon, CATEGORY_BLOCK } from "@/components/chamba/job-icons";
import { Mascot } from "@/components/chamba/art/mascot";
import { Scene } from "@/components/chamba/art/scenes";
import { Burst, Doodle, HazardTape } from "@/components/chamba/art/doodles";
import { formatMXN, formatPay } from "@/lib/format";
import { formatKm, type RadiusKm } from "@/lib/geo";
import { UNLOCK_PRICE, useApp, useEmployerPlan, useIsLive, useIsUnlocked, type PlanId } from "@/lib/store";
import { EmployerGate } from "@/components/empresa/employer-gate";
import { LiveDashboard } from "./live-dashboard";
import { BranchMapArt, GPS_COLONIA, coloniaText, nearPlaceText, placeText, useBranchSummaries, useEmployerJobs } from "./sucursales/branch-kit";
import { APPLICANTS } from "@/lib/data/applicants";
import { cn } from "@/lib/utils";
import { CANDIDATES } from "./candidates-data";
import { InitialsAvatar, LockAvatar, RadiusChips, WaitRing } from "./wait-ring";

type CSSVars = React.CSSProperties & Record<`--${string}`, string | number>;

const PLAN_LABEL: Record<PlanId, { name: string; price: string }> = {
  "por-vacante": { name: "Por vacante", price: "publicar es gratis" },
  pyme: { name: "Pyme", price: "$1,500/mes" },
  industrial: { name: "Industrial", price: "desde $6,500/mes" },
};

/** Demo hiring pipeline for the top vacancy (stage stepper + "qué sigue"). */
const PIPELINE = ["Publicada", "Postulan", "Entrevista", "¡Contrato!"] as const;
const PIPELINE_CURRENT = 2;

/** Rugged workwear edge: ink outline + hard offset shadow (no blur). */
const RUG = "border-2 border-ink shadow-[4px_5px_0_0_var(--ink)] dark:border-black/70 dark:shadow-[4px_5px_0_0_rgb(0_0_0/0.55)]";

const inkCta =
  "press lift inline-flex h-14 items-center justify-center gap-2.5 rounded-full bg-ink px-7 text-[1.05rem] font-semibold text-white shadow-[0_10px_22px_-12px_var(--ink)] outline-none focus-visible:ring-4 focus-visible:ring-white/70";

/** Demo: the curated showcase dashboard (mock people + applicants). Live: real data only. */
export function EmployerDashboard() {
  const live = useIsLive();
  return <EmployerGate shape="dashboard">{() => (live ? <LiveDashboard /> : <DemoDashboard />)}</EmployerGate>;
}

function DemoDashboard() {
  const [radius, setRadius] = useState<RadiusKm>(5);
  const business = useApp((s) => s.business);
  const planId = useEmployerPlan();
  const plan = PLAN_LABEL[planId];
  const isUnlocked = useIsUnlocked();
  const near = CANDIDATES.filter((c) => c.km <= radius);
  // Newest applicants still waiting for a reply.
  const pending = APPLICANTS.toSorted((a, b) => a.minutesAgo - b.minutesAgo).slice(0, 4);
  const fresh = APPLICANTS.filter((a) => a.minutesAgo < 24 * 60).length;
  const jobs = useEmployerJobs();
  const branches = useBranchSummaries();
  const locations = branches.map((b) => b.branch);
  const multi = locations.length > 1;
  const activeJobs = jobs.length;
  const unlockedCount = jobs.filter((j) => isUnlocked(j.id)).length;
  const totalApplicants = jobs.reduce((n, j) => n + j.applicants, 0);
  // Only Pyme caps vacancies with unlocked applicants; Industrial is unlimited.
  const planLimit = planId === "pyme" ? 5 : null;
  const topJob = jobs[0];
  const first = locations[0];
  const place =
    !multi && business && first
      ? first.colonia === GPS_COLONIA
        ? business.name
        : `${business.name}, ${first.colonia}`
      : nearPlaceText(locations);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-5">
      {/* ------------------------------------------------ Hero (the one saturated block) */}
      <HeroCard
        tone="mandarina"
        decor={false}
        eyebrow="¡Chamba a la vista!"
        className={cn("flex animate-rise flex-col overflow-visible pb-0 sm:pb-0 lg:col-span-7", RUG)}
        title={
          <>
            Tienes <CountUp value={fresh} from={0} className="inline-block" /> candidatos nuevos
          </>
        }
        sticker={
          <Sticker variant="ink" rotate={12} dot>
            <strong>+9</strong>esta semana
          </Sticker>
        }
      >
        <span aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-[inherit]">
          <span className="absolute inset-y-0 right-0 w-2/3 bg-dots text-ink [mask-image:linear-gradient(to_left,black,transparent)]" />
          <Doodle name="rayo" color="var(--block-sol)" className="absolute top-[38%] right-6 size-11 rotate-12" />
        </span>
        <p className="mt-3 max-w-md text-[1.05rem] leading-snug font-medium text-muted-foreground">
          Llegaron en las últimas 24 h. ¡Respóndeles hoy y gánale a la competencia!
        </p>
        <Link
          href="/empresa/sucursales"
          className="press mt-3 inline-flex min-h-11 items-center gap-2 self-start rounded-full border-2 border-ink bg-white/85 py-1 pr-3 pl-1.5 text-[0.92rem] font-bold text-ink outline-none hover:bg-white focus-visible:ring-4 focus-visible:ring-white/70"
        >
          <span className="grid size-8 place-items-center rounded-full bg-ink text-limon">
            <HugeiconsIcon icon={Store01Icon} className="size-4.5" strokeWidth={2} />
          </span>
          {placeText(locations)}
          <HugeiconsIcon icon={ArrowRight01Icon} className="size-4" strokeWidth={2.4} />
        </Link>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Link href="/empresa/candidatos" className={inkCta}>
            Ver candidatos
            <HugeiconsIcon icon={ArrowRight01Icon} className="size-5" strokeWidth={2.2} />
          </Link>
          <AvatarStack names={pending.map((p) => p.name)} max={3} label={`${pending.length} personas esperan respuesta`} />
        </div>
        <div aria-hidden className="relative -mx-6 mt-auto overflow-hidden rounded-b-[26px] pt-4 sm:-mx-7">
          <Scene name="equipo" className="mx-auto max-w-[34rem] translate-y-[4%]" />
          <HazardTape className="relative h-9 text-[1.05rem]">¡Contrata cerca de tu planta!</HazardTape>
        </div>
      </HeroCard>

      {/* ------------------------------------------------ Radius (lila) */}
      <Panel
        tone="lila"
        className={cn("flex animate-rise flex-col overflow-hidden lg:col-span-5", RUG)}
        style={{ "--i": 1 } as CSSVars}
      >
        <PanelHeader icon={Location01Icon} title="Cerca de tu centro" />
        <div className="flex items-end justify-between gap-3">
          <p className="flex items-baseline gap-2.5">
            <CountUp
              value={near.length}
              className="font-display text-[4.5rem] leading-none font-extrabold tracking-[-0.05em] tabular-nums"
            />
            <span className="font-display text-xl font-bold">personas</span>
          </p>
          <Burst size={74} color="#FFC93C" points={12} className="mb-1 -rotate-6 text-[0.8rem] leading-none">
            <span className="block text-center">
              <span className="block text-[1.35rem]">{radius}</span>km
            </span>
          </Burst>
        </div>
        <p className="mt-2 text-[1.02rem] leading-snug text-muted-foreground">
          viven a menos de <strong className="font-bold text-foreground tabular-nums">{radius} km</strong> de {place}
        </p>
        <RadiusChips value={radius} onChange={setRadius} label="Radio de búsqueda de candidatos" className="mt-5" />
        <Scene name="radar" className="mx-auto my-3 hidden w-36 lg:block" />
        <div className="mt-5 flex items-center gap-3 rounded-tile border-2 border-dashed border-ink/35 bg-white/45 p-3.5 lg:mt-auto dark:bg-white/30">
          <Mascot mood="piensa" prop="casco" size={52} className="-my-2 shrink-0" />
          <p className="text-[0.95rem] leading-snug">
            Quien vive a menos de 5 km llega a tiempo más seguido y dura más en el puesto.
          </p>
        </div>
      </Panel>

      {/* ------------------------------------------------ KPI tiles */}
      <section aria-label="Resumen del mes" className="grid grid-cols-2 gap-3 lg:col-span-12 lg:grid-cols-4 lg:gap-5">
        {(
          [
            { tone: "limon", label: "Contrataciones", value: <CountUp value={2} from={0} />, hint: "este mes", icon: Tick02Icon },
            {
              tone: "sol",
              label: "Distancia prom.",
              value: <CountUp value={2.4} from={0} decimals={1} suffix=" km" />,
              hint: "casa → trabajo",
              icon: Location01Icon,
            },
            { tone: "cielo", label: "Postulantes", value: <CountUp value={totalApplicants} from={0} />, hint: `en ${activeJobs} vacantes`, icon: UserMultipleIcon },
            { tone: "menta", label: "Vacantes activas", value: <CountUp value={activeJobs} from={0} />, hint: `${unlockedCount} desbloqueada${unlockedCount === 1 ? "" : "s"}`, icon: Briefcase01Icon },
          ] as const
        ).map((s, i) => (
          <StatTile
            key={s.label}
            tone={s.tone}
            label={s.label}
            value={s.value}
            hint={s.hint}
            icon={s.icon}
            className={cn("lift animate-pop-in p-4.5 lg:p-5 [&>div:nth-child(2)]:text-[2.4rem]", RUG)}
            style={{ "--i": i + 2, rotate: `${i % 2 ? 1 : -1}deg` } as CSSVars}
          />
        ))}
      </section>

      {/* ------------------------------------------------ Sucursales (lila) */}
      <Panel tone="lila" className={cn("min-w-0 overflow-hidden lg:col-span-12", RUG)}>
        <PanelHeader
          icon={Store01Icon}
          title={multi ? "Tus sucursales" : "Tu sucursal"}
          count={locations.length}
          action={
            <Button asChild variant="white" size="lg" className="h-11 border-2 border-ink bg-white text-ink hover:bg-white/90 dark:bg-white dark:text-ink">
              <Link href="/empresa/sucursales" aria-label="Administrar sucursales">
                <span className="hidden sm:inline">Administrar</span>
                <span className="sm:hidden">Ver</span>
                <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2.2} />
              </Link>
            </Button>
          }
        />
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {branches.map(({ branch, index, jobs: bj, applicants }) => (
            <li key={branch.id} className="min-w-0 animate-rise" style={{ "--i": Math.min(index + 2, 8) } as CSSVars}>
              <Link
                href="/empresa/sucursales"
                className="group press lift flex items-center gap-3 rounded-tile border-2 border-ink bg-white/75 p-2.5 pr-3.5 text-ink outline-none hover:bg-white focus-visible:ring-4 focus-visible:ring-ring/60 dark:bg-white/85"
              >
                <BranchMapArt seed={branch.id} principal={index === 0} className="w-16 shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-display text-[1.1rem] leading-tight font-extrabold tracking-[-0.02em]">
                    {branch.name}
                  </span>
                  <span className="block truncate text-[0.85rem] text-ink/65">
                    {index === 0 ? "Principal · " : ""}
                    {coloniaText(branch, false)}
                  </span>
                  <span className="mt-1.5 flex flex-wrap gap-1.5 text-[0.8rem] font-bold">
                    <span className="rounded-full bg-ink px-2 py-0.5 text-white tabular-nums">
                      {bj.length} vacante{bj.length === 1 ? "" : "s"}
                    </span>
                    <span className="rounded-full border-2 border-ink px-2 py-px tabular-nums">
                      {applicants} postulante{applicants === 1 ? "" : "s"}
                    </span>
                  </span>
                </span>
              </Link>
            </li>
          ))}
          {multi ? null : (
            <li className="min-w-0">
              <Link
                href="/empresa/sucursales"
                className="group press flex min-h-[5.25rem] items-center gap-3 rounded-tile border-2 border-dashed border-ink/60 px-3.5 py-2.5 outline-none hover:bg-white/40 focus-visible:ring-4 focus-visible:ring-ring/60"
              >
                <span className="grid size-11 shrink-0 place-items-center rounded-full border-2 border-ink bg-limon text-ink transition-transform duration-300 group-hover:rotate-90">
                  <HugeiconsIcon icon={Add01Icon} className="size-5" strokeWidth={2.4} />
                </span>
                <span className="min-w-0">
                  <span className="block font-display text-[1.05rem] leading-tight font-extrabold">¿Tienes otra planta o bodega?</span>
                  <span className="block text-[0.85rem] text-muted-foreground">Agrégala y contrata cerca de cada una.</span>
                </span>
              </Link>
            </li>
          )}
        </ul>
      </Panel>

      {/* ------------------------------------------------ Pending replies (white — dense list) */}
      <Panel tone="tinta" className={cn("min-w-0 overflow-hidden lg:col-span-7", RUG)}>
        <Doodle name="flecha" color="var(--block-sol)" className="pointer-events-none absolute top-5 right-5 size-10 rotate-[20deg]" />
        <PanelHeader icon={Clock01Icon} title="Por responder" count={pending.length} />
        <ul className="space-y-2">
          {pending.map((c, i) => {
            const job = jobs.find((j) => j.id === c.jobId);
            const open = isUnlocked(c.jobId);
            return (
              <li
                key={c.id}
                className="group lift flex animate-rise items-center gap-3 rounded-tile border-2 border-white/10 bg-white/[0.07] p-2.5 pr-2.5"
                style={{ "--i": i } as CSSVars}
              >
                <span className="relative shrink-0">
                  {open ? <InitialsAvatar name={c.name} /> : <LockAvatar />}
                  {job ? (
                    <CategoryIcon category={job.category} size="xs" className="absolute -right-3 -bottom-3 scale-[0.78] ring-2 ring-[var(--block-tinta)]" />
                  ) : null}
                </span>
                <Link
                  href={`/empresa/vacantes/${c.jobId}`}
                  className="min-w-0 flex-1 rounded-lg pl-1 outline-none focus-visible:ring-3 focus-visible:ring-white/70"
                >
                  <span className="block truncate text-[1.05rem] leading-snug font-semibold">
                    {open ? c.name : "Nueva postulación"}
                  </span>
                  <span className="block truncate text-[0.9rem] text-muted-foreground">
                    {formatKm(c.km)} · {job?.title}
                  </span>
                </Link>
                <span className="hidden gap-2 xl:flex">
                  {open ? (
                    <Button
                      variant="lime"
                      className="h-11 px-4"
                      onClick={() => toast.success(`Abriendo SMS para ${c.name.split(" ")[0]}…`)}
                    >
                      <HugeiconsIcon icon={Message01Icon} className="size-4.5" strokeWidth={1.8} />
                      SMS
                    </Button>
                  ) : null}
                  <Button variant={open ? "white" : "lime"} className={cn("h-11 border-ink px-4 text-ink", open && "bg-white text-ink hover:bg-white/90 dark:bg-white dark:text-ink")} asChild>
                    <Link href={`/empresa/vacantes/${c.jobId}`}>{open ? "Ver" : "Desbloquear"}</Link>
                  </Button>
                </span>
                <WaitRing minutes={c.minutesAgo} index={i + 1} />
              </li>
            );
          })}
        </ul>
        <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Doodle name="rayo" color="var(--block-sol)" className="size-5 shrink-0" />
          Responde en menos de 24 h para no perder a los mejores candidatos.
        </p>
      </Panel>

      {/* ------------------------------------------------ Your jobs: stacked category blocks */}
      <section aria-labelledby="tus-vacantes" className="min-w-0 lg:col-span-5">
        <SectionLabel
          className="mb-3"
          title={<span id="tus-vacantes">Tus vacantes</span>}
          count={jobs.length}
          action={
            <Button asChild size="lg" className="h-11">
              <Link href="/empresa/vacantes/nueva">
                <HugeiconsIcon icon={Add01Icon} strokeWidth={2.2} />
                Publicar
              </Link>
            </Button>
          }
        />
        <ul>
          {jobs.map((j, i) => {
            const open = isUnlocked(j.id);
            return (
              <li
                key={j.id}
                className={cn("relative animate-rise", i > 0 && "-mt-7")}
                style={{ "--i": i + 3, zIndex: i + 1 } as CSSVars}
              >
                <Link
                  href={`/empresa/vacantes/${j.id}`}
                  className={cn(
                    "group press lift relative block overflow-hidden rounded-panel p-5 outline-none focus-visible:ring-4 focus-visible:ring-ring/60",
                    RUG,
                    i > 0 && "pt-11",
                    i < jobs.length - 1 && "pb-12",
                    BLOCK_CLASS[CATEGORY_BLOCK[j.category]],
                  )}
                >
                  <CategoryArt
                    category={j.category}
                    animated
                    className="pointer-events-none absolute -right-5 -bottom-6 size-36 rotate-[-8deg] transition-transform duration-300 group-hover:scale-110 group-hover:rotate-0"
                  />
                  <span className="relative block max-w-[68%]">
                    <Badge variant={open ? "lime" : "status"} size="md" className={cn("border-2 border-ink", !open && "bg-white text-ink")}>
                      {open ? (
                        <HugeiconsIcon icon={Tick02Icon} className="size-4" strokeWidth={2.4} />
                      ) : (
                        <HugeiconsIcon icon={LockIcon} className="size-3.5" strokeWidth={2.2} />
                      )}
                      {open ? "Desbloqueada" : "Por desbloquear"}
                    </Badge>
                    <span className="mt-2.5 block font-display text-[1.6rem] leading-[1.05] font-extrabold tracking-[-0.03em]">
                      {j.title}
                    </span>
                    <span className="mt-1 block text-[0.95rem] text-muted-foreground tabular-nums">
                      {formatPay(j)} · {j.shift}
                    </span>
                    <span className="mt-3 flex items-baseline gap-1.5">
                      <span className="font-display text-[2rem] leading-none font-extrabold tabular-nums">{j.applicants}</span>
                      <span className="text-[0.95rem] font-medium">postulantes</span>
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      {/* ------------------------------------------------ Pipeline (menta) */}
      {topJob ? (
        <Panel tone="menta" className={cn("overflow-hidden lg:col-span-7", RUG)}>
          <header className="mb-5 flex items-center gap-3">
            <CategoryIcon category={topJob.category} size="md" animated />
            <div className="min-w-0 flex-1">
              <Eyebrow>Etapa {PIPELINE_CURRENT + 1} de {PIPELINE.length}</Eyebrow>
              <h2 className="font-display text-[1.2rem] leading-tight font-extrabold sm:text-[1.35rem]">{topJob.title}</h2>
            </div>
            <Badge variant="status" size="md" className="shrink-0 border-2 border-ink bg-white text-ink" style={{ "--dot": "var(--nopal)" } as CSSVars}>
              {topJob.openings} plazas
            </Badge>
          </header>

          {/* horizontal stage stepper */}
          <ol aria-label="Proceso de contratación" className="relative grid grid-cols-4">
            <span aria-hidden className="absolute top-5 right-[12.5%] left-[12.5%] h-1 rounded-full bg-ink/15" />
            <span
              aria-hidden
              className="absolute top-5 left-[12.5%] h-1 origin-left animate-grow rounded-full bg-ink"
              style={{ width: `${(PIPELINE_CURRENT / (PIPELINE.length - 1)) * 75}%` }}
            />
            {PIPELINE.map((s, i) => {
              const state = i < PIPELINE_CURRENT ? "done" : i === PIPELINE_CURRENT ? "current" : "todo";
              return (
                <li
                  key={s}
                  aria-current={state === "current" ? "step" : undefined}
                  className="relative flex animate-pop-in flex-col items-center gap-2 text-center"
                  style={{ "--i": i } as CSSVars}
                >
                  <span
                    className={cn(
                      "grid size-11 place-items-center rounded-full border-2 border-ink",
                      state === "done" && "bg-limon text-ink",
                      state === "current" && "bg-primary text-primary-foreground shadow-pop",
                      state === "todo" && "bg-white text-ink",
                    )}
                  >
                    {state === "done" ? (
                      <HugeiconsIcon icon={Tick02Icon} className="size-5" strokeWidth={2.6} />
                    ) : state === "current" ? (
                      <span aria-hidden className="size-3 animate-beat rounded-full bg-limon" />
                    ) : (
                      <HugeiconsIcon icon={StarIcon} className="size-4.5" strokeWidth={2} />
                    )}
                  </span>
                  <span className={cn("px-0.5 text-[0.78rem] leading-tight sm:text-sm", state === "current" ? "font-bold" : "font-medium")}>
                    <span className="sr-only">{state === "done" ? "Hecho: " : state === "current" ? "Ahora: " : "Pendiente: "}</span>
                    {s}
                  </span>
                </li>
              );
            })}
          </ol>

          {/* inside this stage */}
          <div className="mt-6 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
            <div>
              <h3 className="font-display text-[1.05rem] font-bold">En esta etapa</h3>
              <ol className="relative mt-3 space-y-3 border-l-2 border-dashed border-ink/30 pl-5">
                {[
                  { t: "Revisaste 7 postulaciones", m: "ayer", done: true },
                  { t: "Agenda entrevistas con los 3 más cerca", m: "hoy", now: true },
                  { t: "Elige y avisa por SMS", m: "jue" },
                ].map((s, i) => (
                  <li key={s.t} className="relative animate-rise" style={{ "--i": i + 2 } as CSSVars}>
                    <span
                      aria-hidden
                      className={cn(
                        "absolute top-1 -left-[1.95rem] size-4 rounded-full border-2 border-ink",
                        s.done ? "bg-limon" : s.now ? "bg-ink" : "bg-card",
                      )}
                    />
                    <span className="flex items-baseline justify-between gap-3">
                      <span className={cn("leading-snug", s.now ? "font-bold" : s.done ? "text-muted-foreground line-through decoration-2" : "")}>
                        {s.t}
                      </span>
                      <span className="shrink-0 text-sm font-semibold text-muted-foreground uppercase">{s.m}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </div>
            <Button asChild variant="white" size="lg" className="w-full border-2 border-ink sm:w-auto bg-white text-ink hover:bg-white/90 dark:bg-white dark:text-ink">
              <Link href={`/empresa/vacantes/${topJob.id}`}>
                Ver postulantes
                <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2.2} />
              </Link>
            </Button>
          </div>
        </Panel>
      ) : null}

      {/* ------------------------------------------------ Plan & help (durazno) */}
      <Panel tone="durazno" className={cn("flex min-w-0 flex-col overflow-hidden lg:col-span-5", RUG)}>
        <PanelHeader icon={Invoice01Icon} title="Plan y uso" />
        <p className="font-display text-[1.7rem] leading-tight font-extrabold tracking-[-0.03em]">
          {plan.name} <span className="text-[1.1rem] font-semibold text-muted-foreground">· {plan.price}</span>
        </p>
        <div className="mt-5 rounded-tile border-2 border-ink bg-white/55 p-4 dark:bg-white/35">
          <div className="flex items-baseline justify-between gap-3 text-[0.95rem]">
            <span className="font-medium">{planId === "por-vacante" ? "Vacantes desbloqueadas" : "Vacantes activas"}</span>
            <span className="text-right text-muted-foreground tabular-nums">
              {planLimit
                ? `${activeJobs} de ${planLimit}`
                : planId === "por-vacante"
                  ? `${unlockedCount} de ${activeJobs} · ${formatMXN(unlockedCount * UNLOCK_PRICE)} este mes`
                  : `${activeJobs} · sin límite`}
            </span>
          </div>
          {(() => {
            const max = planLimit ?? (planId === "por-vacante" ? activeJobs : null);
            const now = planLimit ? activeJobs : unlockedCount;
            return max ? (
              <div
                className="mt-3 flex h-4 gap-1"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={max}
                aria-valuenow={now}
                aria-label={planLimit ? "Vacantes activas usadas" : "Vacantes desbloqueadas"}
              >
                {Array.from({ length: max }, (_, i) => (
                  <span
                    key={i}
                    className={cn(
                      "flex-1 origin-left animate-grow rounded-full border-2 border-ink",
                      i < now ? "bg-ink" : "bg-white",
                    )}
                    style={{ "--i": i } as CSSVars}
                  />
                ))}
              </div>
            ) : null;
          })()}
        </div>
        <div className="mt-5 flex items-end gap-3">
          <div className="min-w-0 flex-1">
            <p className="font-semibold">¿Dudas con tu plan?</p>
            <p className="mt-0.5 text-[0.92rem] leading-snug text-muted-foreground">Te ayudamos por teléfono o correo, de lunes a sábado.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button asChild size="lg">
                <Link href="/empresa/plan">Ver planes</Link>
              </Button>
              <Button
                variant="white"
                size="lg"
                className="border-2 border-ink bg-white text-ink hover:bg-white/90 dark:bg-white dark:text-ink"
                onClick={() => toast.success("Llamando a tu asesor…")}
              >
                <HugeiconsIcon icon={Call02Icon} className="text-nopal" strokeWidth={1.8} />
                Asesor
              </Button>
            </div>
          </div>
          <Mascot mood="saluda" prop="telefono" size={78} className="-mr-2 -mb-6 shrink-0" />
        </div>
      </Panel>
    </div>
  );
}

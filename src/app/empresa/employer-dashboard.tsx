"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowRight01Icon,
  Add01Icon,
  Invoice01Icon,
  LockIcon,
  Location01Icon,
  Tick02Icon,
  UserMultipleIcon,
  Briefcase01Icon,
  Call02Icon,
  Store01Icon,
} from "@hugeicons/core-free-icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AvatarStack, BLOCK_CLASS, HeroCard, Panel, PanelHeader, SectionLabel, StatTile } from "@/components/chamba/primitives";
import { CountUp, Sticker } from "@/components/chamba/motion";
import { CategoryArt, CATEGORY_BLOCK } from "@/components/chamba/job-icons";
import { Mascot } from "@/components/chamba/art/mascot";
import { Scene } from "@/components/chamba/art/scenes";
import { Burst, Doodle, HazardTape } from "@/components/chamba/art/doodles";
import { formatMXN, formatPay } from "@/lib/format";
import type { RadiusKm } from "@/lib/geo";
import { UNLOCK_PRICE, useApp, useEmployerPlan, useIsLive, useIsUnlocked, type PlanId } from "@/lib/store";
import { EmployerGate } from "@/components/empresa/employer-gate";
import { TodayPanel, PipelineFunnel, ReviewChip, useDashboardPipeline } from "@/components/empresa/pipeline/today-panel";
import { EmailAlertsCard, LiveDashboard } from "./live-dashboard";
import { BranchMapArt, GPS_COLONIA, coloniaText, nearPlaceText, placeText, useBranchSummaries, useEmployerJobs } from "./sucursales/branch-kit";
import { cn } from "@/lib/utils";
import { CANDIDATES } from "./candidates-data";
import { RadiusChips } from "./wait-ring";

type CSSVars = React.CSSProperties & Record<`--${string}`, string | number>;

const PLAN_LABEL: Record<PlanId, { name: string; price: string }> = {
  "por-vacante": { name: "Por vacante", price: "publicar es gratis" },
  pyme: { name: "Pyme", price: "$1,500/mes" },
  industrial: { name: "Industrial", price: "desde $6,500/mes" },
};

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
  // Everything about applicants comes from the hiring pipeline (same numbers as the lists).
  const dash = useDashboardPipeline();
  const toReview = dash.review.length;
  // Only people whose contact is unlocked show initials in the stack.
  const named = dash.review.flatMap((r) => (r.a?.unlocked && r.a.name ? [r.a.name] : []));
  const jobs = useEmployerJobs();
  const branches = useBranchSummaries();
  const locations = branches.map((b) => b.branch);
  const multi = locations.length > 1;
  const activeJobs = jobs.length;
  const unlockedCount = jobs.filter((j) => isUnlocked(j.id)).length;
  const totalApplicants = jobs.reduce((n, j) => n + j.applicants, 0);
  // Only Pyme caps vacancies with unlocked applicants; Industrial is unlimited.
  const planLimit = planId === "pyme" ? 5 : null;
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
          toReview > 0 ? (
            <>
              Tienes <CountUp value={toReview} from={0} className="inline-block" /> postulante{toReview === 1 ? "" : "s"} por revisar
            </>
          ) : (
            "¡Estás al día!"
          )
        }
        sticker={
          dash.week > 0 ? (
            <Sticker variant="ink" rotate={12} dot>
              <strong>+{dash.week}</strong>esta semana
            </Sticker>
          ) : undefined
        }
      >
        <span aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-[inherit]">
          <span className="absolute inset-y-0 right-0 w-2/3 bg-dots text-ink [mask-image:linear-gradient(to_left,black,transparent)]" />
          <Doodle name="rayo" color="var(--block-sol)" className="absolute top-[38%] right-6 size-11 rotate-12" />
        </span>
        <p className="mt-3 max-w-md text-[1.05rem] leading-snug font-medium text-muted-foreground">
          {toReview > 0
            ? "Revísalos hoy y agenda entrevistas: gánale a la competencia."
            : "Ya revisaste a todos. Te avisamos en cuanto alguien más se postule."}
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
          {named.length ? (
            <AvatarStack names={named} max={3} label={`${toReview} ${toReview === 1 ? "persona espera" : "personas esperan"} respuesta`} />
          ) : null}
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
            { tone: "limon", label: "Contrataciones", value: <CountUp value={dash.hiresThisMonth} from={0} />, hint: "este mes", icon: Tick02Icon },
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

      {/* ------------------------------------------------ Para hoy (tinta): from the hiring pipeline */}
      <TodayPanel data={dash} className="lg:col-span-7" />

      {/* ------------------------------------------------ Your jobs: stacked category blocks */}
      <section aria-labelledby="tus-vacantes" className="flex min-w-0 flex-col lg:col-span-5">
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
        {/* The last card grows when "Para hoy" is taller, so both columns end together. */}
        <ul className="flex flex-1 flex-col">
          {jobs.map((j, i) => {
            const open = isUnlocked(j.id);
            return (
              <li
                key={j.id}
                className={cn("relative animate-rise", i > 0 && "-mt-7", i === jobs.length - 1 && "flex flex-1 flex-col")}
                style={{ "--i": i + 3, zIndex: i + 1 } as CSSVars}
              >
                <Link
                  href={`/empresa/vacantes/${j.id}`}
                  className={cn(
                    "group press lift relative block flex-1 overflow-hidden rounded-panel p-5 outline-none focus-visible:ring-4 focus-visible:ring-ring/60",
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
                    <ReviewChip jobId={j.id} data={dash} className="mt-2" />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      {/* ------------------------------------------------ Hiring funnel (menta): real counts */}
      <PipelineFunnel data={dash} className="lg:col-span-7" />

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

      <EmailAlertsCard />
    </div>
  );
}

"use client";

import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Add01Icon,
  ArrowRight01Icon,
  Briefcase01Icon,
  ComingSoon01Icon,
  Invoice01Icon,
  Location01Icon,
  Mail01Icon,
  Tick02Icon,
  UserMultipleIcon,
} from "@hugeicons/core-free-icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { BLOCK_CLASS, HeroCard, Panel, PanelHeader, SectionLabel, StatTile } from "@/components/chamba/primitives";
import { CountUp, Sticker } from "@/components/chamba/motion";
import { CategoryArt, CATEGORY_BLOCK } from "@/components/chamba/job-icons";
import { Scene } from "@/components/chamba/art/scenes";
import { Mascot } from "@/components/chamba/art/mascot";
import { Doodle, HazardTape } from "@/components/chamba/art/doodles";
import { useMyCompany } from "@/lib/data/catalog";
import { useLiveUser } from "@/lib/live/session";
import { formatPay } from "@/lib/format";
import { useApp, useEmployerPlan, type PlanId } from "@/lib/store";
import { cn } from "@/lib/utils";
import { useBranchSummaries } from "./sucursales/branch-kit";
import { BranchesPanel, HeroPlaceChip, PublishButton, RUG } from "./dashboard-kit";
import { TeamSummaryCard } from "@/components/team/team-summary-card";
import { useCan } from "@/lib/team";
import { ReviewChip, TodayPanel, useDashboardPipeline } from "@/components/empresa/pipeline/today-panel";

/*
 * The employer dashboard on real data (live mode). Same look as the demo dashboard, but every
 * number comes from the company's own vacancies and applicants; nothing invented.
 */

type CSSVars = React.CSSProperties & Record<`--${string}`, string | number>;

const PLAN_LABEL: Record<PlanId, string> = { "por-vacante": "Por vacante", pyme: "Pyme", industrial: "Industrial" };

const inkCta =
  "press lift inline-flex h-14 items-center justify-center gap-2.5 rounded-full bg-ink px-7 text-[1.05rem] font-semibold text-white shadow-[0_10px_22px_-12px_var(--ink)] outline-none focus-visible:ring-4 focus-visible:ring-white/70";

export function LiveDashboard() {
  const can = useCan();
  const my = useMyCompany();
  const planId = useEmployerPlan();
  // Applicant numbers come from the hiring pipeline (same as the lists and the applicant page).
  const dash = useDashboardPipeline();
  const branches = useBranchSummaries();
  const locations = branches.map((b) => b.branch);
  const multi = locations.length > 1;

  const open = my.jobs.filter((j) => j.status === "abierta");
  const active = my.jobs.filter((j) => j.status !== "cerrada");
  const totalApplicants = my.jobs.reduce((n, j) => n + j.applicants, 0);
  const appsReady = !dash.loading;
  const toReview = dash.review.length;
  const noJobs = my.jobs.length === 0;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-5">
      {/* ------------------------------------------------ Hero (the one saturated block) */}
      <HeroCard
        tone="mandarina"
        decor={false}
        eyebrow={my.company?.name ?? "Tu negocio"}
        className={cn("flex animate-rise flex-col overflow-visible pb-0 sm:pb-0 lg:col-span-7", RUG)}
        title={
          noJobs ? (
            can.createVacancy ? "Publica tu primera vacante" : "Todavía no hay vacantes"
          ) : appsReady && toReview > 0 ? (
            <>
              Tienes <CountUp value={toReview} from={0} className="inline-block" /> postulante{toReview === 1 ? "" : "s"} por revisar
            </>
          ) : appsReady && dash.counts.total > 0 ? (
            "¡Estás al día!"
          ) : (
            "Tus vacantes ya están en el radar"
          )
        }
        sticker={
          appsReady && dash.week > 0 ? (
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
          {noJobs
            ? can.createVacancy
              ? "Es gratis. Le aparece a la gente que vive cerca de tu sucursal y te llegan sus postulaciones."
              : `Cuando el dueño o un administrador publique una vacante${can.allBranches ? "" : " en tu sucursal"}, aquí verás a quien se postule.`
            : appsReady && toReview > 0
              ? "Revísalos hoy y agenda entrevistas: gánale a la competencia."
              : appsReady && dash.counts.total > 0
                ? "Ya revisaste a todos. Te avisamos en cuanto alguien más se postule."
                : "Le aparecen a la gente que vive cerca. Te avisamos aquí en cuanto alguien se postule."}
        </p>
        <HeroPlaceChip locations={locations} />
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Link href={noJobs ? (can.createVacancy ? "/empresa/vacantes/nueva" : "/empresa/equipo") : "/empresa/candidatos"} className={inkCta}>
            {noJobs && !can.createVacancy ? (
              <>
                Ver mi equipo
                <HugeiconsIcon icon={ArrowRight01Icon} className="size-5" strokeWidth={2.2} />
              </>
            ) : noJobs ? (
              <>
                <HugeiconsIcon icon={Add01Icon} className="size-5" strokeWidth={2.4} />
                Publicar vacante
              </>
            ) : (
              <>
                Ver postulantes
                <HugeiconsIcon icon={ArrowRight01Icon} className="size-5" strokeWidth={2.2} />
              </>
            )}
          </Link>
        </div>
        <div aria-hidden className="relative -mx-6 mt-auto overflow-hidden rounded-b-[26px] pt-4 sm:-mx-7">
          <Scene name="equipo" className="mx-auto max-w-[34rem] translate-y-[4%]" />
          <HazardTape className="relative h-9 text-[1.05rem]">¡Contrata cerca de tu planta!</HazardTape>
        </div>
      </HeroCard>

      {/* ------------------------------------------------ Para hoy (tinta): from the hiring pipeline */}
      <TodayPanel data={dash} className="lg:col-span-5" />

      {/* ------------------------------------------------ KPI tiles */}
      <section aria-label="Resumen" className="grid grid-cols-2 gap-3 lg:col-span-12 lg:grid-cols-4 lg:gap-5">
        {(
          [
            {
              tone: "menta",
              label: "Vacantes activas",
              value: <CountUp value={open.length} from={0} />,
              hint: active.length > open.length ? `${active.length - open.length} en pausa` : "publicadas",
              icon: Briefcase01Icon,
            },
            {
              tone: "cielo",
              label: "Postulantes",
              value: <CountUp value={totalApplicants} from={0} />,
              hint: `en ${my.jobs.length} vacante${my.jobs.length === 1 ? "" : "s"}`,
              icon: UserMultipleIcon,
            },
            {
              tone: "limon",
              label: "Contrataciones",
              value: appsReady ? <CountUp value={dash.counts.contratada} from={0} /> : "—",
              hint: "en tus vacantes",
              icon: Tick02Icon,
            },
            {
              tone: "sol",
              label: multi ? "Sucursales" : "Sucursal",
              value: <CountUp value={locations.length} from={0} />,
              hint: "en Saltillo",
              icon: Location01Icon,
            },
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

      {/* ------------------------------------------------ Your jobs: stacked category blocks */}
      <section aria-labelledby="tus-vacantes" className="flex min-w-0 flex-col lg:col-span-7">
        <SectionLabel
          className="mb-3"
          title={<span id="tus-vacantes">Tus vacantes</span>}
          count={active.length}
          action={<PublishButton />}
        />
        {active.length === 0 && !can.createVacancy ? (
          <div className={cn("flex flex-1 items-center gap-4 rounded-panel bg-card p-5", RUG)}>
            <Scene name="negocio" className="w-28 shrink-0" />
            <span className="min-w-0">
              <span className="block font-display text-[1.35rem] leading-tight font-extrabold">Sin vacantes activas</span>
              <span className="mt-1 block text-[0.95rem] text-muted-foreground">
                Las publica el dueño o un administrador. En cuanto haya una{can.allBranches ? "" : " en tu sucursal"}, la ves aquí.
              </span>
            </span>
          </div>
        ) : active.length === 0 ? (
          <Link
            href="/empresa/vacantes/nueva"
            className={cn(
              "group press lift flex items-center gap-4 rounded-panel bg-card p-5 outline-none focus-visible:ring-4 focus-visible:ring-ring/60",
              RUG,
            )}
          >
            <Scene name="negocio" className="w-28 shrink-0" />
            <span className="min-w-0">
              <span className="block font-display text-[1.35rem] leading-tight font-extrabold">Publica tu primera vacante</span>
              <span className="mt-1 block text-[0.95rem] text-muted-foreground">Gratis, en menos de 2 minutos.</span>
            </span>
          </Link>
        ) : (
          // The last card grows when the plan column is taller, so both columns end together.
          <ul className="flex flex-1 flex-col">
            {active.map((j, i) => (
              <li
                key={j.id}
                className={cn("relative animate-rise", i > 0 && "-mt-7", i === active.length - 1 && "flex flex-1 flex-col")}
                style={{ "--i": i + 3, zIndex: i + 1 } as CSSVars}
              >
                <Link
                  href={`/empresa/vacantes/${j.id}`}
                  className={cn(
                    "group press lift relative block flex-1 overflow-hidden rounded-panel p-5 outline-none focus-visible:ring-4 focus-visible:ring-ring/60",
                    RUG,
                    i > 0 && "pt-11",
                    i < active.length - 1 && "pb-12",
                    BLOCK_CLASS[CATEGORY_BLOCK[j.category]],
                  )}
                >
                  <CategoryArt
                    category={j.category}
                    animated
                    className="pointer-events-none absolute -right-5 -bottom-6 size-36 rotate-[-8deg] transition-transform duration-300 group-hover:scale-110 group-hover:rotate-0"
                  />
                  <span className="relative block max-w-[68%]">
                    <Badge
                      variant={j.status === "abierta" ? "lime" : "status"}
                      size="md"
                      className={cn("border-2 border-ink", j.status !== "abierta" && "bg-white text-ink")}
                    >
                      {j.status === "abierta" ? "Publicada" : "En pausa"}
                    </Badge>
                    <span className="mt-2.5 block font-display text-[1.6rem] leading-[1.05] font-extrabold tracking-[-0.03em]">
                      {j.title}
                    </span>
                    <span className="mt-1 block text-[0.95rem] text-muted-foreground tabular-nums">
                      {formatPay(j)} · {j.shift}
                    </span>
                    <span className="mt-3 flex items-baseline gap-1.5">
                      <span className="font-display text-[2rem] leading-none font-extrabold tabular-nums">{j.applicants}</span>
                      <span className="text-[0.95rem] font-medium">postulante{j.applicants === 1 ? "" : "s"}</span>
                    </span>
                    <ReviewChip jobId={j.id} data={dash} className="mt-2" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ------------------------------------------------ Plan (durazno): payments coming; members who don't manage the plan: their team */}
      {can.managePlan ? (
        <Panel tone="durazno" className={cn("flex min-w-0 flex-col overflow-hidden lg:col-span-5", RUG)}>
          <PanelHeader icon={Invoice01Icon} title="Plan y uso" />
          <p className="font-display text-[1.7rem] leading-tight font-extrabold tracking-[-0.03em]">
            {PLAN_LABEL[planId]} <span className="text-[1.1rem] font-semibold text-muted-foreground">· publicar es gratis</span>
          </p>
          <div className="mt-5 flex items-start gap-3 rounded-tile border-2 border-ink bg-white/55 p-4 dark:bg-white/35">
            <HugeiconsIcon icon={ComingSoon01Icon} className="mt-0.5 size-5 shrink-0" strokeWidth={2} />
            <p className="text-[0.95rem] leading-snug">
              <strong className="font-bold">Pagos: próximamente.</strong> Ya puedes publicar y recibir postulaciones. Muy pronto
              podrás desbloquear nombres y teléfonos, o elegir un plan.
            </p>
          </div>
          <div className="mt-5 flex items-end gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap gap-2">
                <Button asChild size="lg">
                  <Link href="/empresa/plan">Ver planes</Link>
                </Button>
              </div>
            </div>
            {/* Chambarrio's own support / plans: the brand mascot, not the user. */}
            <Mascot mood="saluda" prop="telefono" size={78} className="-mr-2 -mb-6 shrink-0" />
          </div>
        </Panel>
      ) : (
        <TeamSummaryCard className={cn("lg:col-span-5", RUG)} />
      )}

      {/* ------------------------------------------------ Sucursales (lila) */}
      <BranchesPanel className="lg:col-span-12" />

      <EmailAlertsCard />
    </div>
  );
}

/**
 * "Avisos por correo": one switch for "someone applied" emails. It's the person's own profile flag
 * (email_updates), the same one that sends candidate updates; every dueño and admin gets them, and each
 * reclutador for their branches. Live and demo.
 */
export function EmailAlertsCard({ className }: { className?: string }) {
  const can = useCan();
  // Members get the emails of the vacancies they work (dueños and admins: all; a reclutador: theirs).
  const member = !!can.role && can.role !== "dueno";
  const live = useApp((s) => s.mode === "live");
  const storeEmail = useApp((s) => s.email);
  const on = useApp((s) => s.emailUpdates);
  const setOn = useApp((s) => s.setEmailUpdates);
  const { user } = useLiveUser();
  const email = live ? user?.email || storeEmail || null : null;
  const hint = !live
    ? "En la demo no se mandan correos."
    : email
      ? `Te escribimos a ${email} con la colonia y la distancia de cada postulante${can.allBranches ? "" : " de tus sucursales"}.`
      : "Tu cuenta entró con celular y no tiene correo, así que por ahora no te llegan.";

  return (
    <Panel
      tone="cielo"
      aria-labelledby="avisos-correo-t"
      className={cn("flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center lg:col-span-12", RUG, className)}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span className="grid size-11 shrink-0 -rotate-6 place-items-center rounded-xl bg-ink text-white">
          <HugeiconsIcon icon={Mail01Icon} className="size-5" strokeWidth={2} />
        </span>
        <div className="min-w-0">
          <h2 id="avisos-correo-t" className="font-display text-[1.2rem] leading-tight font-extrabold tracking-[-0.02em]">
            Avisos por correo
          </h2>
          <p id="avisos-correo-hint" className="mt-0.5 text-[0.92rem] leading-snug break-words text-muted-foreground">
            {hint}
          </p>
        </div>
      </div>
      <label
        htmlFor="avisos-correo-postulantes"
        className="flex min-h-14 cursor-pointer items-center justify-between gap-4 rounded-tile border-2 border-ink bg-white/75 px-4 text-[0.95rem] font-semibold text-ink sm:shrink-0 dark:bg-white/85"
      >
        {member ? "Avisos de postulaciones de tu equipo" : "Avisarme cuando alguien se postule"}
        <Switch
          id="avisos-correo-postulantes"
          checked={on}
          onCheckedChange={(v) => void setOn(v)}
          aria-describedby="avisos-correo-hint"
        />
      </label>
    </Panel>
  );
}

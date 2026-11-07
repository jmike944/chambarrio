"use client";

import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Add01Icon,
  ArrowRight01Icon,
  Briefcase01Icon,
  Clock01Icon,
  ComingSoon01Icon,
  Invoice01Icon,
  Location01Icon,
  Mail01Icon,
  Store01Icon,
  Tick02Icon,
  UserMultipleIcon,
} from "@hugeicons/core-free-icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { BLOCK_CLASS, HeroCard, Panel, PanelHeader, SectionLabel, StatTile } from "@/components/chamba/primitives";
import { CountUp, Sticker } from "@/components/chamba/motion";
import { CategoryArt, CategoryIcon, CATEGORY_BLOCK } from "@/components/chamba/job-icons";
import { Mascot } from "@/components/chamba/art/mascot";
import { Scene } from "@/components/chamba/art/scenes";
import { Doodle, HazardTape } from "@/components/chamba/art/doodles";
import { useMyCompany } from "@/lib/data/catalog";
import { useApplicants } from "@/lib/live/applicants";
import { useLiveUser } from "@/lib/live/session";
import { formatPay } from "@/lib/format";
import { formatKm } from "@/lib/geo";
import { useApp, useEmployerPlan, type PlanId } from "@/lib/store";
import { cn } from "@/lib/utils";
import { BranchMapArt, coloniaText, placeText, useBranchSummaries } from "./sucursales/branch-kit";
import { InitialsAvatar, LockAvatar, WaitRing } from "./wait-ring";

/*
 * The employer dashboard on real data (live mode). Same look as the demo dashboard, but every
 * number comes from the company's own vacancies and applicants; nothing invented.
 */

type CSSVars = React.CSSProperties & Record<`--${string}`, string | number>;

const PLAN_LABEL: Record<PlanId, string> = { "por-vacante": "Por vacante", pyme: "Pyme", industrial: "Industrial" };

/** Rugged workwear edge: ink outline + hard offset shadow (no blur). */
const RUG = "border-2 border-ink shadow-[4px_5px_0_0_var(--ink)] dark:border-black/70 dark:shadow-[4px_5px_0_0_rgb(0_0_0/0.55)]";

const inkCta =
  "press lift inline-flex h-14 items-center justify-center gap-2.5 rounded-full bg-ink px-7 text-[1.05rem] font-semibold text-white shadow-[0_10px_22px_-12px_var(--ink)] outline-none focus-visible:ring-4 focus-visible:ring-white/70";

const DAY = 24 * 60;

export function LiveDashboard() {
  const my = useMyCompany();
  const planId = useEmployerPlan();
  const { status: appsStatus, applicants } = useApplicants();
  const branches = useBranchSummaries();
  const locations = branches.map((b) => b.branch);
  const multi = locations.length > 1;

  const open = my.jobs.filter((j) => j.status === "abierta");
  const active = my.jobs.filter((j) => j.status !== "cerrada");
  const totalApplicants = my.jobs.reduce((n, j) => n + j.applicants, 0);
  const appsReady = appsStatus === "ready";
  const fresh = applicants.filter((a) => a.minutesAgo < DAY).length;
  const week = applicants.filter((a) => a.minutesAgo < 7 * DAY).length;
  const hired = applicants.filter((a) => a.status === "contratada").length;
  const pending = applicants.filter((a) => a.status === "enviada").slice(0, 4);
  const jobById = Object.fromEntries(my.jobs.map((j) => [j.id, j]));
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
            "Publica tu primera vacante"
          ) : appsReady && fresh > 0 ? (
            <>
              Tienes <CountUp value={fresh} from={0} className="inline-block" /> postulante{fresh === 1 ? "" : "s"} nuevo
              {fresh === 1 ? "" : "s"}
            </>
          ) : (
            "Tus vacantes ya están en el radar"
          )
        }
        sticker={
          appsReady && week > 0 ? (
            <Sticker variant="ink" rotate={12} dot>
              <strong>+{week}</strong>esta semana
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
            ? "Es gratis. Le aparece a la gente que vive cerca de tu sucursal y te llegan sus postulaciones."
            : appsReady && fresh > 0
              ? "Llegaron en las últimas 24 h. ¡Respóndeles hoy y gánale a la competencia!"
              : "Le aparecen a la gente que vive cerca. Te avisamos aquí en cuanto alguien se postule."}
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
          <Link href={noJobs ? "/empresa/vacantes/nueva" : "/empresa/candidatos"} className={inkCta}>
            {noJobs ? (
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

      {/* ------------------------------------------------ Pending replies (tinta) */}
      <Panel tone="tinta" className={cn("min-w-0 overflow-hidden lg:col-span-5", RUG)}>
        <Doodle
          name="flecha"
          color="var(--block-sol)"
          className="pointer-events-none absolute top-5 right-5 size-10 rotate-[20deg]"
        />
        <PanelHeader icon={Clock01Icon} title="Por responder" count={appsReady ? pending.length : undefined} />
        {!appsReady ? (
          <div role="status" aria-busy="true" className="space-y-2">
            <span className="sr-only">Cargando postulantes…</span>
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-16 rounded-tile bg-white/10" />
            ))}
          </div>
        ) : pending.length === 0 ? (
          <div className="flex items-center gap-3 rounded-tile border-2 border-dashed border-white/25 p-4">
            <Mascot mood="piensa" prop="lupa" size={56} className="-my-2 shrink-0" />
            <p className="text-[0.98rem] leading-snug">
              {totalApplicants > 0
                ? "¡Al día! Ya revisaste todas las postulaciones."
                : "Aún nadie se postula. Aquí verás a cada persona en cuanto lo haga."}
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {pending.map((a, i) => {
              const job = jobById[a.jobId];
              const named = a.unlocked && a.name;
              return (
                <li
                  key={a.id}
                  className="group lift flex animate-rise items-center gap-3 rounded-tile border-2 border-white/10 bg-white/[0.07] p-2.5"
                  style={{ "--i": i } as CSSVars}
                >
                  <span className="relative shrink-0">
                    {named ? <InitialsAvatar name={a.name!} /> : <LockAvatar />}
                    {job ? (
                      <CategoryIcon
                        category={job.category}
                        size="xs"
                        className="absolute -right-3 -bottom-3 scale-[0.78] ring-2 ring-[var(--block-tinta)]"
                      />
                    ) : null}
                  </span>
                  <Link
                    href={`/empresa/vacantes/${a.jobId}`}
                    className="min-w-0 flex-1 rounded-lg pl-1 outline-none focus-visible:ring-3 focus-visible:ring-white/70"
                  >
                    <span className="block truncate text-[1.05rem] leading-snug font-semibold">
                      {named ? a.name : "Nueva postulación"}
                    </span>
                    <span className="block truncate text-[0.9rem] text-muted-foreground">
                      {a.km !== null ? `${formatKm(a.km)} · ` : ""}
                      {a.colonia ? `Col. ${a.colonia}` : job?.title}
                    </span>
                  </Link>
                  <WaitRing minutes={a.minutesAgo} index={i + 1} />
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Doodle name="rayo" color="var(--block-sol)" className="size-5 shrink-0" />
          Responde en menos de 24 h para no perder a los mejores candidatos.
        </p>
      </Panel>

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
              value: appsReady ? <CountUp value={hired} from={0} /> : "—",
              hint: "marcadas como contratadas",
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
      <section aria-labelledby="tus-vacantes" className="min-w-0 lg:col-span-7">
        <SectionLabel
          className="mb-3"
          title={<span id="tus-vacantes">Tus vacantes</span>}
          count={active.length}
          action={
            <Button asChild size="lg" className="h-11">
              <Link href="/empresa/vacantes/nueva">
                <HugeiconsIcon icon={Add01Icon} strokeWidth={2.2} />
                Publicar
              </Link>
            </Button>
          }
        />
        {active.length === 0 ? (
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
          <ul>
            {active.map((j, i) => (
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
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ------------------------------------------------ Plan (durazno): payments coming */}
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
          <Mascot mood="saluda" prop="telefono" size={78} className="-mr-2 -mb-6 shrink-0" />
        </div>
      </Panel>

      {/* ------------------------------------------------ Sucursales (lila) */}
      <Panel tone="lila" className={cn("min-w-0 overflow-hidden lg:col-span-12", RUG)}>
        <PanelHeader
          icon={Store01Icon}
          title={multi ? "Tus sucursales" : "Tu sucursal"}
          count={locations.length}
          action={
            <Button
              asChild
              variant="white"
              size="lg"
              className="h-11 border-2 border-ink bg-white text-ink hover:bg-white/90 dark:bg-white dark:text-ink"
            >
              <Link href="/empresa/sucursales" aria-label="Administrar sucursales">
                <span className="hidden sm:inline">Administrar</span>
                <span className="sm:hidden">Ver</span>
                <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2.2} />
              </Link>
            </Button>
          }
        />
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {branches.map(({ branch, index, jobs: bj, applicants: n }) => (
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
                      {n} postulante{n === 1 ? "" : "s"}
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
                  <span className="block font-display text-[1.05rem] leading-tight font-extrabold">
                    ¿Tienes otra planta o bodega?
                  </span>
                  <span className="block text-[0.85rem] text-muted-foreground">Agrégala y contrata cerca de cada una.</span>
                </span>
              </Link>
            </li>
          )}
        </ul>
      </Panel>

      <EmailAlertsCard />
    </div>
  );
}

/**
 * "Avisos por correo" for the business owner: one switch for "someone applied" emails. It's the
 * owner's profile flag (email_updates), the same one that sends candidate updates. Live and demo.
 */
export function EmailAlertsCard({ className }: { className?: string }) {
  const live = useApp((s) => s.mode === "live");
  const storeEmail = useApp((s) => s.email);
  const on = useApp((s) => s.emailUpdates);
  const setOn = useApp((s) => s.setEmailUpdates);
  const { user } = useLiveUser();
  const email = live ? user?.email || storeEmail || null : null;
  const hint = !live
    ? "En la demo no se mandan correos."
    : email
      ? `Te escribimos a ${email} con la colonia y la distancia de cada postulante.`
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
        Avisarme cuando alguien se postule
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

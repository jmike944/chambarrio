"use client";

import { useState } from "react";
import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon, ArrowRight01Icon, LockIcon, UserIcon, WhatsappIcon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BLOCK_CLASS, DistanceRing, Eyebrow, HeroCard, Panel, rotateTone } from "@/components/chamba/primitives";
import { CountUp, Stagger, StaggerItem } from "@/components/chamba/motion";
import { CategoryIcon } from "@/components/chamba/job-icons";
import { Scene } from "@/components/chamba/art/scenes";
import { Burst, Doodle } from "@/components/chamba/art/doodles";
import { EmployerError } from "@/components/empresa/employer-gate";
import { useMyCompany } from "@/lib/data/catalog";
import type { ApplicationStatus } from "@/lib/data/types";
import { useApplicants } from "@/lib/live/applicants";
import { formatMinutesAgo } from "@/lib/format";
import { formatKm, type RadiusKm } from "@/lib/geo";
import { cn } from "@/lib/utils";
import { InitialsAvatar, LockAvatar, RadiusChips } from "../wait-ring";

/*
 * Live /empresa/candidatos: the people who applied to my vacancies (there is no "people near you
 * who didn't apply" source, by design). Colonia + rounded km always; name / WhatsApp only once
 * the vacancy is unlocked.
 */

const RUG = "border-2 border-ink shadow-[4px_5px_0_0_var(--ink)] dark:border-black/70 dark:shadow-[4px_5px_0_0_rgb(0_0_0/0.55)]";

const STATUS_LABEL: Record<ApplicationStatus, string> = {
  enviada: "Nueva",
  vista: "Vista",
  entrevista: "Entrevista",
  contratada: "Contratada",
  cerrada: "Descartada",
};

export function LiveCandidates() {
  const my = useMyCompany();
  const { status, error, applicants, reload } = useApplicants();
  const [radius, setRadius] = useState<RadiusKm>(15);
  const [jobFilter, setJobFilter] = useState<string>("todas");
  const jobById = Object.fromEntries(my.jobs.map((j) => [j.id, j]));

  const inRadius = applicants.filter((a) => a.km === null || a.km <= radius);
  const jobsWithApplicants = my.jobs.filter((j) => applicants.some((a) => a.jobId === j.id));
  const current = jobsWithApplicants.find((j) => j.id === jobFilter);
  const list = inRadius
    .filter((a) => !current || a.jobId === current.id)
    .toSorted((a, b) => (a.km ?? Infinity) - (b.km ?? Infinity));
  const ready = status === "ready";

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 lg:items-start lg:gap-6">
      {/* ------------------------------------------------ Hero: radius control (the one saturated block) */}
      <HeroCard
        tone="uva"
        decor={false}
        eyebrow="Tus postulantes"
        className={cn("animate-rise overflow-hidden lg:sticky lg:top-6 lg:col-span-5", RUG)}
        title={
          ready ? (
            <>
              <CountUp value={inRadius.length} className="inline-block tabular-nums" /> {inRadius.length === 1 ? "persona" : "personas"} a
              menos de <span className="inline-block -rotate-2 rounded-xl bg-limon px-2 text-ink">{radius} km</span>
            </>
          ) : (
            "Buscando a tus postulantes…"
          )
        }
      >
        <span aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-[inherit]">
          <span className="absolute inset-0 bg-dots text-white [mask-image:linear-gradient(to_bottom,black,transparent_70%)]" />
          <Doodle name="rayo" color="var(--block-sol)" className="absolute top-6 right-6 size-10 rotate-12" />
        </span>
        <p className="mt-3 max-w-sm text-[1.02rem] leading-snug text-primary-foreground/80">
          Solo ves a quien se postuló a tus vacantes, con su colonia y la distancia a tu sucursal.
        </p>
        <RadiusChips value={radius} onChange={setRadius} tone="hero" className="mt-5" />
        <div aria-hidden className="relative -mx-6 mt-5 -mb-6 flex items-end justify-between sm:-mx-7 sm:-mb-7">
          <Scene name="busqueda" className="w-48 translate-x-3 translate-y-3 sm:w-56" />
          <Burst size={92} color="var(--limon)" points={14} className="mr-5 mb-6 rotate-6 text-[0.7rem] leading-none">
            <span className="block text-center">
              <span className="block text-[1.6rem]">{ready ? <CountUp value={applicants.length} /> : "—"}</span>
              en total
            </span>
          </Burst>
        </div>
      </HeroCard>

      <div className="min-w-0 space-y-4 lg:col-span-7">
        {jobsWithApplicants.length > 1 ? (
          <div
            role="group"
            aria-label="Filtrar por vacante"
            className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pt-1 pb-2 lg:mx-0 lg:flex-wrap lg:px-0"
          >
            {[{ id: "todas", title: "Todas", category: null }, ...jobsWithApplicants].map((f) => {
              const on = f.id === "todas" ? !current : f.id === current?.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setJobFilter(f.id)}
                  className={cn(
                    "group press inline-flex h-12 shrink-0 items-center gap-2 rounded-full border-2 border-ink pr-4 pl-1.5 font-display text-[1rem] font-bold whitespace-nowrap transition-[background-color,color,translate,box-shadow] outline-none focus-visible:ring-4 focus-visible:ring-ring/50",
                    on
                      ? "bg-ink text-white shadow-[3px_3px_0_0_var(--limon)] dark:border-white/80"
                      : "bg-card text-foreground shadow-[3px_3px_0_0_var(--ink)] hover:-translate-y-0.5 dark:border-black/70",
                  )}
                >
                  {f.category ? (
                    <CategoryIcon category={f.category} size="xs" />
                  ) : (
                    <span className={cn("grid size-8 place-items-center rounded-full", on ? "bg-limon text-ink" : "bg-block-sol text-ink")}>
                      <HugeiconsIcon icon={UserIcon} className="size-4.5" strokeWidth={2.2} />
                    </span>
                  )}
                  {f.title}
                </button>
              );
            })}
          </div>
        ) : null}

        {status === "loading" ? (
          <div role="status" aria-busy="true" className="space-y-4">
            <span className="sr-only">Cargando postulantes…</span>
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-40 rounded-panel" />
            ))}
          </div>
        ) : status === "error" ? (
          <EmployerError message={error} onRetry={reload} />
        ) : my.jobs.length === 0 ? (
          <Panel tone="sol" className={cn("flex flex-col items-center text-center", RUG)}>
            <Scene name="negocio" className="w-52" />
            <h2 className="mt-2 font-display text-[1.4rem] font-extrabold">Publica tu primera vacante</h2>
            <p className="mt-1 max-w-xs text-muted-foreground">Aquí verás a cada persona que se postule, con su colonia y distancia.</p>
            <Button asChild size="lg" className="mt-4">
              <Link href="/empresa/vacantes/nueva">
                <HugeiconsIcon icon={Add01Icon} strokeWidth={2.4} />
                Publicar gratis
              </Link>
            </Button>
          </Panel>
        ) : list.length === 0 ? (
          <Panel tone="lila" className={cn("flex flex-col items-center text-center", RUG)}>
            <Scene name="vacio" className="w-52" />
            <h2 className="mt-2 font-display text-[1.4rem] font-extrabold">
              {applicants.length === 0 ? "Aún nadie se postula" : "Nadie en este radio"}
            </h2>
            <p className="mt-1 max-w-xs text-muted-foreground">
              {applicants.length === 0
                ? "Tus vacantes ya le aparecen a la gente que vive cerca. Te avisamos en cuanto alguien se postule."
                : "Amplía la distancia o quita el filtro para ver a más gente."}
            </p>
            {applicants.length > 0 ? (
              <Button
                size="lg"
                className="mt-4"
                onClick={() => {
                  setJobFilter("todas");
                  setRadius(15);
                }}
              >
                Ver a todos
              </Button>
            ) : null}
          </Panel>
        ) : (
          <Stagger as="ul" className="space-y-4" aria-label={`${list.length} postulantes a menos de ${radius} km`}>
            {list.map((a, i) => {
              const job = jobById[a.jobId];
              const named = a.unlocked && a.name ? a.name : null;
              const phone = named ? (a.phone?.replace(/\D/g, "") ?? "") : "";
              return (
                <StaggerItem
                  as="li"
                  key={a.id}
                  className={cn("group lift relative overflow-hidden rounded-panel p-4 sm:p-5", BLOCK_CLASS[rotateTone(i)], RUG)}
                  style={{ rotate: `${i % 2 ? 0.6 : -0.6}deg` }}
                >
                  <div className="flex items-start gap-3.5">
                    {named ? <InitialsAvatar name={named} size="lg" /> : <LockAvatar className="size-14" />}
                    <div className="min-w-0 flex-1">
                      <p className="font-display text-[1.25rem] leading-tight font-extrabold tracking-[-0.02em] break-words">
                        {named ?? "Postulante"}
                      </p>
                      <p className="mt-0.5 text-[0.95rem] font-medium">{job?.title ?? "Vacante"}</p>
                    </div>
                    {job ? (
                      <CategoryIcon
                        category={job.category}
                        size="md"
                        className="-mt-1 -mr-1 shrink-0 rotate-6 transition-transform duration-300 group-hover:-rotate-6"
                      />
                    ) : null}
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {a.km !== null ? (
                      <span className="inline-flex h-8 items-center gap-1.5 rounded-full border-2 border-ink bg-white pr-2.5 pl-1 font-display text-[0.9rem] font-bold text-ink [--tile:rgb(22_15_51/0.12)]">
                        <DistanceRing km={a.km} radiusKm={radius} size={22} showLabel={false} />
                        <span className="sr-only">A </span>
                        {formatKm(a.km)}
                      </span>
                    ) : null}
                    <span className="inline-flex h-8 items-center rounded-full border-2 border-ink bg-ink px-2.5 text-[0.85rem] font-bold text-white">
                      {STATUS_LABEL[a.status]}
                    </span>
                    <span className="inline-flex h-8 items-center rounded-full border-2 border-ink/25 bg-white/50 px-2.5 text-[0.85rem] font-semibold">
                      {a.experience}
                    </span>
                    {a.colonia ? (
                      <span className="inline-flex h-8 items-center rounded-full border-2 border-ink/25 bg-white/50 px-2.5 text-[0.85rem] font-semibold">
                        Col. {a.colonia}
                      </span>
                    ) : null}
                    <span className="inline-flex h-8 items-center px-1 text-[0.85rem] font-medium text-muted-foreground">
                      {formatMinutesAgo(a.minutesAgo)}
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2 sm:flex sm:justify-end">
                    {named && phone.length >= 10 ? (
                      <Button asChild className="h-12 border-2 border-ink bg-ink px-4 text-white hover:bg-ink/90 dark:border-black/70">
                        <a href={`https://wa.me/${phone}`} target="_blank" rel="noopener noreferrer">
                          <HugeiconsIcon icon={WhatsappIcon} className="size-5 text-limon" strokeWidth={1.8} />
                          WhatsApp
                        </a>
                      </Button>
                    ) : null}
                    <Button
                      asChild
                      variant="white"
                      className="col-span-2 h-12 border-2 border-ink bg-white px-4 text-ink hover:bg-white/90 sm:col-span-1 dark:bg-white dark:text-ink"
                    >
                      <Link href={`/empresa/vacantes/${a.jobId}`}>
                        Ver en la vacante
                        <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2.2} />
                      </Link>
                    </Button>
                  </div>
                </StaggerItem>
              );
            })}
          </Stagger>
        )}

        {/* ------------------------------------------------ Privacy note */}
        <Panel tone="tinta" className={cn("flex items-start gap-3.5", RUG)}>
          <span className="grid size-11 shrink-0 place-items-center rounded-xl border-2 border-white/20 bg-block-sol text-ink">
            <HugeiconsIcon icon={LockIcon} className="size-5" strokeWidth={2.2} />
          </span>
          <div>
            <Eyebrow tone="lime">Privacidad</Eyebrow>
            <p className="mt-1 text-[0.98rem] leading-snug">
              Mostramos la colonia y una distancia aproximada. Nombres y WhatsApp se ven al desbloquear la vacante (pagos
              próximamente). La dirección exacta de cada persona nunca se comparte.
            </p>
          </div>
        </Panel>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon, ArrowRight01Icon, LockIcon, SquareUnlock02Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { Eyebrow, HeroCard, Panel } from "@/components/chamba/primitives";
import { CountUp } from "@/components/chamba/motion";
import { CategoryIcon } from "@/components/chamba/job-icons";
import { Scene } from "@/components/chamba/art/scenes";
import { Burst, Doodle } from "@/components/chamba/art/doodles";
import { EmployerError, EmployerGate } from "@/components/empresa/employer-gate";
import { AccessTag, HARD_SM, INK_BUTTON, WHITE_BUTTON } from "@/components/empresa/workwear";
import { ApplicantFilterEmpty, ApplicantToolbar, useApplicantControls } from "@/components/empresa/applicant-toolbar";
import {
  ApplicantDetailNote,
  ApplicantGrid,
  ApplicantGridSkeleton,
  SORT_PHRASE,
  changeApplicantStatus,
} from "@/components/empresa/applicant-list";
import type { MyJob } from "@/lib/data/catalog";
import { useApplicantProfiles, type ApplicantProfile, type ApplicantProfilesResult } from "@/lib/live/applicant-profiles";
import { isProfileComplete } from "@/lib/profile-strength";
import type { RadiusKm } from "@/lib/geo";
import { usePaymentsEnabled } from "@/lib/store";
import { cn } from "@/lib/utils";
import { RadiusChips } from "../wait-ring";

/*
 * /empresa/candidatos, both modes: everyone who applied to my vacancies, grouped by vacancy (an
 * unlock is per vacancy, so each group says whether its contacts are visible). Demo: the enriched
 * mock applicants; live: job_applicants + job_applicants_detail. Nobody who didn't apply is shown
 * (privacy, by design). Non-identifying details always; name, phone, photo and CV once unlocked.
 */

/** Rugged workwear edge: ink outline + hard offset shadow (no blur). */
const RUG = "border-2 border-ink shadow-[4px_5px_0_0_var(--ink)] dark:border-black/70 dark:shadow-[4px_5px_0_0_rgb(0_0_0/0.55)]";

const countOf = (n: number, one: string, many: string) => (n === 1 ? `1 ${one}` : `${n} ${many}`);
const completeCount = (list: readonly ApplicantProfile[]) =>
  list.filter((a) => a.strength !== null && isProfileComplete(a.strength)).length;

export function CandidatesList() {
  return <EmployerGate shape="cards">{(my) => <AllApplicants jobs={my.jobs} />}</EmployerGate>;
}

type Group = {
  job: MyJob | null;
  list: ApplicantProfile[];
  all: ApplicantProfile[];
};

function AllApplicants({ jobs }: { jobs: MyJob[] }) {
  const { status, error, detailError, applicants, reload, setStatus } = useApplicantProfiles();
  const [radius, setRadius] = useState<RadiusKm>(15);
  const inRadius = applicants.filter((a) => a.km === null || a.km <= radius);
  const controls = useApplicantControls(inRadius);
  const ready = status === "ready";
  const complete = completeCount(applicants);

  // One group per vacancy, in the order of my vacancies (newest first); each keeps the chosen sort.
  const jobIds = new Set(jobs.map((j) => j.id));
  const groups: Group[] = [
    ...jobs.map((job) => ({
      job,
      list: controls.visible.filter((a) => a.jobId === job.id),
      all: applicants.filter((a) => a.jobId === job.id),
    })),
    {
      job: null,
      list: controls.visible.filter((a) => !a.jobId || !jobIds.has(a.jobId)),
      all: applicants.filter((a) => !a.jobId || !jobIds.has(a.jobId)),
    },
  ].filter((g) => g.list.length > 0);

  let toneStart = 0;

  return (
    <div className="grid grid-cols-1 gap-5 lg:gap-6 xl:grid-cols-12 xl:items-start">
      {/* ------------------------------------------------ Hero: radius control (the one saturated block) */}
      <HeroCard
        tone="uva"
        decor={false}
        eyebrow="Tus postulantes"
        // Full width below xl: the art moves to the right so the block doesn't get tall and empty.
        className={cn("animate-rise overflow-hidden sm:pr-[40%] xl:sticky xl:top-6 xl:col-span-5 xl:pr-7", RUG)}
        title={
          ready ? (
            <>
              <CountUp value={inRadius.length} className="inline-block tabular-nums" />{" "}
              {inRadius.length === 1 ? "persona" : "personas"} a menos de{" "}
              <span className="inline-block -rotate-2 rounded-xl bg-limon px-2 text-ink">{radius} km</span>
            </>
          ) : (
            "Buscando a tus postulantes…"
          )
        }
      >
        <span aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-[inherit]">
          <span className="absolute inset-0 bg-dots text-white [mask-image:linear-gradient(to_bottom,black,transparent_70%)]" />
          <Doodle name="rayo" color="var(--block-sol)" className="absolute top-6 right-6 size-10 rotate-12 sm:hidden xl:block" />
        </span>
        <p className="mt-3 max-w-sm text-[1.02rem] leading-snug text-primary-foreground/80">
          {ready && complete > 0 ? (
            <>
              <strong className="font-bold text-primary-foreground">{countOf(complete, "tiene", "tienen")}</strong> el perfil
              completo.{" "}
            </>
          ) : null}
          Solo ves a quien se postuló a tus vacantes, con su colonia y la distancia a tu sucursal.
        </p>
        <RadiusChips
          value={radius}
          onChange={setRadius}
          tone="hero"
          label="Distancia máxima de los postulantes"
          className="mt-5"
        />
        <div
          aria-hidden
          className="relative -mx-6 mt-5 -mb-6 flex items-end justify-between sm:absolute sm:right-0 sm:bottom-0 sm:m-0 sm:w-[40%] sm:flex-col-reverse sm:items-end sm:justify-start xl:relative xl:right-auto xl:bottom-auto xl:-mx-7 xl:mt-5 xl:-mb-7 xl:w-auto xl:flex-row xl:items-end xl:justify-between"
        >
          <Scene name="busqueda" className="w-48 translate-x-3 translate-y-3 sm:w-56" />
          <Burst
            size={92}
            color="var(--limon)"
            points={14}
            className="mr-5 mb-6 rotate-6 text-[0.7rem] leading-none sm:mr-8 sm:-mb-4 xl:mr-5 xl:mb-6"
          >
            <span className="block text-center">
              <span className="block text-[1.6rem]">{ready ? <CountUp value={applicants.length} /> : "—"}</span>
              en total
            </span>
          </Burst>
        </div>
      </HeroCard>

      <div className="min-w-0 space-y-5 xl:col-span-7">
        {status === "loading" ? (
          <ApplicantGridSkeleton count={2} className="sm:grid-cols-2 xl:grid-cols-1" />
        ) : status === "error" ? (
          <EmployerError message={error} onRetry={reload} />
        ) : jobs.length === 0 ? (
          <Panel tone="sol" className={cn("flex flex-col items-center text-center", RUG)}>
            <Scene name="negocio" className="w-52" />
            <h2 className="mt-2 font-display text-[1.4rem] font-extrabold">Publica tu primera vacante</h2>
            <p className="mt-1 max-w-xs text-muted-foreground">
              Aquí verás a cada persona que se postule: su experiencia, licencias, disponibilidad y a qué distancia vive.
            </p>
            <Button asChild size="lg" className={cn("mt-4", INK_BUTTON, HARD_SM)}>
              <Link href="/empresa/vacantes/nueva">
                <HugeiconsIcon icon={Add01Icon} strokeWidth={2.4} />
                Publicar gratis
              </Link>
            </Button>
          </Panel>
        ) : applicants.length === 0 || inRadius.length === 0 ? (
          <Panel tone="lila" className={cn("flex flex-col items-center text-center", RUG)}>
            <Scene name="vacio" className="w-52" />
            <h2 className="mt-2 font-display text-[1.4rem] font-extrabold">
              {applicants.length === 0 ? "Aún nadie se postula" : "Nadie en este radio"}
            </h2>
            <p className="mt-1 max-w-xs text-muted-foreground">
              {applicants.length === 0
                ? "Tus vacantes ya le aparecen a la gente que vive cerca. Te avisamos en cuanto alguien se postule."
                : "Amplía la distancia para ver a más gente."}
            </p>
            {applicants.length > 0 ? (
              <Button size="lg" className={cn("mt-4", INK_BUTTON, HARD_SM)} onClick={() => setRadius(15)}>
                Ver a todos
              </Button>
            ) : null}
          </Panel>
        ) : (
          <>
            {detailError ? <ApplicantDetailNote onRetry={reload} /> : null}
            {inRadius.length > 1 ? <ApplicantToolbar controls={controls} /> : null}
            {groups.length === 0 ? (
              <ApplicantFilterEmpty onClear={controls.clear} />
            ) : (
              groups.map((g) => {
                const start = toneStart;
                toneStart += g.list.length;
                return (
                  <VacancyGroup
                    key={g.job?.id ?? "otras"}
                    group={g}
                    toneStart={start}
                    sortPhrase={SORT_PHRASE[controls.sort]}
                    radius={radius}
                    setStatus={setStatus}
                  />
                );
              })
            )}
          </>
        )}

        {/* ------------------------------------------------ Privacy note */}
        <Panel tone="tinta" className={cn("flex items-start gap-3.5", RUG)}>
          <span className="grid size-11 shrink-0 place-items-center rounded-xl border-2 border-white/20 bg-block-sol text-ink">
            <HugeiconsIcon icon={LockIcon} className="size-5" strokeWidth={2.2} />
          </span>
          <div>
            <Eyebrow tone="lime">Privacidad</Eyebrow>
            <p className="mt-1 text-[0.98rem] leading-snug">
              Siempre ves la colonia, una distancia aproximada, la experiencia, las licencias y la disponibilidad. Nombre,
              teléfono, foto y CV aparecen al desbloquear cada vacante. La dirección exacta de nadie se comparte.
            </p>
          </div>
        </Panel>
      </div>
    </div>
  );
}

function VacancyGroup({
  group: { job, list, all },
  toneStart,
  sortPhrase,
  radius,
  setStatus,
}: {
  group: Group;
  toneStart: number;
  sortPhrase: string;
  radius: RadiusKm;
  setStatus: ApplicantProfilesResult["setStatus"];
}) {
  const payments = usePaymentsEnabled();
  const unlocked = all.length > 0 && all.every((a) => a.unlocked);
  // Demo: the fake unlock lives on the vacancy page. Live: payments are "Próximamente" there.
  const locked = !unlocked && payments;
  const complete = completeCount(all);
  const title = job?.title ?? "Otras vacantes";
  const headingId = `vacante-${job?.id ?? "otras"}`;
  const shown =
    list.length < all.length ? `${list.length} de ${all.length} postulantes` : countOf(all.length, "postulante", "postulantes");

  return (
    <section aria-labelledby={headingId} className="space-y-1 pt-1">
      {/* Mobile: the action drops under the title; sm+: it sits on the right. */}
      <header className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-3 gap-y-2.5 px-1 sm:grid-cols-[auto_minmax(0,1fr)_auto]">
        {job ? <CategoryIcon category={job.category} size="sm" className="row-span-2 mt-0.5 sm:row-span-1" /> : <span />}
        <div className="min-w-0">
          <h2 id={headingId} className="font-display text-[1.4rem] leading-[1.1] font-extrabold tracking-[-0.03em] break-words">
            {title}
          </h2>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[0.9rem] text-muted-foreground">
            <AccessTag unlocked={unlocked} className="h-7" />
            <span>
              {shown}
              {complete > 0 && list.length === all.length ? ` · ${complete} con perfil completo` : ""}
            </span>
          </p>
        </div>
        {job ? (
          <Button
            asChild
            size="lg"
            className={cn(
              "col-start-2 h-11 justify-self-start px-4 sm:col-start-3 sm:row-start-1 sm:justify-self-end",
              locked ? INK_BUTTON : WHITE_BUTTON,
              HARD_SM,
            )}
          >
            <Link href={`/empresa/vacantes/${job.id}`}>
              {locked ? <HugeiconsIcon icon={SquareUnlock02Icon} strokeWidth={2.2} /> : null}
              {locked ? "Desbloquear" : "Ver vacante"}
              {locked ? null : <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2.4} />}
            </Link>
          </Button>
        ) : null}
      </header>
      <ApplicantGrid
        applicants={list}
        label={`${title}: ${countOf(list.length, "postulante", "postulantes")}, ${sortPhrase}`}
        toneStart={toneStart}
        className="sm:grid-cols-2 xl:grid-cols-1"
        cardProps={(a) => ({
          radiusKm: radius,
          onStatusChange: changeApplicantStatus(setStatus, a),
        })}
      />
    </section>
  );
}

"use client";

import { useLayoutEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowLeft01Icon,
  CancelCircleIcon,
  CheckmarkBadge01Icon,
  ComingSoon01Icon,
  PauseIcon,
  PlayIcon,
  LockIcon,
  Location01Icon,
  SquareUnlock02Icon,
  Store01Icon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { BLOCK_CLASS, Eyebrow, SectionLabel } from "@/components/chamba/primitives";
import { CountUp } from "@/components/chamba/motion";
import { CategoryArt, CATEGORY_BLOCK } from "@/components/chamba/job-icons";
import { Mascot } from "@/components/chamba/art/mascot";
import { HazardTape } from "@/components/chamba/art/doodles";
import { Scene } from "@/components/chamba/art/scenes";
import { EmployerError, EmployerGate } from "@/components/empresa/employer-gate";
import { UnlockDialog } from "@/components/empresa/unlock-dialog";
import { Padlock } from "@/components/empresa/padlock";
import { HARD, HARD_SM, INK_BUTTON, OUTLINE, WHITE_BUTTON } from "@/components/empresa/workwear";
import { ApplicantFilterEmpty, ApplicantToolbar, useApplicantControls } from "@/components/empresa/applicant-toolbar";
import {
  ApplicantDetailNote,
  ApplicantGrid,
  ApplicantGridSkeleton,
  SORT_PHRASE,
  changeApplicantStatus,
} from "@/components/empresa/applicant-list";
import { CATEGORY_BY_ID } from "@/lib/data/categories";
import type { MyJob } from "@/lib/data/catalog";
import { useApplicantProfiles } from "@/lib/live/applicant-profiles";
import { setJobStatus, type JobStatus } from "@/lib/live/backend";
import { isProfileComplete } from "@/lib/profile-strength";
import { formatMinutesAgo, formatMXN, formatPay } from "@/lib/format";
import { formatKm } from "@/lib/geo";
import { UNLOCK_PRICE, useEmployerLocations, useIsLive, useIsUnlocked, usePaymentsEnabled } from "@/lib/store";
import { branchIdOf, coloniaText } from "@/app/empresa/sucursales/branch-kit";
import { cn } from "@/lib/utils";

type CSSVars = React.CSSProperties & Record<`--${string}`, string | number>;

const people = (n: number, one: string, many: string) => (n === 1 ? `1 ${one}` : `${n} ${many}`);

const BackLink = () => (
  <Link
    href="/empresa/vacantes"
    className={cn(
      "press inline-flex h-11 items-center gap-1.5 rounded-full bg-card pr-4 pl-2.5 text-[0.95rem] font-semibold outline-none hover:-translate-x-0.5 focus-visible:ring-3 focus-visible:ring-ring/50",
      OUTLINE,
      "dark:border-white/30",
    )}
  >
    <HugeiconsIcon icon={ArrowLeft01Icon} className="size-5" strokeWidth={2.2} />
    Vacantes
  </Link>
);

export function VacancyApplicants({ jobId }: { jobId: string }) {
  return (
    <div className="pt-6 lg:pt-10">
      <EmployerGate shape="detail">
        {(my) => {
          const job = my.jobs.find((j) => j.id === jobId);
          return job ? <VacancyApplicantsBody job={job} /> : <VacancyNotFound />;
        }}
      </EmployerGate>
    </div>
  );
}

function VacancyNotFound() {
  return (
    <>
      <BackLink />
      <section
        className={cn(
          "mt-4 flex flex-col items-center rounded-panel bg-card p-8 text-center",
          OUTLINE,
          HARD,
          "dark:border-white/25",
        )}
      >
        <Scene name="vacio" className="w-52" />
        <h1 className="mt-3 font-display text-[1.6rem] leading-tight font-extrabold tracking-[-0.03em]">
          No encontramos esta vacante
        </h1>
        <p className="mt-1.5 max-w-sm text-muted-foreground">
          Puede que el enlace esté mal o que no sea de tu negocio. Revisa tu lista de vacantes.
        </p>
        <Button asChild size="lg" className={cn("mt-5", INK_BUTTON, HARD_SM)}>
          <Link href="/empresa/vacantes">Ver mis vacantes</Link>
        </Button>
      </section>
    </>
  );
}

function VacancyApplicantsBody({ job }: { job: MyJob }) {
  const jobId = job.id;
  const live = useIsLive();
  const payments = usePaymentsEnabled();
  // Demo: the enriched mock applicants (never Supabase). Live: job_applicants + job_applicants_detail.
  const { status: listStatus, error: listError, detailError, applicants, reload, setStatus } = useApplicantProfiles(jobId);
  // "Más completos primero" by default from 3 applicants; quick filters on top.
  const controls = useApplicantControls(applicants);
  const loadingList = listStatus === "loading";
  const total = loadingList ? job.applicants : applicants.length;
  const jobUnlocked = useIsUnlocked()(jobId);
  // Live: what the server says per applicant; demo: the vacancy's unlock.
  const unlocked = live ? applicants.length > 0 && applicants.every((a) => a.unlocked) : jobUnlocked;
  const complete = applicants.filter((a) => a.strength !== null && isProfileComplete(a.strength)).length;
  const [dialogOpen, setDialogOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [busy, setBusy] = useState<JobStatus | null>(null);
  const locations = useEmployerLocations();
  const branch = locations.find((l) => l.id === branchIdOf(job, locations));
  const multi = locations.length > 1;

  // Pages stay mounted after navigating away; don't return to an open dialog.
  useLayoutEffect(
    () => () => {
      setDialogOpen(false);
      setCloseOpen(false);
    },
    [],
  );

  async function changeJobStatus(next: JobStatus) {
    if (busy) return;
    setBusy(next);
    const r = await setJobStatus(jobId, next);
    setBusy(null);
    setCloseOpen(false);
    if (r.error) {
      toast.error(r.error);
      return;
    }
    toast.success(
      next === "pausada"
        ? "Pausamos la vacante. Nadie nuevo la verá hasta que la reanudes."
        : next === "abierta"
          ? "¡Vacante activa otra vez! Ya aparece para la gente cerca."
          : "Cerramos la vacante. Sus postulantes se conservan.",
    );
  }

  const within5 = applicants.filter((a) => a.km !== null && a.km <= 5).length;
  const nearestKm = applicants.reduce<number | null>((m, a) => (a.km !== null && (m === null || a.km < m) ? a.km : m), null);
  // Applicant cards rotate pastels, skipping the job's own tone so the grid never echoes the hero.
  const jobTone = CATEGORY_BLOCK[job.category];

  return (
    <>
      <BackLink />

      <div className="mt-4 grid grid-cols-1 gap-5 lg:grid-cols-12 lg:gap-6">
        {/* Vacancy summary — painted in its category's color, art bleeding off the corner */}
        <section
          className={cn(
            "animate-rise relative isolate overflow-hidden rounded-panel p-5 pb-6 sm:p-7 lg:col-span-7",
            BLOCK_CLASS[jobTone],
            OUTLINE,
            HARD,
          )}
        >
          <span aria-hidden className="pointer-events-none absolute inset-0 -z-20 bg-dots opacity-60" />
          <CategoryArt
            category={job.category}
            animated
            className="pointer-events-none absolute -top-10 -right-6 -z-10 size-28 rotate-6 sm:-top-8 sm:size-44"
          />
          <span className="flex flex-wrap items-center gap-2 pr-24 sm:pr-40">
            <span className="inline-flex items-center rounded-full border-2 border-ink bg-white px-2.5 py-0.5 text-[0.72rem] font-extrabold tracking-[0.1em] text-ink uppercase">
              {CATEGORY_BY_ID[job.category].label}
            </span>
            {branch ? (
              <Link
                href="/empresa/sucursales"
                aria-label={`Sucursal: ${branch.name}, ${coloniaText(branch)}. Ver sucursales`}
                className="press relative inline-flex min-h-8 max-w-full after:absolute after:inset-x-0 after:-inset-y-1.5 items-center gap-1.5 rounded-full border-2 border-ink bg-ink py-0.5 pr-3 pl-2 text-[0.82rem] font-bold text-white outline-none focus-visible:ring-4 focus-visible:ring-ring/60"
              >
                <HugeiconsIcon
                  icon={multi ? Store01Icon : Location01Icon}
                  className="size-4 shrink-0 text-limon"
                  strokeWidth={2.2}
                />
                <span className="truncate">{multi ? `${branch.name} · ${coloniaText(branch, false)}` : coloniaText(branch)}</span>
              </Link>
            ) : null}
          </span>
          <h1 className="mt-6 max-w-[11ch] sm:mt-4 font-display text-[2.3rem] leading-[0.98] font-extrabold tracking-[-0.04em] sm:max-w-[14ch] sm:text-[2.9rem]">
            {job.title}
          </h1>
          <p className="mt-2.5 max-w-[34ch] pr-6 text-[0.98rem] text-muted-foreground sm:pr-24">
            <span className="font-semibold text-foreground tabular-nums">{formatPay(job)}</span> · {job.shift} · Publicada{" "}
            {formatMinutesAgo(job.postedMinutesAgo).toLowerCase()}
          </p>
          <dl className="mt-6 grid grid-cols-3 gap-2.5 sm:gap-3">
            {[
              {
                label: "Postulantes",
                value: <CountUp value={total} from={0} />,
                rot: "-1.5deg",
              },
              {
                label: "A menos de 5 km",
                value: loadingList ? "—" : <CountUp value={within5} from={0} />,
                rot: "1deg",
              },
              {
                label: "El más cercano",
                value: nearestKm !== null ? formatKm(nearestKm) : "—",
                rot: "-1deg",
              },
            ].map((s, i) => (
              <div
                key={s.label}
                className={cn(
                  "animate-pop-in flex flex-col rounded-tile p-3 sm:p-4",
                  i === 0 ? "bg-ink text-white" : "bg-white text-ink",
                  OUTLINE,
                  HARD_SM,
                )}
                style={{ "--i": i + 2, rotate: s.rot } as CSSVars}
              >
                <dt
                  className={cn(
                    "order-2 mt-1 text-[0.8rem] leading-tight font-semibold sm:text-sm",
                    i === 0 ? "text-white/75" : "text-ink/65",
                  )}
                >
                  {s.label}
                </dt>
                <dd
                  className={cn(
                    "order-1 font-display text-[1.5rem] leading-none font-extrabold tracking-[-0.04em] whitespace-nowrap tabular-nums min-[400px]:text-[1.7rem] sm:text-[2.2rem]",
                    i === 0 && "text-limon",
                  )}
                >
                  {s.value}
                </dd>
              </div>
            ))}
          </dl>

          {live ? (
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  "inline-flex h-9 items-center rounded-md border-2 border-ink px-2.5 text-[0.75rem] font-extrabold tracking-[0.1em] uppercase",
                  job.status === "abierta"
                    ? "bg-limon text-ink"
                    : job.status === "pausada"
                      ? "bg-white text-ink"
                      : "bg-ink text-white",
                )}
              >
                {job.status === "abierta" ? "Publicada" : job.status === "pausada" ? "En pausa" : "Cerrada"}
              </span>
              {job.status === "abierta" ? (
                <Button
                  size="lg"
                  className={cn("h-11", WHITE_BUTTON)}
                  aria-disabled={!!busy || undefined}
                  onClick={() => void changeJobStatus("pausada")}
                >
                  <HugeiconsIcon icon={PauseIcon} strokeWidth={2.2} />
                  {busy === "pausada" ? "Pausando…" : "Pausar"}
                </Button>
              ) : (
                <Button
                  size="lg"
                  className={cn("h-11", WHITE_BUTTON)}
                  aria-disabled={!!busy || undefined}
                  onClick={() => void changeJobStatus("abierta")}
                >
                  <HugeiconsIcon icon={PlayIcon} strokeWidth={2.2} />
                  {busy === "abierta" ? "Activando…" : job.status === "cerrada" ? "Volver a publicar" : "Reanudar"}
                </Button>
              )}
              {job.status !== "cerrada" ? (
                <Button size="lg" className={cn("h-11", WHITE_BUTTON)} onClick={() => setCloseOpen(true)}>
                  <HugeiconsIcon icon={CancelCircleIcon} className="text-destructive" strokeWidth={2.2} />
                  Cerrar
                </Button>
              ) : null}
            </div>
          ) : null}
        </section>

        {/* Access — the ONE saturated block: mandarina while locked, violet once unlocked */}
        <section
          className={cn(
            "animate-rise relative isolate flex flex-col overflow-hidden rounded-panel p-6 sm:p-7 lg:col-span-5",
            unlocked ? "block-uva" : "block-mandarina",
            OUTLINE,
            HARD,
          )}
          style={{ "--i": 1 } as CSSVars}
        >
          <span aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-dots opacity-50" />
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <Eyebrow tone={unlocked ? "lime" : "inverse"}>{unlocked ? "¡Ya quedó!" : "Publicada gratis"}</Eyebrow>
              <h2 className="mt-2 font-display text-[1.75rem] leading-[1.02] font-extrabold tracking-[-0.035em] sm:text-[2rem]">
                {unlocked
                  ? "Postulaciones desbloqueadas"
                  : total === 1
                    ? "1 persona quiere esta chamba"
                    : `${total} personas quieren esta chamba`}
              </h2>
            </div>
            <div className="relative -mt-2 -mr-2 shrink-0">
              <Mascot mood={unlocked ? "saluda" : "piensa"} prop={unlocked ? "telefono" : "lupa"} size={78} />
              <Padlock open={unlocked} className="absolute -bottom-3 -left-5 size-14" />
            </div>
          </div>

          {unlocked ? (
            <p className="mt-4 text-[1.02rem] leading-relaxed text-muted-foreground">
              Ya ves el nombre, la foto y el teléfono de cada postulante: llámale, mándale un SMS o abre su CV. Responde en menos
              de 24 horas para no perder a los mejores.
            </p>
          ) : (
            <>
              <p className="mt-4 text-[1.02rem] leading-relaxed">
                {live && total === 0
                  ? "Todavía nadie se postula. Te avisamos en cuanto alguien cerca lo haga; ya puedes ver de qué colonia es y a qué distancia vive."
                  : `${people(total, "persona quiere", "personas quieren")} este trabajo y ${within5 === 1 ? "1 vive" : `${within5} viven`} a menos de 5 km${
                      complete > 0 ? `; ${complete === 1 ? "1 tiene" : `${complete} tienen`} el perfil completo` : ""
                    }. Desbloquea la vacante para ver quiénes son y contactarlas.`}
              </p>
              <p className="mt-5 flex items-baseline gap-2">
                <span className="font-display text-[2.6rem] leading-none font-extrabold tracking-[-0.045em] tabular-nums">
                  {formatMXN(UNLOCK_PRICE)}
                </span>
                <span className="text-[0.95rem] font-medium text-muted-foreground">MXN al mes por esta vacante</span>
              </p>
              {payments ? null : (
                <p
                  id="pagos-pronto"
                  className="mt-3 inline-flex items-start gap-2 rounded-tile border-2 border-ink bg-white px-3 py-2 text-[0.9rem] leading-snug font-semibold text-ink"
                >
                  <HugeiconsIcon icon={ComingSoon01Icon} className="mt-0.5 size-4.5 shrink-0" strokeWidth={2.2} />
                  Los pagos en línea llegan muy pronto. Mientras, ya ves la experiencia, las licencias, la disponibilidad y qué
                  tan completo está el perfil de cada postulante.
                </p>
              )}
            </>
          )}

          <div className="mt-5 flex items-end gap-3 lg:mt-auto lg:pt-6">
            {unlocked ? (
              <a
                href="#postulantes"
                className={cn(
                  "press inline-flex h-14 flex-1 items-center justify-center gap-2 rounded-full bg-limon px-5 text-[1.02rem] font-bold text-ink outline-none focus-visible:ring-3 focus-visible:ring-white/70",
                  OUTLINE,
                  HARD_SM,
                )}
              >
                <HugeiconsIcon icon={UserGroupIcon} className="size-5" strokeWidth={2.2} />
                Ver postulantes
              </a>
            ) : payments ? (
              <Button
                size="xl"
                className={cn("flex-1 px-5 text-[1.02rem] font-bold", INK_BUTTON, HARD_SM)}
                onClick={() => setDialogOpen(true)}
              >
                <HugeiconsIcon icon={SquareUnlock02Icon} className="size-5" strokeWidth={2.2} />
                Desbloquear postulaciones
              </Button>
            ) : (
              <Button
                size="xl"
                disabled
                aria-describedby="pagos-pronto"
                className={cn("flex-1 px-5 text-[1.02rem] font-bold disabled:opacity-70", INK_BUTTON, HARD_SM)}
              >
                <HugeiconsIcon icon={SquareUnlock02Icon} className="size-5" strokeWidth={2.2} />
                Desbloquear · Próximamente
              </Button>
            )}
          </div>
        </section>

        {/* Applicants */}
        <section id="postulantes" aria-labelledby="postulantes-title" className="scroll-mt-6 lg:col-span-12">
          <SectionLabel
            title={<span id="postulantes-title">Postulantes</span>}
            count={total}
            action={
              !loadingList && complete > 0 ? (
                <span className="inline-flex h-8 items-center gap-1.5 rounded-md border-2 border-ink bg-limon px-2.5 text-[0.8rem] font-extrabold text-ink tabular-nums shadow-[2px_2px_0_0_var(--ink)] dark:shadow-[2px_2px_0_0_rgb(0_0_0/0.7)]">
                  <HugeiconsIcon icon={CheckmarkBadge01Icon} className="size-4" strokeWidth={2.4} />
                  {complete} con perfil completo
                </span>
              ) : null
            }
            className="mt-2 mb-4"
          />
          {loadingList ? (
            <ApplicantGridSkeleton className="sm:grid-cols-2 lg:grid-cols-3" />
          ) : listStatus === "error" ? (
            <EmployerError message={listError} onRetry={reload} />
          ) : applicants.length === 0 ? (
            <div className={cn("block-cielo flex flex-col items-center rounded-panel p-6 text-center", OUTLINE, HARD_SM)}>
              <Scene name="busqueda" className="w-44" />
              <p className="mt-2 font-display text-[1.3rem] font-extrabold">Aún no hay postulantes</p>
              <p className="mt-1 max-w-sm text-[0.95rem] text-muted-foreground">
                Tu vacante ya le aparece a la gente que vive cerca. Te avisamos en cuanto alguien se postule.
              </p>
            </div>
          ) : (
            <>
              {detailError ? <ApplicantDetailNote onRetry={reload} className="mb-4" /> : null}
              {applicants.length > 1 ? <ApplicantToolbar controls={controls} /> : null}
              {controls.visible.length === 0 ? (
                <ApplicantFilterEmpty onClear={controls.clear} className="mt-4" />
              ) : (
                <ApplicantGrid
                  applicants={controls.visible}
                  label={`${people(controls.visible.length, "postulante", "postulantes")}, ${SORT_PHRASE[controls.sort]}`}
                  avoidTone={jobTone}
                  className="sm:grid-cols-2 lg:grid-cols-3"
                  cardProps={(a) => ({
                    onStatusChange: changeApplicantStatus(setStatus, a),
                  })}
                />
              )}
            </>
          )}

          {unlocked || loadingList || applicants.length === 0 ? null : (
            <div className={cn("mt-6 overflow-hidden rounded-panel bg-card", OUTLINE, "dark:border-white/25")}>
              <HazardTape className="block h-4 w-full" />
              <p className="flex items-start gap-3 p-4 text-[0.95rem] leading-relaxed text-muted-foreground sm:p-5">
                <span className="grid size-9 shrink-0 place-items-center rounded-full border-2 border-ink bg-block-sol text-ink">
                  <HugeiconsIcon icon={LockIcon} className="size-4.5" strokeWidth={2.2} />
                </span>
                <span>
                  Nombre, teléfono, foto y CV se muestran al desbloquear. Lo demás (experiencia, licencias, disponibilidad) ya lo
                  ves. Las empresas nunca ven la dirección exacta de nadie.
                </span>
              </p>
            </div>
          )}
        </section>
      </div>

      {payments ? <UnlockDialog job={job} count={applicants.length} open={dialogOpen} onOpenChange={setDialogOpen} /> : null}

      <AlertDialog open={closeOpen} onOpenChange={(o) => (busy ? undefined : setCloseOpen(o))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cerrar {job.title}?</AlertDialogTitle>
            <AlertDialogDescription>
              Ya no aparecerá en el radar ni recibirá postulaciones. Quienes se postularon se conservan aquí.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!busy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              aria-disabled={!!busy || undefined}
              onClick={(e) => {
                e.preventDefault();
                void changeJobStatus("cerrada");
              }}
            >
              {busy === "cerrada" ? "Cerrando…" : "Cerrar vacante"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

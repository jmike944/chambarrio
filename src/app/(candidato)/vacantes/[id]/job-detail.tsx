"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  Bicycle01Icon,
  Bookmark01Icon,
  Building06Icon,
  Bus01Icon,
  Call02Icon,
  Car01Icon,
  CheckListIcon,
  CheckmarkBadge01Icon,
  Clock01Icon,
  InformationCircleIcon,
  LinkSquare02Icon,
  Location01Icon,
  Money03Icon,
  Note01Icon,
  Route01Icon,
  Store01Icon,
  Tick02Icon,
  WalkingIcon,
  Message01Icon,
  ShieldUserIcon,
} from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Panel, StatTile, surface, type BlockTone } from "@/components/chamba/primitives";
import { CountUp, Reveal, Sticker, useConfetti } from "@/components/chamba/motion";
import { CategoryArt, CategoryIcon, CATEGORY_BLOCK } from "@/components/chamba/job-icons";
import { Scene } from "@/components/chamba/art/scenes";
import { MyMascot, MyScene } from "@/components/chamba/art/my-mascot";
import { Doodle } from "@/components/chamba/art/doodles";
import { CATEGORY_BY_ID } from "@/lib/data/categories";
import { useCatalog, useJob } from "@/lib/data/catalog";
import type { ApplicationPipeline, Branch, Company, Job } from "@/lib/data/types";
import { bandColor, bandFor, BAND_LABEL, commuteOptions, distanceKm, formatKm, type CommuteMode, type LatLng } from "@/lib/geo";
import { formatMinutesAgo, formatMXN, formatNumber, formatPay, PERIOD_LONG } from "@/lib/format";
import { useApp, useMyAvatar } from "@/lib/store";
import { cn } from "@/lib/utils";
import {
  STEP_META,
  UNHIRE_COPY,
  capitalize,
  fmtDate,
  fmtDateLong,
  fmtDayTime,
  fmtTime,
  relativeDayWord,
  stepOf,
  useMyPipeline,
  useNow,
  wasHiredBeforeClose,
  type PipelineStep,
} from "@/lib/pipeline";
import { STRENGTH_LEVEL_LABEL, strengthLevel } from "@/lib/profile-strength";
import { ApplicantAvatar } from "@/components/empresa/applicant-avatar";
import { CatalogErrorPanel, GoneScene, InkSkeleton, LoadingNote } from "../_seeker/states";
import { appliedRecently, candidateTitle, interviewState, STEP_TONE } from "../../postulaciones/_pipeline/model";
import { useMyStrength } from "../../postulaciones/_pipeline/profile";
import { MiniTrack, NotAppliedSteps, PipelineStatus, StatusHeader } from "../../postulaciones/_pipeline/status";

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

type BranchStop = Branch & { km: number; jobs: Job[] };

/** Every branch of the company with its distance from home and open vacancies, nearest first. */
function branchStops(company: Company, home: LatLng, jobsAtBranch: (branchId: string) => Job[]): BranchStop[] {
  return company.locations
    .map((b) => ({ ...b, km: distanceKm(home, b.location), jobs: jobsAtBranch(b.id) }))
    .toSorted((a, b) => a.km - b.km);
}

/**
 * A closer branch of the same company hiring for the same thing (same title first, then same category).
 * Only counts when it saves a real trip (≥ 300 m).
 */
function closerAlternative(job: Job, stops: BranchStop[], km: number) {
  const title = job.title.toLowerCase();
  let best: { branch: BranchStop; job: Job; sameTitle: boolean } | null = null;
  for (const b of stops) {
    if (b.id === job.branchId || b.km > km - 0.3) continue;
    const same = b.jobs.find((j) => j.title.toLowerCase() === title);
    const match = same ?? b.jobs.find((j) => j.category === job.category);
    if (!match) continue;
    const cand = { branch: b, job: match, sameTitle: !!same };
    // Same title beats same category; within a kind, the nearest wins (stops are sorted).
    if (!best || (cand.sameTitle && !best.sameTitle)) best = cand;
  }
  return best;
}

/** "Hay una sucursal más cerca" nudge. */
function CloserBranchNudge({
  company,
  alt,
  savedKm,
}: {
  company: Company;
  alt: NonNullable<ReturnType<typeof closerAlternative>>;
  savedKm: number;
}) {
  return (
    <section
      aria-label="Sucursal más cerca"
      className={cn("relative isolate animate-rise overflow-hidden rounded-panel border-2 border-ink p-4 sm:p-5", surface("lila"), HARD)}
      style={{ "--i": 4 } as CSSVars}
    >
      <span aria-hidden className="pointer-events-none absolute -right-8 -bottom-10 -z-10 size-36 rounded-full bg-dots text-ink/12" />
      <div className="flex items-start gap-3.5">
        <span aria-hidden className="grid size-12 shrink-0 -rotate-6 place-items-center rounded-2xl border-2 border-ink bg-block-sol text-ink shadow-[2px_3px_0_0_var(--ink)]">
          <HugeiconsIcon icon={Location01Icon} className="size-6" strokeWidth={2.2} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[0.72rem] font-extrabold tracking-[0.14em] uppercase">¡Ojo! Te queda más cerquita</p>
          <h2 className="mt-1 font-display text-[1.3rem] leading-[1.1] font-extrabold tracking-[-0.03em] sm:text-[1.45rem]">
            Hay una sucursal más cerca: {alt.branch.name}, a {formatKm(alt.branch.km)}
          </h2>
          <p className="mt-1 text-[0.95rem] text-muted-foreground">
            {company.name} también busca <strong className="font-semibold text-foreground">{alt.job.title}</strong> en {alt.branch.colonia}.
            Te ahorras {formatKm(savedKm)} de camino.
          </p>
        </div>
      </div>
      <Button
        asChild
        variant="white"
        size="lg"
        className="mt-3.5 w-full border-2 border-ink bg-white text-ink hover:bg-white/90 sm:ml-[3.875rem] sm:w-auto dark:bg-white dark:text-ink dark:hover:bg-white/90"
      >
        <Link href={`/vacantes/${alt.job.id}`}>
          Ver la de {alt.branch.name}
          <HugeiconsIcon icon={ArrowRight01Icon} className="size-5" strokeWidth={2.2} />
        </Link>
      </Button>
    </section>
  );
}

/** "Sucursales de <empresa>": every site, nearest first, with its vacancies as links. */
function BranchesPanel({ company, stops, job }: { company: Company; stops: BranchStop[]; job: Job }) {
  const nearestId = stops[0]?.id;
  const total = stops.reduce((n, b) => n + b.jobs.length, 0);
  return (
    <Panel aria-labelledby="sucursales-titulo" className="h-full border-2 border-ink shadow-[5px_5px_0_0_var(--ink)]! dark:shadow-[5px_5px_0_0_rgb(0_0_0/0.65)]!">
      <header className="mb-1 flex items-center gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-ink text-white dark:bg-limon dark:text-ink">
          <HugeiconsIcon icon={Store01Icon} className="size-5" strokeWidth={2} />
        </span>
        <h2 id="sucursales-titulo" className="min-w-0 font-display text-[1.35rem] leading-tight font-extrabold tracking-[-0.03em]">
          Sucursales de {company.name}
        </h2>
      </header>
      <p className="mb-4 pl-14 text-[0.92rem] text-muted-foreground">
        {stops.length} lugares · {total} {total === 1 ? "vacante abierta" : "vacantes abiertas"}
      </p>
      <ol className="space-y-2.5">
        {stops.map((b) => {
          const here = b.id === job.branchId;
          const nearest = b.id === nearestId;
          const band = bandFor(b.km);
          return (
            <li
              key={b.id}
              aria-current={here ? "location" : undefined}
              className={cn(
                "rounded-tile border-2 p-3 sm:p-3.5",
                here ? "border-ink bg-block-sol text-ink" : "border-border bg-tile",
              )}
            >
              <div className="flex items-start gap-3">
                <span
                  aria-hidden
                  className="mt-0.5 grid size-10 shrink-0 place-items-center rounded-full border-2 border-ink bg-white text-ink"
                >
                  <HugeiconsIcon icon={Location01Icon} className="size-5" strokeWidth={2.2} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-[1.05rem] leading-tight font-bold">{b.name}</span>
                    {here ? (
                      <span className="inline-flex h-6 items-center rounded-md bg-ink px-1.5 text-[0.68rem] font-extrabold tracking-[0.1em] text-limon uppercase">
                        Esta vacante
                      </span>
                    ) : null}
                    {nearest ? (
                      <span className="inline-flex h-6 items-center gap-1 rounded-md border-2 border-ink bg-block-menta px-1.5 text-[0.68rem] font-extrabold tracking-[0.1em] text-ink uppercase">
                        La más cerca
                      </span>
                    ) : null}
                  </p>
                  <p className={cn("mt-0.5 text-[0.9rem]", here ? "text-ink/75" : "text-muted-foreground")}>
                    {b.colonia}
                    {b.id === company.locations[0].id ? " · Matriz" : null}
                  </p>
                </div>
                <span className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-ink px-2.5 text-[0.85rem] font-semibold text-white tabular-nums">
                  <span aria-hidden className="size-2 rounded-full" style={{ background: bandColor(band) }} />
                  {formatKm(b.km)}
                </span>
              </div>
              {b.jobs.length > 0 ? (
                <ul aria-label={`Vacantes en ${b.name}`} className="mt-2.5 flex flex-wrap gap-2 sm:pl-[3.25rem]">
                  {b.jobs.map((j) =>
                    j.id === job.id ? (
                      <li key={j.id}>
                        <span className="inline-flex min-h-11 items-center gap-1.5 rounded-full border-2 border-dashed border-ink/50 px-3 text-[0.9rem] font-semibold">
                          <CategoryIcon category={j.category} size="xs" className="-ml-1 size-6!" />
                          {j.title}
                          <span className="sr-only">(estás viendo esta)</span>
                        </span>
                      </li>
                    ) : (
                      <li key={j.id}>
                        <Link
                          href={`/vacantes/${j.id}`}
                          className="group press inline-flex min-h-11 items-center gap-1.5 rounded-full border-2 border-ink bg-white px-3 text-[0.9rem] font-semibold text-ink outline-none hover:bg-block-limon focus-visible:ring-3 focus-visible:ring-ring/60"
                        >
                          <CategoryIcon category={j.category} size="xs" className="-ml-1 size-6!" />
                          {j.title}
                          <HugeiconsIcon icon={ArrowRight01Icon} className="size-4 transition-transform group-hover:translate-x-0.5" strokeWidth={2.4} />
                        </Link>
                      </li>
                    ),
                  )}
                </ul>
              ) : (
                <p className={cn("mt-2 text-[0.88rem] sm:pl-[3.25rem]", here ? "text-ink/75" : "text-muted-foreground")}>
                  Sin vacantes por ahora.
                </p>
              )}
            </li>
          );
        })}
      </ol>
    </Panel>
  );
}

/** Back link to the list (shared by every state of the page). */
function BackLink() {
  return (
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
  );
}

/** Same footprint as the real page (hero, stat tiles, description), so nothing jumps. */
function DetailSkeleton() {
  return (
    <div className="pt-5 pb-48 lg:pt-10 lg:pb-0">
      <LoadingNote>Cargando la vacante…</LoadingNote>
      <BackLink />
      <div aria-hidden className="mt-5 grid gap-5 lg:grid-cols-12">
        <div className="min-w-0 space-y-5 lg:col-span-8">
          <div className={cn("relative h-[19rem] overflow-hidden rounded-panel border-2 border-ink p-5 sm:h-[21rem] sm:p-7", surface("cielo"), HARD)}>
            <InkSkeleton className="h-7 w-28 rounded-md" />
            <InkSkeleton className="mt-4 h-10 w-3/4" />
            <InkSkeleton className="mt-3 h-5 w-1/2" />
            <InkSkeleton className="mt-8 h-12 w-48" />
            <InkSkeleton className="absolute top-4 right-4 size-28 rounded-full sm:size-44" />
          </div>
          <div className="grid grid-cols-3 gap-2.5 pt-4 sm:gap-3">
            {PASTELS.slice(0, 3).map((t) => (
              <div key={t} className={cn("h-28 rounded-tile border-2 border-ink p-3", surface(t), HARD_SM)}>
                <InkSkeleton className="h-4 w-14" />
                <InkSkeleton className="mt-3 h-7 w-20 max-w-full" />
              </div>
            ))}
          </div>
          <div className={cn("h-48 rounded-panel border-2 border-ink bg-card p-5", HARD)}>
            <InkSkeleton className="h-6 w-40" />
            <InkSkeleton className="mt-4 h-4 w-full" />
            <InkSkeleton className="mt-2 h-4 w-5/6" />
            <InkSkeleton className="mt-2 h-4 w-2/3" />
          </div>
        </div>
        <div className="hidden lg:col-span-4 lg:block">
          <div className={cn("h-80 rounded-panel border-2 border-ink p-6 block-uva", HARD)}>
            <InkSkeleton className="h-4 w-32 bg-white/25!" />
            <InkSkeleton className="mt-3 h-8 w-4/5 bg-white/25!" />
            <InkSkeleton className="mt-8 h-14 w-full rounded-full bg-white/25!" />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Not found / closed / paused. Shown only once the catalog is ready. */
function DetailGone() {
  return (
    <div className="pt-5 pb-28 lg:pt-10">
      <BackLink />
      <Panel tone="cielo" className={cn("mx-auto mt-6 max-w-xl animate-pop-in overflow-hidden border-2 border-ink text-center", HARD)}>
        <GoneScene />
        <h1 className="mt-3 font-display text-[1.7rem] leading-tight font-extrabold tracking-[-0.03em]">Esta vacante ya cerró</h1>
        <p className="mx-auto mt-1.5 max-w-sm text-muted-foreground">
          Ya no recibe postulaciones o el enlace no es correcto. Hay más chamba cerquita de tu casa.
        </p>
        <Button asChild size="lg" className="mt-5">
          <Link href="/vacantes">
            Ver vacantes cerca
            <HugeiconsIcon icon={ArrowRight01Icon} className="size-5" strokeWidth={2.2} />
          </Link>
        </Button>
      </Panel>
    </div>
  );
}

/**
 * Reads the vacancy from the catalog (demo mock or live Supabase; live fetches it by id when it isn't
 * in the nearby list). Not-found only once the catalog is ready. A vacancy that closed after the
 * person applied still shows their application (live: candidates can't read closed vacancies).
 */
export function JobDetail({ jobId }: { jobId: string }) {
  const { status, error, job, company, branch } = useJob(jobId);
  const { jobsAtBranch, source } = useCatalog();
  const mine = useMyPipeline(jobId);
  // A paused / closed vacancy is shown only to the people who applied (their process continues).
  if (job && company && (!job.closed || mine.data)) {
    return <JobDetailView job={job} company={company} branch={branch} jobsAtBranch={jobsAtBranch} live={source === "live"} />;
  }
  // Closed vacancy: wait for my applications before saying it's gone.
  if (status === "loading" || (job?.closed && mine.loading)) return <DetailSkeleton />;
  if (status === "error") {
    return (
      <div className="pt-5 pb-28 lg:pt-10">
        <BackLink />
        <CatalogErrorPanel error={error} title="No pudimos cargar esta vacante" className="mx-auto mt-6 max-w-xl" />
      </div>
    );
  }
  if (mine.data) return <GoneWithApplication p={mine.data} />;
  return <DetailGone />;
}

/** The vacancy closed (or isn't visible anymore) but this person applied: keep their process visible. */
function GoneWithApplication({ p }: { p: ApplicationPipeline }) {
  const now = useNow();
  useScrollToStatus(!!now);
  return (
    <div className="pt-5 pb-28 lg:pt-10">
      <BackLink />
      <p className={cn("mt-5 flex items-center gap-2.5 rounded-panel border-2 border-ink px-4 py-3 font-semibold", surface("cielo"), HARD_SM)}>
        <HugeiconsIcon icon={Store01Icon} className="size-5 shrink-0" strokeWidth={2.2} />
        Esta vacante ya no recibe postulaciones. Tu proceso sigue aquí.
      </p>
      {now ? <StatusBlock p={p} now={now} tone={STEP_TONE[stepOf(p)]} className="mt-5" /> : <div className="mt-5 h-96 animate-pulse rounded-panel bg-card" />}
    </div>
  );
}

/**
 * Opening /vacantes/x#tu-postulacion (from Avisos) lands on the application block once it renders.
 * Safe to run twice (StrictMode runs effect → cleanup → effect in dev; a kept-alive page re-runs it
 * when shown again): nothing is marked done until the frame that scrolls actually runs.
 */
function useScrollToStatus(ready: boolean) {
  useEffect(() => {
    if (!ready || window.location.hash !== `#${STATUS_ID}`) return;
    const id = requestAnimationFrame(() => document.getElementById(STATUS_ID)?.scrollIntoView({ block: "start" }));
    return () => cancelAnimationFrame(id);
  }, [ready]);
}

const STATUS_ID = "tu-postulacion";

function scrollToStatus() {
  document.getElementById(STATUS_ID)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

/** "Tu postulación": header (title, chip, mini track, mascot) + the state-aware body. */
function StatusBlock({
  p,
  now,
  tone,
  job,
  company,
  branch,
  nudge,
  title,
  className,
}: {
  p: ApplicationPipeline;
  now: number;
  tone: BlockTone;
  job?: Job;
  company?: Company;
  branch?: Branch;
  /** Show the "Completa tu perfil" nudge (off while the apply confirmation already shows it). */
  nudge?: boolean;
  /** Replaces the step's title (the apply confirmation above already says it arrived). */
  title?: string;
  className?: string;
}) {
  return (
    <section
      id={STATUS_ID}
      aria-labelledby="tu-postulacion-titulo"
      className={cn("relative isolate scroll-mt-6 animate-rise rounded-panel border-2 border-ink p-4 sm:p-6", surface(tone), HARD, className)}
    >
      <span aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-[inherit]">
        <span className="absolute -top-12 -left-12 size-44 rounded-full bg-dots text-ink/12" />
      </span>
      <StatusHeader p={p} now={now} title={title} id="tu-postulacion-titulo" className="mb-4 sm:mb-5" />
      <PipelineStatus p={p} now={now} job={job} company={company} branch={branch} nudge={nudge} />
    </section>
  );
}

/**
 * Right after applying: what the company sees now (exactly what job_applicants_detail gives it), and a
 * gentle nudge to complete the profile. Every company sees the profile right away: the avatar the
 * person built, colonia and distance, experience and work history, "Sobre mí", studies, skills,
 * shifts and expected pay. Name, phone, photo and CV: right away on the Pyme / Industrial plans,
 * else once the company opens (unlocks) the vacancy's applicants.
 */
function ApplyConfirmation({ company, km, tone }: { company: Company; km: number; tone: BlockTone }) {
  const colonia = useApp((s) => (s.hasHome && s.colonia ? s.colonia : null));
  const experience = useApp((s) => s.experience);
  const jobsBefore = useApp((s) => s.workExperiences.length);
  const look = useMyAvatar();
  const strength = useMyStrength();
  const level = strengthLevel(strength.value);
  const seesContact = company.plan === "pyme" || company.plan === "industrial";
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    // Mobile: the button lives in the bottom bar; bring the confirmation into view if it's hidden.
    if (r.top > window.innerHeight - 160 || r.bottom < 0) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);
  const facts = [
    { label: "Colonia", value: colonia ?? "Saltillo" },
    { label: "Distancia", value: `A ${formatKm(km)}` },
    { label: "Experiencia", value: jobsBefore > 0 ? `${experience} · ${jobsBefore} ${jobsBefore === 1 ? "empleo" : "empleos"}` : experience },
  ];
  return (
    <section
      ref={ref}
      aria-live="polite"
      aria-labelledby="ya-quedo-titulo"
      className={cn("@container relative isolate scroll-mt-6 animate-pop-in overflow-hidden rounded-panel border-2 border-ink p-4 sm:p-6", surface(tone), HARD)}
    >
      <span aria-hidden className="pointer-events-none absolute -right-10 -bottom-12 -z-10 size-48 rounded-full bg-dots text-ink/12" />
      <div className="grid gap-4 @2xl:grid-cols-[0.9fr_1.1fr] @2xl:grid-rows-[auto_1fr] @2xl:gap-x-6">
        <div className="min-w-0 @2xl:col-start-1 @2xl:row-start-1">
          <div className="flex items-start gap-3">
            <MyScene name="exito" className="-mt-1 -ml-1 w-24 shrink-0 sm:w-28" />
            <div className="min-w-0">
              <p className="text-[0.75rem] font-extrabold tracking-[0.14em] uppercase">¡Ya quedó!</p>
              <h2 id="ya-quedo-titulo" className="mt-1 font-display text-[1.45rem] leading-[1.05] font-extrabold tracking-[-0.03em] sm:text-[1.8rem]">
                {company.name} ya tiene tu solicitud
              </h2>
            </div>
          </div>
          <p className="mt-3 text-[0.98rem] leading-snug">
            Desde ahora te ve en su lista. Cuando la revisen, cuando te inviten a entrevista o si hay cambios, te avisamos aquí.
          </p>
        </div>

        <div className="@container min-w-0 rounded-tile border-2 border-ink bg-white p-4 text-ink shadow-[4px_4px_0_0_var(--ink)] @2xl:col-start-2 @2xl:row-span-2 @2xl:row-start-1">
          <p className="text-[0.72rem] font-extrabold tracking-[0.14em] uppercase">Esto ve {company.name} ahora</p>
          <div className="mt-3 flex items-center gap-3">
            {/* Their own look: the avatar is what every company sees, before anything is unlocked. */}
            <ApplicantAvatar name={null} locked={false} art={look} />
            <div className="min-w-0">
              <p className="font-display text-[1.15rem] leading-tight font-extrabold">Tu ficha</p>
              <p className="flex items-start gap-1.5 text-[0.88rem] leading-snug text-ink/70">
                <HugeiconsIcon icon={ShieldUserIcon} className="mt-0.5 size-3.5 shrink-0" strokeWidth={2.4} />
                {seesContact
                  ? "También ve tu nombre, teléfono, foto y CV, para contactarte."
                  : "Para cuidar tu privacidad, tu nombre, teléfono, foto y CV se comparten cuando la empresa avanza con tu postulación."}
              </p>
            </div>
          </div>
          <dl className="mt-3 grid grid-cols-1 gap-2 @sm:grid-cols-3">
            {facts.map((f) => (
              <div key={f.label} className="min-w-0 rounded-xl bg-ink/[0.05] px-3 py-2">
                <dt className="text-[0.7rem] font-bold tracking-[0.12em] text-ink/60 uppercase">{f.label}</dt>
                <dd className="font-semibold">{f.value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-[0.88rem] leading-snug text-ink/75">
            También ve tu perfil: experiencia (dónde trabajaste y qué hacías), «Sobre mí», estudios, habilidades, turnos y el sueldo que
            buscas.{" "}
            <Link href="/perfil" className="font-semibold text-ink underline underline-offset-4 outline-none focus-visible:ring-3 focus-visible:ring-ink/30">
              Revisar mi perfil
            </Link>
          </p>
          <div className="mt-3">
            <p className="flex items-baseline justify-between gap-2 text-[0.88rem]">
              <span className="font-semibold">Tu perfil</span>
              <span className="tabular-nums">
                <strong className="font-display text-[1.15rem] font-extrabold">{strength.value}%</strong> · {STRENGTH_LEVEL_LABEL[level]}
              </span>
            </p>
            <div className="mt-1.5 h-3 overflow-hidden rounded-full border-2 border-ink bg-ink/[0.06]">
              <div className="h-full origin-left animate-grow rounded-full bg-nopal" style={{ width: `${Math.max(6, strength.value)}%` }} />
            </div>
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap @2xl:col-start-1 @2xl:row-start-2 @2xl:self-end">
          {strength.low ? (
            <Link href="/perfil" className={INK_LINK}>
              Completa tu perfil y destaca
              <HugeiconsIcon icon={ArrowRight01Icon} className="size-5" strokeWidth={2.2} />
            </Link>
          ) : null}
          <Link href="/postulaciones" className={WHITE_LINK}>
            Ver mis postulaciones
          </Link>
        </div>
      </div>
    </section>
  );
}

/** "8441234501" → "844 123 4501" (anything else as it is). */
const prettyPhone = (d: string) => (/^\d{10}$/.test(d) ? `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}` : d);

const INK_LINK =
  "press inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-ink px-5 text-[0.98rem] font-semibold text-white outline-none focus-visible:ring-3 focus-visible:ring-ink/40";
const WHITE_LINK =
  "press inline-flex min-h-12 items-center justify-center gap-2 rounded-full border-2 border-ink bg-white px-5 text-[0.98rem] font-semibold text-ink outline-none hover:bg-white/90 focus-visible:ring-3 focus-visible:ring-ink/40";

function JobDetailView({
  job,
  company,
  branch,
  jobsAtBranch,
  live,
}: {
  job: Job;
  company: Company;
  branch: Branch | undefined;
  jobsAtBranch: (branchId: string) => Job[];
  live: boolean;
}) {
  const jobId = job.id;
  const home = useApp((s) => s.home);
  const signedIn = useApp((s) => s.signedIn);
  const saved = useApp((s) => s.saved.includes(jobId));
  const appliedInStore = useApp((s) => s.applications.some((a) => a.jobId === jobId));
  const apply = useApp((s) => s.apply);
  const toggleSaved = useApp((s) => s.toggleSaved);
  const fire = useConfetti();
  const { data: p } = useMyPipeline(jobId);
  const now = useNow();
  const [justApplied, setJustApplied] = useState(false);
  useScrollToStatus(!!p && !!now);

  const applied = appliedInStore || !!p;
  const step = p ? stepOf(p) : null;
  const multi = company.locations.length > 1;
  const km = distanceKm(home, job.location);
  const stops = multi ? branchStops(company, home, jobsAtBranch) : [];
  const alt = multi ? closerAlternative(job, stops, km) : null;
  const band = bandFor(km);
  const commutes = commuteOptions(km);
  const fastest = commutes.reduce((a, b) => (b.minutes < a.minutes ? b : a), commutes[0]);
  const smsText = encodeURIComponent(`Hola, vi la vacante de ${job.title} en Chambarrio y me interesa. ¿Sigue disponible?`);
  const category = CATEGORY_BY_ID[job.category];

  const heroTone = CATEGORY_BLOCK[job.category];
  const tones = PASTELS.filter((t) => t !== heroTone);
  const successTone: BlockTone = heroTone === "limon" ? "menta" : "limon";
  const statusTone: BlockTone = !step ? "sol" : STEP_TONE[step] !== heroTone ? STEP_TONE[step] : STEP_TONE[step] === "menta" ? "cielo" : "menta";
  const showConfirmation = !!p && step === "enviada" && (justApplied || appliedRecently(p, now));
  // Panels right under the status block never repeat its colour.
  const comoTone: BlockTone = tones[4] ?? tones[1];
  const piden: BlockTone = [tones[3], ...tones].find((t) => t !== statusTone && t !== comoTone) ?? tones[3];
  const initials = company.name
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  // Live visitors without a session can't apply or save: send them to sign in instead.
  const needsAccount = live && !signedIn;
  /** The vacancy's phone, else the company's. */
  const phone = job.phone || company.phone || "";
  const hasPhone = !!phone;
  /** A vacante curada: nobody at the company reads applications here, so candidates call / text / open the original. */
  const curated = job.curated ?? null;
  const originalUrl = curated?.sourceUrl ?? null;

  async function onApply(e: React.MouseEvent<HTMLButtonElement>) {
    const origin = e.currentTarget;
    if (!live) {
      apply(jobId);
      setJustApplied(true);
      fire({ origin, count: 56, colors: CONFETTI });
      toast.success("¡Ya quedó! Postulación enviada", { description: `${company.name} ya tiene tu solicitud.` });
      return;
    }
    // Live: the button flips at once; celebrate only once the server agrees (on error the store
    // rolls back and toasts by itself).
    setJustApplied(true);
    const r = await apply(jobId);
    if (r.error) {
      setJustApplied(false);
      return;
    }
    fire({ origin, count: 56, colors: CONFETTI });
    toast.success("¡Ya quedó! Postulación enviada", { description: `${company.name} ya tiene tu solicitud.` });
  }

  async function onSave() {
    if (!live) {
      toggleSaved(jobId);
      toast(saved ? "Quitada de tus guardadas" : "Guardada para después");
      return;
    }
    const r = await toggleSaved(jobId);
    if (!r.error) toast(saved ? "Quitada de tus guardadas" : "Guardada para después");
  }

  /** The big lime button: apply, or (once applied) jump to the application's status. Curated: call (or the original posting). */
  const primary = (compact: boolean) =>
    curated ? (
      hasPhone ? (
        <Button asChild variant="lime" size="xl" className={cn("w-full border-2 border-ink text-[1.05rem] font-bold", HARD_SM)}>
          <a href={`tel:+52${phone}`}>
            <HugeiconsIcon icon={Call02Icon} className="size-5" strokeWidth={2.2} />
            Llamar para postularme
          </a>
        </Button>
      ) : originalUrl ? (
        <Button asChild variant="lime" size="xl" className={cn("w-full border-2 border-ink text-[1.05rem] font-bold", HARD_SM)}>
          <a href={originalUrl} target="_blank" rel="noopener noreferrer nofollow">
            Postularme en la vacante original
            <HugeiconsIcon icon={LinkSquare02Icon} className="size-5" strokeWidth={2.2} />
          </a>
        </Button>
      ) : null
    ) : needsAccount ? (
      <Button asChild variant="lime" size="xl" className={cn("w-full border-2 border-ink text-[1.05rem] font-bold", HARD_SM)}>
        <Link href="/entrar">Entra para postularte</Link>
      </Button>
    ) : applied ? (
      <Button
        variant="lime"
        size="xl"
        className="h-auto min-h-14 w-full flex-col gap-0 border-2 border-ink py-1.5 text-[1.02rem] leading-tight font-bold"
        onClick={scrollToStatus}
      >
        <span className="inline-flex items-center gap-1.5">
          <HugeiconsIcon icon={Tick02Icon} className="size-5" strokeWidth={2.4} />
          {step === "descartada" || step === "retirada" ? "Postulación cerrada" : step === "contratada" ? "¡Te contrataron!" : "Ya te postulaste"}
        </span>
        <span className="text-[0.82rem] font-semibold opacity-75">
          {!compact && p && step ? actionLine(p, step, now) : "Ver mi postulación"}
        </span>
      </Button>
    ) : (
      <Button variant="lime" size="xl" className={cn("w-full border-2 border-ink text-[1.05rem] font-bold", HARD_SM)} onClick={onApply}>
        ¡Postularme!
      </Button>
    );

  const whiteBtn = "border-2 border-ink bg-white text-ink hover:bg-white/90 dark:bg-white dark:text-ink dark:hover:bg-white/90";
  const smsButton = hasPhone ? (
    <Button asChild variant="white" size="lg" className={whiteBtn}>
      <a href={`sms:+52${phone}?&body=${smsText}`}>
        <HugeiconsIcon icon={Message01Icon} className="size-5 text-nopal" strokeWidth={2} />
        SMS
      </a>
    </Button>
  ) : null;
  // Next to SMS: "Llamar" (curated: the call is already the big button, so the original posting instead).
  const middleButton = curated ? (
    hasPhone && originalUrl ? (
      <Button asChild variant="white" size="lg" className={whiteBtn}>
        <a href={originalUrl} target="_blank" rel="noopener noreferrer nofollow">
          <HugeiconsIcon icon={LinkSquare02Icon} className="size-5" strokeWidth={2} />
          Original
        </a>
      </Button>
    ) : null
  ) : hasPhone ? (
    <Button asChild variant="white" size="lg" className={whiteBtn}>
      <a href={`tel:+52${phone}`}>
        <HugeiconsIcon icon={Call02Icon} className="size-5" strokeWidth={2} />
        Llamar
      </a>
    </Button>
  ) : null;
  const sideButtons = [smsButton, middleButton].filter(Boolean).length;

  /** CTA cluster — lives on the violet action block (mobile bar; `stacked` in the narrower desktop aside). */
  const renderActions = (stacked = false) => {
    // Save shows its label when it has the row to itself (stacked, or nothing next to it).
    const wideSave = stacked || sideButtons === 0;
    return (
      <div className="flex flex-col gap-2.5">
        {primary(stacked)}
        <div
          className={cn(
            "grid gap-2.5",
            sideButtons === 0 || (stacked && sideButtons === 1)
              ? "grid-cols-1"
              : stacked
                ? "grid-cols-2"
                : sideButtons === 1
                  ? "grid-cols-[1fr_auto]"
                  : "grid-cols-[1fr_1fr_auto]",
          )}
        >
          {smsButton}
          {middleButton}
          <Button
            variant="white"
            size={wideSave ? "lg" : "icon-lg"}
            className={cn(
              "border-2 border-ink bg-white text-ink hover:bg-white/90 dark:bg-white dark:text-ink",
              saved && "bg-block-sol hover:bg-block-sol dark:bg-block-sol",
              stacked && sideButtons === 2 && "col-span-2",
              wideSave && "w-full",
            )}
            onClick={needsAccount ? undefined : onSave}
            disabled={needsAccount}
            aria-pressed={saved}
            aria-label={saved ? "Quitar de guardadas" : "Guardar vacante"}
          >
            <HugeiconsIcon icon={Bookmark01Icon} className="size-5" strokeWidth={saved ? 2.6 : 2} />
            {wideSave ? <span aria-hidden>{saved ? "Guardada" : "Guardar para después"}</span> : null}
          </Button>
        </div>
      </div>
    );
  };

  const queVasAHacer = (
    <Panel className="flex h-full flex-col border-2 border-ink shadow-[5px_5px_0_0_var(--ink)]! dark:shadow-[5px_5px_0_0_rgb(0_0_0/0.65)]!">
      <BlockHeader icon={Note01Icon} title="Qué vas a hacer" onCard />
      <p className="text-[1.05rem] leading-relaxed">
        {job.description || (curated ? "La vacante no da más detalles. Pregúntalos al llamar." : "")}
      </p>
      <dl className="mt-auto grid grid-cols-2 gap-2.5 pt-5">
        <Fact label="Horario" value={job.schedule} className="col-span-2" />
        <Fact label="Jornada" value={job.type} />
        <Fact label="Experiencia" value={job.experience} />
      </dl>
    </Panel>
  );

  const quePiden = (
    <Panel tone={piden} className={cn("h-full overflow-hidden border-2 border-ink", HARD)}>
      <BlockHeader icon={CheckListIcon} title="Qué piden" />
      {job.requirements.length === 0 ? (
        <p className="rounded-tile bg-white/55 p-3 text-[1.02rem] leading-snug font-medium">
          {curated ? "La vacante no lo dice. Pregúntalo al llamar." : "No piden nada en especial."}
        </p>
      ) : null}
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
      {job.benefits.length === 0 ? (
        <p className="text-[1.02rem] leading-snug">{curated ? "No las menciona. Pregunta por ellas al llamar." : "No las menciona."}</p>
      ) : null}
      <ul className="flex flex-wrap gap-2.5">
        {job.benefits.map((b, i) => (
          <li key={b} className="animate-pop-in" style={{ "--i": i, rotate: `${i % 2 === 0 ? -2 : 2}deg` } as CSSVars}>
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
  );

  const comoLlegar = (
    <Panel tone={comoTone} className={cn("@container flex h-full flex-col border-2 border-ink", HARD)}>
      <BlockHeader icon={Route01Icon} title="Cómo llegar" />
      <ul className="grid gap-2 @lg:grid-cols-2">
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
      <p className="mt-auto pt-3 text-sm text-muted-foreground">Tiempos estimados por calle, ida. Costos de ida y vuelta.</p>
    </Panel>
  );

  /** Curated vacancies, in place of "¿Qué sigue?": where it came from, and the company's way in. */
  const dondeSalio = curated ? (
    <Panel tone="cielo" className={cn("relative flex h-full flex-col overflow-hidden border-2 border-ink", HARD)}>
      <BlockHeader icon={InformationCircleIcon} title="Publicada por Chambarrio" />
      <div className="space-y-2.5 text-[1.02rem] leading-relaxed">
        <p>
          <strong>{company.name}</strong> todavía no publica en Chambarrio. Juntamos esta vacante de información pública
          {curated.sourceLabel ? <> ({curated.sourceLabel.charAt(0).toLowerCase() + curated.sourceLabel.slice(1)})</> : null} para que la
          tengas cerca.
        </p>
        {curated.checkedAt ? (
          <p className="font-semibold">Confirmamos que seguía abierta el {fmtDate(curated.checkedAt, { weekday: false, now: now ?? undefined })}.</p>
        ) : null}
        <p className="text-muted-foreground">Por eso aquí no hay botón de postularte: habla directo con la empresa.</p>
        {originalUrl ? (
          <a
            href={originalUrl}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="inline-flex items-center gap-1.5 font-semibold underline decoration-2 underline-offset-4 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            Ver la vacante original
            <HugeiconsIcon icon={LinkSquare02Icon} className="size-4" strokeWidth={2.2} />
          </a>
        ) : null}
      </div>
      <div className="mt-auto pt-5">
        <div className="rounded-tile border-2 border-ink bg-white/75 p-4">
          <p className="font-display text-[1.15rem] leading-tight font-extrabold">¿Trabajas en {company.name}?</p>
          <p className="mt-1 text-[0.95rem] leading-snug">Reclama la empresa gratis y recibe las postulaciones aquí, con su distancia y colonia.</p>
          <Link href={`/reclamar?empresa=${encodeURIComponent(company.id)}`} className={cn(INK_LINK, "mt-3 w-full")}>
            Reclamar mi empresa
            <HugeiconsIcon icon={ArrowRight01Icon} className="size-5" strokeWidth={2.2} />
          </Link>
        </div>
      </div>
    </Panel>
  ) : null;

  const queSigue = (
    <Panel tone="cielo" className={cn("relative flex h-full flex-col overflow-hidden border-2 border-ink", HARD)}>
      <div className="flex items-start justify-between gap-3">
        <BlockHeader icon={Clock01Icon} title="¿Qué sigue?" />
        <MyMascot mood="saluda" prop="casco" size={72} className="-mt-2 -mr-1 shrink-0" />
      </div>
      <NotAppliedSteps className="-mt-1" />
    </Panel>
  );

  /** Company card. `wide` (alone in its row) lays out horizontally; `fill` grows with art at the bottom. */
  const empresa = (fill: boolean) => (
    <Panel tone={tones[0]} className={cn("flex h-full flex-col overflow-hidden border-2 border-ink", HARD)}>
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
        {[company.kind, company.employees, multi ? `${company.locations.length} sucursales` : job.colonia].filter(Boolean).map((t) => (
          <li key={t} className="inline-flex h-8 items-center rounded-full bg-white/60 px-3">
            {t}
          </li>
        ))}
      </ul>
      {company.about ? <p className="mt-4 text-[1.02rem] leading-relaxed">{company.about}</p> : null}
      {/* Desktop, next to a taller panel: the art takes only the leftover height (never adds any). */}
      {fill ? (
        <div aria-hidden className="relative mt-4 hidden min-h-0 flex-1 lg:block">
          <Scene name="negocio" className="absolute inset-x-0 bottom-0 h-full max-h-60 w-full" />
        </div>
      ) : null}
    </Panel>
  );

  return (
    <div className="pt-5 pb-48 lg:pt-10 lg:pb-0">
      <BackLink />

      {/* Desktop: rows of panels whose heights match (grid rows stretch), so no column ends early. */}
      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-12 lg:gap-6">
        <div className="flex min-w-0 flex-col gap-5 lg:col-span-8">
          {/* ------------------------------------------------ hero: category block + huge moving art */}
          <div className="relative animate-rise">
            <section
              aria-labelledby="vacante-titulo"
              className={cn("relative isolate overflow-hidden rounded-panel border-2 border-ink p-5 pb-0 sm:p-7 sm:pb-0", surface(heroTone), HARD)}
            >
              <span aria-hidden className="pointer-events-none absolute -top-10 -left-10 -z-20 size-48 rounded-full bg-dots text-ink/12" />
              <span aria-hidden className="pointer-events-none absolute -top-2 -right-7 -z-10 size-32 rotate-[8deg] sm:-top-4 sm:-right-4 sm:size-56">
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
                {curated ? (
                  <span className="inline-flex h-7 items-center gap-1.5 rounded-md border-2 border-ink bg-white px-2 text-[0.72rem] font-extrabold tracking-[0.12em] uppercase">
                    <HugeiconsIcon icon={Call02Icon} className="size-3.5" strokeWidth={2.4} />
                    Por teléfono
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
              <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 pr-16 text-[1.02rem] font-medium sm:pr-48">
                <span>
                  {company.name}
                  {multi && branch ? <span className="font-semibold"> · {branch.name}</span> : null}
                </span>
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

          {/* ------------------------------------------------ stat tiles in three pastels (grow to the action block's height) */}
          <div className="grid flex-1 grid-cols-3 gap-2.5 pt-4 sm:gap-3">
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
                  value={
                    // Three tiles share a 390 px row: long words ("Vespertino") step down a size
                    // instead of breaking mid-word.
                    <span
                      className={cn(
                        "block leading-tight break-words hyphens-auto sm:text-[1.7rem]",
                        typeof s.value === "string" && s.value.length > 8 ? "text-[1rem] min-[400px]:text-[1.1rem]" : "text-[1.2rem]",
                      )}
                    >
                      {s.value}
                    </span>
                  }
                  hint={s.hint}
                  className={cn("h-full border-2 border-ink p-3 sm:p-4", HARD_SM)}
                />
              </div>
            ))}
          </div>
        </div>

        {/* ------------------------------------------------ desktop action block (the one saturated block) */}
        <aside className="hidden min-w-0 lg:col-span-4 lg:flex">
          <section
            aria-label={applied ? "Tu postulación" : curated ? "Cómo postularte" : "Postúlate"}
            // overflow-clip, not hidden: a hidden box is still a scroll container, and when applying
            // grows the content, scroll anchoring scrolled it and cut off the top line.
            className={cn("relative isolate flex flex-1 flex-col overflow-clip rounded-panel border-2 border-ink p-6 block-uva", HARD)}
          >
            <span aria-hidden className="pointer-events-none absolute -right-12 -bottom-12 -z-10 size-48 rounded-full bg-dots text-white/10" />
            {applied ? (
              <>
                <p className="text-[0.75rem] font-extrabold tracking-[0.14em] text-limon uppercase">
                  {step === "contratada" ? "¡Felicidades!" : step === "descartada" || step === "retirada" ? "Tu postulación" : "Ya estás en la lista"}
                </p>
                <p className="mt-2 font-display text-[1.6rem] leading-[1.05] font-extrabold tracking-[-0.03em]">
                  {p ? candidateTitle(p, now) : STEP_META.enviada.candidateTitle}
                </p>
                {p ? <MiniTrack p={p} inverse className="mt-4" /> : null}
                {p && step && now ? <AsideStamp p={p} step={step} now={now} /> : null}
                <p className="mt-3 text-primary-foreground/80">{p && step ? asideLine(p, step, now) : "Sigue el avance aquí abajo."}</p>
              </>
            ) : curated ? (
              <>
                <p className="text-[0.75rem] font-extrabold tracking-[0.14em] text-limon uppercase">Llama directo</p>
                <p className="mt-2 font-display text-[1.6rem] leading-[1.05] font-extrabold tracking-[-0.03em]">
                  {hasPhone ? (
                    <>
                      Esta vacante se pide <span className="text-limon">por teléfono</span>
                    </>
                  ) : (
                    <>
                      Esta vacante se pide <span className="text-limon">en su página</span>
                    </>
                  )}
                </p>
                <ul className="mt-4 space-y-1.5 text-[0.95rem] text-primary-foreground/85">
                  {(hasPhone
                    ? [`Llama o manda SMS al ${prettyPhone(phone)}`, "Di que la viste en Chambarrio", "Pregunta si sigue abierta y cuándo ir"]
                    : ["Abre la vacante original", "Sigue sus pasos para postularte", "Guárdala aquí para no perderla"]
                  ).map((t) => (
                    <li key={t} className="flex items-center gap-2">
                      <HugeiconsIcon icon={Tick02Icon} className="size-4 shrink-0 text-limon" strokeWidth={3} />
                      {t}
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <>
                <p className="text-[0.75rem] font-extrabold tracking-[0.14em] text-limon uppercase">¡Ándale, no la dejes ir!</p>
                <p className="mt-2 font-display text-[1.6rem] leading-[1.05] font-extrabold tracking-[-0.03em]">
                  {job.applicants > 0 ? (
                    <>
                      <CountUp value={job.applicants} className="text-limon" />{" "}
                      {job.applicants === 1 ? "persona ya se postuló" : "personas ya se postularon"}
                    </>
                  ) : (
                    <>
                      Sé <span className="text-limon">de los primeros</span> en postularte
                    </>
                  )}
                </p>
                <ul className="mt-4 space-y-1.5 text-[0.95rem] text-primary-foreground/85">
                  {["Un toque, sin currículum", `Te ven en ${company.name} al instante`, "Te avisamos aquí cada paso"].map((t) => (
                    <li key={t} className="flex items-center gap-2">
                      <HugeiconsIcon icon={Tick02Icon} className="size-4 shrink-0 text-limon" strokeWidth={3} />
                      {t}
                    </li>
                  ))}
                </ul>
              </>
            )}
            <div className="mt-auto pt-5">{renderActions(true)}</div>
          </section>
        </aside>

        {alt ? (
          <div className="lg:col-span-12">
            <CloserBranchNudge company={company} alt={alt} savedKm={km - alt.branch.km} />
          </div>
        ) : null}

        {/* ------------------------------------------------ right after applying */}
        {showConfirmation ? (
          <div className="lg:col-span-12">
            <ApplyConfirmation company={company} km={km} tone={successTone} />
          </div>
        ) : null}

        {/* ------------------------------------------------ paused / closed after applying */}
        {job.closed && applied ? (
          <p className={cn("flex items-center gap-2.5 rounded-panel border-2 border-ink px-4 py-3 font-semibold lg:col-span-12", surface("cielo"), HARD_SM)}>
            <HugeiconsIcon icon={Store01Icon} className="size-5 shrink-0" strokeWidth={2.2} />
            Esta vacante ya no recibe postulaciones. Tu proceso sigue aquí.
          </p>
        ) : null}

        {/* ------------------------------------------------ this person's application, state-aware */}
        {p && now ? (
          <div className="min-w-0 lg:col-span-12">
            <StatusBlock
              p={p}
              now={now}
              tone={showConfirmation && statusTone === successTone ? "cielo" : statusTone}
              job={job}
              company={company}
              branch={branch}
              nudge={!showConfirmation}
              title={showConfirmation ? "Así va tu proceso" : undefined}
            />
          </div>
        ) : null}

        {applied ? (
          <>
            <Reveal inView className="min-w-0 lg:col-span-6">
              {queVasAHacer}
            </Reveal>
            <Reveal inView className="min-w-0 lg:col-span-6">
              {quePiden}
            </Reveal>
            <Reveal inView className={cn("min-w-0", multi ? "lg:col-span-5" : "lg:col-span-7")}>
              {comoLlegar}
            </Reveal>
            {multi ? (
              <>
                <Reveal inView className="min-w-0 lg:col-span-7">
                  <BranchesPanel company={company} stops={stops} job={job} />
                </Reveal>
                <Reveal inView className="min-w-0 lg:col-span-12">
                  {empresa(false)}
                </Reveal>
              </>
            ) : (
              <Reveal inView className="min-w-0 lg:col-span-5">
                {empresa(true)}
              </Reveal>
            )}
          </>
        ) : (
          <>
            <Reveal inView className="min-w-0 lg:col-span-7">
              {queVasAHacer}
            </Reveal>
            <Reveal inView className="min-w-0 lg:col-span-5">
              {dondeSalio ?? queSigue}
            </Reveal>
            <Reveal inView className="min-w-0 lg:col-span-6">
              {quePiden}
            </Reveal>
            <Reveal inView className="min-w-0 lg:col-span-6">
              {comoLlegar}
            </Reveal>
            {multi ? (
              <>
                <Reveal inView className="min-w-0 lg:col-span-7">
                  <BranchesPanel company={company} stops={stops} job={job} />
                </Reveal>
                <Reveal inView className="min-w-0 lg:col-span-5">
                  {empresa(true)}
                </Reveal>
              </>
            ) : (
              <Reveal inView className="min-w-0 lg:col-span-12">
                {empresa(false)}
              </Reveal>
            )}
          </>
        )}
      </div>

      {/* Mobile sticky action block above the pill nav */}
      <div className="fixed inset-x-0 bottom-24 z-30 px-3 lg:hidden">
        <div className={cn("mx-auto max-w-xl rounded-[1.75rem] border-2 border-ink p-2.5 block-uva", HARD)}>{renderActions()}</div>
      </div>
    </div>
  );
}

/** White stamp in the desktop action block: the interview time, or when the last step happened. */
function AsideStamp({ p, step, now }: { p: ApplicationPipeline; step: PipelineStep; now: number }) {
  const upcoming = step === "entrevista" && p.interview && interviewState(p, now) !== "past" ? p.interview.at : null;
  const last = p.events.at(-1)?.at ?? p.appliedAt;
  const at = upcoming ?? last;
  const label = upcoming ? "Tu entrevista" : STEP_META[step].candidateLabel;
  return (
    <button
      type="button"
      onClick={scrollToStatus}
      className="press mt-4 block w-full rounded-tile border-2 border-ink bg-white p-3.5 text-left text-ink shadow-[3px_3px_0_0_var(--ink)] outline-none focus-visible:ring-3 focus-visible:ring-limon"
    >
      <span className="block text-[0.7rem] font-extrabold tracking-[0.14em] uppercase opacity-70">
        {label} · {capitalize(relativeDayWord(at, now) ?? fmtDate(at, { now }))}
      </span>
      <span className="block font-display text-[2rem] leading-none font-extrabold tracking-[-0.04em] tabular-nums">{fmtTime(at)}</span>
      <span className="mt-1 block text-[0.88rem] leading-snug font-medium">{fmtDateLong(at, { now, capitalize: true })}</span>
    </button>
  );
}

/** Second line of the "Ya te postulaste" button (the first line already names closed / hired). */
function actionLine(p: ApplicationPipeline, step: PipelineStep, now: number): string {
  if (step === "entrevista" && p.interview && now) {
    return interviewState(p, now) === "past" ? "Ver tu postulación" : `Entrevista: ${fmtDayTime(p.interview.at, { now })}`;
  }
  if (step === "contratada") return "Confirma tu primer día";
  if (step === "descartada") return p.companyMessage?.trim() ? "Ver el mensaje de la empresa" : "Ver detalle";
  if (step === "retirada") return "Ver detalle";
  return `${STEP_META[step].candidateLabel} · Ver avance`;
}

/** One line under the title of the desktop action block once applied. */
function asideLine(p: ApplicationPipeline, step: PipelineStep, now: number): string {
  if (step === "entrevista" && p.interview && now && interviewState(p, now) !== "past") {
    return "Abajo tienes el lugar, qué llevar y cómo avisar si no puedes ir.";
  }
  if (step === "contratada") {
    return p.companyMessage?.trim() ? "Lee el mensaje de la empresa y confirma tu primer día." : "Llama o manda SMS para confirmar tu primer día.";
  }
  if (wasHiredBeforeClose(p)) return UNHIRE_COPY.next;
  return STEP_META[step].typical ?? STEP_META[step].candidateNext;
}

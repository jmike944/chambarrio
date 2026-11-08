"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowDown01Icon,
  ArrowRight01Icon,
  Bookmark01Icon,
  Calendar03Icon,
  CalendarAdd01Icon,
  Location01Icon,
  SentIcon,
  Store01Icon,
} from "@hugeicons/core-free-icons";
import { BLOCK_CLASS, Chip, HeroCard, Panel, PanelHeader, type BlockTone } from "@/components/chamba/primitives";
import { CountUp, Sticker } from "@/components/chamba/motion";
import { CategoryArt, CategoryIcon } from "@/components/chamba/job-icons";
import { Scene } from "@/components/chamba/art/scenes";
import { MyMascot, MyScene } from "@/components/chamba/art/my-mascot";
import { Doodle } from "@/components/chamba/art/doodles";
import { JobRow } from "@/components/chamba/job-row";
import { Button } from "@/components/ui/button";
import { useApp } from "@/lib/store";
import { useCatalog, useJob } from "@/lib/data/catalog";
import type { ApplicationPipeline } from "@/lib/data/types";
import { distanceKm, formatKm } from "@/lib/geo";
import { formatPay } from "@/lib/format";
import {
  STEP_META,
  defaultInterviewPlace,
  downloadIcs,
  fmtDate,
  fmtDayTime,
  fmtTime,
  interviewIcsFor,
  stepOf,
  useMyPipelines,
  useNow,
  type PipelineStep,
} from "@/lib/pipeline";
import { cn } from "@/lib/utils";
import { HARD, HARD_SM, HazardTape, Rivets, STENCIL } from "./rugged";
import { CatalogErrorPanel, InkSkeleton, LoadingNote, RowSkeletons } from "../vacantes/_seeker/states";
import { ago, byAttention, interviewState, listTones, type CSSVars } from "./_pipeline/model";
import { MiniTrack, PipelineStatus, STEP_MOOD, StepChip } from "./_pipeline/status";
import { useSimilarJobs } from "./_pipeline/similar";

/** Stat tiles — three bold pastels (no pink). */
const STAT_TONES = ["sol", "cielo", "menta"] as const satisfies readonly BlockTone[];

type Filter = "todas" | "proceso" | "entrevistas" | "terminadas";
const FILTERS: { id: Filter; label: string; match: (s: PipelineStep) => boolean }[] = [
  { id: "todas", label: "Todas", match: () => true },
  { id: "proceso", label: "En proceso", match: (s) => s === "enviada" || s === "vista" || s === "entrevista" },
  { id: "entrevistas", label: "Entrevistas", match: (s) => s === "entrevista" },
  { id: "terminadas", label: "Terminadas", match: (s) => s === "contratada" || s === "descartada" || s === "retirada" },
];
/** Show the filter chips from this many applications on. */
const FILTER_FROM = 5;

const cardId = (jobId: string) => `postulacion-${jobId}`;

export function ApplicationsList() {
  const mine = useMyPipelines();
  const saved = useApp((s) => s.saved);
  const catalog = useCatalog();
  const live = catalog.source === "live";
  const now = useNow();
  const [filter, setFilter] = useState<Filter>("todas");
  /** Cards the person opened/closed (by jobId); the top card starts open when it needs attention. */
  const [toggled, setToggled] = useState<Record<string, boolean>>({});

  // Demo: only applications whose vacancy exists. Live: every application; a vacancy that closed
  // shows as "Vacante cerrada" but keeps its timeline.
  const list = useMemo(() => {
    const rows = live ? mine.data : mine.data.filter((p) => catalog.jobById[p.jobId]);
    return now ? rows.toSorted(byAttention(now)) : rows;
  }, [live, mine.data, catalog.jobById, now]);

  if (mine.loading || !now || (live && catalog.status === "loading")) return <ApplicationsSkeleton />;
  if (live && catalog.status === "error" && list.length === 0) {
    return <CatalogErrorPanel error={catalog.error} title="No pudimos cargar tus postulaciones" className="mx-auto max-w-xl" />;
  }

  const steps = list.map((p) => stepOf(p));
  const hero = list[0] ?? null;
  const autoOpen = hero && ["entrevista", "contratada", "vista"].includes(stepOf(hero)) ? hero.jobId : null;
  const isOpen = (jobId: string) => toggled[jobId] ?? jobId === autoOpen;
  const active = steps.filter((s) => s === "enviada" || s === "vista" || s === "entrevista").length;
  // Same count as the "Entrevistas" filter chip (an interview that already happened still waits for an answer).
  const interviews = steps.filter((s) => s === "entrevista").length;
  const visible = list.filter((_, i) => FILTERS.find((f) => f.id === filter)!.match(steps[i]));
  const tones = listTones(visible.map(stepOf));

  function openCard(jobId: string) {
    setToggled((t) => ({ ...t, [jobId]: true }));
    setFilter("todas");
    requestAnimationFrame(() => document.getElementById(cardId(jobId))?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 lg:gap-6">
      <div className="flex min-w-0 lg:col-span-7 lg:row-span-2">
        {hero ? <AttentionHero p={hero} now={now} onDetails={() => openCard(hero.jobId)} /> : <EmptyHero />}
      </div>

      <div className="grid grid-cols-3 gap-2.5 sm:gap-3 lg:col-span-5">
        <MiniStat tone={STAT_TONES[0]} icon={SentIcon} label="En proceso" value={active} index={1} />
        <MiniStat tone={STAT_TONES[1]} icon={Calendar03Icon} label={interviews === 1 ? "Entrevista" : "Entrevistas"} value={interviews} index={2} />
        <MiniStat tone={STAT_TONES[2]} icon={Bookmark01Icon} label="Guardadas" value={saved.length} index={3} />
      </div>

      {/* The list (full width on desktop, so expanding a card never unbalances two columns). */}
      <section aria-labelledby="mis-postulaciones" className="min-w-0 lg:col-span-12 lg:row-start-3">
        {list.length ? (
          <>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 id="mis-postulaciones" className="flex items-center gap-2.5 font-display text-[1.45rem] font-extrabold tracking-[-0.03em]">
                Tus postulaciones
                <span className="grid h-7 min-w-7 -rotate-6 place-items-center rounded-md border-2 border-ink bg-block-sol px-2 font-sans text-[0.85rem] font-bold text-ink tabular-nums">
                  {list.length}
                </span>
              </h2>
              {mine.refreshing ? <span className="text-sm font-medium text-muted-foreground">Actualizando…</span> : null}
            </div>
            {list.length >= FILTER_FROM ? (
              <div role="group" aria-label="Filtrar postulaciones" className="no-scrollbar -mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:px-0">
                {FILTERS.map((f) => (
                  <Chip key={f.id} active={filter === f.id} count={steps.filter(f.match).length} onClick={() => setFilter(f.id)}>
                    {f.label}
                  </Chip>
                ))}
              </div>
            ) : null}
            {visible.length ? (
              <ul className="space-y-4">
                {visible.map((p, i) => (
                  <li key={p.jobId} className="animate-rise" style={{ "--i": Math.min(i + 3, 8) } as CSSVars}>
                    <ApplicationCard
                      p={p}
                      now={now}
                      tone={tones[i]}
                      open={isOpen(p.jobId)}
                      onToggle={() => setToggled((t) => ({ ...t, [p.jobId]: !isOpen(p.jobId) }))}
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <p className={cn("rounded-panel p-5 text-center font-semibold", BLOCK_CLASS.cielo, HARD)}>Nada por aquí con ese filtro.</p>
            )}
          </>
        ) : (
          <StartHere />
        )}
      </section>

      <div className="flex min-w-0 flex-col gap-5 lg:col-span-5 lg:col-start-8 lg:row-start-2">
        <Panel tone="lila" className={cn("flex-1 animate-rise overflow-hidden", HARD)} style={{ "--i": 4 } as CSSVars}>
          <PanelHeader icon={Bookmark01Icon} title="Guardadas" count={saved.length} />
          {saved.length === 0 ? (
            <div className="flex items-center gap-4 py-2">
              <MyMascot mood="duerme" size={72} />
              <p className="text-[0.98rem] leading-snug text-muted-foreground">
                Guarda vacantes con el <HugeiconsIcon icon={Bookmark01Icon} className="inline size-4 align-[-2px]" /> para verlas después.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {saved.map((id) => (
                <SavedRow key={id} id={id} live={live} />
              ))}
            </ul>
          )}
        </Panel>

        <Link
          href="/vacantes"
          className={cn(
            "group lift press relative isolate flex min-h-40 animate-rise flex-col justify-between overflow-hidden rounded-panel p-5 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:p-6",
            HARD,
            BLOCK_CLASS.durazno,
          )}
          style={{ "--i": 5 } as CSSVars}
        >
          <Doodle name="rayo" color="#FFD23F" className="absolute top-6 right-[38%] -z-10 size-7 rotate-12" />
          <HazardTape className="absolute inset-x-0 top-0 -z-10 h-3 border-t-0" />
          <div className="mt-2 max-w-[58%]">
            <p className="text-[0.72rem] font-semibold tracking-[0.14em] uppercase opacity-75">¡Ándale!</p>
            <p className="mt-1 font-display text-[1.5rem] leading-[1.02] font-extrabold tracking-[-0.03em]">Hay más chamba a la vuelta</p>
          </div>
          <span className="mt-4 inline-flex h-11 w-fit items-center gap-1.5 rounded-full bg-ink px-4 text-[0.95rem] font-semibold text-white transition-transform group-hover:translate-x-1">
            Ver vacantes cerca
            <HugeiconsIcon icon={ArrowRight01Icon} className="size-4.5" strokeWidth={2.2} />
          </span>
          <Scene name="radar" className="pointer-events-none absolute -right-6 -bottom-6 -z-10 w-40 rotate-6 sm:w-48" />
        </Link>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ hero: what needs attention */

function AttentionHero({ p, now, onDetails }: { p: ApplicationPipeline; now: number; onDetails: () => void }) {
  const home = useApp((s) => s.home);
  const { job, company, branch, label } = useJob(p.jobId);
  const step = stepOf(p);
  const ist = interviewState(p, now);
  const upcoming = ist === "upcoming" || ist === "today";
  const companyName = company?.name ?? "La empresa";

  const copy = (() => {
    if (step === "entrevista" && upcoming && p.interview)
      return {
        eyebrow: ist === "today" ? "Hoy es tu entrevista" : "Tu próxima entrevista",
        title: fmtDayTime(p.interview.at, { now, capitalize: true }),
        body: null as string | null,
      };
    if (step === "entrevista") return { eyebrow: "Tu entrevista ya pasó", title: `¿Cómo te fue en ${companyName}?`, body: STEP_META.entrevista.typical };
    if (step === "contratada")
      return { eyebrow: "¡Lo lograste!", title: "¡Te contrataron!", body: p.companyMessage?.trim() || STEP_META.contratada.candidateNext };
    if (step === "vista") return { eyebrow: "Buenas noticias", title: `${companyName} vio tu postulación`, body: STEP_META.vista.candidateNext };
    if (step === "enviada") return { eyebrow: "Vas bien", title: "Tu postulación va en camino", body: STEP_META.enviada.candidateNext };
    return { eyebrow: "Sigue buscando", title: "Hay más chamba cerca de ti", body: STEP_META[step].candidateNext };
  })();

  const place = p.interview ? (p.interview.place ?? (branch ? defaultInterviewPlace(branch, company?.name) : null)) : null;
  const closedOnly = step === "descartada" || step === "retirada";

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
    <HeroCard
      eyebrow={copy.eyebrow}
      title={copy.title}
      className={cn(
        "flex w-full flex-col animate-rise overflow-visible border-[2.5px] border-ink shadow-[6px_6px_0_0_var(--ink)]! dark:shadow-[6px_6px_0_0_rgb(255_255_255/0.16)]!",
      )}
      sticker={
        upcoming && p.interview ? (
          <Sticker variant="lime" dot rotate={12}>
            <strong>{fmtTime(p.interview.at, { h24: true })}</strong>
            {fmtDate(p.interview.at, { now })}
          </Sticker>
        ) : step === "contratada" ? (
          <Sticker variant="lime" dot rotate={12}>
            <strong>¡Sí!</strong>Chamba
          </Sticker>
        ) : null
      }
    >
      <span aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-[inherit]">
        <Doodle name="rayo" color="var(--limon)" className="absolute top-[38%] right-5 size-6 rotate-12" />
        <Doodle name="zigzag" color="#FFD23F" className="absolute bottom-28 left-[46%] size-7" />
        <HazardTape className="absolute inset-x-0 bottom-0 h-3 border-b-0" />
      </span>
      <Rivets className="text-white" />

      <Link
        href={`/vacantes/${p.jobId}`}
        className="group press mt-4 flex items-center gap-3 rounded-tile bg-white/12 p-3 outline-none transition-colors hover:bg-white/20 focus-visible:ring-3 focus-visible:ring-limon"
      >
        {job ? (
          <CategoryIcon category={job.category} size="md" />
        ) : (
          <span aria-hidden className="grid size-12 shrink-0 place-items-center rounded-tile border-2 border-dashed border-white/40">
            <HugeiconsIcon icon={Store01Icon} className="size-5" strokeWidth={2} />
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[1.08rem] leading-snug font-semibold">{job?.title ?? "Vacante cerrada"}</span>
          <span className="line-clamp-2 text-[0.93rem] leading-snug text-primary-foreground/80">
            {job ? `${label} · ${formatKm(distanceKm(home, job.location))}` : "Ya no recibe postulaciones"}
          </span>
        </span>
        <HugeiconsIcon icon={ArrowRight01Icon} className="size-5 shrink-0 transition-transform group-hover:translate-x-1" strokeWidth={2} />
      </Link>

      {upcoming && place ? (
        <p className="mt-3 flex items-start gap-2 text-[0.98rem] leading-snug text-primary-foreground/90">
          <HugeiconsIcon icon={Location01Icon} className="mt-0.5 size-[1.1rem] shrink-0 text-limon" strokeWidth={2.2} />
          {place}
        </p>
      ) : null}
      {upcoming && p.interview?.note ? (
        <p className="mt-2 rounded-tile bg-white/10 px-3 py-2 text-[0.95rem] leading-snug text-primary-foreground/90">“{p.interview.note}”</p>
      ) : copy.body ? (
        <p className="mt-3 text-[0.98rem] leading-snug text-primary-foreground/85">{copy.body}</p>
      ) : null}

      <div className="relative mt-4 flex items-end gap-3">
        <div className="min-w-0 flex-1">
          <p className="mb-2 text-[0.72rem] font-semibold tracking-[0.14em] uppercase">
            <span className="text-limon">{STEP_META[step].candidateLabel}</span>
            <span className="text-primary-foreground/75"> · {ago(p.events.at(-1)?.at ?? p.appliedAt, now)}</span>
          </p>
          <MiniTrack p={p} inverse />
        </div>
        <MyMascot mood={STEP_MOOD[step]} prop={step === "contratada" ? "trofeo" : "casco"} size={88} className="-mr-2 -mb-1 shrink-0 sm:-mr-3" />
      </div>

      <div className="mt-auto grid gap-2.5 pt-5 sm:grid-cols-2">
        {closedOnly ? (
          <Button variant="lime" size="xl" className="w-full sm:col-span-2" asChild>
            <Link href="/vacantes">Ver vacantes cerca</Link>
          </Button>
        ) : upcoming && p.interview ? (
          <>
            <Button variant="lime" size="xl" className="w-full" onClick={addToCalendar}>
              <HugeiconsIcon icon={CalendarAdd01Icon} className="size-5" strokeWidth={2.2} />
              A mi calendario
            </Button>
            <Button size="xl" className="w-full border-2 border-white/70 bg-transparent text-white hover:bg-white/10" onClick={onDetails}>
              Qué llevar y más
              <HugeiconsIcon icon={ArrowDown01Icon} className="size-5" strokeWidth={2.2} />
            </Button>
          </>
        ) : (
          <Button variant="lime" size="xl" className="w-full sm:col-span-2" onClick={onDetails}>
            Ver el detalle
            <HugeiconsIcon icon={ArrowDown01Icon} className="size-5" strokeWidth={2.2} />
          </Button>
        )}
      </div>
    </HeroCard>
  );
}

function EmptyHero() {
  return (
    <HeroCard eyebrow="Tus postulaciones" title="Aún no te postulas a ninguna" className="flex w-full flex-col animate-rise">
      <div className="mt-2 flex items-center gap-4">
        <p className="min-w-0 flex-1 text-[1rem] leading-snug text-primary-foreground/85">
          Un toque y listo, sin currículum. Aquí vas a ver cuándo la empresa vea tu postulación, tu entrevista y su respuesta.
        </p>
        <MyScene name="busqueda" className="w-32 shrink-0 sm:w-40" />
      </div>
      <Button variant="lime" size="xl" className="mt-auto w-full" asChild>
        <Link href="/vacantes">Ve las que están cerca de ti</Link>
      </Button>
    </HeroCard>
  );
}

/** Empty list: a few vacancies near home to start with. */
function StartHere() {
  const jobs = useSimilarJobs(null, null, 4);
  const radiusKm = useApp((s) => s.radiusKm);
  return (
    <Panel tone="cielo" className={cn("animate-rise", HARD)}>
      <PanelHeader icon={Location01Icon} title="Para empezar, estas quedan cerca" />
      {jobs.length ? (
        <ul className="grid gap-x-6 lg:grid-cols-2">
          {jobs.map((j) => (
            <li key={j.id}>
              <JobRow job={j} km={j.km} radiusKm={radiusKm} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground">Busca en el mapa o amplía tu radio para ver más vacantes.</p>
      )}
    </Panel>
  );
}

/* ------------------------------------------------------------------ list card */

/** One-liner under the title: the interview day, or when the last step happened. */
function summaryLine(p: ApplicationPipeline, step: PipelineStep, now: number): string {
  const ist = interviewState(p, now);
  if (step === "entrevista" && p.interview && ist !== "past") return `Entrevista ${fmtDayTime(p.interview.at, { now })}`;
  if (step === "entrevista") return "Ya fue tu entrevista · esperando respuesta";
  const last = p.events.at(-1)?.at ?? p.appliedAt;
  const when = ago(last, now);
  switch (step) {
    case "enviada":
      return `Te postulaste ${when}`;
    case "vista":
      return `La vieron ${when}`;
    case "contratada":
      return `Te contrataron ${when}`;
    case "descartada":
      return `Se cerró ${when}`;
    default:
      return `La retiraste ${when}`;
  }
}

function ApplicationCard({
  p,
  now,
  tone,
  open,
  onToggle,
}: {
  p: ApplicationPipeline;
  now: number;
  tone: BlockTone;
  open: boolean;
  onToggle: () => void;
}) {
  const home = useApp((s) => s.home);
  const { status, job, company, branch, label } = useJob(p.jobId);
  const step = stepOf(p);
  const bodyId = `${cardId(p.jobId)}-detalle`;
  const loadingJob = !job && status !== "ready";
  const closedLook = step === "descartada" || step === "retirada";

  return (
    <article
      id={cardId(p.jobId)}
      aria-label={job?.title ?? "Vacante cerrada"}
      className={cn("relative isolate scroll-mt-6 rounded-panel", BLOCK_CLASS[tone], HARD)}
    >
      {job ? (
        <CategoryArt
          category={job.category}
          className={cn(
            // Bleeds off the top edge on purpose (sticker), but stays clear of the expand button.
            "pointer-events-none absolute -top-3 right-[4.5rem] -z-10 size-16 rotate-12 sm:right-[5.25rem] sm:size-20",
            closedLook && "opacity-50 grayscale",
          )}
        />
      ) : null}
      <button
        type="button"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={onToggle}
        className="group flex w-full items-start gap-3 rounded-panel p-4 text-left outline-none focus-visible:ring-3 focus-visible:ring-ink/40 sm:gap-4 sm:p-5"
      >
        {job ? (
          <CategoryIcon category={job.category} size="md" className={cn("shrink-0", HARD_SM)} />
        ) : (
          <span aria-hidden className="grid size-12 shrink-0 place-items-center rounded-tile border-2 border-dashed border-ink/40 bg-white/50">
            <HugeiconsIcon icon={Store01Icon} className="size-5" strokeWidth={2} />
          </span>
        )}
        <span className="min-w-0 flex-1 pr-1">
          <span className="block pr-16 text-[1.12rem] leading-snug font-semibold sm:pr-20">
            {loadingJob ? <InkSkeleton className="inline-block h-5 w-40" /> : (job?.title ?? "Vacante cerrada")}
          </span>
          <span className="block truncate text-[0.93rem] text-muted-foreground">
            {job ? (
              <>
                <span className="font-semibold text-foreground tabular-nums">{formatPay(job)}</span> · {label} ·{" "}
                {job.closed ? "Ya no recibe postulaciones" : formatKm(distanceKm(home, job.location))}
              </>
            ) : loadingJob ? (
              "Cargando la vacante…"
            ) : (
              "Ya no recibe postulaciones"
            )}
          </span>
          <span className="mt-2.5 flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
            <StepChip p={p} />
            <span className="text-[0.9rem] leading-snug font-medium">{summaryLine(p, step, now)}</span>
            {p.pending ? <span className="text-[0.85rem] text-muted-foreground">Guardando…</span> : null}
          </span>
          <MiniTrack p={p} className="mt-3 max-w-[16rem]" />
        </span>
        <span
          aria-hidden
          className={cn(
            "grid size-11 shrink-0 place-items-center rounded-full border-2 border-ink bg-white text-ink transition-transform duration-300 group-hover:scale-105",
            open && "rotate-180 bg-ink text-white",
          )}
        >
          <HugeiconsIcon icon={ArrowDown01Icon} className="size-5" strokeWidth={2.4} />
        </span>
        <span className="sr-only">{open ? "Ocultar detalle" : "Ver detalle"}</span>
      </button>

      {open ? (
        <div id={bodyId} className="animate-rise border-t-2 border-ink/15 px-4 pt-4 pb-4 [--rise:8px] sm:px-5 sm:pb-5">
          <PipelineStatus p={p} now={now} job={job} company={company} branch={branch} />
          {job ? (
            <Link
              href={`/vacantes/${p.jobId}`}
              className="press mt-3 inline-flex min-h-11 items-center gap-1.5 font-semibold underline decoration-2 underline-offset-4 outline-none focus-visible:ring-3 focus-visible:ring-ink/30"
            >
              Ver la vacante
              <HugeiconsIcon icon={ArrowRight01Icon} className="size-4" strokeWidth={2.4} />
            </Link>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

/* ------------------------------------------------------------------ saved */

function SavedRow({ id, live }: { id: string; live: boolean }) {
  const home = useApp((s) => s.home);
  const radiusKm = useApp((s) => s.radiusKm);
  const toggleSaved = useApp((s) => s.toggleSaved);
  const { status, job } = useJob(id);
  if (job) {
    return (
      <li>
        <JobRow job={job} km={distanceKm(home, job.location)} radiusKm={radiusKm} />
      </li>
    );
  }
  if (!live) return null;
  if (status !== "ready") {
    return (
      <li>
        <RowSkeletons count={1} />
      </li>
    );
  }
  return (
    <li className="flex items-center gap-3 py-2.5">
      <span className="grid size-12 shrink-0 place-items-center rounded-2xl border-2 border-dashed border-ink/35 bg-hatch" aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">Esta vacante ya cerró</span>
        <span className="block text-sm text-muted-foreground">Ya no recibe postulaciones.</span>
      </span>
      <Button
        variant="white"
        size="lg"
        className="shrink-0 border-2 border-ink px-4 text-ink"
        onClick={async () => {
          const r = await toggleSaved(id);
          if (!r.error) toast("Quitada de tus guardadas");
        }}
      >
        Quitar
      </Button>
    </li>
  );
}

/* ------------------------------------------------------------------ skeleton */

/** Before the store / live answer land: same layout, placeholders only. */
function ApplicationsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 lg:gap-6">
      <div className="flex min-w-0 lg:col-span-7 lg:row-span-2">
        <HeroCard eyebrow="Tus postulaciones" title="Cargando tus postulaciones…" className="w-full animate-rise">
          <LoadingNote>Cargando tus postulaciones…</LoadingNote>
          <InkSkeleton className="mt-4 h-16 w-full rounded-tile bg-white/15!" />
          <InkSkeleton className="mt-4 h-4 w-2/3 bg-white/20!" />
          <InkSkeleton className="mt-5 h-20 w-full bg-white/15!" />
          <InkSkeleton className="mt-5 h-14 w-full rounded-full bg-white/20!" />
        </HeroCard>
      </div>
      <div aria-hidden className="grid grid-cols-3 gap-2.5 sm:gap-3 lg:col-span-5">
        {STAT_TONES.map((t) => (
          <div key={t} className={cn("h-[7.6rem] rounded-tile p-3.5 sm:p-4", BLOCK_CLASS[t], HARD_SM)}>
            <InkSkeleton className="size-8 rounded-lg" />
            <InkSkeleton className="mt-2 h-9 w-10" />
            <InkSkeleton className="mt-1.5 h-3.5 w-14" />
          </div>
        ))}
      </div>
      <div className="min-w-0 lg:col-span-5 lg:col-start-8 lg:row-start-2">
        <Panel tone="lila" className={cn("h-full overflow-hidden", HARD)}>
          <PanelHeader icon={Bookmark01Icon} title="Guardadas" />
          <RowSkeletons count={2} />
        </Panel>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ stat tile */

function MiniStat({ tone, icon, label, value, index }: { tone: BlockTone; icon: typeof SentIcon; label: string; value: number; index: number }) {
  return (
    <div className={cn("relative min-w-0 animate-pop-in rounded-tile p-3.5 sm:p-4", BLOCK_CLASS[tone], HARD_SM)} style={{ "--i": index } as CSSVars}>
      <span className="grid size-8 place-items-center rounded-lg bg-ink text-white">
        <HugeiconsIcon icon={icon} className="size-4" strokeWidth={2.2} />
      </span>
      <p className={cn("mt-2 text-[2.3rem] leading-none", STENCIL)}>
        <CountUp value={value} from={0} />
      </p>
      <p className="mt-1 text-[0.82rem] leading-tight font-medium text-muted-foreground">{label}</p>
    </div>
  );
}


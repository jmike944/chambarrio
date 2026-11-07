"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowRight01Icon,
  Bookmark01Icon,
  Calendar03Icon,
  SentIcon,
  Tick02Icon,
  ViewIcon,
} from "@hugeicons/core-free-icons";
import { BLOCK_CLASS, HeroCard, Panel, PanelHeader, rotateTone, type BlockTone } from "@/components/chamba/primitives";
import { CountUp, StageBars, Sticker, useConfetti } from "@/components/chamba/motion";
import { CATEGORY_BLOCK, CategoryArt, CategoryIcon } from "@/components/chamba/job-icons";
import { Mascot, type MascotMood } from "@/components/chamba/art/mascot";
import { Scene } from "@/components/chamba/art/scenes";
import { Doodle } from "@/components/chamba/art/doodles";
import { JobRow, companyLabel } from "@/components/chamba/job-row";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useApp } from "@/lib/store";
import { useCatalog, useJob } from "@/lib/data/catalog";
import { useSessionLoaded } from "@/lib/live/session";
import type { Application, ApplicationStatus, CategoryId, Job } from "@/lib/data/types";
import { distanceKm, formatKm } from "@/lib/geo";
import { formatMinutesAgo, formatPay } from "@/lib/format";
import { cn } from "@/lib/utils";
import { HARD, HARD_SM, HazardTape, Rivets, STENCIL } from "./rugged";
import { CatalogErrorPanel, InkSkeleton, LoadingNote, RowSkeletons } from "../vacantes/_seeker/states";

type CSSVars = React.CSSProperties & Record<`--${string}`, string | number>;

const STEPS: { id: ApplicationStatus; label: string; short: string }[] = [
  { id: "enviada", label: "Enviada", short: "Enviada" },
  { id: "vista", label: "La empresa la vio", short: "Te vieron" },
  { id: "entrevista", label: "Entrevista", short: "Entrevista" },
  { id: "contratada", label: "Contratada", short: "¡Contratada!" },
];

const STATUS: Record<ApplicationStatus, { label: string; color: string; hint: string }> = {
  enviada: { label: "Enviada", color: "var(--uva-ink)", hint: "La empresa suele responder en 1 o 2 días." },
  vista: { label: "La empresa la vio", color: "var(--cielo)", hint: "Ten tu teléfono a la mano: pueden llamarte." },
  entrevista: { label: "Entrevista", color: "var(--nopal)", hint: "Te esperan el jueves a las 10:00. Lleva tu INE y comprobante de domicilio." },
  contratada: { label: "Contratada", color: "var(--nopal)", hint: "¡Felicidades! Acuerda tu primer día con la empresa." },
  cerrada: { label: "Vacante cerrada", color: "var(--rosa)", hint: "Esta vacante ya se ocupó. Hay más cerca de ti." },
};

/** Hero copy per status — the most advanced application gets the violet block. */
const HERO: Record<ApplicationStatus, { eyebrow: string; title: string; mood: MascotMood; sticker: React.ReactNode }> = {
  contratada: { eyebrow: "¡Lo lograste!", title: "¡Te contrataron!", mood: "festeja", sticker: <><strong>¡Sí!</strong>Chamba</> },
  entrevista: { eyebrow: "Tu siguiente paso", title: "¡Tienes entrevista!", mood: "saluda", sticker: <><strong>Jue</strong>10:00</> },
  vista: { eyebrow: "Buenas noticias", title: "¡Ya te vieron!", mood: "saluda", sticker: <><strong>¡Ojo!</strong>Te vieron</> },
  enviada: { eyebrow: "Vas bien", title: "¡Postulación enviada!", mood: "piensa", sticker: <><strong>1–2</strong>días</> },
  cerrada: { eyebrow: "Sigue buscando", title: "Esta ya se ocupó", mood: "piensa", sticker: <><strong>+</strong>cerca</> },
};

/** Live: there's no interview scheduling yet, so no made-up day/time. */
const LIVE_HINT: Partial<Record<ApplicationStatus, string>> = {
  entrevista: "La empresa te contacta por WhatsApp para acordar el día y la hora.",
  cerrada: "Esta postulación ya no sigue. Hay más chamba cerca de ti.",
};
const LIVE_STICKER: Partial<Record<ApplicationStatus, React.ReactNode>> = {
  entrevista: <><strong>¡Ya!</strong>Entrevista</>,
};
const hintFor = (status: ApplicationStatus, live: boolean) => (live ? LIVE_HINT[status] : undefined) ?? STATUS[status].hint;

const RANK: Record<ApplicationStatus, number> = { contratada: 4, entrevista: 3, vista: 2, enviada: 1, cerrada: 0 };

/** Stat tiles — three bold pastels (no pink). */
const STAT_TONES = ["sol", "cielo", "menta"] as const satisfies readonly BlockTone[];

/**
 * Category tint per card, nudged so neighbours never repeat a tone: the first card avoids the
 * stat tile right above it, the last card avoids the lila "Guardadas" panel below it.
 */
function pickTones(categories: (CategoryId | undefined)[]): BlockTone[] {
  const out: BlockTone[] = [];
  categories.forEach((category, i) => {
    const avoid = new Set<BlockTone>([out[i - 1], ...(i === 0 ? STAT_TONES : []), i === categories.length - 1 ? "lila" : undefined].filter(Boolean) as BlockTone[]);
    let tone: BlockTone = category ? CATEGORY_BLOCK[category] : "cielo";
    let k = i;
    while (avoid.has(tone)) tone = rotateTone(++k);
    out.push(tone);
  });
  return out;
}

export function ApplicationsList() {
  const allApplications = useApp((s) => s.applications);
  const saved = useApp((s) => s.saved);
  const catalog = useCatalog();
  const live = catalog.source === "live";
  const sessionLoaded = useSessionLoaded();

  // Demo: only applications whose vacancy exists (as always). Live: every application; a vacancy
  // that closed (or isn't visible anymore) shows as "Vacante cerrada" instead of disappearing.
  const applications = live ? allApplications : allApplications.filter((a) => catalog.jobById[a.jobId]);
  const hero = applications.reduce<Application | null>((best, a) => (!best || RANK[a.status] > RANK[best.status] ? a : best), null);
  const rest = applications.filter((a) => a !== hero);
  const tones = pickTones(rest.map((a) => catalog.jobById[a.jobId]?.category));
  const seen = allApplications.filter((a) => RANK[a.status] >= 2).length;

  // Live: the user's applications arrive with loadSession(); the vacancies with the catalog.
  if (live && (catalog.status === "loading" || !sessionLoaded)) return <ApplicationsSkeleton />;
  if (live && catalog.status === "error") return <CatalogErrorPanel error={catalog.error} title="No pudimos cargar tus postulaciones" className="mx-auto max-w-xl" />;

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 lg:gap-6">
      <div className="grid min-w-0 grid-cols-1 content-start gap-5 lg:col-span-7">
        {hero ? <HeroSlot app={hero} live={live} /> : <EmptyHero />}

        <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
          <MiniStat tone={STAT_TONES[0]} icon={SentIcon} label="Enviadas" value={applications.length} index={1} />
          <MiniStat tone={STAT_TONES[1]} icon={ViewIcon} label="Te vieron" value={seen} index={2} />
          <MiniStat tone={STAT_TONES[2]} icon={Bookmark01Icon} label="Guardadas" value={saved.length} index={3} />
        </div>

        {rest.length > 0 ? (
          <section aria-labelledby="en-camino">
            <h2 id="en-camino" className="mb-3 flex items-center gap-2.5 font-display text-[1.45rem] font-extrabold tracking-[-0.03em]">
              También en camino
              <span className="grid h-7 min-w-7 -rotate-6 place-items-center rounded-md border-2 border-ink bg-[#FFD23F] px-2 font-sans text-[0.85rem] font-bold text-ink tabular-nums">
                {rest.length}
              </span>
            </h2>
            <ul className="pt-3">
              {rest.map((a, i) => (
                <li
                  key={a.jobId}
                  className={cn("relative animate-rise", i > 0 && "-mt-3")}
                  style={{ "--i": Math.min(i + 3, 8), zIndex: i + 1 } as CSSVars}
                >
                  <CardSlot app={a} tone={tones[i]} live={live} />
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>

      <div className="grid min-w-0 grid-cols-1 content-start gap-5 lg:col-span-5">
        <Panel tone="lila" className={cn("overflow-hidden animate-rise", HARD)} style={{ "--i": 4 } as CSSVars}>
          <PanelHeader icon={Bookmark01Icon} title="Guardadas" count={saved.length} />
          {saved.length === 0 ? (
            <div className="flex items-center gap-4 py-2">
              <Mascot mood="duerme" size={72} />
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
          href="/inicio"
          className={cn(
            "group lift press relative isolate flex min-h-44 flex-col justify-between overflow-hidden rounded-panel p-5 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:p-6",
            "animate-rise",
            HARD,
            BLOCK_CLASS.durazno,
          )}
          style={{ "--i": 5 } as CSSVars}
        >
          <Doodle name="rayo" color="#FFD23F" className="absolute top-6 right-[38%] -z-10 size-7 rotate-12" />
          <HazardTape className="absolute inset-x-0 top-0 -z-10 h-3 border-t-0" />
          <div className="mt-2 max-w-[58%]">
            <p className="text-[0.72rem] font-semibold tracking-[0.14em] uppercase opacity-75">¡Ándale!</p>
            <p className="mt-1 font-display text-[1.6rem] leading-[1.02] font-extrabold tracking-[-0.03em]">
              Hay más chamba a la vuelta
            </p>
          </div>
          <span className="mt-4 inline-flex h-11 w-fit items-center gap-1.5 rounded-full bg-ink px-4 text-[0.95rem] font-semibold text-white transition-transform group-hover:translate-x-1">
            Ver vacantes cerca
            <HugeiconsIcon icon={ArrowRight01Icon} className="size-4.5" strokeWidth={2.2} />
          </span>
          <Scene name="radar" className="pointer-events-none absolute -right-6 -bottom-6 -z-10 w-44 rotate-6 sm:w-52" />
        </Link>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ catalog slots */

/** Hero for the most advanced application; resolves its vacancy (live fetches it if it's far away). */
function HeroSlot({ app, live }: { app: Application; live: boolean }) {
  const home = useApp((s) => s.home);
  const { status, job } = useJob(app.jobId);
  if (job) return <ApplicationHero app={app} job={job} km={distanceKm(home, job.location)} live={live} />;
  // "error" here is only a failed single-vacancy fetch (page-level errors are handled above): don't call it closed.
  if (status !== "ready") return <HeroSkeleton />;
  return <ClosedHero app={app} />;
}

function CardSlot({ app, tone, live }: { app: Application; tone: BlockTone; live: boolean }) {
  const home = useApp((s) => s.home);
  const { status, job } = useJob(app.jobId);
  if (job) return <ApplicationCard app={app} job={job} tone={tone} km={distanceKm(home, job.location)} live={live} />;
  if (status !== "ready") return <CardSkeleton tone={tone} />;
  return <ClosedCard app={app} tone={tone} />;
}

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

/** Live: the vacancy closed (or was paused) after the user applied. */
function ClosedCard({ app, tone }: { app: Application; tone: BlockTone }) {
  return (
    <div className={cn("relative block rounded-panel p-5", BLOCK_CLASS[tone], HARD)}>
      <div className="flex items-start gap-3">
        <span aria-hidden className="mt-0.5 grid size-10 shrink-0 place-items-center rounded-xl border-2 border-dashed border-ink/40 bg-white/50" />
        <div className="min-w-0 flex-1">
          <p className="text-[1.1rem] leading-snug font-semibold">Vacante cerrada</p>
          <p className="text-[0.93rem] text-muted-foreground">La empresa ya no recibe postulaciones para esta vacante.</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Badge variant="status" size="md" className="border-transparent bg-white text-ink" style={{ "--dot": STATUS.cerrada.color } as CSSVars}>
          {STATUS.cerrada.label}
        </Badge>
        <span className="text-[0.88rem] text-muted-foreground">
          Te postulaste {app.minutesAgo === 0 ? "justo ahora" : formatMinutesAgo(app.minutesAgo).toLowerCase()}
        </span>
      </div>
      <Button asChild variant="white" size="lg" className="mt-4 w-full border-2 border-ink text-ink">
        <Link href="/vacantes">Ver más vacantes cerca</Link>
      </Button>
    </div>
  );
}

function ClosedHero({ app }: { app: Application }) {
  const copy = HERO.cerrada;
  return (
    <HeroCard eyebrow={copy.eyebrow} title="Esta vacante ya cerró" className="animate-rise border-[2.5px] border-ink">
      <div className="mt-2 flex items-center gap-4">
        <p className="min-w-0 flex-1 text-[1rem] leading-snug text-primary-foreground/85">
          Te postulaste {app.minutesAgo === 0 ? "justo ahora" : formatMinutesAgo(app.minutesAgo).toLowerCase()}, pero la empresa ya no
          recibe postulaciones. Hay más chamba a unos pasos de tu casa.
        </p>
        <Mascot mood="piensa" prop="casco" size={96} className="shrink-0" />
      </div>
      <Button variant="lime" size="xl" className="mt-5 w-full" asChild>
        <Link href="/vacantes">Ver vacantes cerca</Link>
      </Button>
    </HeroCard>
  );
}

function HeroSkeleton() {
  return (
    <HeroCard eyebrow="Tus postulaciones" title="Cargando tus postulaciones…" className="animate-rise">
      <LoadingNote>Cargando tus postulaciones…</LoadingNote>
      <InkSkeleton className="mt-4 h-16 w-full rounded-tile bg-white/15!" />
      <InkSkeleton className="mt-4 h-4 w-2/3 bg-white/20!" />
      <InkSkeleton className="mt-5 h-20 w-full bg-white/15!" />
      <InkSkeleton className="mt-5 h-14 w-full rounded-full bg-white/20!" />
    </HeroCard>
  );
}

function CardSkeleton({ tone }: { tone: BlockTone }) {
  return (
    <div aria-hidden className={cn("relative h-[15.5rem] rounded-panel p-5", BLOCK_CLASS[tone], HARD)}>
      <div className="flex items-start gap-3">
        <InkSkeleton className="size-10 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1 space-y-2">
          <InkSkeleton className="h-5 w-3/5" />
          <InkSkeleton className="h-4 w-2/5" />
        </div>
      </div>
      <InkSkeleton className="mt-4 h-7 w-28 rounded-full" />
      <InkSkeleton className="mt-4 h-10 w-full" />
      <InkSkeleton className="mt-3 h-12 w-full rounded-tile" />
    </div>
  );
}

/** Live, before the session and catalog land: same two-column layout, placeholders only. */
function ApplicationsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 lg:gap-6">
      <div className="grid min-w-0 grid-cols-1 content-start gap-5 lg:col-span-7">
        <HeroSkeleton />
        <div aria-hidden className="grid grid-cols-3 gap-2.5 sm:gap-3">
          {STAT_TONES.map((t) => (
            <div key={t} className={cn("h-[7.6rem] rounded-tile p-3.5 sm:p-4", BLOCK_CLASS[t], HARD_SM)}>
              <InkSkeleton className="size-8 rounded-lg" />
              <InkSkeleton className="mt-2 h-9 w-10" />
              <InkSkeleton className="mt-1.5 h-3.5 w-14" />
            </div>
          ))}
        </div>
      </div>
      <div className="grid min-w-0 grid-cols-1 content-start gap-5 lg:col-span-5">
        <Panel tone="lila" className={cn("overflow-hidden", HARD)}>
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
    <div
      className={cn("relative min-w-0 animate-pop-in rounded-tile p-3.5 sm:p-4", BLOCK_CLASS[tone], HARD_SM)}
      style={{ "--i": index } as CSSVars}
    >
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

/* ------------------------------------------------------------------ hero */

function ApplicationHero({ app, job, km, live }: { app: Application; job: Job; km: number; live: boolean }) {
  const fire = useConfetti();
  const [confirmed, setConfirmed] = useState(false);
  const copy = HERO[app.status];
  const stepIdx = STEPS.findIndex((s) => s.id === app.status);

  return (
    <HeroCard
      eyebrow={copy.eyebrow}
      title={copy.title}
      className={cn("animate-rise overflow-visible border-[2.5px] border-ink shadow-[6px_6px_0_0_var(--ink)]! dark:shadow-[6px_6px_0_0_rgb(255_255_255/0.16)]!")}
      sticker={
        <Sticker variant="lime" dot rotate={12}>
          {(live ? LIVE_STICKER[app.status] : undefined) ?? copy.sticker}
        </Sticker>
      }
    >
      <span aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-[inherit]">
        <Doodle name="rayo" color="var(--limon)" className="absolute top-[38%] right-5 size-6 rotate-12" />
        <Doodle name="zigzag" color="#FFD23F" className="absolute bottom-28 left-[46%] size-7" />
        <Doodle name="flecha" color="#5CC3FF" className="absolute right-[30%] bottom-6 size-5 -rotate-12" />
        <HazardTape className="absolute inset-x-0 bottom-0 h-3 border-b-0" />
      </span>
      <Rivets className="text-white" />
      <Link
        href={`/vacantes/${job.id}`}
        className="group press mt-4 flex items-center gap-3 rounded-tile bg-white/12 p-3 outline-none transition-colors hover:bg-white/20 focus-visible:ring-3 focus-visible:ring-limon"
      >
        <CategoryIcon category={job.category} size="md" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[1.08rem] leading-snug font-semibold">{job.title}</span>
          <span className="line-clamp-2 text-[0.93rem] leading-snug text-primary-foreground/80">
            {companyLabel(job)} · {formatKm(km)}
          </span>
        </span>
        <HugeiconsIcon icon={ArrowRight01Icon} className="size-5 shrink-0 transition-transform group-hover:translate-x-1" strokeWidth={2} />
      </Link>

      <p className="mt-3 text-[0.98rem] leading-snug text-primary-foreground/85">{hintFor(app.status, live)}</p>

      <div className="relative mt-4 flex items-end gap-3">
        <div className="min-w-0 flex-1">
          <p className="mb-2 text-[0.72rem] font-semibold tracking-[0.14em] uppercase">
            <span className="text-limon">Etapa {Math.max(stepIdx, 0) + 1} de {STEPS.length}</span>
            <span className="text-primary-foreground/75"> · {STEPS[Math.max(stepIdx, 0)].short}</span>
          </p>
          <StageBars
            className="h-20"
            total={STEPS.length}
            current={Math.max(stepIdx, 0) + 1}
            labels={STEPS.map((s) => s.label)}
            tone="inverse"
            label={`Avance de tu postulación a ${job.title}`}
          />
        </div>
        <Mascot mood={copy.mood} prop={app.status === "contratada" ? "trofeo" : "casco"} size={96} className="-mr-2 -mb-1 shrink-0 sm:-mr-3" />
      </div>

      {app.status === "entrevista" && !live ? (
        <Button
          variant="lime"
          size="xl"
          className="mt-5 w-full"
          disabled={confirmed}
          onClick={(e) => {
            fire({ origin: e.currentTarget });
            setConfirmed(true);
            toast.success("¡Ya quedó! Le avisamos a la empresa que vas.");
          }}
        >
          <HugeiconsIcon icon={confirmed ? Tick02Icon : Calendar03Icon} className="size-5" strokeWidth={2} />
          {confirmed ? "¡Ya quedó! Te esperan el jueves" : "Confirmar asistencia"}
        </Button>
      ) : (
        <Button variant="lime" size="xl" className="mt-5 w-full" asChild>
          <Link href={`/vacantes/${job.id}`}>Ver la vacante</Link>
        </Button>
      )}
    </HeroCard>
  );
}

function EmptyHero() {
  return (
    <HeroCard eyebrow="Tus postulaciones" title="Aún no te postulas a ninguna" className="animate-rise">
      <div className="mt-2 flex items-center gap-4">
        <p className="min-w-0 flex-1 text-[1rem] leading-snug text-primary-foreground/85">
          Hay chamba a unos pasos de tu casa. ¡Échale un ojo!
        </p>
        <Scene name="busqueda" className="w-32 shrink-0 sm:w-40" />
      </div>
      <Button variant="lime" size="xl" className="mt-5 w-full" asChild>
        <Link href="/inicio">Ve las que están cerca de ti</Link>
      </Button>
    </HeroCard>
  );
}

/* ------------------------------------------------------------------ list card */

function ApplicationCard({ app, job, tone, km, live }: { app: Application; job: Job; tone: BlockTone; km: number; live: boolean }) {
  const st = STATUS[app.status];
  const stepIdx = STEPS.findIndex((s) => s.id === app.status);
  return (
    <Link
      href={`/vacantes/${job.id}`}
      className={cn(
        "group lift press relative block rounded-panel p-5 outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        BLOCK_CLASS[tone],
        HARD,
      )}
    >
      <CategoryArt
        category={job.category}
        className="pointer-events-none absolute -top-4 -right-2 size-20 rotate-12 transition-transform duration-300 ease-[var(--ease-spring)] group-hover:rotate-0 group-hover:scale-110"
      />
      <div className="flex items-start gap-3 pr-16">
        <CategoryIcon category={job.category} size="sm" className="mt-0.5" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[1.1rem] leading-snug font-semibold">{job.title}</p>
          <p className="truncate text-[0.93rem] text-muted-foreground">
            <span className="font-semibold text-foreground tabular-nums">{formatPay(job)}</span> · {companyLabel(job)}
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Badge
          variant="status"
          size="md"
          className="border-transparent bg-white text-ink"
          style={{ "--dot": st.color } as CSSVars}
        >
          {st.label}
        </Badge>
        <span className="text-[0.88rem] text-muted-foreground">
          {formatKm(km)} · {app.minutesAgo === 0 ? "Justo ahora" : formatMinutesAgo(app.minutesAgo)}
        </span>
      </div>

      <StageStepper stepIdx={stepIdx} className="mt-4" />
      <p className="mt-3 rounded-tile border-2 border-dashed border-ink/25 bg-tile px-3.5 py-2.5 text-[0.9rem] leading-snug">{hintFor(app.status, live)}</p>
    </Link>
  );
}

/** Horizontal stepper (desktop reference): done = lime check circles, current = violet dot, future = hatched. */
function StageStepper({ stepIdx, className }: { stepIdx: number; className?: string }) {
  return (
    <ol className={cn("grid grid-cols-4", className)} aria-label="Avance de tu postulación">
      {STEPS.map((s, i) => {
        const state = i < stepIdx ? "done" : i === stepIdx ? "current" : "todo";
        return (
          <li key={s.id} className="relative flex flex-col items-center gap-1.5 text-center" aria-current={state === "current" ? "step" : undefined}>
            {i > 0 ? (
              <span
                aria-hidden
                className={cn(
                  "absolute top-4 right-1/2 left-[-50%] -z-0 mx-5 -translate-y-1/2",
                  i <= stepIdx ? "h-1 rounded-full bg-ink" : "border-t-2 border-dashed border-ink/30",
                )}
              />
            ) : null}
            <span
              aria-hidden
              className={cn(
                "relative grid size-8 place-items-center rounded-full border-2 animate-pop-in",
                state === "done" && "border-ink bg-limon text-ink",
                state === "current" && "border-ink bg-primary ring-4 ring-primary/25",
                state === "todo" && "border-dashed border-ink/35 bg-hatch",
              )}
              style={{ "--i": i } as CSSVars}
            >
              {state === "done" ? <HugeiconsIcon icon={Tick02Icon} className="size-4.5" strokeWidth={3} /> : null}
              {state === "current" ? <span className="size-2.5 rounded-full bg-white" /> : null}
            </span>
            <span className={cn("w-full truncate px-0.5 text-[0.74rem] leading-tight", state === "todo" ? "text-muted-foreground" : "font-semibold")}>
              <span className="sr-only">{state === "done" ? "Hecho: " : state === "current" ? "Ahora: " : "Pendiente: "}</span>
              {s.short}
            </span>
          </li>
        );
      })}
    </ol>
  );
}


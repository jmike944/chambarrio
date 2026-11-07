"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01Icon, ArrowRight01Icon, ArrowRight02Icon, Gps01Icon } from "@hugeicons/core-free-icons";
import { JobRow } from "@/components/chamba/job-row";
import { CATEGORY_BLOCK, CategoryIcon } from "@/components/chamba/job-icons";
import { CountUp, useConfetti } from "@/components/chamba/motion";
import { Mascot } from "@/components/chamba/art/mascot";
import { Scene } from "@/components/chamba/art/scenes";
import { Doodle } from "@/components/chamba/art/doodles";
import { CATEGORY_BY_ID } from "@/lib/data/categories";
import { COMPANY_BY_ID } from "@/lib/data/jobs";
import type { CategoryId } from "@/lib/data/types";
import { formatPay } from "@/lib/format";
import { useApp, useJobsByDistance } from "@/lib/store";
import { RADIUS_STOPS, bandColor, bandFor, formatKm } from "@/lib/geo";
import { cn } from "@/lib/utils";
import type { PlacedJob } from "./job-map";

/* ------------------------------------------------------------------ local styling helpers */

type CSSVars = React.CSSProperties & Record<`--${string}`, string | number>;

/** Hard offset "sticker" edge: ink outline + ink drop (deeper black in dark so it still reads). */
const RUGGED = "border-[2.5px] border-[#160f33] shadow-[0_5px_0_#160f33] dark:shadow-[0_5px_0_rgb(0_0_0/0.65)]";
/** Safety-tape stripes (ink / safety yellow). */
const HAZARD = "bg-[repeating-linear-gradient(-45deg,#160f33_0_9px,#ffd84a_9px_18px)]";

/** Static bg classes per category block tone (pink is swapped for safety yellow). */
const CHIP_BG: Record<(typeof CATEGORY_BLOCK)[CategoryId], string> = {
  lila: "bg-block-lila",
  chicle: "bg-block-sol",
  limon: "bg-block-limon",
  cielo: "bg-block-cielo",
  sol: "bg-block-sol",
  menta: "bg-block-menta",
  durazno: "bg-block-durazno",
};

const JobMap = dynamic(() => import("./job-map").then((m) => m.JobMap), {
  ssr: false,
  loading: () => (
    <div className="grid size-full place-items-center bg-[#f2ead8] text-[#160f33] dark:bg-[#14121c] dark:text-[#f2efff]">
      <div className="flex flex-col items-center gap-2">
        <Mascot mood="piensa" prop="casco" size={84} />
        <p className="font-display text-lg font-bold">Cargando mapa…</p>
      </div>
    </div>
  ),
});

/* ------------------------------------------------------------------ controls */

function RadiusChips({ className }: { className?: string }) {
  const radiusKm = useApp((s) => s.radiusKm);
  const setRadius = useApp((s) => s.setRadius);
  return (
    <div
      role="group"
      aria-label="Radio de búsqueda"
      className={cn("grid grid-cols-4 gap-1 rounded-full border-2 border-[#160f33] bg-white/70 p-1", className)}
    >
      {RADIUS_STOPS.map((s) => (
        <button
          key={s}
          type="button"
          aria-pressed={s === radiusKm}
          onClick={() => setRadius(s)}
          className={cn(
            "press h-9 rounded-full px-1 font-display text-[0.95rem] font-bold tabular-nums whitespace-nowrap text-[#160f33] transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring",
            s === radiusKm ? "bg-[#160f33] text-white shadow-[inset_0_-2px_0_rgb(255_255_255/0.18)]" : "hover:bg-white",
          )}
        >
          {s} km
        </button>
      ))}
    </div>
  );
}

function LocateButton({ className }: { className?: string }) {
  const setHome = useApp((s) => s.setHome);
  const fire = useConfetti();
  const [busy, setBusy] = useState(false);
  function locate(e: React.MouseEvent<HTMLButtonElement>) {
    const origin = e.currentTarget;
    if (!("geolocation" in navigator)) {
      toast.error("No pudimos obtener tu ubicación. Elige tu colonia en Perfil.");
      return;
    }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setBusy(false);
        setHome({ lat: pos.coords.latitude, lng: pos.coords.longitude }, "Mi ubicación", "gps");
        fire({ origin, count: 28 });
        toast.success("¡Ya quedó! Usamos tu ubicación actual.");
      },
      () => {
        setBusy(false);
        toast.error("No pudimos obtener tu ubicación. Elige tu colonia en Perfil.");
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
    );
  }
  return (
    <button
      type="button"
      onClick={locate}
      disabled={busy}
      aria-label="Usar mi ubicación"
      className={cn(
        "press grid size-11 shrink-0 place-items-center rounded-full border-2 border-[#160f33] bg-white text-[#160f33] shadow-[0_3px_0_#160f33] outline-none transition-[translate,box-shadow] hover:-translate-y-0.5 focus-visible:ring-3 focus-visible:ring-ring disabled:opacity-60",
        className,
      )}
    >
      <HugeiconsIcon icon={Gps01Icon} className={cn("size-5", busy && "animate-spin")} strokeWidth={2} />
    </button>
  );
}

/** Category legend: one chip per category in range (count), tap = fly to the nearest one. */
function CategoryLegend({
  jobs,
  onPick,
  className,
}: {
  jobs: PlacedJob[];
  onPick: (id: string) => void;
  className?: string;
}) {
  const groups = useMemo(() => {
    const m = new Map<CategoryId, { n: number; nearest: PlacedJob }>();
    for (const j of jobs) {
      const g = m.get(j.category);
      if (g) g.n++;
      else m.set(j.category, { n: 1, nearest: j });
    }
    return [...m.entries()].toSorted((a, b) => b[1].n - a[1].n);
  }, [jobs]);
  if (groups.length === 0) return null;
  return (
    <ul aria-label="Categorías en tu radio" className={cn("no-scrollbar flex gap-2 overflow-x-auto", className)}>
      {groups.map(([cat, g], i) => (
        <li key={cat} className="shrink-0 animate-pop-in" style={{ "--i": Math.min(i, 8) } as CSSVars}>
          <button
            type="button"
            onClick={() => onPick(g.nearest.id)}
            aria-label={`${CATEGORY_BY_ID[cat].label}: ${g.n} ${g.n === 1 ? "vacante" : "vacantes"}. Ver la más cercana`}
            className={cn(
              "group press flex h-11 items-center gap-1.5 rounded-full border-2 border-[#160f33] pr-1.5 pl-1 text-[0.9rem] font-semibold text-[#160f33] shadow-[0_3px_0_#160f33] outline-none transition-[translate] hover:-translate-y-0.5 focus-visible:ring-3 focus-visible:ring-ring dark:shadow-[0_3px_0_rgb(0_0_0/0.65)]",
              CHIP_BG[CATEGORY_BLOCK[cat]],
            )}
          >
            <CategoryIcon category={cat} size="xs" className="transition-transform group-hover:-rotate-12" />
            {CATEGORY_BY_ID[cat].label}
            <span className="grid h-6 min-w-6 place-items-center rounded-full bg-[#160f33] px-1.5 font-display text-[0.75rem] font-extrabold text-white tabular-nums">
              {g.n}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------------ hero card */

function SelectedJobCard({
  job,
  radiusKm,
  index,
  total,
  onStep,
  onWiden,
  className,
}: {
  job: PlacedJob;
  radiusKm: number;
  /** Position inside the radius list (-1 = outside the radius). */
  index: number;
  total: number;
  onStep: (dir: 1 | -1) => void;
  onWiden: (() => void) | null;
  className?: string;
}) {
  const company = COMPANY_BY_ID[job.companyId];
  const inside = index >= 0;
  return (
    <div className={cn("relative pt-14", className)}>
      {/* the crew boss peeking over the card */}
      <div aria-hidden className="pointer-events-none absolute top-0 left-5 z-0 translate-y-2">
        <Mascot mood={inside ? "saluda" : "piensa"} prop={inside ? "casco" : "lupa"} size={70} />
      </div>
      <Doodle name="rayo" color="#ffd84a" className="pointer-events-none absolute top-6 left-[6.5rem] z-0 size-6 rotate-12" />

      <article
        aria-label="Vacante seleccionada"
        className={cn("relative z-10 overflow-hidden rounded-[1.6rem] block-mandarina", RUGGED)}
      >
        <div aria-hidden className={cn("h-2.5 border-b-2 border-[#160f33]", HAZARD)} />
        <div className="p-4 pt-3">
          <div className="flex items-center gap-2">
            <p className="min-w-0 flex-1 truncate font-display text-[0.8rem] font-extrabold tracking-[0.08em] uppercase">
              {inside ? "¡Chamba a la vista!" : `Nada a ${radiusKm} km · la más cerca`}
            </p>
            {inside && total > 1 ? (
              <div className="flex items-center gap-1.5">
                <span className="font-display text-sm font-bold tabular-nums" aria-live="polite">
                  {index + 1}/{total}
                </span>
                <StepButton dir={-1} onClick={() => onStep(-1)} />
                <StepButton dir={1} onClick={() => onStep(1)} />
              </div>
            ) : null}
          </div>

          <div key={job.id} className="mt-2 flex animate-pop-in items-center gap-3" style={{ "--i": 0 } as CSSVars}>
            <CategoryIcon
              category={job.category}
              size="lg"
              animated
              className="shrink-0 -rotate-6 rounded-2xl border-2 border-[#160f33] shadow-[2px_3px_0_#160f33]"
            />
            <div className="min-w-0 flex-1">
              <h2 className="line-clamp-2 font-display text-[1.3rem] leading-[1.08] font-extrabold tracking-[-0.03em]">
                {job.title}
              </h2>
              <p className="mt-1 truncate text-[0.93rem]">
                <span className="font-bold tabular-nums">{formatPay(job)}</span>
                <span className="opacity-75"> · {company.name}</span>
              </p>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span className="inline-flex h-7 items-center gap-1.5 rounded-md bg-[#160f33] px-2 font-display text-[0.85rem] font-extrabold tracking-wide text-white uppercase tabular-nums">
              <span className="size-2.5 rounded-full ring-2 ring-white/30" style={{ background: bandColor(bandFor(job.km)) }} />A {formatKm(job.km)}
            </span>
            <span className="inline-flex h-7 items-center rounded-md border-2 border-[#160f33] bg-white/55 px-2 text-[0.8rem] font-semibold">
              {CATEGORY_BY_ID[job.category].label}
            </span>
            {job.urgent ? (
              <span className="inline-flex h-7 -rotate-3 items-center rounded-md border-2 border-[#160f33] bg-block-sol px-2 font-display text-[0.78rem] font-extrabold tracking-wider uppercase">
                ¡Urge!
              </span>
            ) : null}
          </div>

          <div className="mt-3.5 flex gap-2">
            {onWiden ? (
              <button
                type="button"
                onClick={onWiden}
                className="press h-14 flex-1 rounded-full border-2 border-[#160f33] bg-white/70 px-3 font-semibold outline-none hover:bg-white focus-visible:ring-3 focus-visible:ring-ring"
              >
                Ábrele el radio
              </button>
            ) : null}
            <Link
              href={`/vacantes/${job.id}`}
              className="group press flex h-14 flex-[1.4] items-center justify-center gap-2 rounded-full bg-[#160f33] px-5 text-[1.05rem] font-semibold text-white shadow-[0_3px_0_rgb(0_0_0/0.35)] outline-none transition-[translate] hover:-translate-y-0.5 focus-visible:ring-3 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#160f33]"
            >
              Ver vacante
              <HugeiconsIcon
                icon={ArrowRight02Icon}
                className="size-5 transition-transform group-hover:translate-x-1"
                strokeWidth={2.2}
              />
            </Link>
          </div>
        </div>
      </article>
    </div>
  );
}

function StepButton({ dir, onClick }: { dir: 1 | -1; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={dir === 1 ? "Siguiente vacante" : "Vacante anterior"}
      className="press grid size-11 place-items-center rounded-full border-2 border-[#160f33] bg-white text-[#160f33] outline-none hover:bg-block-sol focus-visible:ring-3 focus-visible:ring-ring"
    >
      <HugeiconsIcon icon={dir === 1 ? ArrowRight01Icon : ArrowLeft01Icon} className="size-5" strokeWidth={2.4} />
    </button>
  );
}

/* ------------------------------------------------------------------ screen */

export function MapScreen() {
  const home = useApp((s) => s.home);
  const radiusKm = useApp((s) => s.radiusKm);
  const setRadius = useApp((s) => s.setRadius);
  const jobs = useJobsByDistance();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focus, setFocus] = useState<{ lat: number; lng: number } | null>(null);

  // Spread out jobs that share a building so every pin stays tappable.
  const placed: PlacedJob[] = useMemo(() => {
    const seen = new Map<string, number>();
    return jobs.map((j) => {
      const key = `${j.location.lat},${j.location.lng}`;
      const n = seen.get(key) ?? 0;
      seen.set(key, n + 1);
      const angle = n * 2.4;
      const off = n === 0 ? 0 : 0.0007;
      return { ...j, pos: { lat: j.location.lat + off * Math.cos(angle), lng: j.location.lng + off * Math.sin(angle) } };
    });
  }, [jobs]);

  const inRadius = placed.filter((j) => j.km <= radiusKm);
  const selected = placed.find((j) => j.id === selectedId) ?? inRadius[0] ?? placed[0];
  const selectedIndex = selected ? inRadius.findIndex((j) => j.id === selected.id) : -1;
  const nextStop = RADIUS_STOPS.find((s) => s > radiusKm);

  function select(id: string, fly = false) {
    setSelectedId(id);
    if (fly) {
      const j = placed.find((x) => x.id === id);
      if (j) setFocus({ ...j.pos });
    }
  }

  function step(dir: 1 | -1) {
    if (inRadius.length === 0) return;
    const i = (Math.max(selectedIndex, 0) + dir + inRadius.length) % inRadius.length;
    select(inRadius[i].id, true);
  }

  const widen = inRadius.length === 0 && nextStop ? () => setRadius(nextStop) : null;

  return (
    <div className="lg:grid lg:grid-cols-12 lg:gap-5 lg:pt-10">
      {/* Desktop column: sol header block + cielo list block */}
      <div className="hidden lg:col-span-5 lg:flex lg:h-[calc(100dvh-5rem)] lg:flex-col lg:gap-4">
        <section className={cn("relative shrink-0 animate-rise overflow-hidden rounded-panel p-6 block-sol", RUGGED)}>
          <div aria-hidden className={cn("absolute inset-x-0 top-0 h-2.5 border-b-2 border-[#160f33]", HAZARD)} />
          <div aria-hidden className="pointer-events-none absolute -top-2 -right-6 w-44 rotate-6">
            <Scene name="mapa" />
          </div>
          <Doodle name="estrella" color="#ff6b2c" className="pointer-events-none absolute top-24 right-44 size-6" />
          <p className="mt-1 font-display text-[0.78rem] font-extrabold tracking-[0.12em] uppercase opacity-75">
            Chamba cerca de casa
          </p>
          <h1 className="mt-1 font-display text-[3rem] leading-none font-extrabold tracking-[-0.045em]">Mapa</h1>
          <p className="mt-2 max-w-[15rem] text-[0.95rem]">
            <span className="font-display text-[1.4rem] font-extrabold tabular-nums">
              <CountUp value={inRadius.length} />
            </span>{" "}
            vacantes a {radiusKm} km o menos de tu casa
          </p>
          <div className="relative mt-4 flex items-center gap-2">
            <RadiusChips className="flex-1" />
            <LocateButton />
          </div>
        </section>

        <section
          aria-label="Vacantes en tu radio"
          className={cn("flex min-h-0 flex-1 animate-rise flex-col rounded-panel p-5 block-cielo", RUGGED)}
          style={{ "--i": 1 } as CSSVars}
        >
          <h2 className="mb-2 flex items-center gap-2 font-display text-[1.3rem] font-extrabold">
            Más cerca de ti
            <span className="grid h-7 min-w-7 place-items-center rounded-full bg-[#160f33] px-2 text-[0.8rem] text-white tabular-nums">
              {inRadius.length}
            </span>
          </h2>
          <ul className="-mr-2 flex-1 space-y-1 overflow-y-auto overscroll-contain pr-2">
            {inRadius.map((j, i) => (
              <li
                key={j.id}
                onClickCapture={(e) => {
                  if (e.metaKey || e.ctrlKey) return;
                  e.preventDefault();
                  select(j.id, true);
                }}
                className={cn(
                  "animate-rise rounded-2xl px-2 transition-colors",
                  j.id === selected?.id && "bg-white/60 ring-2 ring-[#160f33]",
                )}
                style={{ "--i": Math.min(i, 8) } as CSSVars}
              >
                <JobRow job={j} km={j.km} radiusKm={radiusKm} />
              </li>
            ))}
            {inRadius.length === 0 ? (
              <li className="flex flex-col items-center gap-2 py-6 text-center">
                <Mascot mood="piensa" prop="lupa" size={90} />
                <p className="font-display text-lg font-bold">No hay vacantes en este radio.</p>
                <p className="opacity-75">Prueba con uno más grande.</p>
              </li>
            ) : null}
          </ul>
        </section>
      </div>

      {/* Map: full-bleed on mobile, framed block on desktop. Overlays live inside. */}
      <div
        className={cn(
          "fixed inset-0 z-0 bg-[#f2ead8] dark:bg-[#14121c] lg:relative lg:col-span-7 lg:h-[calc(100dvh-5rem)] lg:overflow-hidden lg:rounded-panel lg:border-[2.5px] lg:border-[#160f33] lg:shadow-[0_6px_0_#160f33] dark:lg:shadow-[0_6px_0_rgb(0_0_0/0.65)]",
          "[&_.maplibregl-ctrl-bottom-right]:bottom-[27rem]! lg:[&_.maplibregl-ctrl-bottom-right]:bottom-0!",
        )}
      >
        <JobMap
          home={home}
          radiusKm={radiusKm}
          jobs={placed}
          selectedId={selected?.id ?? null}
          onSelect={(id) => select(id)}
          focus={focus}
        />

        <CategoryLegend
          jobs={inRadius}
          onPick={(id) => select(id, true)}
          className="absolute inset-x-0 top-[calc(max(0.75rem,env(safe-area-inset-top))+4.6rem)] z-10 px-3 pt-1 pb-2 lg:top-3 lg:px-4"
        />

        {selected ? (
          <SelectedJobCard
            job={selected}
            radiusKm={radiusKm}
            index={selectedIndex}
            total={inRadius.length}
            onStep={step}
            onWiden={widen}
            className="absolute inset-x-3 bottom-28 z-10 mx-auto max-w-xl lg:inset-x-auto lg:bottom-5 lg:left-5 lg:w-[25rem]"
          />
        ) : null}
      </div>

      {/* Mobile top bar: safety-yellow block */}
      <div className="fixed inset-x-3 top-[max(0.75rem,env(safe-area-inset-top))] z-30 animate-rise lg:hidden">
        <div className={cn("mx-auto flex max-w-xl items-center gap-2 rounded-full p-1.5 pl-4 block-sol", RUGGED)}>
          <h1 className="font-display text-[1.35rem] leading-none font-extrabold tracking-[-0.03em]">Mapa</h1>
          <RadiusChips className="flex-1" />
          <LocateButton />
        </div>
      </div>
    </div>
  );
}

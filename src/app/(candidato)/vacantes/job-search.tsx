"use client";

import Link from "next/link";
import { useDeferredValue, useState } from "react";
import { motion } from "motion/react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowRight01Icon,
  Cancel01Icon,
  Clock01Icon,
  FilterHorizontalIcon,
  MapsLocation01Icon,
  Search01Icon,
  Store01Icon,
  ToolsIcon,
} from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Panel, rotateTone, surface, type BlockTone } from "@/components/chamba/primitives";
import { CountUp, springs } from "@/components/chamba/motion";
import { CategoryArt, CategoryIcon, CATEGORY_BLOCK } from "@/components/chamba/job-icons";
import { Doodle, Marquee } from "@/components/chamba/art/doodles";
import { CATEGORIES, CATEGORY_BY_ID } from "@/lib/data/categories";
import { useCatalog } from "@/lib/data/catalog";
import type { Company } from "@/lib/data/types";
import { companyLabel } from "@/components/chamba/job-row";
import type { CategoryId, EmploymentType, Job, Shift } from "@/lib/data/types";
import { bandColor, bandFor, formatKm, RADIUS_STOPS } from "@/lib/geo";
import { formatMinutesAgo, formatMXN, formatPay } from "@/lib/format";
import { useApp, useJobsByDistance } from "@/lib/store";
import { cn } from "@/lib/utils";
import { CatalogErrorPanel, InkSkeleton, JobCardSkeletons, LiveEmptyNearby, LoadingNote, PickHomeBanner, StaleNote } from "./_seeker/states";
import { MyMascot, MyScene } from "@/components/chamba/art/my-mascot";

const SHIFTS: Shift[] = ["Matutino", "Vespertino", "Nocturno", "Mixto", "Rotativo"];
const TYPES: EmploymentType[] = ["Tiempo completo", "Medio tiempo", "Temporal", "Fines de semana"];
const MIN_PAY = [0, 1500, 2000, 2500, 3000];

type CSSVars = React.CSSProperties & Record<`--${string}`, string | number>;

/** Workwear look: hard offset ink shadow (stays visible on the dark canvas). */
const HARD = "shadow-[5px_5px_0_0_var(--ink)] dark:shadow-[5px_5px_0_0_rgb(0_0_0/0.65)]";
/** Hazard-tape stripes (static background, no animation). */
const HAZARD: React.CSSProperties = {
  backgroundImage: "repeating-linear-gradient(-45deg, var(--ink) 0 10px, transparent 10px 20px)",
};
const TAPE = ["Paga semanal", "Cerca de tu casa", "Sin currículum", "Contacto directo", "Entrevista rápida"];

/** Normalize any pay period to weekly pesos. */
function weeklyPay(job: Pick<Job, "pay" | "period">) {
  switch (job.period) {
    case "mes":
      return job.pay / 4.33;
    case "quincena":
      return job.pay / 2.16;
    case "dia":
      return job.pay * 6;
    default:
      return job.pay;
  }
}

/** Category tone for each card, nudged so two neighbours never share a color. */
function cardTones(list: Job[], avoidFirst?: BlockTone): BlockTone[] {
  const out: BlockTone[] = [];
  list.forEach((j, i) => {
    let t: BlockTone = CATEGORY_BLOCK[j.category];
    let k = i;
    const prev = i > 0 ? out[i - 1] : avoidFirst;
    while (t === prev) t = rotateTone(++k);
    out.push(t);
  });
  return out;
}

/* ------------------------------------------------------------------ filter bits */

/** Chunky toggle chip that sits on a pastel block: frosted white → ink when on. */
function BlockChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "press inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full border-2 px-4 text-[0.95rem] font-medium whitespace-nowrap transition-[background-color,color,border-color,box-shadow] outline-none focus-visible:ring-3 focus-visible:ring-ring/60",
        active
          ? "border-ink bg-ink text-white shadow-[3px_3px_0_0_var(--block-uva)] dark:shadow-[3px_3px_0_0_var(--limon)]"
          : "border-ink/15 bg-white/55 text-ink hover:border-ink/40 hover:bg-white/80",
      )}
    >
      {active ? (
        <motion.span
          initial={{ scale: 0, rotate: -40 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={springs.bouncy}
          className="grid size-4 place-items-center rounded-full bg-limon text-[0.6rem] text-ink"
          aria-hidden
        >
          ✓
        </motion.span>
      ) : null}
      {children}
    </button>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <fieldset className="min-w-0">
      <legend className="mb-2.5 font-display text-[1.02rem] font-bold tracking-[-0.01em]">{label}</legend>
      {children}
    </fieldset>
  );
}

/** "Pick a topic" bubble: round cartoon icon, label below. Selected = ring + bounce. */
function TopicBubble({
  active,
  onClick,
  label,
  index,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  index: number;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className="group flex w-[4.9rem] shrink-0 animate-pop-in flex-col items-center gap-1.5 rounded-[1.4rem] py-1 outline-none focus-visible:ring-3 focus-visible:ring-ring/60"
      style={{ "--i": Math.min(index, 10) } as CSSVars}
    >
      <motion.span
        animate={active ? { y: [0, -10, 0, -4, 0], rotate: [0, -8, 6, 0] } : { y: 0, rotate: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        whileTap={{ scale: 0.88 }}
        className={cn(
          "relative grid size-[4.25rem] place-items-center rounded-full transition-[box-shadow] duration-200",
          active
            ? "shadow-[0_0_0_3px_var(--background),0_0_0_6px_var(--primary)]"
            : "shadow-[0_0_0_2px_color-mix(in_oklab,var(--foreground)_10%,transparent)] group-hover:shadow-[0_0_0_3px_color-mix(in_oklab,var(--primary)_45%,transparent)]",
        )}
      >
        {children}
        {active ? (
          <motion.span
            aria-hidden
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={springs.bouncy}
            className="absolute -top-1 -right-1 grid size-6 place-items-center rounded-full border-2 border-background bg-limon text-[0.7rem] font-bold text-ink"
          >
            ✓
          </motion.span>
        ) : null}
      </motion.span>
      <span
        className={cn(
          "line-clamp-2 max-w-full text-center text-[0.78rem] leading-tight hyphens-auto",
          active ? "font-bold text-uva-ink" : "text-foreground/85",
        )}
      >
        {label}
      </span>
    </button>
  );
}

/* ------------------------------------------------------------------ job card */

function JobBlockCard({
  job,
  company,
  tone,
  index,
}: {
  job: Job & { km: number };
  company: Company | undefined;
  tone: BlockTone;
  index: number;
}) {
  const band = bandFor(job.km);
  const tilt = index % 2 === 0 ? 8 : -8;
  return (
    <Link
      href={`/vacantes/${job.id}`}
      className={cn(
        "group press lift relative isolate block overflow-hidden rounded-panel border-2 border-ink p-5 pr-28 outline-none transition-[translate,box-shadow] duration-200 hover:shadow-[8px_8px_0_0_var(--ink)] focus-visible:ring-4 focus-visible:ring-ring/60 sm:pr-36 dark:hover:shadow-[8px_8px_0_0_rgb(0_0_0/0.7)]",
        surface(tone),
        HARD,
      )}
    >
      {/* cartoon art bleeding off the corner */}
      <span
        aria-hidden
        className="pointer-events-none absolute -top-3 -right-5 -z-10 size-32 transition-transform duration-300 ease-[var(--ease-spring)] group-hover:scale-110 group-hover:-rotate-6 sm:size-40"
        style={{ rotate: `${tilt}deg` }}
      >
        <CategoryArt category={job.category} className="size-full" />
      </span>
      <span aria-hidden className="absolute -right-10 -bottom-12 -z-20 size-40 rounded-full bg-dots text-ink/15" />

      <span className="flex flex-wrap items-center gap-1.5">
        <span className="inline-flex h-7 items-center gap-1.5 rounded-md border-2 border-ink bg-white/70 px-2 text-[0.72rem] font-extrabold tracking-[0.12em] uppercase">
          <span aria-hidden className="size-1.5 rounded-full bg-ink" />
          {CATEGORY_BY_ID[job.category].label}
        </span>
        {job.urgent ? (
          <span className="inline-flex h-7 items-center gap-1 rounded-full bg-chile px-2.5 text-[0.75rem] font-bold tracking-wide text-white uppercase">
            <span aria-hidden className="size-1.5 animate-beat rounded-full bg-white" />
            Urge
          </span>
        ) : null}
        {company && company.locations.length > 1 ? (
          <span className="inline-flex h-7 items-center gap-1 rounded-md border-2 border-dashed border-ink bg-white/55 px-2 text-[0.75rem] font-bold tabular-nums">
            <HugeiconsIcon icon={Store01Icon} className="size-3.5" strokeWidth={2.2} />
            {company.locations.length} sucursales
          </span>
        ) : null}
      </span>

      <span className="mt-2.5 block font-display text-[1.35rem] leading-[1.1] font-extrabold tracking-[-0.03em] sm:text-[1.5rem]">
        {job.title}
      </span>
      <span className="mt-1 line-clamp-2 text-[0.95rem] leading-snug text-muted-foreground">{companyLabel(job)}</span>

      <span className="mt-4 flex flex-wrap items-end justify-between gap-x-3 gap-y-2">
        <span className="font-display text-[1.9rem] leading-none font-extrabold tracking-[-0.04em] tabular-nums">
          {formatPay(job)}
        </span>
      </span>

      <span className="mt-3 flex flex-wrap items-center gap-2 text-[0.85rem]">
        <span className="inline-flex h-8 items-center gap-1.5 rounded-full bg-ink px-3 font-semibold text-white tabular-nums">
          <span aria-hidden className="size-2 rounded-full" style={{ background: bandColor(band) }} />
          {formatKm(job.km)}
        </span>
        <span className="inline-flex h-8 items-center gap-1.5 rounded-full bg-white/60 px-3 font-medium">
          <HugeiconsIcon icon={Clock01Icon} className="size-4" strokeWidth={1.8} />
          {job.shift}
        </span>
        <span className="hidden h-8 items-center rounded-full bg-white/60 px-3 font-medium min-[420px]:inline-flex">
          {formatMinutesAgo(job.postedMinutesAgo)}
        </span>
      </span>

      <span
        aria-hidden
        className="absolute right-4 bottom-4 grid size-11 place-items-center rounded-full bg-ink text-white transition-transform duration-200 ease-[var(--ease-spring)] group-hover:translate-x-1 group-hover:-rotate-12"
      >
        <HugeiconsIcon icon={ArrowRight01Icon} className="size-5" strokeWidth={2.2} />
      </span>
    </Link>
  );
}

/* ------------------------------------------------------------------ screen */

export function JobSearch() {
  const radiusKm = useApp((s) => s.radiusKm);
  const setRadius = useApp((s) => s.setRadius);
  const jobs = useJobsByDistance();
  const catalog = useCatalog();
  const { companyById, branchById } = catalog;
  const loading = catalog.status === "loading";
  const live = catalog.source === "live";

  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [category, setCategory] = useState<CategoryId | null>(null);
  const [shift, setShift] = useState<Shift | null>(null);
  const [type, setType] = useState<EmploymentType | null>(null);
  const [minPay, setMinPay] = useState(0);

  const q = deferredQuery.trim().toLowerCase();
  const results = jobs.filter((j) => {
    if (j.km > radiusKm) return false;
    if (category && j.category !== category) return false;
    if (shift && j.shift !== shift) return false;
    if (type && j.type !== type) return false;
    if (minPay && weeklyPay(j) < minPay) return false;
    if (q) {
      const branch = branchById[j.branchId];
      const haystack = [j.title, companyById[j.companyId]?.name, branch?.name, branch?.colonia ?? j.colonia]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
  const tones = cardTones(results, "lila");

  const activeFilters = [category, shift, type, minPay || null, q || null].filter(Boolean).length;
  const nextRadius = RADIUS_STOPS[Math.min(RADIUS_STOPS.length - 1, RADIUS_STOPS.indexOf(radiusKm) + 1)];

  function clearFilters() {
    setQuery("");
    setCategory(null);
    setShift(null);
    setType(null);
    setMinPay(0);
  }

  const filterGroups = (
    <>
        <FilterGroup label="Turno">
        <div className="flex flex-wrap gap-2">
          {SHIFTS.map((s) => (
            <BlockChip key={s} active={shift === s} onClick={() => setShift(shift === s ? null : s)}>
              {s}
            </BlockChip>
          ))}
        </div>
      </FilterGroup>

      <FilterGroup label="Jornada">
        <div className="flex flex-wrap gap-2">
          {TYPES.map((t) => (
            <BlockChip key={t} active={type === t} onClick={() => setType(type === t ? null : t)}>
              {t}
            </BlockChip>
          ))}
        </div>
      </FilterGroup>

      <FilterGroup label="Sueldo mínimo por semana">
        <div className="flex flex-wrap gap-2">
          {MIN_PAY.map((p) => (
            <BlockChip key={p} active={minPay === p} onClick={() => setMinPay(p)}>
              {p === 0 ? "Cualquiera" : `${formatMXN(p)}+`}
            </BlockChip>
          ))}
        </div>
      </FilterGroup>

      {activeFilters > 0 ? (
        <Button
          variant="white"
          size="lg"
          onClick={clearFilters}
          className="w-full border-2 border-ink text-ink"
        >
          <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
          Limpiar filtros ({activeFilters})
        </Button>
      ) : null}
    </>
  );

  return (
    <div className="grid gap-5 lg:grid-cols-12 lg:items-start">
      <PickHomeBanner className="lg:col-span-12" />
      {/* ---------------------------------------------------------- hero: search + radius */}
      <section
        className={cn("relative isolate animate-rise overflow-hidden rounded-panel border-2 border-ink p-5 pb-20 block-uva sm:p-7 sm:pb-20 lg:col-span-12", HARD)}
        aria-labelledby="buscar-hero"
      >
        {/* rugged doodles: bolts, zigzags, arrows — no cute stuff */}
        <span aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <Doodle name="rayo" color="var(--block-sol)" className="absolute top-[29%] right-6 size-8 rotate-12 sm:top-6 sm:right-[42%]" />
          <Doodle name="zigzag" color="var(--block-mandarina)" className="absolute top-[52%] right-[30%] hidden size-9 -rotate-12 sm:block" />
          <Doodle name="flecha" color="var(--limon)" className="absolute top-[30%] left-[58%] hidden size-9 rotate-[20deg] lg:block" />
          <Doodle name="estrella" color="var(--block-cielo)" className="absolute top-[38%] right-[24%] hidden size-6 lg:block" />
        </span>
        <span aria-hidden className="pointer-events-none absolute -top-16 -left-16 -z-10 size-56 rounded-full bg-dots text-white/10" />
        <div
          aria-hidden
          className="pointer-events-none absolute right-2 bottom-10 -z-10 hidden animate-float sm:block lg:right-10 lg:bottom-8"
        >
          <MyMascot mood="piensa" prop="lupa" size={150} className="lg:hidden" />
          <MyMascot mood="piensa" prop="lupa" size={190} className="hidden lg:block" />
        </div>
        <div aria-hidden className="pointer-events-none absolute top-3 right-3 animate-float sm:hidden">
          <MyMascot mood="piensa" prop="lupa" size={92} />
        </div>

        <div className="max-w-2xl">
          <p className="inline-flex items-center gap-2 text-[0.75rem] font-bold tracking-[0.16em] text-limon uppercase">
            <span aria-hidden className="h-3 w-6 rounded-[3px] bg-block-sol" style={HAZARD} />
            ¡Chamba a la vista!
          </p>
          <h2 id="buscar-hero" className="mt-2 pr-24 font-display text-[2.05rem] leading-[1.02] font-extrabold tracking-[-0.04em] sm:pr-0 sm:text-[2.6rem]">
            {loading ? (
              <InkSkeleton className="inline-block h-[1.6rem] w-12 bg-white/25! align-middle sm:h-8" />
            ) : (
              <CountUp value={results.length} className="text-limon" />
            )}{" "}
            {results.length === 1 ? "vacante" : "vacantes"} a menos de{" "}
            <span className="whitespace-nowrap">{radiusKm} km</span>
          </h2>

          {/* Search */}
          <label className="mt-5 flex h-14 items-center gap-3 rounded-full border-2 border-ink bg-white px-5 text-ink shadow-[4px_4px_0_0_var(--ink)] focus-within:ring-4 focus-within:ring-limon sm:max-w-xl">
            <HugeiconsIcon icon={Search01Icon} className="size-5 shrink-0" strokeWidth={2} />
            <span className="sr-only">Buscar por puesto, empresa, sucursal o colonia</span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Puesto, empresa o colonia…"
              autoComplete="off"
              enterKeyHint="search"
              className="h-full min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-ink/55"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Borrar búsqueda"
                className="press -mr-2 grid size-10 place-items-center rounded-full bg-ink/8 outline-none hover:bg-ink/15 focus-visible:ring-3 focus-visible:ring-ring/60"
              >
                <HugeiconsIcon icon={Cancel01Icon} className="size-4" strokeWidth={2} />
              </button>
            ) : null}
          </label>

          {/* Radius: translucent pills, current = white */}
          <fieldset className="mt-5 sm:max-w-xl">
            <legend className="mb-2 flex items-center gap-1.5 text-sm text-primary-foreground/80">
              <HugeiconsIcon icon={MapsLocation01Icon} className="size-4" strokeWidth={1.8} />
              Distancia desde tu casa
            </legend>
            <div className="grid grid-cols-4 gap-1.5 rounded-full bg-white/12 p-1.5">
              {RADIUS_STOPS.map((s) => {
                const on = s === radiusKm;
                return (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setRadius(s)}
                    className={cn(
                      "press relative h-11 rounded-full text-[0.95rem] font-semibold tabular-nums outline-none focus-visible:ring-3 focus-visible:ring-limon",
                      on ? "text-ink" : "text-primary-foreground/85 hover:bg-white/10",
                    )}
                  >
                    {on ? (
                      <motion.span
                        layoutId="radius-pill"
                        transition={springs.snappy}
                        className="absolute inset-0 rounded-full bg-limon shadow-[0_0_0_2px_var(--ink)]"
                      />
                    ) : null}
                    <span className="relative">{s} km</span>
                  </button>
                );
              })}
            </div>
          </fieldset>
        </div>

        {/* hazard tape band slapped across the bottom */}
        <div aria-hidden className="absolute inset-x-[-1rem] bottom-4 -rotate-2 border-y-2 border-ink bg-block-sol text-ink">
          <Marquee
            speed={30}
            className="py-2 font-display text-[0.95rem] font-extrabold tracking-[0.06em] uppercase"
            items={TAPE.map((t) => (
              <span key={t} className="inline-flex items-center gap-6">
                {t}
                <span className="inline-block h-3 w-8 rounded-[3px] bg-block-sol" style={HAZARD} />
              </span>
            ))}
          />
        </div>
      </section>

      {/* ---------------------------------------------------------- topics */}
      <section aria-labelledby="temas" className="min-w-0 lg:col-span-12">
        <div className="mb-1 flex items-baseline justify-between gap-3">
          <h2 id="temas" className="font-display text-[1.45rem] font-extrabold tracking-[-0.03em]">
            ¿De qué le sabes?
          </h2>
          <span className="hidden text-sm text-muted-foreground sm:inline">Elige un tipo de chamba</span>
        </div>
        <div className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 pt-2 pb-2 sm:-mx-6 sm:px-6 lg:mx-0 lg:justify-between lg:gap-1 lg:overflow-visible lg:px-0">
          <TopicBubble active={category === null} onClick={() => setCategory(null)} label="Todas" index={0}>
            <span className="grid size-full place-items-center rounded-full border-2 border-ink bg-block-sol text-ink">
              <HugeiconsIcon icon={ToolsIcon} className="size-8" strokeWidth={2} />
            </span>
          </TopicBubble>
          {CATEGORIES.map((c, i) => (
            <TopicBubble
              key={c.id}
              active={category === c.id}
              onClick={() => setCategory(category === c.id ? null : c.id)}
              label={c.label}
              index={i + 1}
            >
              <CategoryIcon
                category={c.id}
                size="lg"
                animated={category === c.id}
                className="size-full! rounded-full!"
              />
            </TopicBubble>
          ))}
        </div>
      </section>

      {/* ---------------------------------------------------------- filters: drawer on mobile */}
      <div className="-mt-1 flex items-center gap-2 lg:hidden">
        <Drawer>
          <DrawerTrigger asChild>
            <button
              type="button"
              className="press inline-flex h-12 shrink-0 items-center gap-2 rounded-full border-2 border-ink bg-block-sol px-4 font-semibold text-ink shadow-[3px_3px_0_0_var(--ink)] outline-none focus-visible:ring-3 focus-visible:ring-ring/60 dark:border-transparent dark:shadow-[3px_3px_0_0_var(--limon)]"
            >
              <HugeiconsIcon icon={FilterHorizontalIcon} className="size-5" strokeWidth={2} />
              Filtros
              {activeFilters > 0 ? (
                <span className="grid h-6 min-w-6 place-items-center rounded-full bg-ink px-1.5 text-[0.8rem] text-white tabular-nums">
                  {activeFilters}
                </span>
              ) : null}
            </button>
          </DrawerTrigger>
          <DrawerContent className="block-sol border-0">
            <div className="relative overflow-y-auto px-5 pt-2 pb-8">
              <DrawerHeader className="px-0 text-left">
                <DrawerTitle className="font-display text-[1.6rem] font-extrabold tracking-[-0.03em]">Afina tu búsqueda</DrawerTitle>
                <DrawerDescription className="text-muted-foreground">
                  <CountUp value={results.length} /> {results.length === 1 ? "vacante" : "vacantes"} con estos filtros
                </DrawerDescription>
              </DrawerHeader>
              <div className="space-y-6">{filterGroups}</div>
              <DrawerClose asChild>
                <Button size="xl" className="mt-6 w-full">
                  ¡Ándale, ver {results.length}!
                </Button>
              </DrawerClose>
            </div>
          </DrawerContent>
        </Drawer>
        <p className="min-w-0 truncate text-sm text-muted-foreground">
          {[shift, type, minPay ? `${formatMXN(minPay)}+` : null].filter(Boolean).join(" · ") || "Turno, jornada y sueldo"}
        </p>
      </div>

      <Panel tone="cielo" className="relative hidden space-y-6 overflow-hidden border-2 border-ink lg:sticky lg:top-6 lg:col-span-4 lg:block">
        <span aria-hidden className="pointer-events-none absolute -top-2 -right-2 rotate-12">
          <Doodle name="rayo" color="var(--block-sol)" className="size-14" />
        </span>
        <header className="flex items-center gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-ink text-white">
            <HugeiconsIcon icon={FilterHorizontalIcon} className="size-5" strokeWidth={1.8} />
          </span>
          <h2 className="font-display text-[1.35rem] leading-tight font-extrabold tracking-[-0.03em]">Afina tu búsqueda</h2>
        </header>
        {filterGroups}
      </Panel>

      {/* ---------------------------------------------------------- results */}
      <section aria-labelledby="resultados" className="min-w-0 lg:col-span-8">
        <div className="mb-3 flex items-end justify-between gap-3">
          <h2 id="resultados" className="flex items-center gap-2 font-display text-[1.45rem] leading-tight font-extrabold tracking-[-0.03em]">
            {category ? CATEGORY_BY_ID[category].label : "Cerquita de ti"}
            <span className="grid h-7 min-w-7 -rotate-3 place-items-center rounded-md bg-ink px-2 font-sans text-[0.85rem] font-bold tracking-normal text-limon tabular-nums dark:bg-limon dark:text-ink">
              {loading ? "…" : results.length}
            </span>
          </h2>
          <span className="shrink-0 text-sm text-muted-foreground">Más cerca primero</span>
        </div>

        <StaleNote className="mb-2" />
        {loading ? (
          <>
            <LoadingNote />
            <JobCardSkeletons count={4} tall />
          </>
        ) : catalog.status === "error" ? (
          <CatalogErrorPanel error={catalog.error} />
        ) : results.length === 0 && live && activeFilters === 0 ? (
          <LiveEmptyNearby radiusKm={radiusKm} onWiden={(r) => void setRadius(r)} />
        ) : results.length === 0 ? (
          <Panel tone="cielo" className="animate-pop-in overflow-hidden text-center">
            <MyScene name="vacio" className="mx-auto w-full max-w-[18rem]" />
            <h3 className="mt-3 font-display text-[1.6rem] leading-tight font-extrabold tracking-[-0.03em]">
              ¡Uy! Aquí no hay chamba… todavía
            </h3>
            <p className="mx-auto mt-1.5 max-w-sm text-muted-foreground">
              {radiusKm < 15 ? "Amplía tu radio o quita algún filtro para ver más." : "Quita algún filtro para ver más."}
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {radiusKm < 15 ? (
                <Button size="lg" onClick={() => setRadius(nextRadius)}>
                  Buscar a {nextRadius} km
                </Button>
              ) : null}
              {activeFilters > 0 ? (
                <Button variant="white" size="lg" onClick={clearFilters}>
                  Quitar filtros
                </Button>
              ) : null}
            </div>
          </Panel>
        ) : (
          <ul className="grid grid-cols-1 gap-3.5">
            {results.map((j, i) => (
              <li key={j.id} className="min-w-0 animate-rise [--rise:22px]" style={{ "--i": Math.min(i, 8) } as CSSVars}>
                <JobBlockCard job={j} company={companyById[j.companyId]} tone={tones[i]} index={i} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

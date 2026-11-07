"use client";

import { useId, useState } from "react";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import {
  Briefcase01Icon,
  CheckmarkBadge01Icon,
  Clock01Icon,
  FlashIcon,
  Location01Icon,
  Certificate01Icon,
  FilterIcon,
  SortByDown02Icon,
} from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { Scene } from "@/components/chamba/art/scenes";
import { HARD_SM, INK_BUTTON, OUTLINE } from "@/components/empresa/workwear";
import type { ApplicantProfile } from "@/lib/live/applicant-profiles";
import { cn } from "@/lib/utils";

/*
 * Ordering + quick filters above an applicant list. `useApplicantControls(list)` keeps the state and
 * returns the visible list; <ApplicantToolbar/> renders the controls; <ApplicantFilterEmpty/> is the
 * "nobody matches" state.
 */

export type ApplicantSort = "completos" | "cercanos" | "recientes";
export type ApplicantFilter = "licencia" | "experiencia" | "disponible";

const SORTS: {
  id: ApplicantSort;
  label: string;
  short: string;
  icon: IconSvgElement;
}[] = [
  {
    id: "completos",
    label: "Más completos primero",
    short: "Más completos",
    icon: CheckmarkBadge01Icon,
  },
  {
    id: "cercanos",
    label: "Más cercanos primero",
    short: "Más cercanos",
    icon: Location01Icon,
  },
  {
    id: "recientes",
    label: "Más recientes primero",
    short: "Más recientes",
    icon: Clock01Icon,
  },
];

const FILTERS: {
  id: ApplicantFilter;
  label: string;
  hint: string;
  icon: IconSvgElement;
}[] = [
  {
    id: "licencia",
    label: "Con licencia",
    hint: "Con licencias o certificados",
    icon: Certificate01Icon,
  },
  {
    id: "experiencia",
    label: "Con experiencia",
    hint: "Con experiencia laboral",
    icon: Briefcase01Icon,
  },
  {
    id: "disponible",
    label: "Disponible ya",
    hint: "Pueden empezar de inmediato",
    icon: FlashIcon,
  },
];

const MATCH: Record<ApplicantFilter, (a: ApplicantProfile) => boolean> = {
  licencia: (a) => a.details.certifications.length > 0,
  experiencia: (a) => a.experiences.length > 0 || a.experience !== "Sin experiencia",
  disponible: (a) => a.details.availableFrom === "inmediata",
};

const byKm = (a: ApplicantProfile, b: ApplicantProfile) => (a.km ?? Infinity) - (b.km ?? Infinity);

export function sortApplicants(list: readonly ApplicantProfile[], sort: ApplicantSort): ApplicantProfile[] {
  if (sort === "cercanos") return list.toSorted((a, b) => byKm(a, b) || a.minutesAgo - b.minutesAgo);
  if (sort === "recientes") return list.toSorted((a, b) => a.minutesAgo - b.minutesAgo || byKm(a, b));
  return list.toSorted((a, b) => (b.strength ?? -1) - (a.strength ?? -1) || byKm(a, b) || a.minutesAgo - b.minutesAgo);
}

export type ApplicantControls = {
  sort: ApplicantSort;
  setSort: (s: ApplicantSort) => void;
  filters: ApplicantFilter[];
  toggle: (f: ApplicantFilter) => void;
  clear: () => void;
  counts: Record<ApplicantFilter, number>;
  /** Filtered + sorted. */
  visible: ApplicantProfile[];
  total: number;
  /** Strength is known for at least one applicant (otherwise "Más completos" is hidden). */
  hasStrength: boolean;
};

/** "Más completos primero" is the default once there are ≥ 3 applicants; nearest first otherwise. */
export function useApplicantControls(list: readonly ApplicantProfile[]): ApplicantControls {
  const [picked, setSort] = useState<ApplicantSort | null>(null);
  const [filters, setFilters] = useState<ApplicantFilter[]>([]);
  const hasStrength = list.some((a) => a.strength !== null);
  const fallback: ApplicantSort = list.length >= 3 && hasStrength ? "completos" : "cercanos";
  const sort = picked === "completos" && !hasStrength ? fallback : (picked ?? fallback);
  const counts = {
    licencia: list.filter(MATCH.licencia).length,
    experiencia: list.filter(MATCH.experiencia).length,
    disponible: list.filter(MATCH.disponible).length,
  };
  const visible = sortApplicants(
    list.filter((a) => filters.every((f) => MATCH[f](a))),
    sort,
  );
  return {
    sort,
    setSort,
    filters,
    toggle: (f) => setFilters((fs) => (fs.includes(f) ? fs.filter((x) => x !== f) : [...fs, f])),
    clear: () => setFilters([]),
    counts,
    visible,
    total: list.length,
    hasStrength,
  };
}

const LABEL =
  "inline-flex shrink-0 items-center gap-1 text-[0.8rem] font-extrabold tracking-[0.1em] text-muted-foreground uppercase";

export function ApplicantToolbar({ controls, className }: { controls: ApplicantControls; className?: string }) {
  const { sort, setSort, filters, toggle, counts, hasStrength } = controls;
  const sorts = hasStrength ? SORTS : SORTS.filter((s) => s.id !== "completos");
  const labelId = useId();
  return (
    // Container queries: the toolbar sits in a full-width section (vacancy) or a 7/12 column (candidatos).
    <div className={cn("@container space-y-2.5", className)}>
      {/* Narrow: reads as a sentence, "Ordenar: primero los más · Completos | Cercanos | Recientes". */}
      <div className="flex flex-col gap-1.5 pt-0.5 @2xl:flex-row @2xl:items-center @2xl:gap-2.5">
        <span id={labelId} className={LABEL}>
          <HugeiconsIcon icon={SortByDown02Icon} className="size-4" strokeWidth={2.2} />
          <span>
            Ordenar<span className="@lg:hidden">: primero los más</span>
          </span>
        </span>
        <div
          role="group"
          aria-labelledby={labelId}
          className={cn(
            "grid auto-cols-fr grid-flow-col gap-1 rounded-full bg-card p-1 @lg:inline-flex @lg:self-start",
            OUTLINE,
            HARD_SM,
            "dark:border-black/70",
          )}
        >
          {sorts.map((s) => {
            const on = s.id === sort;
            return (
              <button
                key={s.id}
                type="button"
                aria-pressed={on}
                aria-label={s.label}
                onClick={() => setSort(s.id)}
                className={cn(
                  "press inline-flex h-10 min-w-0 items-center justify-center gap-1.5 rounded-full px-2 text-[0.9rem] font-bold whitespace-nowrap transition-[background-color,color] outline-none focus-visible:ring-3 focus-visible:ring-ring/50 @lg:px-4",
                  on ? "bg-ink text-white dark:bg-white dark:text-ink" : "text-foreground hover:bg-tile",
                )}
              >
                <HugeiconsIcon
                  icon={s.icon}
                  className={cn("hidden size-4.5 shrink-0 @lg:block", on && "text-limon dark:text-ink")}
                  strokeWidth={2.2}
                />
                <span className="@lg:hidden">{s.short.replace(/^Más /, "").replace(/^./, (c) => c.toUpperCase())}</span>
                <span className="hidden @lg:inline">{s.short}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div
        role="group"
        aria-label="Filtros rápidos"
        className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1.5 lg:mx-0 lg:overflow-visible lg:px-0 lg:pb-0"
      >
        <span className={cn(LABEL, "h-11 pr-1")}>
          <HugeiconsIcon icon={FilterIcon} className="size-4" strokeWidth={2.2} />
          Filtrar
        </span>
        {/* Mobile: one scrolling strip. Desktop: chips wrap, aligned after the label. */}
        <div className="flex gap-2 lg:flex-wrap">
          {FILTERS.map((f) => {
            const on = filters.includes(f.id);
            return (
              <button
                key={f.id}
                type="button"
                aria-pressed={on}
                title={f.hint}
                onClick={() => toggle(f.id)}
                className={cn(
                  "press relative inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full border-2 border-ink pr-2 pl-3 text-[0.92rem] font-bold whitespace-nowrap transition-[background-color,color,translate,box-shadow] outline-none focus-visible:ring-4 focus-visible:ring-ring/50",
                  on
                    ? "bg-ink text-white shadow-[3px_3px_0_0_var(--limon)] dark:border-white/80"
                    : "bg-card text-foreground shadow-[3px_3px_0_0_var(--ink)] hover:-translate-y-0.5 dark:border-black/70 dark:shadow-[3px_3px_0_0_rgb(0_0_0/0.7)]",
                )}
              >
                <HugeiconsIcon icon={f.icon} className={cn("size-4.5", on && "text-limon")} strokeWidth={2.2} />
                {f.label}
                <span
                  className={cn(
                    "grid h-6 min-w-6 place-items-center rounded-full px-1.5 text-[0.78rem] font-extrabold tabular-nums",
                    on ? "bg-limon text-ink" : "bg-tile text-foreground",
                  )}
                >
                  {counts[f.id]}
                </span>
                <span className="sr-only"> postulantes</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** Nobody passes the quick filters. */
export function ApplicantFilterEmpty({ onClear, className }: { onClear: () => void; className?: string }) {
  return (
    <div className={cn("block-lila flex flex-col items-center rounded-panel p-6 text-center", OUTLINE, HARD_SM, className)}>
      <Scene name="vacio" className="w-44" />
      <p className="mt-2 font-display text-[1.3rem] font-extrabold">Nadie cumple esos filtros</p>
      <p className="mt-1 max-w-xs text-[0.95rem] text-muted-foreground">Quita alguno para ver a más postulantes.</p>
      <Button size="lg" className={cn("mt-4", INK_BUTTON, HARD_SM)} onClick={onClear}>
        Quitar filtros
      </Button>
    </div>
  );
}

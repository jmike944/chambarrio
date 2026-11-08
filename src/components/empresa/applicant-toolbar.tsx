"use client";

import { useId } from "react";
import { create } from "zustand";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import {
  Briefcase01Icon,
  CheckmarkBadge01Icon,
  Clock01Icon,
  FlashIcon,
  Location01Icon,
  Certificate01Icon,
  FilterIcon,
  Route01Icon,
  SortByDown02Icon,
} from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { Scene } from "@/components/chamba/art/scenes";
import { HARD_SM, INK_BUTTON, OUTLINE } from "@/components/empresa/workwear";
import { STEP_COLOR, STEP_FILTER_LABEL } from "@/components/empresa/pipeline/pipeline-kit";
import type { ApplicantProfile } from "@/lib/live/applicant-profiles";
import { onLive } from "@/lib/live/events";
import { PIPELINE_STEPS, type PipelineStep } from "@/lib/pipeline";
import { cn } from "@/lib/utils";

/*
 * Ordering + quick filters + pipeline step filter above an applicant list.
 * `useApplicantControls(list, { scope, stepOf })` keeps the state (per scope, so the vacancy list and
 * its applicant page agree on the order, and it survives going back) and returns the visible list;
 * <ApplicantToolbar/> renders the controls; <ApplicantFilterEmpty/> is the "nobody matches" state.
 */

export type ApplicantSort = "completos" | "cercanos" | "recientes" | "etapa";
export type ApplicantFilter = "licencia" | "experiencia" | "disponible";
export type StepFilter = PipelineStep | "todos";

const SORTS: {
  id: ApplicantSort;
  label: string;
  short: string;
  narrow: string;
  icon: IconSvgElement;
}[] = [
  { id: "completos", label: "Más completos primero", short: "Más completos", narrow: "Completos", icon: CheckmarkBadge01Icon },
  { id: "cercanos", label: "Más cercanos primero", short: "Más cercanos", narrow: "Cercanos", icon: Location01Icon },
  { id: "recientes", label: "Más recientes primero", short: "Más recientes", narrow: "Recientes", icon: Clock01Icon },
  { id: "etapa", label: "Por etapa: nuevos primero", short: "Por etapa", narrow: "Etapa", icon: Route01Icon },
];

const FILTERS: {
  id: ApplicantFilter;
  label: string;
  hint: string;
  icon: IconSvgElement;
}[] = [
  { id: "licencia", label: "Con licencia", hint: "Con licencias o certificados", icon: Certificate01Icon },
  { id: "experiencia", label: "Con experiencia", hint: "Con experiencia laboral", icon: Briefcase01Icon },
  { id: "disponible", label: "Disponible ya", hint: "Pueden empezar de inmediato", icon: FlashIcon },
];

const MATCH: Record<ApplicantFilter, (a: ApplicantProfile) => boolean> = {
  licencia: (a) => a.details.certifications.length > 0,
  experiencia: (a) => a.experiences.length > 0 || a.experience !== "Sin experiencia",
  disponible: (a) => a.details.availableFrom === "inmediata",
};

const STEP_ORDER: Record<PipelineStep, number> = { enviada: 0, vista: 1, entrevista: 2, contratada: 3, descartada: 4, retirada: 5 };

const byKm = (a: ApplicantProfile, b: ApplicantProfile) => (a.km ?? Infinity) - (b.km ?? Infinity);

export function sortApplicants(
  list: readonly ApplicantProfile[],
  sort: ApplicantSort,
  stepOf?: (a: ApplicantProfile) => PipelineStep | null,
): ApplicantProfile[] {
  if (sort === "cercanos") return list.toSorted((a, b) => byKm(a, b) || a.minutesAgo - b.minutesAgo);
  if (sort === "recientes") return list.toSorted((a, b) => a.minutesAgo - b.minutesAgo || byKm(a, b));
  const completos = (a: ApplicantProfile, b: ApplicantProfile) =>
    (b.strength ?? -1) - (a.strength ?? -1) || byKm(a, b) || a.minutesAgo - b.minutesAgo;
  if (sort === "etapa" && stepOf) {
    const rank = (a: ApplicantProfile) => {
      const s = stepOf(a);
      return s ? STEP_ORDER[s] : 9;
    };
    return list.toSorted((a, b) => rank(a) - rank(b) || completos(a, b));
  }
  return list.toSorted(completos);
}

// ------------------------------------------------------------------ state (per scope)

type ScopeState = { sort: ApplicantSort | null; filters: ApplicantFilter[]; step: StepFilter };
const BLANK: ScopeState = { sort: null, filters: [], step: "todos" };

type ControlsStore = {
  scopes: Record<string, ScopeState>;
  /** The order a list showed when one of its cards was opened (the applicant page's prev / next). */
  orders: Record<string, string[]>;
};

export const useControlsStore = create<ControlsStore>()(() => ({ scopes: {}, orders: {} }));

function patchScope(scope: string, patch: Partial<ScopeState>) {
  useControlsStore.setState((s) => ({ scopes: { ...s.scopes, [scope]: { ...(s.scopes[scope] ?? BLANK), ...patch } } }));
}

/** Sets a list's step filter from elsewhere (e.g. a dashboard link to "Entrevista"). */
export function setStepFilter(scope: string, step: StepFilter) {
  patchScope(scope, { step, filters: [] });
}

/** Remembers the order of the list a card was opened from. */
export function rememberOrder(jobId: string, ids: string[]) {
  useControlsStore.setState((s) => ({ orders: { ...s.orders, [jobId]: ids } }));
}

if (typeof window !== "undefined") {
  // Demo ↔ live / account switch: ids mean something else now.
  onLive("reset", () => useControlsStore.setState({ scopes: {}, orders: {} }, true));
}

export type ApplicantControls = {
  sort: ApplicantSort;
  setSort: (s: ApplicantSort) => void;
  filters: ApplicantFilter[];
  toggle: (f: ApplicantFilter) => void;
  /** Clears the quick filters and the step filter. */
  clear: () => void;
  counts: Record<ApplicantFilter, number>;
  step: StepFilter;
  setStep: (s: StepFilter) => void;
  /** Applicants per step (before the quick filters). Null when there's no pipeline info. */
  stepCounts: Record<PipelineStep, number> | null;
  /** Filtered + sorted. */
  visible: ApplicantProfile[];
  total: number;
  /** Strength is known for at least one applicant (otherwise "Más completos" is hidden). */
  hasStrength: boolean;
};

/** The default order: "más completos" from 3 applicants with a known strength, else the nearest. */
export function defaultSort(list: readonly ApplicantProfile[]): ApplicantSort {
  return list.length >= 3 && list.some((a) => a.strength !== null) ? "completos" : "cercanos";
}

/** "Más completos primero" is the default once there are ≥ 3 applicants; nearest first otherwise. */
export function useApplicantControls(
  list: readonly ApplicantProfile[],
  { scope = "default", stepOf }: { scope?: string; stepOf?: (a: ApplicantProfile) => PipelineStep | null } = {},
): ApplicantControls {
  const state = useControlsStore((s) => s.scopes[scope]) ?? BLANK;
  const hasStrength = list.some((a) => a.strength !== null);
  const fallback = defaultSort(list);
  const picked = state.sort === "etapa" && !stepOf ? null : state.sort;
  const sort = picked === "completos" && !hasStrength ? fallback : (picked ?? fallback);
  const counts = {
    licencia: list.filter(MATCH.licencia).length,
    experiencia: list.filter(MATCH.experiencia).length,
    disponible: list.filter(MATCH.disponible).length,
  };
  let stepCounts: Record<PipelineStep, number> | null = null;
  if (stepOf) {
    stepCounts = { enviada: 0, vista: 0, entrevista: 0, contratada: 0, descartada: 0, retirada: 0 };
    for (const a of list) {
      const s = stepOf(a);
      if (s) stepCounts[s]++;
    }
  }
  const step = stepOf ? state.step : "todos";
  const visible = sortApplicants(
    list.filter((a) => (step === "todos" || stepOf?.(a) === step) && state.filters.every((f) => MATCH[f](a))),
    sort,
    stepOf,
  );
  return {
    sort,
    setSort: (s) => patchScope(scope, { sort: s }),
    filters: state.filters,
    toggle: (f) => patchScope(scope, { filters: state.filters.includes(f) ? state.filters.filter((x) => x !== f) : [...state.filters, f] }),
    clear: () => patchScope(scope, { filters: [], step: "todos" }),
    counts,
    step,
    setStep: (s) => patchScope(scope, { step: s }),
    stepCounts,
    visible,
    total: list.length,
    hasStrength,
  };
}

const LABEL =
  "inline-flex shrink-0 items-center gap-1 text-[0.8rem] font-extrabold tracking-[0.1em] text-muted-foreground uppercase";

const CHIP =
  "press relative inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full border-2 border-ink pr-2 pl-3 text-[0.92rem] font-bold whitespace-nowrap transition-[background-color,color,translate,box-shadow] outline-none focus-visible:ring-4 focus-visible:ring-ring/50";
const CHIP_ON = "bg-ink text-white shadow-[3px_3px_0_0_var(--limon)] dark:border-white/80";
const CHIP_OFF =
  "bg-card text-foreground shadow-[3px_3px_0_0_var(--ink)] hover:-translate-y-0.5 dark:border-black/70 dark:shadow-[3px_3px_0_0_rgb(0_0_0/0.7)]";

function CountBadge({ n, on }: { n: number; on: boolean }) {
  return (
    <span
      className={cn(
        "grid h-6 min-w-6 place-items-center rounded-full px-1.5 text-[0.78rem] font-extrabold tabular-nums",
        on ? "bg-limon text-ink" : "bg-tile text-foreground",
      )}
    >
      {n}
    </span>
  );
}

export function ApplicantToolbar({ controls, className }: { controls: ApplicantControls; className?: string }) {
  const { sort, setSort, filters, toggle, counts, hasStrength, stepCounts, step, setStep, total } = controls;
  const sorts = SORTS.filter((s) => (s.id !== "completos" || hasStrength) && (s.id !== "etapa" || stepCounts));
  const labelId = useId();
  const steps = stepCounts ? PIPELINE_STEPS.filter((s) => s.key !== "retirada" || stepCounts.retirada > 0 || step === "retirada") : [];
  return (
    // Container queries: the toolbar sits in a full-width section (vacancy) or a 7/12 column (candidatos).
    <div className={cn("@container space-y-2.5", className)}>
      {/* Pipeline steps: one scrolling strip on phones, wrapping chips on desktop. */}
      {stepCounts ? (
        <div
          role="group"
          aria-label="Etapa de la postulación"
          className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pt-1 pb-1.5 lg:mx-0 lg:flex-wrap lg:gap-1.5 lg:overflow-visible lg:px-0"
        >
          {[{ key: "todos" as const, n: total }, ...steps.map((s) => ({ key: s.key, n: stepCounts[s.key] }))].map(({ key, n }) => {
            const on = step === key;
            const empty = n === 0 && !on;
            return (
              <button
                key={key}
                type="button"
                aria-pressed={on}
                aria-disabled={empty || undefined}
                onClick={() => (empty ? undefined : setStep(on && key !== "todos" ? "todos" : key))}
                className={cn(
                  CHIP,
                  "gap-1.5 pr-1.5 pl-2.5 text-[0.9rem] lg:h-10 lg:gap-1 lg:pl-2 lg:text-[0.86rem]",
                  on ? CHIP_ON : CHIP_OFF,
                  empty && "opacity-55 shadow-none! hover:translate-y-0!",
                )}
              >
                {key === "todos" ? null : (
                  <span aria-hidden className="size-3 shrink-0 rounded-full border-2 border-ink" style={{ background: STEP_COLOR[key] }} />
                )}
                {key === "todos" ? "Todos" : STEP_FILTER_LABEL[key]}
                <CountBadge n={n} on={on} />
                <span className="sr-only"> postulantes</span>
              </button>
            );
          })}
        </div>
      ) : null}

      {/* Narrow: "Ordenar · Completos | Cercanos | Recientes | Etapa". */}
      <div className="flex flex-col gap-1.5 pt-0.5 @2xl:flex-row @2xl:items-center @2xl:gap-2.5">
        <span id={labelId} className={LABEL}>
          <HugeiconsIcon icon={SortByDown02Icon} className="size-4" strokeWidth={2.2} />
          <span>Ordenar</span>
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
                  "press inline-flex h-10 min-w-0 items-center justify-center gap-1.5 rounded-full px-1.5 text-[0.86rem] font-bold whitespace-nowrap transition-[background-color,color] outline-none focus-visible:ring-3 focus-visible:ring-ring/50 @sm:px-2 @sm:text-[0.9rem] @lg:px-3 @3xl:px-4",
                  on ? "bg-ink text-white dark:bg-white dark:text-ink" : "text-foreground hover:bg-tile",
                )}
              >
                <HugeiconsIcon
                  icon={s.icon}
                  className={cn("hidden size-4.5 shrink-0 @lg:block", on && "text-limon dark:text-ink")}
                  strokeWidth={2.2}
                />
                {/* Long labels only when the toolbar is wide (vacancy page); short ones in a column. */}
                <span className="@3xl:hidden">{s.narrow}</span>
                <span className="hidden @3xl:inline">{s.short}</span>
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
                className={cn(CHIP, on ? CHIP_ON : CHIP_OFF)}
              >
                <HugeiconsIcon icon={f.icon} className={cn("size-4.5", on && "text-limon")} strokeWidth={2.2} />
                {f.label}
                <CountBadge n={counts[f.id]} on={on} />
                <span className="sr-only"> postulantes</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** Nobody passes the filters. */
export function ApplicantFilterEmpty({
  onClear,
  step = "todos",
  quick = true,
  className,
}: {
  onClear: () => void;
  /** The step filter in use, for the message. */
  step?: StepFilter;
  /** Quick filters (licencia, experiencia…) are on too. */
  quick?: boolean;
  className?: string;
}) {
  const label = step === "todos" ? null : STEP_FILTER_LABEL[step];
  return (
    <div className={cn("block-lila flex flex-col items-center rounded-panel p-6 text-center", OUTLINE, HARD_SM, className)}>
      <Scene name="vacio" className="w-44" />
      <p className="mt-2 font-display text-[1.3rem] font-extrabold">
        {label ? (quick ? `Nadie en «${label}» con esos filtros` : `Nadie en «${label}» por ahora`) : "Nadie cumple esos filtros"}
      </p>
      <p className="mt-1 max-w-xs text-[0.95rem] text-muted-foreground">
        {label ? (quick ? "Cambia de etapa o quita algún filtro para ver a más postulantes." : "Cambia de etapa para ver a los demás.") : "Quita alguno para ver a más postulantes."}
      </p>
      <Button size="lg" className={cn("mt-4", INK_BUTTON, HARD_SM)} onClick={onClear}>
        Ver a todos
      </Button>
    </div>
  );
}

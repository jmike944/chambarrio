"use client";

import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import { Cancel01Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import { BLOCK_CLASS, type BlockTone } from "@/components/chamba/primitives";
import { useApp } from "@/lib/store";
import { strengthOf, strengthTips, type StrengthInput, type StrengthKey } from "@/lib/profile-strength";
import { cn } from "@/lib/utils";
import { HARD, HARD_SM } from "../postulaciones/rugged";

/*
 * Shared pieces of the candidate profile editor (/perfil): the color-block section shell, the
 * "por qué ayuda" line, segmented / toggle controls, counters, and the live strength hook.
 */

export type CSSVars = React.CSSProperties & Record<`--${string}`, string | number>;

/** Text field on a pastel block: white, ink outline. Always ink text (the block is light in both themes). */
export const FIELD =
  "h-12 rounded-tile border-2 border-ink/30 bg-white/85 px-3.5 text-base text-ink placeholder:text-ink/45 focus-visible:border-ink focus-visible:ring-3 focus-visible:ring-ink/25 dark:bg-white/85 md:text-base";
export const AREA =
  "min-h-28 rounded-tile border-2 border-ink/30 bg-white/85 px-3.5 py-3 text-base leading-relaxed text-ink placeholder:text-ink/45 focus-visible:border-ink focus-visible:ring-3 focus-visible:ring-ink/25 dark:bg-white/85 md:text-base";
/** Solid ink action (theme-constant ink). */
export const INK_BTN =
  "press inline-flex h-12 items-center justify-center gap-2 rounded-full bg-ink px-5 text-[0.95rem] font-semibold text-white outline-none focus-visible:ring-3 focus-visible:ring-ink/50 disabled:pointer-events-none disabled:opacity-45";
/** White outlined action on a block. */
export const WHITE_BTN =
  "press inline-flex h-12 items-center justify-center gap-2 rounded-full border-2 border-ink bg-white px-4 text-[0.95rem] font-semibold text-ink outline-none hover:bg-white/85 focus-visible:ring-3 focus-visible:ring-ink/50 disabled:pointer-events-none disabled:opacity-45";
export const LABEL = "text-[0.95rem] font-semibold";
export const SUBLABEL = "mb-2 text-[0.72rem] font-extrabold tracking-[0.14em] uppercase opacity-75";

// ------------------------------------------------------------------ edits → confetti

let lastEditAt = 0;
/** Call from any user edit: confetti only celebrates crossings the user caused (not a server load). */
export function markEdited() {
  lastEditAt = Date.now();
}
export function editedRecently(ms = 6000) {
  return Date.now() - lastEditAt < ms;
}

// ------------------------------------------------------------------ strength (live, from the store)

/** What the strength meter reads from the store (stable references, so it only re-renders on change). */
export function useStrengthInput(): StrengthInput {
  const input = useApp(
    useShallow((s) => ({
      name: s.name,
      phone: s.phone,
      hasHome: s.hasHome,
      interests: s.interests,
      headline: s.headline,
      about: s.about,
      education: s.education,
      skills: s.skills,
      certifications: s.certifications,
      shifts: s.shifts,
      availableFrom: s.availableFrom,
      avatarPath: s.avatarPath,
      cvPath: s.cvPath,
      experiences: s.workExperiences.length,
    })),
  );
  return input;
}

export function useProfileStrength() {
  const input = useStrengthInput();
  return useMemo(() => ({ value: strengthOf(input), tips: strengthTips(input), input }), [input]);
}

/** Section anchor ids in this editor (tips scroll to them). */
export type SectionId =
  | "avatar"
  | "datos"
  | "intereses"
  | "zona"
  | "presentacion"
  | "experiencia"
  | "habilidades"
  | "escolaridad"
  | "disponibilidad"
  | "sueldo"
  | "idiomas"
  | "archivos";

export function sectionForTip(key: StrengthKey): SectionId {
  switch (key) {
    case "name":
    case "phone":
      return "datos";
    case "home":
      return "zona";
    case "interests":
      return "intereses";
    case "headline":
    case "about":
      return "presentacion";
    case "experience":
      return "experiencia";
    case "skills":
      return "habilidades";
    case "education":
      return "escolaridad";
    case "availability":
      return "disponibilidad";
    case "photo":
    case "cv":
      return "archivos";
  }
}

/** Scrolls a section into view, moves focus to its heading and gives its icon a wiggle. */
export function goToSection(id: SectionId) {
  const el = document.getElementById(id);
  if (!el) return;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  const heading = el.querySelector<HTMLElement>("[data-section-title]");
  heading?.focus({ preventScroll: true });
  const icon = el.querySelector<HTMLElement>("[data-section-icon]");
  if (icon && !reduce) {
    icon.classList.remove("animate-wiggle");
    void icon.offsetWidth; // restart the animation
    icon.classList.add("animate-wiggle");
    window.setTimeout(() => icon.classList.remove("animate-wiggle"), 900);
  }
}

// ------------------------------------------------------------------ section shell

/** Color block + hard ink outline + staggered rise, with an icon tile, title and optional "why" line. */
export function Block({
  tone,
  index,
  title,
  icon,
  why,
  badge,
  className,
  children,
  id,
  ...props
}: Omit<React.ComponentProps<"section">, "title"> & {
  tone: BlockTone;
  index: number;
  title: React.ReactNode;
  icon: IconSvgElement;
  /** One short line: why filling this in helps. */
  why?: React.ReactNode;
  /** Right side of the header (points, "Opcional"…). */
  badge?: React.ReactNode;
}) {
  const titleId = id ? `${id}-t` : undefined;
  return (
    <section
      id={id}
      aria-labelledby={titleId}
      className={cn(
        "relative isolate min-w-0 scroll-mt-6 animate-rise rounded-panel p-5 sm:p-6",
        BLOCK_CLASS[tone],
        HARD,
        className,
      )}
      style={{ "--i": Math.min(index, 8) } as CSSVars}
      {...props}
    >
      <header className="mb-4">
        <div className="flex items-center gap-3">
          <span
            data-section-icon
            aria-hidden
            className="grid size-10 shrink-0 -rotate-6 place-items-center rounded-xl bg-ink text-white"
          >
            <HugeiconsIcon icon={icon} className="size-5" strokeWidth={2} />
          </span>
          <h2
            id={titleId}
            data-section-title
            tabIndex={-1}
            className="min-w-0 flex-1 font-display text-[1.35rem] leading-tight font-extrabold tracking-[-0.03em] outline-none focus-visible:underline focus-visible:decoration-[3px] focus-visible:underline-offset-4"
          >
            {title}
          </h2>
          {badge ? <div className="shrink-0">{badge}</div> : null}
        </div>
        {why ? <p className="mt-2 text-[0.92rem] leading-snug text-muted-foreground">{why}</p> : null}
      </header>
      {children}
    </section>
  );
}

/**
 * "+15 %" pill (points still missing in a section) or "✓ +20" once all of it is earned.
 * `parts`: [points, earned] per strength part the section covers.
 */
export function PointsBadge({ parts }: { parts: readonly (readonly [number, boolean])[] }) {
  const total = parts.reduce((n, [p]) => n + p, 0);
  const missing = parts.reduce((n, [p, ok]) => n + (ok ? 0 : p), 0);
  const earned = missing === 0;
  const points = earned ? total : missing;
  return earned ? (
    <span className="inline-flex h-7 items-center gap-1 rounded-full bg-ink px-2.5 text-[0.75rem] font-bold text-limon">
      <HugeiconsIcon icon={Tick02Icon} className="size-3.5" strokeWidth={3} />
      <span>
        +{points}
        <span className="sr-only"> puntos sumados</span>
      </span>
    </span>
  ) : (
    <span className="inline-flex h-7 -rotate-3 items-center rounded-full border-2 border-dashed border-ink/50 bg-white/60 px-2.5 text-[0.75rem] font-bold text-ink">
      +{points}
      <span className="sr-only"> puntos si lo llenas</span>%
    </span>
  );
}

/** "38 / 80" under a text field; turns emphatic near the limit. */
export function Counter({ id, value, max }: { id?: string; value: number; max: number }) {
  const near = value >= max * 0.9;
  return (
    <span id={id} className={cn("text-[0.8rem] tabular-nums", near ? "font-bold" : "text-muted-foreground")} aria-live={near ? "polite" : "off"}>
      {value} / {max}
    </span>
  );
}

// ------------------------------------------------------------------ controls

/** Single choice as big pills (radiogroup). Tapping the chosen one again clears it when `clearable`. */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  clearable = false,
  columns = "grid-cols-2",
  className,
}: {
  label: string;
  options: readonly { value: T; label: React.ReactNode; hint?: string }[];
  value: T | null;
  onChange: (v: T | null) => void;
  clearable?: boolean;
  columns?: string;
  className?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("grid gap-2", columns, className)}>
      {options.map((o) => {
        const on = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => {
              markEdited();
              onChange(on && clearable ? null : o.value);
            }}
            className={cn(
              "press flex min-h-12 items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-center text-[0.92rem] leading-tight font-semibold outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ink/60",
              on ? cn("bg-ink text-white", HARD_SM) : "border-2 border-ink/25 bg-white/55 text-ink hover:bg-white/80",
            )}
          >
            {on ? <HugeiconsIcon icon={Tick02Icon} className="size-4 shrink-0 text-limon" strokeWidth={3} /> : null}
            <span>
              {o.label}
              {o.hint ? <span className={cn("block text-[0.75rem] font-normal", on ? "text-white/75" : "opacity-70")}>{o.hint}</span> : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Multi-select toggle chip (aria-pressed), 48px tall. */
export function ToggleChip({
  on,
  onToggle,
  icon,
  children,
  hint,
  className,
}: {
  on: boolean;
  onToggle: () => void;
  icon?: IconSvgElement;
  children: React.ReactNode;
  hint?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={() => {
        markEdited();
        onToggle();
      }}
      className={cn(
        "press relative inline-flex min-h-12 items-center gap-2 rounded-full px-4 py-1.5 text-left text-[0.92rem] leading-tight font-semibold outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ink/60",
        on ? cn("bg-ink text-white", HARD_SM) : "border-2 border-ink/25 bg-white/55 text-ink hover:bg-white/80",
        className,
      )}
    >
      {icon ? (
        <HugeiconsIcon icon={icon} className={cn("size-5 shrink-0", on && "text-limon")} strokeWidth={2} />
      ) : on ? (
        <HugeiconsIcon icon={Tick02Icon} className="size-4 shrink-0 text-limon" strokeWidth={3} />
      ) : null}
      <span>
        {children}
        {hint ? <span className={cn("block text-[0.75rem] font-normal", on ? "text-white/75" : "opacity-70")}>{hint}</span> : null}
      </span>
    </button>
  );
}

/** A removable chip (the whole chip is the remove button, ≥44px). `cert` = license look (ink + lime check). */
export function RemovableChip({ label, cert = false, onRemove }: { label: string; cert?: boolean; onRemove: () => void }) {
  return (
    <button
      type="button"
      onClick={() => {
        markEdited();
        onRemove();
      }}
      aria-label={`Quitar ${label}`}
      className={cn(
        "press group inline-flex min-h-11 max-w-full items-center gap-1.5 rounded-xl py-1.5 pr-2 pl-3 text-left text-[0.92rem] leading-tight font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ink/50",
        cert ? cn("bg-ink text-white", HARD_SM) : "border-2 border-ink bg-white text-ink",
      )}
    >
      {cert ? <span aria-hidden className="grid size-5 shrink-0 place-items-center rounded-full bg-limon text-ink">
        <HugeiconsIcon icon={Tick02Icon} className="size-3" strokeWidth={3.2} />
      </span> : null}
      <span className="min-w-0 break-words">{label}</span>
      <span
        aria-hidden
        className={cn(
          "grid size-7 shrink-0 place-items-center rounded-full transition-colors",
          cert ? "bg-white/15 group-hover:bg-white/25" : "bg-ink/8 group-hover:bg-ink/15",
        )}
      >
        <HugeiconsIcon icon={Cancel01Icon} className="size-3.5" strokeWidth={2.6} />
      </span>
    </button>
  );
}

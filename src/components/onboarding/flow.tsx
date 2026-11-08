"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import { ArrowLeft01Icon, ArrowRight02Icon, Cancel01Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { ChambarrioLogo, ChambarrioMark } from "@/components/brand/chambarrio-logo";
import { StageBars, springs } from "@/components/chamba/motion";
import { BLOCK_CLASS, type BlockTone } from "@/components/chamba/primitives";
import { Scene, SCENE_RATIO, type SceneName } from "@/components/chamba/art/scenes";
import { Mascot, type MascotProps } from "@/components/chamba/art/mascot";
import { Doodle, Marquee, type DoodleName } from "@/components/chamba/art/doodles";
import { cn } from "@/lib/utils";

/*
 * Onboarding "work levels" — bold, rugged, blue-collar playful:
 * every step is a saturated hero block (uva / mandarina, alternating) with a cartoon scene,
 * a stencil step number, hazard tape and rising stage bars. Answers below are pastel slabs
 * with thick ink outlines and a hard offset ink shadow that you "stamp" down when you tap.
 * Motion is transform/opacity only.
 */

export type CSSVars = React.CSSProperties & Record<`--${string}`, string | number>;

export const focusRing = "outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

/** Pastels for answer blocks — workwear palette (no bubblegum pink, lavender sparingly). */
export const PASTELS = ["sol", "cielo", "limon", "durazno", "menta", "lila"] as const satisfies readonly BlockTone[];
export type Pastel = (typeof PASTELS)[number];
/** 5-tone cycle for grids: no repeats on rows or columns at 3 or 4 columns. */
const GRID_TONES = ["sol", "cielo", "limon", "durazno", "menta"] as const satisfies readonly Pastel[];
export const gridTone = (i: number): Pastel => GRID_TONES[((i % 5) + 5) % 5];
export const pastel = (i: number): Pastel => PASTELS[((i % PASTELS.length) + PASTELS.length) % PASTELS.length];

/** Caution-tape stripes (ink + safety yellow). Static background. */
export const HAZARD = "bg-[repeating-linear-gradient(-45deg,var(--ink)_0_9px,var(--block-sol)_9px_18px)]";

/** Stencil-style two-digit number ("02"). */
export const stencil = (n: number) => String(n).padStart(2, "0");

/** Workwear confetti: safety yellow, lime, orange, sky, ink, white, violet (no pink). */
export const WORK_CONFETTI = ["#FFE27A", "#DDF78A", "#FF6B2C", "#5CB8FF", "#160F33", "#FFFFFF", "#4318E0"];

export type HeroTone = "uva" | "mandarina";

/** Cartoon for the hero: a named Scene or Chambita the worker. */
export type HeroArt = { scene: SceneName } | { mascot: Omit<MascotProps, "size" | "className"> };

function HeroArtwork({ art }: { art: HeroArt }) {
  if ("scene" in art) {
    const ratio = SCENE_RATIO[art.scene];
    return (
      <Scene
        name={art.scene}
        className={cn(
          "lg:mx-auto lg:block",
          // Desktop sizes are capped by viewport height too, so short laptop screens keep the slogan band visible.
          ratio >= 2.5
            ? "w-full lg:w-[min(36rem,100%)]"
            : ratio >= 1.5
              ? "w-44 sm:w-52 lg:w-[min(34rem,100%,76dvh)]"
              : "w-36 sm:w-40 lg:w-[min(24rem,86%,38dvh)]",
        )}
      />
    );
  }
  return (
    <>
      <Mascot {...art.mascot} size={124} className="lg:hidden" />
      <Mascot {...art.mascot} size={250} className="hidden lg:mx-auto lg:block" />
    </>
  );
}

/* ------------------------------------------------------------------ chunky slab */

/**
 * Hard offset shadow as its own layer, so pressing only moves the face (transform-only):
 * idle = 4px ink shadow, hover = face lifts, active = face stamps down onto the shadow,
 * selected = the shadow turns into caution tape.
 */
export function SlabShadow({ on, className }: { on?: boolean; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0 translate-x-[5px] translate-y-[5px] rounded-[inherit]",
        on ? HAZARD : "bg-ink dark:bg-black/80",
        className,
      )}
    />
  );
}

/** Classes for the moving face that sits on a SlabShadow. */
export const slabFace = (on?: boolean) =>
  cn(
    "relative border-[3px] border-ink transition-[translate] duration-150 ease-out",
    "active:translate-x-[4px] active:translate-y-[4px]",
    on
      ? "-translate-x-[3px] -translate-y-[3px]"
      : "[@media(hover:hover)]:hover:-translate-x-[2px] [@media(hover:hover)]:hover:-translate-y-[2px]",
  );

/* ------------------------------------------------------------------ decoration */

const DOODLES: DoodleName[] = ["rayo", "zigzag", "chispa", "flecha", "circulo", "garabato", "rayo", "chispa"];
// Kept to the edges (right side + top strip) so they never sit on the heading.
const SPOTS = [
  [70, 5, -14],
  [90, 30, 18],
  [94, 62, 10],
  [56, 3, -8],
  [84, 90, 24],
  [40, 2, 30],
  [97, 10, -20],
  [62, 94, 12],
] as const;

/** Workwear doodles (bolts, sparks, arrows, zigzags) — no hearts or cutesy stars. */
export function WorkDoodles({
  tone,
  seed = 0,
  count = 6,
  className,
}: {
  tone: HeroTone;
  seed?: number;
  count?: number;
  className?: string;
}) {
  const palette =
    tone === "uva" ? ["var(--block-sol)", "var(--limon)", "#ffffff"] : ["var(--ink)", "#ffffff", "var(--block-sol)"];
  return (
    <span aria-hidden className={cn("pointer-events-none absolute inset-0 -z-10 overflow-hidden", className)}>
      {Array.from({ length: count }, (_, i) => {
        const [x, y, r] = SPOTS[(i + seed) % SPOTS.length];
        return (
          <span key={i} className="absolute" style={{ left: `${x}%`, top: `${y}%`, rotate: `${r}deg` }}>
            <Doodle
              name={DOODLES[(i + seed) % DOODLES.length]}
              color={palette[i % palette.length]}
              className="size-7 lg:size-9"
            />
          </span>
        );
      })}
    </span>
  );
}

/** Steel rivets for the corners of a plate. */
function Rivets({ className }: { className?: string }) {
  const dot = "absolute size-3 rounded-full bg-black/25 shadow-[inset_-1px_-1px_0_rgb(255_255_255/0.35)]";
  return (
    <span aria-hidden className={cn("pointer-events-none absolute inset-4 hidden lg:block", className)}>
      <span className={cn(dot, "top-0 left-0")} />
      <span className={cn(dot, "top-0 right-0")} />
      <span className={cn(dot, "bottom-0 left-0")} />
      <span className={cn(dot, "right-0 bottom-0")} />
    </span>
  );
}

/* ------------------------------------------------------------------ buttons */

/** Sticky footer for the primary action (fades the canvas behind it; no backdrop blur). */
export function StickyFooter({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "sticky bottom-0 z-20 -mx-4 mt-auto space-y-3 bg-linear-to-t from-background from-70% to-transparent px-4 pt-8 pb-[max(1rem,env(safe-area-inset-bottom))] sm:-mx-6 sm:px-6 lg:static lg:mx-0 lg:bg-none lg:px-0 lg:pt-8",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Chunky violet CTA: ink outline, hard ink shadow, stamps down on tap, arrow nudges on hover. */
export function PrimaryButton({
  className,
  children,
  arrow = true,
  ...props
}: React.ComponentProps<typeof Button> & { arrow?: boolean }) {
  return (
    <span className="group/cta relative block rounded-full">
      {props.disabled ? null : <SlabShadow className="translate-y-[6px] translate-x-0" />}
      <Button
        size="xl"
        className={cn(
          "relative h-15 w-full border-[3px] border-ink text-[1.15rem] font-extrabold tracking-[-0.01em] shadow-none font-display",
          "transition-[translate,background-color,opacity] hover:translate-y-[-2px] active:translate-y-[6px] active:scale-100",
          "disabled:border-ink/40 disabled:opacity-45 dark:border-black",
          className,
        )}
        {...props}
      >
        {children}
        {arrow ? (
          <HugeiconsIcon
            icon={ArrowRight02Icon}
            className="size-6 transition-[translate] duration-200 group-hover/cta:translate-x-1"
            strokeWidth={2.6}
          />
        ) : null}
      </Button>
    </span>
  );
}

export function SecondaryButton({ className, ...props }: React.ComponentProps<typeof Button>) {
  return (
    <span className="relative block rounded-full">
      <SlabShadow className="translate-x-0 translate-y-[4px]" />
      <Button
        variant="white"
        size="xl"
        className={cn(
          "relative w-full border-[3px] border-ink bg-white text-base font-bold text-ink shadow-none hover:translate-y-[-2px] active:translate-y-[4px] active:scale-100 dark:border-black",
          className,
        )}
        {...props}
      />
    </span>
  );
}

/* ------------------------------------------------------------------ marquee band */

const MARQUEE = [
  "¡Chamba cerca!",
  "Sin currículum",
  "Gratis para ti",
  "Postúlate en un toque",
  "Cerca de tu casa",
  "¡Ándale!",
];

/** Tilted caution-tape band of scrolling slogans (decorative). */
export function SloganBand({ className, items = MARQUEE }: { className?: string; items?: string[] }) {
  return (
    <div
      aria-hidden
      className={cn("relative z-10 -mx-6 -rotate-2 border-y-[3px] border-ink bg-block-sol text-ink", className)}
    >
      <span className={cn("absolute inset-x-0 -top-[3px] h-2", HAZARD)} />
      <Marquee
        speed={22}
        className="py-2.5 font-display text-[1.05rem] font-extrabold tracking-[0.02em] uppercase"
        items={items.map((m) => (
          <span key={m} className="inline-flex items-center gap-4">
            {m}
            <span className="inline-block size-2.5 rotate-45 bg-ink" />
          </span>
        ))}
      />
      <span className={cn("absolute inset-x-0 -bottom-[3px] h-2", HAZARD)} />
    </div>
  );
}

/* ------------------------------------------------------------------ shell */

export function FlowShell({
  step,
  total,
  title,
  hint,
  aside,
  onBack,
  footer,
  tone = "uva",
  art,
  band = false,
  stepKey,
  children,
}: {
  /** zero-based; pass undefined to hide progress (e.g. done screen) */
  step?: number;
  total?: number;
  title: string;
  hint?: React.ReactNode;
  /** supporting line shown in the desktop hero */
  aside: string;
  onBack?: () => void;
  footer?: React.ReactNode;
  /** Saturated hero block for this step (alternate per step). */
  tone?: HeroTone;
  art?: HeroArt;
  /** Show the tilted caution-tape slogan band under the hero (welcome / done screens). */
  band?: boolean;
  /** Changes whenever the step changes (defaults to the title) → content slides in. */
  stepKey?: string | number;
  children: React.ReactNode;
}) {
  const key = stepKey ?? title;
  // "Salir" goes back to the page this visitor came from: companies to /empresas, everyone else to the landing.
  const exitHref = usePathname().startsWith("/bienvenida/empresa") ? "/empresas" : "/";
  const order = step ?? total ?? 99;
  // Slide direction follows the step number ("derive state from props" pattern, no effects).
  const [seen, setSeen] = useState({ key, order, dir: 0 });
  if (seen.key !== key) setSeen({ key, order, dir: order >= seen.order ? 1 : -1 });
  const dir = seen.dir;

  const onUva = tone === "uva";
  const showProgress = step !== undefined && !!total;
  const seed = typeof key === "number" ? key : key.length;
  // Panoramic scenes (3:1) get their own full-width row on mobile instead of the side slot.
  const panoramic = !!art && "scene" in art && SCENE_RATIO[art.scene] >= 2.5;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col overflow-x-clip lg:grid lg:grid-cols-[minmax(0,1.1fr)_minmax(0,30rem)] lg:items-start lg:gap-12 lg:px-8 lg:py-6">
      {/* ── Hero block: the "level" plate ─────────────────────────── */}
      <section
        data-tone={tone}
        aria-labelledby="flow-title"
        className={cn(
          "relative isolate flex flex-col overflow-hidden rounded-b-[2.25rem] px-4 pt-safe pb-7 sm:px-6",
          "lg:sticky lg:top-6 lg:h-[calc(100dvh-3rem)] lg:min-h-[38rem] lg:rounded-[2.5rem] lg:border-[3px] lg:border-ink lg:p-10 lg:shadow-[8px_8px_0_0_var(--ink)] dark:lg:shadow-[8px_8px_0_0_#000]",
          BLOCK_CLASS[tone],
        )}
      >
        <span aria-hidden className="pointer-events-none absolute inset-0 -z-20 bg-dots opacity-50" />
        <WorkDoodles tone={tone} seed={seed} />
        <Rivets />

        {/* stencil step number, huge and hollow */}
        {showProgress ? (
          <span
            aria-hidden
            key={`n-${key}`}
            className={cn(
              "pointer-events-none absolute -z-10 animate-rise font-display leading-none font-extrabold tracking-[-0.06em] text-transparent select-none",
              "top-14 right-2 text-[8.5rem] [-webkit-text-stroke:3px_var(--foreground)] opacity-25",
              "lg:top-[28%] lg:right-6 lg:text-[15rem] lg:[-webkit-text-stroke:4px_var(--foreground)]",
            )}
          >
            {stencil(step + 1)}
          </span>
        ) : null}

        <header className="flex h-18 shrink-0 items-center justify-between gap-3 lg:h-auto">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              className={cn(
                "press flex h-12 items-center gap-1.5 rounded-full border-[2.5px] border-current/25 bg-tile pr-5 pl-3.5 text-[0.95rem] font-bold transition-[scale,background-color] hover:bg-[color-mix(in_oklab,var(--tile),currentColor_10%)]",
                focusRing,
              )}
            >
              <HugeiconsIcon icon={ArrowLeft01Icon} className="size-5" strokeWidth={2.4} />
              Atrás
            </button>
          ) : (
            <Link href="/" className={cn("group rounded-xl", focusRing)} aria-label="Chambarrio, inicio">
              <span className="lg:hidden">
                <ChambarrioMark className="size-11 shrink-0 group-hover:animate-wiggle" />
              </span>
              <span className="hidden lg:inline-flex">
                <ChambarrioLogo iconClassName="size-10 shrink-0 group-hover:animate-wiggle" wordmarkClassName="text-[1.4rem]" />
              </span>
            </Link>
          )}
          <Link
            href={exitHref}
            aria-label="Salir"
            className={cn(
              "press flex h-12 items-center gap-1.5 rounded-full px-4 text-[0.95rem] font-bold opacity-90 transition-[opacity,scale] hover:opacity-100",
              focusRing,
            )}
          >
            Salir
            <HugeiconsIcon icon={Cancel01Icon} className="size-4.5" strokeWidth={2.4} />
          </Link>
        </header>

        {showProgress ? (
          <div className="mt-1 flex items-end gap-3 lg:mt-8">
            <StageBars
              tone="inverse"
              total={total}
              current={step + 1}
              label="Tu registro"
              className={cn("h-9 w-[min(11rem,48%)] lg:h-14 lg:w-64", !onUva && "[--limon:var(--ink)]")}
            />
            <span
              key={`paso-${step}`}
              className="animate-pop-in rounded-md border-2 border-ink bg-block-sol px-2.5 py-1 font-display text-[0.8rem] font-extrabold tracking-[0.06em] whitespace-nowrap text-ink uppercase tabular-nums shadow-[3px_3px_0_0_var(--ink)]"
            >
              Paso {step + 1} de {total}
            </span>
          </div>
        ) : null}

        <div
          className={cn(
            "relative mt-4 grid items-end gap-2 lg:mt-auto lg:flex lg:flex-col-reverse lg:items-start lg:gap-8",
            panoramic ? "grid-cols-1" : "grid-cols-[minmax(0,1fr)_auto]",
          )}
        >
          <div className="min-w-0 pb-1">
            <h1
              id="flow-title"
              key={`t-${key}`}
              className="animate-rise font-display text-[2.05rem] leading-[0.98] font-extrabold tracking-[-0.045em] text-balance [--rise:22px] sm:text-[2.4rem] lg:text-[3.6rem] lg:leading-[0.95]"
            >
              {title}
            </h1>
            {hint ? (
              <p
                key={`h-${key}`}
                className="mt-2.5 animate-rise text-[1rem] leading-snug font-medium text-muted-foreground text-pretty lg:mt-4 lg:max-w-[34ch] lg:text-[1.15rem]"
                style={{ "--i": 1 } as CSSVars}
              >
                {hint}
              </p>
            ) : null}
          </div>
          {art ? (
            <div
              key={`a-${key}`}
              className={cn(
                "animate-pop-in lg:mr-0 lg:mb-0 lg:self-center",
                panoramic ? "-mx-2 mt-2 -mb-4 lg:w-full" : "-mr-3 -mb-9 self-end lg:w-full",
              )}
              style={{ "--i": 1 } as CSSVars}
            >
              <div className="animate-float">
                <HeroArtwork art={art} />
              </div>
            </div>
          ) : null}
        </div>

        <p className="block-on-pastel mt-8 hidden max-w-[24ch] -rotate-1 self-start rounded-xl border-[3px] border-ink bg-white px-5 py-3.5 font-display text-[1.3rem] leading-tight font-extrabold shadow-[5px_5px_0_0_var(--ink)] lg:block">
          {aside}
        </p>

        {band ? (
          <SloganBand className="mt-8 -mb-1 lg:mt-6 lg:-mx-12" />
        ) : (
          <span aria-hidden className={cn("absolute inset-x-0 bottom-0 h-2.5 lg:h-3", HAZARD)} />
        )}
      </section>

      {/* ── Answers ───────────────────────────────────────────────── */}
      <div className="mx-auto flex w-full max-w-md min-w-0 flex-1 flex-col px-4 pt-8 sm:px-6 lg:mx-0 lg:min-h-[calc(100dvh-3rem)] lg:max-w-none lg:justify-center lg:px-0 lg:pt-0">
        <motion.div
          key={key}
          className="flex flex-1 flex-col lg:flex-none"
          initial={dir === 0 ? false : { opacity: 0, x: 48 * dir }}
          animate={{ opacity: 1, x: 0 }}
          transition={springs.soft}
        >
          {children}
          {footer ? <StickyFooter>{footer}</StickyFooter> : null}
        </motion.div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ answers */

/** "Selected" badge: ink circle with a lime tick (pops in). */
export function CheckDot({ on, className }: { on: boolean; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid size-8 shrink-0 place-items-center rounded-full border-[2.5px] transition-colors",
        on ? "animate-pop-in border-ink bg-ink text-limon" : "border-ink/35 bg-white/60",
        className,
      )}
    >
      {on ? <HugeiconsIcon icon={Tick02Icon} className="size-4.5" strokeWidth={3.2} /> : null}
    </span>
  );
}

/** Section label on the canvas: chunky, with a short caution-tape tick. */
export function FlowLabel({ children, className, id }: { children: React.ReactNode; className?: string; id?: string }) {
  return (
    <p
      id={id}
      className={cn(
        "mb-3.5 flex items-center gap-2.5 font-display text-[1.15rem] font-extrabold tracking-[-0.015em]",
        className,
      )}
    >
      <span aria-hidden className={cn("h-3.5 w-7 rounded-sm border-2 border-ink", HAZARD)} />
      {children}
    </p>
  );
}

/** Big tappable color slab for single-choice questions. Art bleeds off the right edge. */
export function ChoiceCard({
  icon,
  leading,
  art,
  title,
  description,
  selected,
  badge,
  tone = "sol",
  index = 0,
  onClick,
  className,
}: {
  icon?: IconSvgElement;
  /** Custom leading tile content (e.g. a big number or a category icon). */
  leading?: React.ReactNode;
  /** Cartoon that bleeds off the right edge. */
  art?: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  selected?: boolean;
  badge?: string;
  tone?: Pastel;
  /** Entrance stagger index. */
  index?: number;
  onClick: () => void;
  className?: string;
}) {
  return (
    <div className={cn("relative animate-rise rounded-[1.6rem]", className)} style={{ "--i": index + 1 } as CSSVars}>
      <SlabShadow on={selected} />
      <button
        type="button"
        onClick={onClick}
        aria-pressed={selected}
        className={cn(
          "group isolate flex min-h-26 w-full items-center gap-4 overflow-hidden rounded-[1.6rem] p-4 text-left sm:p-5",
          BLOCK_CLASS[tone],
          slabFace(selected),
          focusRing,
        )}
      >
        <span aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-dots opacity-40" />
        {leading || icon ? (
          <span className="grid size-16 shrink-0 place-items-center rounded-[1rem] border-[2.5px] border-ink bg-white text-ink transition-[rotate] duration-200 group-hover:-rotate-6">
            {leading ?? (icon ? <HugeiconsIcon icon={icon} className="size-8" strokeWidth={2} /> : null)}
          </span>
        ) : null}
        <span className={cn("relative z-10 min-w-0 flex-1", art && "pr-24 sm:pr-28")}>
          <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1 font-display text-[1.4rem] leading-tight font-extrabold tracking-[-0.025em]">
            {title}
            {badge ? (
              <span className="rounded-md bg-ink px-2 py-0.5 font-display text-[0.72rem] font-extrabold tracking-[0.08em] text-limon uppercase">
                {badge}
              </span>
            ) : null}
          </span>
          {description ? (
            <span className="mt-1 block text-[0.95rem] leading-snug font-medium text-muted-foreground">
              {description}
            </span>
          ) : null}
        </span>
        {art ? (
          <span
            aria-hidden
            className="pointer-events-none absolute -right-4 -bottom-5 w-32 rotate-[-6deg] transition-[rotate,scale] duration-300 group-hover:scale-110 group-hover:rotate-2 sm:w-36"
          >
            {art}
          </span>
        ) : null}
        {selected !== undefined ? (
          <CheckDot on={!!selected} className={cn("relative z-10", art && "absolute top-3 right-3")} />
        ) : null}
      </button>
    </div>
  );
}

/** Square answer tile with cartoon art on top (interests, business type). Pops when picked. */
export function ArtTile({
  pressed,
  onClick,
  art,
  tone,
  index = 0,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  art: React.ReactNode;
  tone: Pastel;
  index?: number;
  children: React.ReactNode;
}) {
  return (
    <div className="animate-rise" style={{ "--i": Math.min(index, 10) } as CSSVars}>
      <motion.div
        className="relative rounded-[1.3rem]"
        animate={{
          scale: pressed ? 1.05 : 1,
          rotate: pressed ? (index % 2 ? 2.5 : -2.5) : 0,
        }}
        transition={springs.bouncy}
      >
        <SlabShadow on={pressed} className="translate-x-[4px] translate-y-[4px]" />
        <button
          type="button"
          aria-pressed={pressed}
          onClick={onClick}
          className={cn(
            "group flex min-h-34 w-full flex-col items-center justify-end gap-1.5 overflow-hidden rounded-[1.3rem] px-1.5 pt-2 pb-2.5 text-center",
            BLOCK_CLASS[tone],
            slabFace(pressed),
            focusRing,
          )}
        >
          <span className="grid w-full flex-1 place-items-center transition-[scale,rotate] duration-200 group-hover:scale-110 group-hover:-rotate-3">
            {art}
          </span>
          <span className="font-display text-[0.84rem] leading-tight font-extrabold tracking-[-0.02em] text-balance sm:text-[0.92rem]">
            {children}
          </span>
        </button>
        <CheckDot on={pressed} className={cn("absolute -top-2.5 -right-2 z-10 size-8", !pressed && "hidden")} />
      </motion.div>
    </div>
  );
}

/** Pill toggle (secondary multi-choice). */
export function ToggleChip({
  pressed,
  onClick,
  icon,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  icon?: IconSvgElement;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        "press flex h-12 items-center gap-2 rounded-full border-[2.5px] border-ink px-4.5 text-[1rem] font-bold transition-[scale,background-color,color]",
        pressed ? "bg-ink text-limon" : "bg-white text-ink hover:bg-block-sol",
        focusRing,
      )}
    >
      {icon ? <HugeiconsIcon icon={icon} className="size-5" strokeWidth={2} /> : null}
      {children}
    </button>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  className,
}: {
  options: readonly { value: T; label: string; hint?: string }[];
  value: T | null;
  onChange: (v: T) => void;
  label: string;
  className?: string;
}) {
  return (
    <div role="group" aria-label={label} className={cn("grid grid-cols-2 gap-3.5", className)}>
      {options.map((o, i) => {
        const on = o.value === value;
        return (
          <div key={o.value} className="relative rounded-[1.1rem]">
            <SlabShadow on={on} className="translate-x-[4px] translate-y-[4px]" />
            <button
              type="button"
              aria-pressed={on}
              onClick={() => onChange(o.value)}
              className={cn(
                "flex min-h-16 w-full flex-col items-center justify-center rounded-[1.1rem] px-3 py-2 text-center font-display text-[1.1rem] leading-tight font-extrabold",
                BLOCK_CLASS[pastel(i + 1)],
                slabFace(on),
                focusRing,
              )}
            >
              {o.label}
              {o.hint ? (
                <span className="mt-0.5 font-sans text-sm font-medium text-muted-foreground">{o.hint}</span>
              ) : null}
            </button>
          </div>
        );
      })}
    </div>
  );
}

/** Pastel slab panel (non-interactive) with ink outline + hard shadow. */
export function Slab({
  tone,
  className,
  children,
  index,
  ...props
}: React.ComponentProps<"div"> & { tone: BlockTone; index?: number }) {
  return (
    <div
      className={cn(
        "relative isolate overflow-hidden rounded-[1.6rem] border-[3px] border-ink p-5 shadow-[5px_5px_0_0_var(--ink)] dark:shadow-[5px_5px_0_0_#000]",
        index !== undefined && "animate-rise",
        BLOCK_CLASS[tone],
        className,
      )}
      style={index !== undefined ? ({ "--i": index } as CSSVars) : undefined}
      {...props}
    >
      {children}
    </div>
  );
}

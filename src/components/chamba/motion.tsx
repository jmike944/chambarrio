"use client";

/**
 * Chambarrio motion kit. Small, typed, reduced-motion-safe pieces (see design-api.md).
 *
 * Rules of thumb
 * - Animate transform + opacity only (low-end Android). No animated blur/filters/size.
 * - First-paint content: prefer CSS (`animate-rise`, <Reveal>) — it runs before hydration.
 * - motion-driven pieces (<Stagger>, <CountUp>, nav pill) respect <MotionConfig reducedMotion="user">.
 */

import * as React from "react";
import { animate, motion, useReducedMotion, type HTMLMotionProps, type Transition, type Variants } from "motion/react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Tick02Icon } from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ springs */

/** Shared spring presets so motion feels the same everywhere. */
export const springs = {
  /** UI feedback: nav pill, toggles. */
  snappy: { type: "spring", stiffness: 520, damping: 38, mass: 0.9 },
  /** Entrances: cards, list items. */
  soft: { type: "spring", stiffness: 300, damping: 30, mass: 0.9 },
  /** Celebratory pops: stickers, icons. Overshoots. */
  bouncy: { type: "spring", stiffness: 480, damping: 16, mass: 0.8 },
} satisfies Record<string, Transition>;

type CSSVars = React.CSSProperties & Record<`--${string}`, string | number>;

/* ------------------------------------------------------------------ Reveal */

type RevealTag = "div" | "section" | "article" | "li" | "span" | "p" | "header" | "footer";

export type RevealProps = Omit<React.HTMLAttributes<HTMLElement>, "style"> & {
  as?: RevealTag;
  /** Stagger index: delay = index × 60ms. */
  index?: number;
  /** Animate when scrolled into view (once) instead of on mount. Needs hydration. */
  inView?: boolean;
  /** Rise distance in px (default 14). */
  y?: number;
  style?: CSSVars;
};

/**
 * Fade + rise entrance.
 * - Default (on mount): pure CSS `animate-rise`, so it plays at first paint, even before hydration.
 * - `inView`: motion `whileInView` (once), for content below the fold.
 */
export function Reveal({ as = "div", index = 0, inView = false, y = 14, className, style, children, ...rest }: RevealProps) {
  if (!inView) {
    const Tag = as as React.ElementType;
    return (
      <Tag className={cn("animate-rise", className)} style={{ "--i": index, "--rise": `${y}px`, ...style }} {...rest}>
        {children}
      </Tag>
    );
  }
  const M = motion[as] as React.ComponentType<HTMLMotionProps<"div">>;
  return (
    <M
      className={className}
      style={style}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.25 }}
      transition={{ ...springs.soft, delay: index * 0.06 }}
      {...(rest as HTMLMotionProps<"div">)}
    >
      {children}
    </M>
  );
}

/* ------------------------------------------------------------------ Stagger */

const staggerParent: Variants = {
  hidden: {},
  show: (gap: number = 0.05) => ({ transition: { staggerChildren: gap, delayChildren: 0.04 } }),
};
const staggerChild: Variants = {
  hidden: { opacity: 0, y: 16, scale: 0.98 },
  show: { opacity: 1, y: 0, scale: 1, transition: springs.soft },
};

type StaggerTag = "div" | "ul" | "ol" | "section";
type StaggerItemTag = "div" | "li" | "article" | "section";

export type StaggerProps = Omit<HTMLMotionProps<"div">, "variants" | "initial" | "animate" | "custom"> & {
  as?: StaggerTag;
  /** Seconds between children (default 0.05). */
  gap?: number;
  /** Start when scrolled into view (once) instead of on mount. */
  inView?: boolean;
};

/**
 * Staggered entrance for a list. Children must be <StaggerItem>. Items that mount later
 * (e.g. after a filter change) animate in on their own. Content is hidden until hydration,
 * so prefer CSS `animate-rise` + `--i` for the very first fold.
 */
export function Stagger({ as = "div", gap = 0.05, inView = false, ...props }: StaggerProps) {
  const M = motion[as] as React.ComponentType<HTMLMotionProps<"div">>;
  return (
    <M
      variants={staggerParent}
      custom={gap}
      initial="hidden"
      {...(inView ? { whileInView: "show", viewport: { once: true, amount: 0.15 } } : { animate: "show" })}
      {...props}
    />
  );
}

export type StaggerItemProps = Omit<HTMLMotionProps<"div">, "variants"> & { as?: StaggerItemTag };

export function StaggerItem({ as = "div", ...props }: StaggerItemProps) {
  const M = motion[as] as React.ComponentType<HTMLMotionProps<"div">>;
  return <M variants={staggerChild} {...props} />;
}

/* ------------------------------------------------------------------ Sticker */

const STICKER_VARIANT = {
  lime: "bg-limon text-ink",
  violet: "bg-primary text-primary-foreground",
  ink: "bg-ink text-limon",
  white: "bg-white text-ink",
} as const;
const STICKER_DOT = {
  lime: "bg-ink",
  violet: "bg-limon",
  ink: "bg-limon",
  white: "bg-primary",
} as const;
const STICKER_SIZE = {
  sm: "size-16 p-2 text-[0.66rem]",
  md: "size-[5.25rem] p-2.5 text-[0.74rem]",
  lg: "size-28 p-3 text-[0.86rem]",
} as const;

export type StickerProps = React.ComponentProps<"span"> & {
  variant?: keyof typeof STICKER_VARIANT;
  size?: keyof typeof STICKER_SIZE;
  /** Tilt in degrees (reference uses -12…12). Default -10. */
  rotate?: number;
  /** Small solid accent dot near the rim. */
  dot?: boolean;
  /** Gentle idle bob after popping in. Default true. */
  float?: boolean;
  /** Stagger index for the pop-in delay. */
  index?: number;
};

/**
 * Round, tilted sticker badge ("6 días", "¡Nuevo!", "A 2 km"). Pops in with a spring and
 * floats. CSS-only, so it animates at first paint. Use at most ONE per view, usually
 * absolutely positioned over a card corner: <div className="absolute -top-5 -right-2">.
 * Wrap the headline in <strong> (rendered big) and keep the rest to 2–3 short words.
 */
export function Sticker({
  variant = "lime",
  size = "md",
  rotate = -10,
  dot = false,
  float = true,
  index = 0,
  className,
  style,
  children,
  ...props
}: StickerProps) {
  return (
    <span
      data-slot="sticker"
      className={cn(
        "relative inline-grid shrink-0 place-items-center rounded-full text-center leading-[1.05] font-semibold shadow-sticker select-none",
        "[&_strong]:block [&_strong]:font-display [&_strong]:text-[1.75em] [&_strong]:leading-[0.95] [&_strong]:font-extrabold [&_strong]:tracking-[-0.03em]",
        float ? "animate-sticker" : "animate-pop-in",
        STICKER_VARIANT[variant],
        STICKER_SIZE[size],
        className,
      )}
      style={{ rotate: `${rotate}deg`, "--i": index, ...style } as CSSVars}
      {...props}
    >
      <span className="block">{children}</span>
      {dot ? (
        <span aria-hidden className={cn("absolute top-[13%] right-[15%] size-[9%] rounded-full", STICKER_DOT[variant])} />
      ) : null}
    </span>
  );
}

/* ------------------------------------------------------------------ CountUp */

const nf = (decimals: number) =>
  new Intl.NumberFormat("es-MX", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

export type CountUpProps = Omit<React.ComponentProps<"span">, "children"> & {
  value: number;
  /**
   * Start value for the first render. Omit to show `value` immediately (no mount animation,
   * no flash before hydration); pass 0 for a count-up on mount. Changes always animate.
   */
  from?: number;
  /** Seconds. Default 0.9. */
  duration?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
};

/** Animated number (tabular). Re-animates from the old to the new value whenever `value` changes. */
export function CountUp({ value, from, duration = 0.9, decimals = 0, prefix = "", suffix = "", className, ...props }: CountUpProps) {
  const ref = React.useRef<HTMLSpanElement>(null);
  const prev = React.useRef<number>(from ?? value);
  const reduce = useReducedMotion();
  const format = React.useCallback((n: number) => `${prefix}${nf(decimals).format(n)}${suffix}`, [prefix, suffix, decimals]);
  // React renders the initial text once; later updates are written directly (no re-render per frame).
  const [initial] = React.useState(() => format(value));

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const start = prev.current;
    prev.current = value;
    if (reduce || start === value) {
      el.textContent = format(value);
      return;
    }
    const controls = animate(start, value, {
      duration,
      ease: [0.2, 0.8, 0.2, 1],
      onUpdate: (v) => {
        el.textContent = format(v);
      },
    });
    return () => controls.stop();
  }, [value, duration, format, reduce]);

  return (
    <span ref={ref} className={cn("tabular-nums", className)} {...props}>
      {initial}
    </span>
  );
}

/* ------------------------------------------------------------------ Confetti */

export type ConfettiOptions = {
  /** Burst from this element's center (e.g. the button that was tapped). */
  origin?: Element | null;
  /** Or from viewport coordinates. Default: horizontal center, 35% down. */
  x?: number;
  y?: number;
  /** Number of pieces (default 36; keep ≤ 60 for low-end phones). */
  count?: number;
  /** Cone width in degrees (default 110, pointing up). */
  spread?: number;
  /** CSS colors. Default: violet, lime, maíz (sun), rosa, cielo. */
  colors?: string[];
};

const CONFETTI_COLORS = ["var(--primary)", "var(--limon)", "var(--maiz)", "var(--rosa)", "var(--cielo)"];

/**
 * Celebratory burst made of plain DOM nodes animated with WAAPI (transform/opacity only).
 * No-op on the server and under prefers-reduced-motion. Cleans itself up.
 */
export function confetti({ origin, x, y, count = 36, spread = 110, colors = CONFETTI_COLORS }: ConfettiOptions = {}) {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

  let ox = x ?? window.innerWidth / 2;
  let oy = y ?? window.innerHeight * 0.35;
  if (origin) {
    const r = origin.getBoundingClientRect();
    ox = r.left + r.width / 2;
    oy = r.top + r.height / 2;
  }

  const layer = document.createElement("div");
  layer.setAttribute("aria-hidden", "true");
  layer.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:100;overflow:hidden;contain:strict";
  document.body.appendChild(layer);

  const rand = (a: number, b: number) => a + Math.random() * (b - a);
  let longest = 0;
  for (let i = 0; i < count; i++) {
    const piece = document.createElement("span");
    const shape = i % 3; // 0 dot, 1 square, 2 ribbon
    const w = shape === 2 ? rand(4, 6) : rand(7, 11);
    const h = shape === 2 ? rand(11, 16) : w;
    piece.style.cssText = `position:absolute;left:${ox - w / 2}px;top:${oy - h / 2}px;width:${w}px;height:${h}px;background:${
      colors[i % colors.length]
    };border-radius:${shape === 0 ? "50%" : "2px"};will-change:transform,opacity`;
    layer.appendChild(piece);

    const angle = ((-90 + rand(-spread / 2, spread / 2)) * Math.PI) / 180;
    const v = rand(150, 340);
    const dx = Math.cos(angle) * v;
    const dy = Math.sin(angle) * v;
    const fall = rand(260, 420);
    const spin = rand(-540, 540);
    const duration = rand(1100, 1600);
    const delay = rand(0, 90);
    longest = Math.max(longest, duration + delay);
    piece.animate(
      [
        { transform: "translate(0,0) rotate(0deg) scale(0.4)", opacity: 1, easing: "cubic-bezier(.12,.75,.3,1)" },
        { transform: `translate(${dx}px,${dy}px) rotate(${spin / 2}deg) scale(1)`, opacity: 1, offset: 0.38, easing: "cubic-bezier(.45,0,.85,.55)" },
        { transform: `translate(${dx * 1.25}px,${dy + fall}px) rotate(${spin}deg) scale(0.9)`, opacity: 0 },
      ],
      { duration, delay, fill: "forwards" },
    );
  }
  window.setTimeout(() => layer.remove(), longest + 100);
}

/** Hook form of confetti(); returns a stable `fire(options?)`. */
export function useConfetti() {
  return React.useCallback((options?: ConfettiOptions) => confetti(options), []);
}

/** Declarative trigger: bursts every time `fire` changes to a new truthy value. */
export function Confetti({ fire, ...options }: ConfettiOptions & { fire: unknown }) {
  const opts = React.useRef(options);
  React.useEffect(() => {
    opts.current = options;
  });
  React.useEffect(() => {
    if (fire) confetti(opts.current);
  }, [fire]);
  return null;
}

/* ------------------------------------------------------------------ StageBars */

export type StageBarsProps = {
  /** Number of stages (default 8). */
  total?: number;
  /** Current stage, 1-based. Stages before it are done; after it are pending. */
  current: number;
  /** Optional stage names (same length as total) for the accessible value text. */
  labels?: string[];
  /** Accessible name. Default "Progreso". */
  label?: string;
  /** "default" on white/lavender surfaces; "inverse" on violet (HeroCard). */
  tone?: "default" | "inverse";
  className?: string;
};

/**
 * The reference's rising segmented progress: rounded bars that get taller left→right.
 * Done = soft lavender, current = solid violet with a lime dot, pending = hatched.
 * Height comes from the container (default h-20); bars grow in with a stagger.
 */
export function StageBars({ total = 8, current, labels, label = "Progreso", tone = "default", className }: StageBarsProps) {
  const cur = Math.min(Math.max(current, 1), total);
  const name = labels?.[cur - 1];
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={1}
      aria-valuemax={total}
      aria-valuenow={cur}
      aria-valuetext={`Etapa ${cur} de ${total}${name ? `: ${name}` : ""}`}
      className={cn("flex h-20 items-end gap-1.5", className)}
    >
      {Array.from({ length: total }, (_, i) => {
        const n = i + 1;
        const state = n < cur ? "done" : n === cur ? "current" : "todo";
        const height = total === 1 ? 100 : 38 + (62 * i) / (total - 1);
        return (
          <span
            key={i}
            className={cn(
              "relative min-w-0 flex-1 origin-bottom animate-grow rounded-[0.7rem]",
              tone === "default"
                ? state === "done"
                  ? "bg-uva-soft"
                  : state === "current"
                    ? "bg-primary shadow-pop"
                    : "bg-hatch"
                : state === "done"
                  ? "bg-white/30"
                  : state === "current"
                    ? "bg-limon"
                    : "bg-hatch-inverse",
            )}
            style={{ height: `${height}%`, "--i": i } as CSSVars}
          >
            {state === "current" ? (
              <span
                aria-hidden
                className={cn(
                  "absolute top-2 left-1/2 size-2 -translate-x-1/2 animate-beat rounded-full",
                  tone === "default" ? "bg-limon" : "bg-ink",
                )}
              />
            ) : null}
          </span>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ StepList */

export type Step = {
  title: React.ReactNode;
  body?: React.ReactNode;
  /** Right-aligned extra (time, date, chip). */
  meta?: React.ReactNode;
};

export type StepListProps = {
  steps: Step[];
  /** 0-based index of the current step; earlier steps render as done. */
  current?: number;
  className?: string;
};

/**
 * "Qué sigue" numbered list. The current step is a solid violet row with a lime number;
 * done steps get a check; future steps are quiet. Rows rise in with a stagger (CSS).
 */
export function StepList({ steps, current = 0, className }: StepListProps) {
  return (
    <ol className={cn("space-y-1.5", className)}>
      {steps.map((s, i) => {
        const state = i < current ? "done" : i === current ? "current" : "todo";
        return (
          <li
            key={i}
            aria-current={state === "current" ? "step" : undefined}
            className={cn(
              "flex animate-rise items-start gap-3.5 rounded-[1.25rem] p-3",
              state === "current" && "bg-primary text-primary-foreground shadow-pop",
            )}
            style={{ "--i": i } as CSSVars}
          >
            <span
              aria-hidden
              className={cn(
                "grid size-9 shrink-0 place-items-center rounded-full font-display text-[1.05rem] font-extrabold tabular-nums",
                state === "done" && "bg-uva-soft text-uva-ink",
                state === "current" && "animate-pop-in bg-limon text-ink",
                state === "todo" && "bg-tile text-muted-foreground",
              )}
            >
              {state === "done" ? <HugeiconsIcon icon={Tick02Icon} className="size-5" strokeWidth={2.4} /> : i + 1}
            </span>
            <span className="min-w-0 flex-1 pt-1.5">
              <span className="sr-only">
                {`Paso ${i + 1}${state === "done" ? ", hecho" : state === "current" ? ", actual" : ""}: `}
              </span>
              <span className={cn("block leading-snug font-semibold", state === "todo" && "text-foreground/80")}>{s.title}</span>
              {s.body ? (
                <span
                  className={cn(
                    "mt-0.5 block text-[0.92rem] leading-snug",
                    state === "current" ? "text-primary-foreground/80" : "text-muted-foreground",
                  )}
                >
                  {s.body}
                </span>
              ) : null}
            </span>
            {s.meta ? (
              <span
                className={cn(
                  "shrink-0 pt-1.5 text-sm tabular-nums",
                  state === "current" ? "text-primary-foreground/80" : "text-muted-foreground",
                )}
              >
                {s.meta}
              </span>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

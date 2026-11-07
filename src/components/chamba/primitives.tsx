import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import { cn } from "@/lib/utils";
import { bandColor, bandFor, formatKm } from "@/lib/geo";

/*
 * Server-safe building blocks (no hooks). Motion pieces live in ./motion.tsx.
 * Surfaces: lavender canvas → white Panel (radius-panel, hairline, soft violet shadow)
 * → lavender tiles inside (radius-tile). Violet HeroCard for the one "next step" per view.
 */

type CSSVars = React.CSSProperties & Record<`--${string}`, string | number>;

/* ------------------------------------------------------------------ surfaces */

/* ------------------------------------------------------------------ color blocks */

/**
 * Color-block surfaces. Screens should be MOSTLY blocks, not white: mix ≥3 tones per screen,
 * never the same tone on adjacent cards, one saturated hero (uva / mandarina) per view.
 * Each `block-*` utility re-scopes --foreground / --muted-foreground / --border / --tile, so
 * children using the usual semantic classes adapt automatically.
 */
export const BLOCK_TONES = [
  "lila",
  "chicle",
  "limon",
  "cielo",
  "sol",
  "menta",
  "durazno",
  "mandarina",
  "uva",
  "tinta",
] as const;
export type BlockTone = (typeof BLOCK_TONES)[number];
export type SurfaceTone = "white" | BlockTone;

export const BLOCK_CLASS: Record<BlockTone, string> = {
  lila: "block-lila",
  chicle: "block-chicle",
  limon: "block-limon",
  cielo: "block-cielo",
  sol: "block-sol",
  menta: "block-menta",
  durazno: "block-durazno",
  mandarina: "block-mandarina",
  uva: "block-uva",
  tinta: "block-tinta",
};

/** Surface classes for a tone ("white" = the classic hairline card). */
export function surface(tone: SurfaceTone = "white") {
  return tone === "white" ? "border border-border bg-card text-card-foreground shadow-card" : BLOCK_CLASS[tone];
}

/** Pick a pastel that differs from its neighbours: rotate(i) for lists of cards. */
const ROTATION: BlockTone[] = ["sol", "cielo", "limon", "durazno", "menta"];
export function rotateTone(i: number): BlockTone {
  return ROTATION[((i % ROTATION.length) + ROTATION.length) % ROTATION.length];
}

/** Outer card. `tone` makes it a color block (default white). Big radius; inner tiles use rounded-tile. */
export function Panel({ className, tone = "white", ...props }: React.ComponentProps<"section"> & { tone?: SurfaceTone }) {
  return (
    <section
      data-tone={tone}
      className={cn("relative min-w-0 rounded-panel p-5 sm:p-6", surface(tone), className)}
      {...props}
    />
  );
}

/** Panel title row: icon in a lavender circle, display-font heading, optional count chip + action. */
export function PanelHeader({
  icon,
  title,
  count,
  action,
  className,
}: {
  icon?: IconSvgElement;
  title: React.ReactNode;
  count?: number;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("mb-4 flex items-center gap-3", className)}>
      {icon ? (
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-tile text-uva-ink">
          <HugeiconsIcon icon={icon} className="size-5" strokeWidth={1.8} />
        </span>
      ) : null}
      <h2 className="flex min-w-0 items-center gap-2.5 font-display text-[1.3rem] leading-tight font-bold tracking-[-0.025em]">
        <span className="min-w-0">{title}</span>
        {count !== undefined ? (
          <span className="grid h-6 min-w-6 shrink-0 place-items-center rounded-full bg-tile px-2 font-sans text-[0.8rem] font-semibold tracking-normal text-uva-ink tabular-nums">
            {count}
          </span>
        ) : null}
      </h2>
      {action ? <div className="ml-auto shrink-0">{action}</div> : null}
    </header>
  );
}

/**
 * Violet "next step" hero (reference: "Your mortgage offer is here"). Lime eyebrow, chunky
 * white title, faint radar rings in the corner. Put CTAs inside with <Button variant="lime" size="xl">.
 * `sticker` is positioned over the top-right corner (use one <Sticker>).
 */
export function HeroCard({
  eyebrow,
  title,
  sticker,
  decor = true,
  tone = "uva",
  className,
  children,
  ...props
}: Omit<React.ComponentProps<"section">, "title"> & {
  eyebrow?: React.ReactNode;
  title?: React.ReactNode;
  sticker?: React.ReactNode;
  /** Faint concentric rings in the corner (the "radius" motif). Default true. */
  decor?: boolean;
  /** Saturated hero surface. Default violet; mandarina/limon/etc. for variety across screens. */
  tone?: BlockTone;
}) {
  return (
    <section
      data-tone={tone}
      className={cn(
        "relative isolate min-w-0 rounded-panel p-6 shadow-pop sm:p-7",
        BLOCK_CLASS[tone],
        className,
      )}
      {...props}
    >
      {decor ? (
        <span aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-[inherit]">
          <svg viewBox="0 0 200 200" className="absolute -right-20 -bottom-24 size-72 opacity-[0.12]">
            {[30, 55, 80, 100].map((r) => (
              <circle key={r} cx="100" cy="100" r={r} fill="none" stroke="currentColor" strokeWidth="1.5" />
            ))}
          </svg>
          <span className="absolute -top-10 -left-10 size-32 rounded-full bg-white/[0.12]" />
        </span>
      ) : null}
      {sticker ? <div className="absolute -top-5 -right-2 z-10 sm:-right-3">{sticker}</div> : null}
      {eyebrow ? <Eyebrow tone={tone === "uva" || tone === "tinta" ? "lime" : "inverse"}>{eyebrow}</Eyebrow> : null}
      {title ? (
        <h2 className={cn("font-display text-[2rem] leading-[1.02] font-extrabold tracking-[-0.035em] sm:text-[2.3rem]", eyebrow && "mt-2", sticker && "pr-16")}>
          {title}
        </h2>
      ) : null}
      {children}
    </section>
  );
}

/* ------------------------------------------------------------------ type */

const EYEBROW_TONE = {
  muted: "text-muted-foreground",
  violet: "text-uva-ink",
  lime: "text-limon",
  inverse: "text-current opacity-75",
} as const;

/** Small uppercase letter-spaced label ("TU SIGUIENTE PASO", "ETAPA 3 DE 6"). */
export function Eyebrow({
  tone = "muted",
  as: Tag = "p",
  className,
  ...props
}: React.ComponentProps<"p"> & { tone?: keyof typeof EYEBROW_TONE; as?: "p" | "span" | "div" }) {
  return (
    <Tag
      className={cn("text-[0.72rem] leading-4 font-semibold tracking-[0.14em] uppercase", EYEBROW_TONE[tone], className)}
      {...props}
    />
  );
}

/** Section title that sits on the lavender canvas between panels, with optional count + action. */
export function SectionLabel({
  title,
  eyebrow,
  count,
  action,
  as: Tag = "h2",
  className,
}: {
  title: React.ReactNode;
  eyebrow?: React.ReactNode;
  count?: number;
  action?: React.ReactNode;
  as?: "h2" | "h3";
  className?: string;
}) {
  return (
    <div className={cn("flex items-end gap-3 px-1", className)}>
      <div className="min-w-0 flex-1">
        {eyebrow ? <Eyebrow className="mb-1">{eyebrow}</Eyebrow> : null}
        <Tag className="flex items-center gap-2.5 font-display text-[1.45rem] leading-tight font-extrabold tracking-[-0.03em]">
          <span className="min-w-0">{title}</span>
          {count !== undefined ? (
            <span className="grid h-6 min-w-6 shrink-0 place-items-center rounded-full bg-card px-2 font-sans text-[0.8rem] font-semibold tracking-normal text-uva-ink tabular-nums shadow-card">
              {count}
            </span>
          ) : null}
        </Tag>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ tiles & stats */

const TILE_TONE = {
  soft: "bg-tile text-uva-ink",
  violet: "bg-primary text-primary-foreground",
  lime: "bg-limon text-ink",
  white: "border border-border bg-card text-uva-ink",
  plain: "bg-tile text-foreground",
} as const;
const TILE_SIZE = { sm: "size-10 [&_svg]:size-5", md: "size-12 [&_svg]:size-6", lg: "size-14 [&_svg]:size-7" } as const;

/** Square-ish icon holder for NON-category icons (categories use the cartoon job icons). */
export function IconTile({
  icon,
  tone = "soft",
  size = "md",
  className,
}: {
  icon: IconSvgElement;
  tone?: keyof typeof TILE_TONE;
  size?: keyof typeof TILE_SIZE;
  className?: string;
}) {
  return (
    <span className={cn("grid shrink-0 place-items-center rounded-tile", TILE_TONE[tone], TILE_SIZE[size], className)}>
      <HugeiconsIcon icon={icon} strokeWidth={1.7} />
    </span>
  );
}

const STAT_TONE: Record<string, string> = {
  soft: "bg-tile text-foreground",
  white: "border border-border bg-card text-card-foreground shadow-card",
  violet: "block-uva",
  lime: "block-limon",
  ...BLOCK_CLASS,
};

/** Label + big display number (+ hint). `value` can be a <CountUp/>. */
export function StatTile({
  label,
  value,
  hint,
  icon,
  tone = "soft",
  className,
  style,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: IconSvgElement;
  tone?: "soft" | "white" | "violet" | "lime" | BlockTone;
  className?: string;
  style?: CSSVars;
}) {
  const quiet = "text-muted-foreground";
  return (
    <div className={cn("min-w-0 rounded-tile p-4", STAT_TONE[tone], className)} style={style}>
      <div className={cn("flex items-center gap-1.5 text-sm", quiet)}>
        {icon ? <HugeiconsIcon icon={icon} className="size-4 shrink-0" strokeWidth={1.8} /> : null}
        <span className="min-w-0 truncate">{label}</span>
      </div>
      <div className="mt-1 font-display text-[2rem] leading-none font-extrabold tracking-[-0.035em] tabular-nums">{value}</div>
      {hint ? <div className={cn("mt-1.5 text-[0.85rem]", quiet)}>{hint}</div> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ chips */

/**
 * Toggle chip for filters / choices (≥44px tap target). Active = violet. Use inside client
 * components (it's a plain <button>); pass `active` and `onClick`.
 */
export function Chip({
  active = false,
  icon,
  count,
  className,
  children,
  ...props
}: React.ComponentProps<"button"> & { active?: boolean; icon?: IconSvgElement; count?: number }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(
        "press inline-flex h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-[0.95rem] whitespace-nowrap outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        active
          ? "border-transparent bg-primary font-medium text-primary-foreground shadow-[0_6px_14px_-8px_var(--primary)]"
          : "border-border bg-card text-foreground hover:border-[color-mix(in_oklab,var(--primary)_35%,transparent)] hover:bg-tile",
        className,
      )}
      {...props}
    >
      {icon ? <HugeiconsIcon icon={icon} className="size-[1.15rem] shrink-0" strokeWidth={1.8} /> : null}
      {children}
      {count !== undefined ? (
        <span
          className={cn(
            "grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[0.72rem] font-semibold tabular-nums",
            active ? "bg-limon text-ink" : "bg-tile text-uva-ink",
          )}
        >
          {count}
        </span>
      ) : null}
    </button>
  );
}

/** Small rounded label (legacy, unstyled color — pass bg/text classes). Prefer <Badge> variants. */
export function Pill({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium whitespace-nowrap tabular-nums",
        className,
      )}
      {...props}
    />
  );
}

export function StatusDot({ color, pulse, className }: { color: string; pulse?: boolean; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("inline-block size-2.5 shrink-0 rounded-full", className)}
      style={{ background: color, animation: pulse ? "live-pulse 2s infinite" : undefined }}
    />
  );
}

/* ------------------------------------------------------------------ people */

/* Theme-constant workwear pastels with ink initials: readable on any block, in both themes. */
const AVATAR_TONES = [
  "bg-limon text-ink",
  "bg-block-cielo text-ink",
  "bg-block-sol text-ink",
  "bg-block-durazno text-ink",
  "bg-block-menta text-ink",
] as const;

function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}

/** Overlapping initials circles (+N). For applicant counts, "who else applied", etc. */
export function AvatarStack({
  names,
  max = 3,
  size = "md",
  label,
  className,
}: {
  names: string[];
  max?: number;
  size?: "sm" | "md";
  /** Accessible summary; default "N personas". */
  label?: string;
  className?: string;
}) {
  const shown = names.slice(0, max);
  const extra = names.length - shown.length;
  const box = size === "sm" ? "size-7 text-[0.65rem]" : "size-9 text-[0.78rem]";
  return (
    <span role="img" aria-label={label ?? `${names.length} personas`} className={cn("flex items-center -space-x-2", className)}>
      {shown.map((n, i) => (
        <span
          key={`${n}-${i}`}
          aria-hidden
          className={cn("grid shrink-0 place-items-center rounded-full font-bold ring-2 ring-ink", box, AVATAR_TONES[i % AVATAR_TONES.length])}
        >
          {initialsOf(n)}
        </span>
      ))}
      {extra > 0 ? (
        <span aria-hidden className={cn("grid shrink-0 place-items-center rounded-full bg-ink font-bold text-white ring-2 ring-ink tabular-nums", box)}>
          +{extra}
        </span>
      ) : null}
    </span>
  );
}

/* ------------------------------------------------------------------ distance */

/** Ring that fills with how far a job is relative to your radius, colored by proximity band. */
export function DistanceRing({
  km,
  radiusKm,
  size = 36,
  showLabel = true,
}: {
  km: number;
  radiusKm: number;
  size?: number;
  showLabel?: boolean;
}) {
  const band = bandFor(km);
  const stroke = 4;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const frac = Math.min(1, km / radiusKm);
  return (
    <span className="flex items-center gap-2.5">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden className="-rotate-90 shrink-0">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--tile)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={bandColor(band)}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${Math.max(0.06, frac) * c} ${c}`}
        />
      </svg>
      {showLabel ? (
        <span className="min-w-[3.6rem] text-right text-base font-medium tabular-nums whitespace-nowrap sm:min-w-[4.25rem] sm:text-lg">
          {formatKm(km)}
        </span>
      ) : null}
    </span>
  );
}

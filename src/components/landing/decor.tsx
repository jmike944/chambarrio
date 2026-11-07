/*
 * Landing-only workwear decor. Server-component safe (no hooks), deterministic, CSS motion only.
 * Rugged, not cute: hazard stripes, rivets, tape, stencil numbers, hard offset ink shadows.
 */
import { Doodle, type DoodleName } from "@/components/chamba/art/doodles";
import { cn } from "@/lib/utils";

/** Hard offset ink shadow. `--hard` is set on the page root (ink in light, near-black in dark). */
export const HARD = "border-[3px] border-ink shadow-[5px_5px_0_0_var(--hard)]";
export const HARD_SM = "border-[2.5px] border-ink shadow-[3px_3px_0_0_var(--hard)]";

/** Hover lift + tap squish via transform only (no animated shadow). */
export const PRESSABLE =
  "transition-[translate,scale,rotate] duration-200 ease-[var(--ease-out-soft)] active:translate-x-[2px] active:translate-y-[2px] active:scale-[0.98] motion-safe:hover:-translate-y-1";

const BTN_BASE =
  "relative inline-flex items-center justify-center gap-2 rounded-full font-display font-extrabold tracking-[-0.01em] outline-none select-none focus-visible:ring-4 focus-visible:ring-ring/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background";

/** Chunky ink-outlined CTA classes (for <Link>/<a>/<button>). */
export function chunky(tone: "ink" | "white" | "lime" | "sol" = "ink", size: "md" | "lg" = "lg") {
  return cn(
    BTN_BASE,
    PRESSABLE,
    size === "lg" ? "h-14 px-7 text-[1.08rem]" : "h-11 px-5 text-[0.95rem]",
    size === "lg" ? HARD : HARD_SM,
    tone === "ink" && "bg-ink text-white",
    tone === "white" && "bg-white text-ink",
    tone === "lime" && "bg-limon text-ink",
    tone === "sol" && "bg-block-sol text-ink",
  );
}

/** Yellow/ink hazard stripes band. */
export function HazardStripe({
  className,
  colors = ["var(--block-sol)", "var(--ink)"],
  size = 14,
}: {
  className?: string;
  colors?: [string, string];
  size?: number;
}) {
  return (
    <span
      aria-hidden
      className={cn("pointer-events-none block h-3", className)}
      style={{
        backgroundImage: `repeating-linear-gradient(-45deg, ${colors[0]} 0 ${size}px, ${colors[1]} ${size}px ${size * 2}px)`,
      }}
    />
  );
}

/** Four rivets in the corners of a block. Parent must be `relative`. */
export function Rivets({ className, inset = "0.85rem" }: { className?: string; inset?: string }) {
  const pos = [
    { top: inset, left: inset },
    { top: inset, right: inset },
    { bottom: inset, left: inset },
    { bottom: inset, right: inset },
  ];
  return (
    <span aria-hidden className={cn("pointer-events-none absolute inset-0", className)}>
      {pos.map((p, i) => (
        <span
          key={i}
          className="absolute size-2.5 rounded-full border-2 border-ink bg-white/60"
          style={p}
        />
      ))}
    </span>
  );
}

/** A strip of masking tape with stencil text. */
export function Tape({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-8 items-center gap-2 bg-[#f4ecd2] px-3 font-display text-[0.8rem] font-extrabold tracking-[0.12em] text-ink uppercase shadow-[2px_2px_0_0_rgb(22_15_51/0.25)]",
        "[clip-path:polygon(2%_0,98%_4%,100%_100%,0_94%)]",
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Outlined stencil number ("01"). Decorative. */
export function StencilNumber({ n, className, stroke = 2.5 }: { n: number; className?: string; stroke?: number }) {
  return (
    <span
      aria-hidden
      className={cn(
        "block font-display leading-none font-extrabold tracking-[-0.04em] tabular-nums",
        className,
      )}
      style={{ color: "transparent", WebkitTextStroke: `${stroke}px var(--foreground)` }}
    >
      {String(n).padStart(2, "0")}
    </span>
  );
}

/** Rugged doodle shapes only (no hearts, no clouds). */
const RUGGED: DoodleName[] = ["rayo", "zigzag", "flecha", "estrella", "circulo", "espiral", "garabato", "chispa"];

/**
 * Deterministic scatter of rugged doodles. Parent must be `relative overflow-hidden`.
 * Doodles hug the left/right edges (half bleeding off) so text stays readable.
 */
export function Scatter({
  count = 6,
  seed = 1,
  palette = ["var(--ink)"],
  className,
  size = "size-7",
}: {
  count?: number;
  seed?: number;
  palette?: string[];
  className?: string;
  size?: string;
}) {
  return (
    <span aria-hidden className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}>
      {Array.from({ length: count }, (_, i) => {
        const k = (i + 1) * (seed * 7 + 5);
        const edgeX = i % 2 === 0 ? ((k * 13) % 5) - 1.5 : 91 + ((k * 7) % 4);
        const y = (k * 31 + i * 17) % 90;
        return (
          <span
            key={i}
            className="absolute"
            style={{ left: `${edgeX}%`, top: `${y}%`, rotate: `${((k * 29) % 70) - 35}deg` }}
          >
            <Doodle name={RUGGED[(i + seed) % RUGGED.length]} color={palette[i % palette.length]} className={size} />
          </span>
        );
      })}
    </span>
  );
}

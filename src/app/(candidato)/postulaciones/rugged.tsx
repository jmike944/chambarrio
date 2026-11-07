/*
 * Local "workwear" helpers for the candidate screens owned by this folder set
 * (postulaciones / notificaciones / perfil). Server-component safe, no hooks.
 * Motifs: hard ink outline + offset shadow, hazard tape, rivets, stencil numbers.
 */
import { cn } from "@/lib/utils";

/** Hard ink outline + offset ink shadow (light) / offset chalk shadow (dark). Static — never animated. */
export const HARD =
  "border-[2.5px] border-ink shadow-[5px_5px_0_0_var(--ink)] dark:shadow-[5px_5px_0_0_rgb(255_255_255/0.16)]";
/** Smaller version for chips/tiles. */
export const HARD_SM =
  "border-2 border-ink shadow-[3px_3px_0_0_var(--ink)] dark:shadow-[3px_3px_0_0_rgb(255_255_255/0.16)]";

/** Big stencil-ish display numerals / labels. */
export const STENCIL = "font-display font-extrabold uppercase tracking-[-0.02em] tabular-nums";

/** Yellow/ink hazard tape strip. Size it with height/width classes. Decorative. */
export function HazardTape({ className, tone = "sol" }: { className?: string; tone?: "sol" | "mandarina" | "limon" }) {
  const c = tone === "sol" ? "#FFD23F" : tone === "mandarina" ? "#FF6B2C" : "#DDF78A";
  return (
    <span
      aria-hidden
      className={cn("block border-y-2 border-ink", className)}
      style={{ backgroundImage: `repeating-linear-gradient(-45deg, #160F33 0 9px, ${c} 9px 18px)` }}
    />
  );
}

/** Four little rivets in the corners of a block. Parent must be `relative`. */
export function Rivets({ className }: { className?: string }) {
  const dot = "absolute size-2 rounded-full bg-current opacity-35";
  return (
    <span aria-hidden className={cn("pointer-events-none absolute inset-3", className)}>
      <span className={cn(dot, "top-0 left-0")} />
      <span className={cn(dot, "top-0 right-0")} />
      <span className={cn(dot, "bottom-0 left-0")} />
      <span className={cn(dot, "right-0 bottom-0")} />
    </span>
  );
}

/** Small rotated ink stamp ("NUEVO", "HOY"). */
export function Stamp({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-md border-2 border-ink bg-ink px-2 text-[0.68rem] font-bold tracking-[0.14em] text-white uppercase",
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Bold doodle palette (no pink). */
export const RUGGED_PALETTE = ["#FFD23F", "var(--limon)", "#5CC3FF", "#FF6B2C"];

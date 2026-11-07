import { HugeiconsIcon } from "@hugeicons/react";
import { LockIcon, SquareUnlock02Icon } from "@hugeicons/core-free-icons";
import { BLOCK_TONES, rotateTone, type BlockTone } from "@/components/chamba/primitives";
import { CATEGORY_BLOCK } from "@/components/chamba/job-icons";
import type { CategoryId } from "@/lib/data/types";
import { cn } from "@/lib/utils";

/*
 * Employer "workwear" kit (local to the vacancy screens): hard ink offset shadows, ink outlines,
 * stencil numbers and rugged status tags. Server-component safe (no hooks).
 */

/** Hard printed-patch drop shadow (ink on light, black on dark canvas). */
export const HARD = "shadow-[5px_5px_0_0_var(--ink)] dark:shadow-[5px_5px_0_0_rgb(0_0_0/0.7)]";
export const HARD_SM = "shadow-[3px_3px_0_0_var(--ink)] dark:shadow-[3px_3px_0_0_rgb(0_0_0/0.7)]";
/** Ink outline used on every block card. */
export const OUTLINE = "border-2 border-ink";

/** Tappable card motion: hover lift (pointer devices) that grows the hard shadow, squish on press. */
export const TAPPABLE =
  "press transition-[translate,scale,box-shadow] duration-200 [@media(hover:hover)]:hover:-translate-x-0.5 [@media(hover:hover)]:hover:-translate-y-0.5 [@media(hover:hover)]:hover:shadow-[7px_7px_0_0_var(--ink)] dark:[@media(hover:hover)]:hover:shadow-[7px_7px_0_0_rgb(0_0_0/0.7)]";

/** Solid ink button (for CTAs on mandarina / pastel blocks). Ink is theme-constant. */
export const INK_BUTTON =
  "border-2 border-ink bg-ink text-white hover:bg-[color-mix(in_oklab,var(--ink),white_12%)] dark:bg-ink dark:text-white";
/** White button with ink outline (secondary action on blocks). */
export const WHITE_BUTTON =
  "border-2 border-ink bg-white text-ink hover:bg-white/85 dark:bg-white dark:text-ink dark:hover:bg-white/85";

/** Rugged confetti: safety yellow, lime, orange, sky, white (no pink). */
export const WORK_CONFETTI = ["#FFC93C", "#DDF78A", "#FF6B2C", "#5CC3FF", "#FFFFFF"];

/** Chunky form control: white field, ink outline, small hard shadow. */
export const FIELD =
  "h-14 rounded-tile border-2 border-ink bg-white px-4 text-base text-ink shadow-[3px_3px_0_0_var(--ink)] placeholder:text-ink/45 focus-visible:border-ink md:text-base dark:bg-white dark:text-ink dark:shadow-[3px_3px_0_0_rgb(0_0_0/0.55)] data-placeholder:text-ink/45 [&_svg]:text-ink/60";

/**
 * Tones for a list of category cards: each card takes its category's block, unless that would
 * repeat the previous card's tone (or a reserved neighbour), then it rotates to the next pastel.
 */
export function blockSequence(categories: CategoryId[], avoidFirst?: BlockTone): BlockTone[] {
  const out: BlockTone[] = [];
  categories.forEach((c, i) => {
    let tone: BlockTone = CATEGORY_BLOCK[c];
    const prev = i === 0 ? avoidFirst : out[i - 1];
    let k = i;
    while (tone === prev || tone === "chicle") tone = rotateTone(++k);
    out.push(tone);
  });
  return out;
}

/** Pastel tones only (for picking stat tiles etc.). */
export const PASTELS = BLOCK_TONES.filter((t) => !["chicle", "mandarina", "uva", "tinta"].includes(t));

/** Big stencil step number ("01") with an ink drop. */
export function StencilNum({ n, className }: { n: number; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-grid h-11 min-w-11 place-items-center rounded-[0.7rem] bg-ink px-2 font-display text-[1.35rem] leading-none font-extrabold tracking-[-0.02em] text-white tabular-nums",
        "-rotate-3",
        className,
      )}
    >
      {String(n).padStart(2, "0")}
    </span>
  );
}

/** Rugged stamped status tag: unlocked = lime, locked = hazard stripes. */
export function AccessTag({ unlocked, className }: { unlocked: boolean; className?: string }) {
  return (
    <span
      className={cn(
        "relative inline-flex h-8 items-center gap-1.5 overflow-hidden rounded-md border-2 border-ink px-2.5 text-[0.72rem] font-extrabold tracking-[0.1em] text-ink uppercase",
        unlocked ? "bg-limon" : "bg-white",
        className,
      )}
    >
      {unlocked ? null : (
        <span
          aria-hidden
          className="absolute inset-y-0 left-0 w-2.5 border-r-2 border-ink bg-[repeating-linear-gradient(-45deg,#ffc93c_0_5px,#160f33_5px_10px)]"
        />
      )}
      <HugeiconsIcon
        icon={unlocked ? SquareUnlock02Icon : LockIcon}
        className={cn("size-4", !unlocked && "ml-2")}
        strokeWidth={2.2}
      />
      {unlocked ? "Desbloqueada" : "Por desbloquear"}
    </span>
  );
}

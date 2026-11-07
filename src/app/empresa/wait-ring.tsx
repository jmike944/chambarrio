import { HugeiconsIcon } from "@hugeicons/react";
import { LockIcon } from "@hugeicons/core-free-icons";
import { RADIUS_STOPS, type RadiusKm } from "@/lib/geo";
import { cn } from "@/lib/utils";

/*
 * Small server-safe pieces shared by the employer screens (dashboard + candidatos):
 * WaitRing gauge, chunky initials avatars, a padlock avatar and the radius chip group.
 */

type CSSVars = React.CSSProperties & Record<`--${string}`, string | number>;

/**
 * Hours a candidate has been waiting for a reply, out of a 24 h goal — drawn as a chunky
 * gauge (ink rim, 4 tick marks every 6 h) with the stencil-style time in the middle.
 */
export function WaitRing({ minutes, size = 50, index = 0 }: { minutes: number; size?: number; index?: number }) {
  const hours = minutes / 60;
  const color = hours < 2 ? "var(--nopal)" : hours < 8 ? "var(--cielo)" : hours < 16 ? "var(--maiz)" : "var(--chile)";
  const stroke = 6;
  const r = (size - stroke) / 2 - 1.5;
  const c = 2 * Math.PI * r;
  const frac = Math.min(1, hours / 24);
  const short = minutes < 60 ? `${minutes}m` : `${Math.round(hours)}h`;
  const label = minutes < 60 ? `${minutes} minutos` : `${Math.round(hours)} horas`;
  const mid = size / 2;
  return (
    <span
      className="relative grid shrink-0 animate-pop-in place-items-center rounded-full bg-white text-ink"
      style={{ "--i": index, width: size, height: size } as CSSVars}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden className="absolute inset-0 -rotate-90">
        <circle cx={mid} cy={mid} r={r} fill="none" stroke="rgb(22 15 51 / 0.12)" strokeWidth={stroke} />
        <circle
          cx={mid}
          cy={mid}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeDasharray={`${Math.max(0.06, frac) * c} ${c}`}
        />
        {[0.25, 0.75, 1.25, 1.75].map((k) => (
          <line
            key={k}
            x1={mid + Math.cos(k * Math.PI) * (r - stroke / 2)}
            y1={mid + Math.sin(k * Math.PI) * (r - stroke / 2)}
            x2={mid + Math.cos(k * Math.PI) * (r + stroke / 2)}
            y2={mid + Math.sin(k * Math.PI) * (r + stroke / 2)}
            stroke="#160F33"
            strokeWidth="2"
          />
        ))}
        <circle cx={mid} cy={mid} r={size / 2 - 1} fill="none" stroke="#160F33" strokeWidth="2" />
      </svg>
      <span className="relative font-display text-[0.74rem] leading-none font-extrabold tracking-[-0.02em] tabular-nums">
        <span className="sr-only">Esperando {label}</span>
        <span aria-hidden>{short}</span>
      </span>
    </span>
  );
}

/* ------------------------------------------------------------------ avatars */

const AVATAR_TONES = [
  "bg-block-sol",
  "bg-block-cielo",
  "bg-block-limon",
  "bg-block-durazno",
  "bg-block-menta",
  "bg-[#ff9a5c]",
] as const;

export function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}

function hash(s: string) {
  let h = 0;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
}

/** Chunky square-ish initials badge, ink outline + hard offset shadow. Wiggles on parent .group hover. */
export function InitialsAvatar({ name, size = "md", className }: { name: string; size?: "md" | "lg"; className?: string }) {
  const h = hash(name);
  return (
    <span
      aria-hidden
      className={cn(
        "grid shrink-0 place-items-center rounded-[0.9rem] border-2 border-ink font-display font-extrabold tracking-[-0.03em] text-ink shadow-[2px_3px_0_0_var(--ink)] group-hover:animate-wiggle",
        AVATAR_TONES[h % AVATAR_TONES.length],
        size === "lg" ? "size-14 text-xl" : "size-12 text-[1.05rem]",
        className,
      )}
      style={{ rotate: `${(h % 3) * 5 - 5}deg` }}
    >
      {initialsOf(name)}
    </span>
  );
}

/** Hazard-striped "locked" avatar with a steel padlock that jiggles on hover. */
export function LockAvatar({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid size-12 shrink-0 place-items-center overflow-hidden rounded-[0.9rem] border-2 border-ink shadow-[2px_3px_0_0_var(--ink)]",
        className,
      )}
      style={{ background: "repeating-linear-gradient(-45deg,#ffc93c 0 6px,#160f33 6px 12px)" }}
    >
      <span className="grid size-8 place-items-center rounded-lg border-2 border-ink bg-white text-ink group-hover:animate-wiggle">
        <HugeiconsIcon icon={LockIcon} className="size-4.5" strokeWidth={2.4} />
      </span>
    </span>
  );
}

/* ------------------------------------------------------------------ radius chips */

/**
 * 2/5/10/15 km segmented chips. `tone="block"` for pastel blocks (ink active pill),
 * `tone="hero"` for saturated surfaces (white active pill on translucent track).
 */
export function RadiusChips({
  value,
  onChange,
  label = "Distancia máxima",
  tone = "block",
  className,
}: {
  value: RadiusKm;
  onChange: (r: RadiusKm) => void;
  label?: string;
  tone?: "block" | "hero";
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        "grid grid-cols-4 gap-1 rounded-full p-1",
        tone === "hero" ? "bg-white/15" : "bg-white/55 dark:bg-white/40",
        className,
      )}
    >
      {RADIUS_STOPS.map((s) => {
        const on = s === value;
        return (
          <button
            key={s}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(s)}
            className={cn(
              "press h-11 rounded-full font-display text-[1rem] font-bold tabular-nums transition-[background-color,color,scale] outline-none focus-visible:ring-3",
              tone === "hero"
                ? on
                  ? "bg-white text-ink ring-2 ring-limon focus-visible:ring-limon"
                  : "text-current hover:bg-white/15 focus-visible:ring-white/70"
                : on
                  ? "bg-ink text-white shadow-[0_6px_14px_-8px_var(--ink)] focus-visible:ring-ink/40"
                  : "text-ink hover:bg-white/60 focus-visible:ring-ink/40",
            )}
          >
            {s} km
          </button>
        );
      })}
    </div>
  );
}

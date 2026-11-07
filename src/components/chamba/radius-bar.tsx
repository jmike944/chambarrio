"use client";

import { useRef } from "react";
import { cn } from "@/lib/utils";
import { MAX_RADIUS, RADIUS_STOPS, bandColor, bandFor, type RadiusKm } from "@/lib/geo";

/**
 * The signature control: a chunky 0–15 km cartoon track. The filled part shows the proximity
 * spectrum at absolute scale (so 5 km only ever shows green→blue); a round knob carries the
 * value. Motion is transform-only: one wrapper slides (knob + the cover over the unfilled part)
 * with a springy ease. Keyboard: arrows / Home / End; pointer: tap or drag; plus 4 stop pills.
 */
export function RadiusBar({
  value,
  onChange,
  label = "Radio de búsqueda",
  originLabel = "Tu casa",
  className,
}: {
  value: RadiusKm;
  onChange: (r: RadiusKm) => void;
  label?: string;
  /** What the bar measures from: the candidate's home or the employer's workplace. */
  originLabel?: string;
  className?: string;
}) {
  const railRef = useRef<HTMLDivElement>(null);
  const frac = value / MAX_RADIUS;
  const idx = RADIUS_STOPS.indexOf(value);
  const color = bandColor(bandFor(value));

  function pickFromPointer(clientX: number) {
    const el = railRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const km = ((clientX - rect.left) / rect.width) * MAX_RADIUS;
    const nearest = RADIUS_STOPS.reduce((best, s) => (Math.abs(s - km) < Math.abs(best - km) ? s : best));
    if (nearest !== value) onChange(nearest);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowRight" || e.key === "ArrowUp") {
      e.preventDefault();
      onChange(RADIUS_STOPS[Math.min(RADIUS_STOPS.length - 1, idx + 1)]);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
      e.preventDefault();
      onChange(RADIUS_STOPS[Math.max(0, idx - 1)]);
    } else if (e.key === "Home") {
      e.preventDefault();
      onChange(RADIUS_STOPS[0]);
    } else if (e.key === "End") {
      e.preventDefault();
      onChange(RADIUS_STOPS[RADIUS_STOPS.length - 1]);
    }
  }

  return (
    <div className={cn("select-none", className)}>
      <div
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={2}
        aria-valuemax={15}
        aria-valuenow={value}
        aria-valuetext={`${value} kilómetros`}
        onKeyDown={onKeyDown}
        onPointerDown={(e) => {
          (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
          pickFromPointer(e.clientX);
        }}
        onPointerMove={(e) => {
          if (e.buttons === 1) pickFromPointer(e.clientX);
        }}
        className="group/bar relative h-16 cursor-pointer rounded-full outline-none touch-none focus-visible:ring-4 focus-visible:ring-ring/60 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
      >
        {/* track: spectrum underneath, hard cartoon shadow */}
        <div className="absolute inset-0 overflow-hidden rounded-full border-[2.5px] border-foreground bg-spectrum shadow-[0_4px_0_var(--foreground)]">
          {/* ring boundaries ("hilos" of a sarape) */}
          <div className="absolute inset-y-0 right-8 left-8">
            {RADIUS_STOPS.slice(0, -1).map((s) => (
              <span
                key={s}
                aria-hidden
                className="absolute inset-y-0 w-[5px] -translate-x-1/2 border-x border-black/25"
                style={{ left: `${(s / MAX_RADIUS) * 100}%` }}
              />
            ))}
            {/* cover over the unfilled part + knob, slid together (transform only) */}
            <div
              className="absolute inset-0 transition-[translate] duration-500 ease-[var(--ease-spring)]"
              style={{ translate: `${frac * 100}% 0` }}
            >
              <span
                aria-hidden
                className="absolute inset-y-0 left-0 w-[300%] border-l-[2.5px] border-[color:var(--ink)] dark:border-black/70"
                style={{
                  background:
                    "repeating-linear-gradient(-45deg, color-mix(in oklab, var(--foreground) 13%, transparent) 0 7px, transparent 7px 14px), var(--card)",
                }}
              />
            </div>
          </div>
        </div>

        {/* knob (outside the clipped track so it can overhang) */}
        <div ref={railRef} className="pointer-events-none absolute inset-y-0 right-8 left-8">
          <div
            className="absolute inset-0 transition-[translate] duration-500 ease-[var(--ease-spring)]"
            style={{ translate: `${frac * 100}% 0` }}
          >
            <span
              aria-hidden
              className="absolute top-1/2 left-0 grid size-[4.5rem] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-[2.5px] border-[color:var(--ink)] bg-white text-[color:var(--ink)] shadow-[0_4px_0_var(--ink)] transition-transform duration-200 group-active/bar:scale-110"
            >
              <span key={value} className="block animate-pop-in text-center leading-none">
                <span className="block font-display text-[1.6rem] font-extrabold tracking-[-0.04em] tabular-nums">{value}</span>
                <span className="block text-[0.7rem] font-bold tracking-wide uppercase">km</span>
              </span>
              <span aria-hidden className="absolute -top-1 -right-1 size-4 rounded-full border-2 border-[color:var(--ink)]" style={{ background: color }} />
            </span>
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between px-1 text-[0.85rem] font-semibold text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <svg viewBox="0 0 16 16" aria-hidden className="size-4">
            <path d="M2.5 8 8 3l5.5 5M4.5 7v6h7V7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {originLabel}
        </span>
        <span className="tabular-nums">15 km</span>
      </div>

      <div role="group" aria-label="Elige tu radio" className="mt-3 grid grid-cols-4 gap-2">
        {RADIUS_STOPS.map((s) => {
          const on = s === value;
          return (
            <button
              key={s}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(s)}
              className={cn(
                "press flex h-12 items-center justify-center gap-1.5 rounded-full border-2 text-[0.95rem] font-semibold tabular-nums outline-none transition-[background-color,color,translate,box-shadow] duration-200 focus-visible:ring-3 focus-visible:ring-ring/60",
                on
                  ? "-translate-y-0.5 border-[color:var(--ink)] bg-primary text-primary-foreground shadow-[0_3px_0_var(--ink)]"
                  : "border-foreground/15 bg-tile text-foreground hover:-translate-y-0.5 hover:border-foreground/40",
              )}
            >
              <span aria-hidden className="size-2.5 rounded-full border border-black/30" style={{ background: bandColor(bandFor(s)) }} />
              {s} km
            </button>
          );
        })}
      </div>
    </div>
  );
}

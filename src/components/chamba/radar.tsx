"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { RADIUS_STOPS, MAX_RADIUS, bandColor, bandFor, formatKm, type RadiusKm } from "@/lib/geo";
import { useCatalog } from "@/lib/data/catalog";
import { useApp, type JobWithDistance } from "@/lib/store";
import { cn } from "@/lib/utils";
import { CategoryArt } from "./job-icons";
import { RadarDrawer } from "./radar-drawer";
import { layoutSpots, vacantes, type RadarSpot } from "./radar-spots";

type Vars = React.CSSProperties & Record<`--${string}`, string | number>;

const SIZE = 320;
const C = SIZE / 2;
const OUTER = C - 10;
const scale = (km: number) => Math.sqrt(Math.min(km, MAX_RADIUS) / MAX_RADIUS) * (OUTER - 6);
const BEAM_R = scale(MAX_RADIUS);
const GEO = { c: C, scale, outer: OUTER };
const pct = (v: number) => `${(v / SIZE) * 100}%`;

function wedge(deg: number) {
  const a = (deg * Math.PI) / 180;
  return `M${C} ${C} L${C} ${C - BEAM_R} A${BEAM_R} ${BEAM_R} 0 0 1 ${C + BEAM_R * Math.sin(a)} ${C - BEAM_R * Math.cos(a)} Z`;
}

function spotLabel(s: RadarSpot, radiusKm: number) {
  const where = s.branch.name === s.company.name ? s.company.name : `${s.company.name}, ${s.branch.name}`;
  return `${where}: ${vacantes(s.jobs.length)} a ${formatKm(s.km)}${s.inside ? "" : `, fuera de tu radio de ${radiusKm} km`}`;
}

/**
 * Cartoon radar: concentric 2/5/10/15 km rings around a little house and a sweeping beam. Every
 * branch with vacancies is a pin at its real bearing (square-root scale keeps 2 km readable), with
 * the category art of its jobs and a count badge; places beyond your radius are faint dots.
 *
 * interactive (default): pins are buttons (roving tabindex in distance order, arrows move between
 * them). Selecting one aims the beam at it and opens a drawer with its vacancies and the company's
 * other branches. Motion is transform/opacity only and freezes under prefers-reduced-motion.
 */
export function Radar({
  jobs,
  radiusKm,
  bearings,
  compact = false,
  interactive = true,
  onRadiusChange,
  className,
}: {
  jobs: JobWithDistance[];
  radiusKm: number;
  bearings?: Record<string, number>;
  compact?: boolean;
  /** Pins open a drawer. Off → decorative pins (e.g. the landing preview). */
  interactive?: boolean;
  /** Used by the "ampliar radio" button in the drawer; defaults to the store's setRadius. */
  onRadiusChange?: (r: RadiusKm) => void;
  className?: string;
}) {
  const setRadius = useApp((s) => s.setRadius);
  const { branchById, companyById } = useCatalog();
  const spots = useMemo(
    () => layoutSpots(jobs, radiusKm, GEO, { branchById, companyById }, bearings),
    [jobs, radiusKm, bearings, branchById, companyById],
  );
  const spotsById = useMemo(() => new Map(spots.map((s) => [s.id, s])), [spots]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const pinRefs = useRef(new Map<string, HTMLButtonElement>());

  // Routes stay mounted (Activity) after navigating away, e.g. from a vacancy in the drawer;
  // don't come back to an open sheet.
  useLayoutEffect(() => () => setOpen(false), []);

  const selected = selectedId ? (spotsById.get(selectedId) ?? null) : null;
  const current = open ? selected : null;
  const tabStop = activeId && spotsById.has(activeId) ? activeId : spots[0]?.id;

  const insideSpots = spots.filter((s) => s.inside);
  const outsideSpots = spots.filter((s) => !s.inside);
  const insideJobs = insideSpots.reduce((n, s) => n + s.jobs.length, 0);
  const visibleJobs = spots.reduce((n, s) => n + s.jobs.length, 0);
  const color = bandColor(bandFor(radiusKm));
  const places = insideSpots.length === 1 ? "1 lugar" : `${insideSpots.length} lugares`;
  const summary = `${vacantes(insideJobs)} en ${places} dentro de ${radiusKm} km, ${visibleJobs} en un radio de 15 km`;

  function select(id: string) {
    setSelectedId(id);
    setActiveId(id);
    setOpen(true);
  }

  function onKeyDown(e: React.KeyboardEvent, index: number) {
    const n = spots.length;
    const next =
      e.key === "ArrowRight" || e.key === "ArrowDown"
        ? (index + 1) % n
        : e.key === "ArrowLeft" || e.key === "ArrowUp"
          ? (index - 1 + n) % n
          : e.key === "Home"
            ? 0
            : e.key === "End"
              ? n - 1
              : -1;
    if (next < 0) return;
    e.preventDefault();
    const id = spots[next].id;
    setActiveId(id);
    pinRefs.current.get(id)?.focus();
  }

  const pinProps = (s: RadarSpot, index: number) =>
    ({
      ref: (el: HTMLButtonElement | null) => {
        if (el) pinRefs.current.set(s.id, el);
        else pinRefs.current.delete(s.id);
      },
      type: "button",
      tabIndex: s.id === tabStop ? 0 : -1,
      "aria-label": spotLabel(s, radiusKm),
      "aria-haspopup": "dialog",
      "aria-expanded": current?.id === s.id,
      onClick: () => select(s.id),
      onKeyDown: (e: React.KeyboardEvent) => onKeyDown(e, index),
      onFocus: () => setActiveId(s.id),
    }) as const;

  // Where the beam points while a spot is open (its drawn position, so it lines up with the pin).
  const aim = current ? (Math.atan2(current.x - C, C - current.y) * 180) / Math.PI : 0;
  // A 44px invisible hit area centred on a marker that can be much smaller.
  const HIT =
    "absolute -translate-x-1/2 -translate-y-1/2 rounded-full outline-none [-webkit-tap-highlight-color:transparent] before:absolute before:top-1/2 before:left-1/2 before:size-11 before:-translate-x-1/2 before:-translate-y-1/2 before:rounded-full before:content-['']";

  return (
    <figure className={cn(compact ? "mx-auto w-full max-w-[15rem]" : "mx-auto w-full max-w-[22rem]", className)}>
      <div
        className="relative"
        role={interactive ? "group" : "img"}
        aria-label={interactive ? `Radar de vacantes: ${summary}. Usa las flechas para recorrer los lugares.` : summary}
      >
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden className="block w-full overflow-visible">
          {/* plate */}
          <circle cx={C} cy={C + 5} r={OUTER} fill="var(--foreground)" opacity={0.9} />
          <circle cx={C} cy={C} r={OUTER} fill="var(--card)" stroke="var(--foreground)" strokeWidth={3} />
          {/* your radius (scales, never re-lays out) */}
          <circle
            cx={C}
            cy={C}
            r={BEAM_R}
            fill={color}
            fillOpacity={0.28}
            stroke={color}
            strokeWidth={3 * (BEAM_R / Math.max(scale(radiusKm), 1))}
            style={{
              transformOrigin: `${C}px ${C}px`,
              scale: `${scale(radiusKm) / BEAM_R}`,
              transition: "scale 600ms var(--ease-spring), fill 400ms, stroke 400ms",
            }}
          />
          {/* sweeping beam — stops and points at the open spot */}
          <g
            key={current ? "aim" : "sweep"}
            className={current ? undefined : "motion-safe:animate-[spin_5s_linear_infinite]"}
            style={{
              transformOrigin: `${C}px ${C}px`,
              rotate: current ? `${aim}deg` : undefined,
              transition: "rotate 500ms var(--ease-spring)",
            }}
          >
            <path d={wedge(38)} fill={color} opacity={current ? 0.3 : 0.22} transform={current ? `rotate(-19 ${C} ${C})` : undefined} />
            <path d={wedge(14)} fill={color} opacity={0.28} transform={current ? `rotate(-7 ${C} ${C})` : undefined} />
            <line
              x1={C}
              y1={C}
              x2={C}
              y2={C - BEAM_R}
              stroke="var(--foreground)"
              strokeOpacity={0.55}
              strokeWidth={2.5}
              strokeLinecap="round"
            />
          </g>
          {RADIUS_STOPS.map((s) => {
            const on = s <= radiusKm;
            return (
              <circle
                key={s}
                cx={C}
                cy={C}
                r={scale(s)}
                fill="none"
                stroke="var(--foreground)"
                strokeOpacity={on ? 0.5 : 0.25}
                strokeWidth={s === radiusKm ? 2.5 : 1.5}
                strokeDasharray={on ? undefined : "4 6"}
              />
            );
          })}
          {interactive
            ? null
            : outsideSpots.map((s) => <circle key={s.id} cx={s.x} cy={s.y} r={4} fill="var(--foreground)" opacity={0.28} />)}
        </svg>

        {/* places beyond your radius: faint dots (tappable) */}
        {interactive
          ? outsideSpots.map((s) => {
              const on = current?.id === s.id;
              return (
                <button
                  key={s.id}
                  {...pinProps(s, spots.indexOf(s))}
                  className={cn("group size-[3.4%]", HIT, on && "z-10")}
                  style={{ left: pct(s.x), top: pct(s.y) }}
                >
                  <span
                    className={cn(
                      "block size-full rounded-full bg-[color:var(--foreground)] opacity-30 transition-[scale,opacity] duration-300 ease-[var(--ease-spring)] group-hover:scale-150 group-hover:opacity-70 group-focus-visible:scale-150 group-focus-visible:opacity-100 group-focus-visible:ring-[3px] group-focus-visible:ring-[color:var(--uva)] group-active:scale-90",
                      on && "scale-[1.9]! opacity-100! ring-[3px] ring-[color:var(--card)]",
                    )}
                  />
                </button>
              );
            })
          : null}

        {/* home */}
        <span aria-hidden className="pointer-events-none absolute top-1/2 left-1/2 size-[17%] -translate-x-1/2 -translate-y-1/2">
          <span className="absolute inset-[-10%] rounded-full bg-[color:var(--limon)] opacity-60 motion-safe:animate-[ping_2.4s_cubic-bezier(0,0,0.2,1)_infinite]" />
          <svg viewBox="0 0 48 48" className="relative block size-full overflow-visible">
            <circle cx="24" cy="24" r="22" fill="#DDF78A" stroke="#160F33" strokeWidth="3" />
            <path d="M13 23 24 13l11 10v12H13Z" fill="#fff" stroke="#160F33" strokeWidth="3" strokeLinejoin="round" />
            <path d="M10 24 24 11l14 13" fill="none" stroke="#4318E0" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
            <rect x="21" y="27" width="6" height="8" rx="1.5" fill="#4318E0" />
          </svg>
        </span>

        {/* category pins: one per branch */}
        {insideSpots.map((s, i) => {
          const on = current?.id === s.id;
          const dim = current != null && !on;
          const disc = (
            <span
              className={cn(
                "relative block size-full animate-pop-in rounded-full border-2 border-[color:var(--ink)] bg-white p-[8%] shadow-[0_2px_0_var(--ink)]",
                interactive &&
                  "transition-[translate,rotate] duration-300 ease-[var(--ease-spring)] group-hover:-translate-y-[3px] group-hover:-rotate-8 group-focus-visible:ring-[3px] group-focus-visible:ring-[color:var(--uva)] group-focus-visible:ring-offset-2 group-focus-visible:ring-offset-[color:var(--card)]",
              )}
              style={{ "--i": Math.min(i, 12) } as Vars}
            >
              <CategoryArt category={s.category} className="size-full" />
              {s.jobs.length > 1 ? (
                <span className="absolute -top-[32%] -right-[32%] grid h-[1.05rem] min-w-[1.05rem] place-items-center rounded-full border-[1.5px] border-white bg-[color:var(--ink)] px-1 text-[0.62rem] leading-none font-extrabold text-white tabular-nums">
                  {s.jobs.length}
                </span>
              ) : null}
            </span>
          );
          if (!interactive) {
            return (
              <span key={s.id} aria-hidden className="absolute size-[10%] -translate-x-1/2 -translate-y-1/2" style={{ left: pct(s.x), top: pct(s.y) }}>
                {disc}
              </span>
            );
          }
          return (
            <button
              key={s.id}
              {...pinProps(s, spots.indexOf(s))}
              className={cn("group size-[10%] cursor-pointer", HIT, on && "z-10")}
              style={{ left: pct(s.x), top: pct(s.y) }}
            >
              <span
                className={cn(
                  "relative block size-full transition-[scale,opacity] duration-300 ease-[var(--ease-spring)] group-active:scale-90",
                  on && "scale-[1.35]",
                  dim && "opacity-55",
                )}
              >
                {on ? (
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-[-28%] rounded-full border-[3px] motion-safe:animate-[ping_1.6s_cubic-bezier(0,0,0.2,1)_infinite]"
                    style={{ borderColor: bandColor(bandFor(s.km)) }}
                  />
                ) : null}
                {disc}
              </span>
            </button>
          );
        })}

        {/* ring labels, drawn above the pins so they always read */}
        {compact ? null : (
          <svg viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden className="pointer-events-none absolute inset-0 block size-full overflow-visible">
            {RADIUS_STOPS.map((s) => {
              const on = s <= radiusKm;
              return (
                <g key={s} transform={`translate(${C} ${C - scale(s)})`}>
                  <rect x={-18} y={-10} width={36} height={20} rx={10} fill={on ? "var(--foreground)" : "var(--card)"} stroke="var(--foreground)" strokeOpacity={on ? 1 : 0.35} strokeWidth={1.5} />
                  <text y={4} textAnchor="middle" fontSize="11" fontWeight={800} fill={on ? "var(--card)" : "var(--foreground)"} className="tabular-nums">
                    {s} km
                  </text>
                </g>
              );
            })}
          </svg>
        )}
      </div>
      {compact ? null : (
        <figcaption className="mt-3 text-center text-sm text-muted-foreground">
          {interactive
            ? "Toca un pin para ver sus vacantes. Cada uno es un lugar, en la dirección real desde tu casa."
            : "Cada pin es una vacante, en la dirección real desde tu casa."}
        </figcaption>
      )}

      {interactive ? (
        <RadarDrawer
          spot={selected}
          open={open && selected != null}
          onOpenChange={setOpen}
          radiusKm={radiusKm}
          spotsById={spotsById}
          onSelect={select}
          onWiden={onRadiusChange ?? setRadius}
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            if (selectedId) pinRefs.current.get(selectedId)?.focus();
          }}
        />
      ) : null}
    </figure>
  );
}

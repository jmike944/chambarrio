"use client";

import { useId, useMemo } from "react";
import type { BlockTone } from "@/components/chamba/primitives";
import { useMyCompany, type MyJob } from "@/lib/data/catalog";
import { COLONIAS } from "@/lib/data/jobs";
import type { Branch, Job } from "@/lib/data/types";
import { distanceKm, SALTILLO_CENTER, type LatLng } from "@/lib/geo";
import { useEmployerLocations } from "@/lib/store";
import { cn } from "@/lib/utils";

/*
 * Shared helpers for the employer's sucursales (used by /empresa, /empresa/vacantes, the new-vacancy
 * form and /empresa/sucursales). Client-only: store.ts is a client module.
 */

/**
 * The employer's active vacancies (open + paused): the demo company's seed jobs in demo (all open),
 * the company's own vacancies in live. Closed ones are left out; use `useMyCompany().jobs` for those.
 */
export function useEmployerJobs(): MyJob[] {
  const all = useMyCompany().jobs;
  return useMemo(() => all.filter((j) => j.status !== "cerrada"), [all]);
}

/**
 * Which of the employer's locations a vacancy belongs to. Seed vacancies whose branch isn't in the
 * employer's list (a registered business, or a deleted branch) fall back to the main location.
 */
export function branchIdOf(job: Pick<Job, "branchId">, locations: Branch[]): string | undefined {
  return locations.some((l) => l.id === job.branchId) ? job.branchId : locations[0]?.id;
}

export type BranchSummary = {
  branch: Branch;
  index: number;
  /** Active vacancies (open + paused). */
  jobs: MyJob[];
  /** Every vacancy registered at the branch, closed ones included (live: they block deleting it). */
  allJobs: MyJob[];
  applicants: number;
};

/** Each location with its vacancies and applicant count. */
export function useBranchSummaries(): BranchSummary[] {
  const locations = useEmployerLocations();
  const all = useMyCompany().jobs;
  return useMemo(
    () =>
      locations.map((branch, index) => {
        const every = all.filter((j) => branchIdOf(j, locations) === branch.id);
        const mine = every.filter((j) => j.status !== "cerrada");
        return { branch, index, jobs: mine, allJobs: every, applicants: mine.reduce((n, j) => n + j.applicants, 0) };
      }),
    [locations, all],
  );
}

/** What the LocationPicker stores as the colonia of a GPS pick. */
export const GPS_COLONIA = "Mi ubicación";

/** "Col. Bellavista" (or "Bellavista" without prefix) / "Ubicación por GPS" for a GPS pick. */
export function coloniaText(b: Pick<Branch, "colonia">, prefix = true): string {
  if (b.colonia === GPS_COLONIA) return "Ubicación por GPS";
  return prefix ? `Col. ${b.colonia}` : b.colonia;
}

/** "3 sucursales en Saltillo" / "Parque Industrial Santa Mónica". */
export function placeText(locations: Branch[]): string {
  if (locations.length > 1) return `${locations.length} sucursales en Saltillo`;
  const c = locations[0]?.colonia;
  return c && c !== GPS_COLONIA ? c : "Tu sucursal";
}

/** "tus 3 sucursales" / "tu centro en Lourdes" — for "viven a menos de 5 km de …". */
export function nearPlaceText(locations: Branch[]): string {
  if (locations.length > 1) return `tus ${locations.length} sucursales`;
  const c = locations[0]?.colonia;
  return c && c !== GPS_COLONIA ? `tu centro en ${c}` : "tu centro";
}

/** Rough demo estimate of people looking for work within `km` of a location. */
export function nearbyEstimate(loc: LatLng, km = 5): number {
  const base = COLONIAS.reduce((n, c) => {
    const d = distanceKm(loc, c.location);
    return d <= km ? n + Math.round(46 * (1 - d / (km + 1.5))) : n;
  }, 0);
  return Math.max(12, base);
}

/** Distance to the closest other colonia — a "typical neighbour" distance for previews. */
export function typicalKm(loc: LatLng): number {
  const ds = COLONIAS.map((c) => distanceKm(loc, c.location)).filter((d) => d > 0.4);
  return Math.max(0.6, Math.min(...ds, 4.5));
}

/** Pastel per branch card (never the saturated ones). */
export const BRANCH_TONES = ["cielo", "sol", "menta", "durazno", "limon", "lila"] as const satisfies readonly BlockTone[];
export const branchTone = (i: number): BlockTone => BRANCH_TONES[((i % BRANCH_TONES.length) + BRANCH_TONES.length) % BRANCH_TONES.length];

/* ------------------------------------------------------------------ art */

const INK = "#160F33";

function hash(s: string) {
  let h = 7;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/**
 * Tiny street-map tile with a pin: roads + blocks laid out from the branch id, so each branch gets
 * its own little corner of the city. Decorative.
 */
export function BranchMapArt({ seed, className, principal }: { seed: string; className?: string; principal?: boolean }) {
  const h = hash(seed);
  // Unique per instance: routes stay mounted (Activity), so the same branch can be drawn on two pages at once.
  const clipId = `map-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const hy = 30 + (h % 4) * 10; // horizontal avenue
  const vx = 34 + ((h >> 3) % 4) * 14; // vertical street
  const diag = (h >> 6) % 2 === 0;
  const blocks = [
    { x: 8, y: 8, w: vx - 16, h: hy - 16, fill: "#FFE27A" },
    { x: vx + 8, y: 8, w: 112 - vx - 16, h: hy - 16, fill: "#BDF5D6" },
    { x: 8, y: hy + 8, w: vx - 16, h: 88 - hy - 16, fill: "#BFE6FF" },
    { x: vx + 8, y: hy + 8, w: 112 - vx - 16, h: 88 - hy - 16, fill: "#FFFFFF" },
  ];
  return (
    <svg viewBox="0 0 120 96" aria-hidden className={cn("overflow-visible", className)}>
      <rect x="2" y="2" width="116" height="92" rx="16" fill="#FFFFFF" stroke={INK} strokeWidth="2.5" />
      <clipPath id={clipId}>
        <rect x="3" y="3" width="114" height="90" rx="15" />
      </clipPath>
      <g clipPath={`url(#${clipId})`}>
        {blocks.map((b, i) => (
          <rect key={i} x={b.x} y={b.y} width={Math.max(4, b.w)} height={Math.max(4, b.h)} rx="5" fill={b.fill} stroke={INK} strokeWidth="1.6" />
        ))}
        {/* roads */}
        <path d={`M0 ${hy}H120M${vx} 0V96`} stroke="#E9E4FF" strokeWidth="11" />
        <path d={`M0 ${hy}H120M${vx} 0V96`} stroke={INK} strokeWidth="1.6" strokeDasharray="5 5" />
        {diag ? (
          <>
            <path d={`M${vx + 20} 96L120 ${hy + 18}`} stroke="#E9E4FF" strokeWidth="8" />
            <path d={`M${vx + 20} 96L120 ${hy + 18}`} stroke={INK} strokeWidth="1.3" strokeDasharray="4 4" />
          </>
        ) : (
          <circle cx={vx + 30} cy={hy + 26} r="7" fill="#0FA968" stroke={INK} strokeWidth="1.6" />
        )}
      </g>
      {/* pin */}
      <g
        className="transition-transform duration-300 group-hover:-translate-y-1.5"
        style={{ transformBox: "fill-box", transformOrigin: "center bottom" }}
      >
        <ellipse cx={vx} cy={hy + 2} rx="7" ry="2.5" fill={INK} opacity="0.25" />
        <path
          d={`M${vx} ${hy}c-1.5-6-11-12-11-21a11 11 0 1 1 22 0c0 9-9.5 15-11 21z`}
          fill={principal ? "#4318E0" : "#FF6B2C"}
          stroke={INK}
          strokeWidth="2.4"
          strokeLinejoin="round"
        />
        <circle cx={vx} cy={hy - 21} r="4.6" fill="#DDF78A" stroke={INK} strokeWidth="2" />
      </g>
    </svg>
  );
}

/**
 * All branches on one stylized Saltillo map: sierra on the horizon, dashed routes from the main
 * site to the others, numbered pins. Projected from lat/lng so relative positions are real.
 */
export function CityPins({ locations, className }: { locations: Branch[]; className?: string }) {
  const W = 320;
  const H = 180;
  const pts = locations.length ? locations.map((l) => l.location) : [SALTILLO_CENTER];
  const lats = pts.map((p) => p.lat);
  const lngs = pts.map((p) => p.lng);
  // Same scale on both axes (lng shrinks by cos(lat) ≈ 0.9 here), at least ~4 km across, centered.
  const K = 0.9;
  const cLat = (Math.min(...lats) + Math.max(...lats)) / 2;
  const cLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
  const spanX = Math.max((Math.max(...lngs) - Math.min(...lngs)) * K, 0.04);
  const spanY = Math.max(Math.max(...lats) - Math.min(...lats), 0.03);
  const scale = Math.min((W - 70) / spanX, (H - 112) / spanY);
  const project = (p: LatLng) => ({
    x: W / 2 + (p.lng - cLng) * K * scale,
    y: 46 + (H - 112) / 2 + (cLat - p.lat) * scale,
  });
  const xy = locations.map((l) => project(l.location));
  const main = xy[0];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} aria-hidden className={cn("overflow-visible", className)}>
      {/* street grid */}
      <g stroke="currentColor" strokeOpacity="0.14" strokeWidth="1.5">
        {[40, 80, 120, 160, 200, 240, 280].map((x) => (
          <path key={`v${x}`} d={`M${x} 0V${H - 30}`} />
        ))}
        {[24, 56, 88, 120].map((y) => (
          <path key={`h${y}`} d={`M0 ${y}H${W}`} />
        ))}
      </g>
      {/* Sierra de Zapalinamé on the horizon */}
      <path
        d={`M0 ${H}V${H - 26}l34-20 22 12 30-26 26 18 20-10 34 24 28-22 30 16 24-14 36 22 36-12V${H}z`}
        fill="#160F33"
        fillOpacity="0.55"
      />
      <path
        d={`M0 ${H}V${H - 12}l40-10 30 8 44-14 36 12 40-8 38 10 46-12 46 10V${H}z`}
        fill="#160F33"
        fillOpacity="0.8"
      />
      {/* routes from the main site */}
      {main
        ? xy.slice(1).map((p, i) => (
            <path
              key={i}
              d={`M${main.x} ${main.y}Q${(main.x + p.x) / 2} ${Math.min(main.y, p.y) - 24} ${p.x} ${p.y}`}
              fill="none"
              stroke="#DDF78A"
              strokeWidth="2.5"
              strokeDasharray="6 6"
              strokeLinecap="round"
            />
          ))
        : null}
      {/* pins (main last so it's on top) */}
      {xy
        .map((p, i) => ({ p, i }))
        .toReversed()
        .map(({ p, i }) => (
          <g key={locations[i].id} className="animate-pop-in" style={{ "--i": Math.min(i + 2, 8) } as React.CSSProperties}>
            <ellipse cx={p.x} cy={p.y + 2} rx="9" ry="3" fill="#000" opacity="0.3" />
            <path
              d={`M${p.x} ${p.y}c-2-8-14-15-14-27a14 14 0 1 1 28 0c0 12-12 19-14 27z`}
              fill={i === 0 ? "#DDF78A" : "#FFFFFF"}
              stroke={INK}
              strokeWidth="2.6"
              strokeLinejoin="round"
            />
            <text
              x={p.x}
              y={p.y - 22}
              textAnchor="middle"
              fontSize="14"
              fontWeight="800"
              fill={INK}
              style={{ fontFamily: "var(--font-display)" }}
            >
              {i + 1}
            </text>
          </g>
        ))}
    </svg>
  );
}

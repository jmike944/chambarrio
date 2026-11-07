import { MAX_RADIUS, RADIUS_STOPS, type RadiusKm } from "@/lib/geo";
import type { Branch, CategoryId, Company } from "@/lib/data/types";
import type { JobWithDistance } from "@/lib/store";

/** One place on the radar: a company branch and every vacancy open there. */
export type RadarSpot = {
  /** = branchId */
  id: string;
  branch: Branch;
  company: Company;
  /** Vacancies at this branch, urgent first, then newest. */
  jobs: JobWithDistance[];
  km: number;
  /** Most common category among its vacancies (drives the pin art + drawer tone). */
  category: CategoryId;
  inside: boolean;
  /** Drawn position in radar units (after nudging overlapping pins apart). */
  x: number;
  y: number;
};

export type RadarGeometry = {
  /** Center of the radar, in viewBox units. */
  c: number;
  /** km → distance from center, in viewBox units. */
  scale: (km: number) => number;
  /** Outer plate radius. */
  outer: number;
};

function topCategory(jobs: JobWithDistance[]): CategoryId {
  const n = new Map<CategoryId, number>();
  for (const j of jobs) n.set(j.category, (n.get(j.category) ?? 0) + 1);
  let best = jobs[0].category;
  for (const [k, v] of n) if (v > (n.get(best) ?? 0)) best = k;
  return best;
}

/** Minimum spacing between drawn markers (pins are 32 units wide; outside dots ~11). */
const GAP = { pin: 33, mixed: 23, dot: 12 } as const;

/**
 * Groups vacancies by branch (they share coordinates) and lays the spots out at their real bearing
 * and square-root distance, then nudges overlapping markers apart just enough to tap them.
 * Deterministic, so server and client agree.
 */
export type SpotLookup = {
  branchById: Record<string, Branch>;
  companyById: Record<string, Company>;
};

export function layoutSpots(
  jobs: JobWithDistance[],
  radiusKm: number,
  geo: RadarGeometry,
  lookup: SpotLookup,
  bearings?: Record<string, number>,
): RadarSpot[] {
  const groups = new Map<string, JobWithDistance[]>();
  for (const j of jobs) {
    if (j.km > MAX_RADIUS) continue;
    // A vacancy whose branch/company isn't in the catalog (mid-refresh) can't be drawn as a place.
    if (!lookup.branchById[j.branchId] || !lookup.companyById[j.companyId]) continue;
    const g = groups.get(j.branchId);
    if (g) g.push(j);
    else groups.set(j.branchId, [j]);
  }

  const spots: RadarSpot[] = [...groups.entries()].map(([id, list]) => {
    const first = list[0];
    const km = Math.min(...list.map((j) => j.km));
    const b = (((bearings?.[first.id] ?? first.bearing) % 360) * Math.PI) / 180;
    const r = geo.scale(km);
    return {
      id,
      branch: lookup.branchById[id],
      company: lookup.companyById[first.companyId],
      jobs: list.toSorted((a, z) => Number(!!z.urgent) - Number(!!a.urgent) || a.postedMinutesAgo - z.postedMinutesAgo),
      km,
      category: topCategory(list),
      inside: km <= radiusKm,
      x: geo.c + r * Math.sin(b),
      y: geo.c - r * Math.cos(b),
    };
  });
  spots.sort((a, b) => a.km - b.km || a.id.localeCompare(b.id));

  // Relax: push pairs apart until nothing overlaps, keep everyone off the house and on the plate.
  const rMin = 34;
  const rMax = geo.outer - 14;
  for (let iter = 0; iter < 80; iter++) {
    let moved = false;
    for (let i = 0; i < spots.length; i++) {
      for (let k = i + 1; k < spots.length; k++) {
        const a = spots[i];
        const z = spots[k];
        const min = a.inside && z.inside ? GAP.pin : a.inside || z.inside ? GAP.mixed : GAP.dot;
        let dx = z.x - a.x;
        let dy = z.y - a.y;
        let d = Math.hypot(dx, dy);
        if (d >= min) continue;
        if (d < 0.01) {
          // Same spot: fan out along a deterministic angle.
          const t = ((i * 137.5 + k * 61) * Math.PI) / 180;
          dx = Math.cos(t);
          dy = Math.sin(t);
          d = 1;
        }
        const push = (min - d) / 2 + 0.01;
        const ux = dx / d;
        const uy = dy / d;
        a.x -= ux * push;
        a.y -= uy * push;
        z.x += ux * push;
        z.y += uy * push;
        moved = true;
      }
    }
    for (const s of spots) {
      const dx = s.x - geo.c;
      const dy = s.y - geo.c;
      const d = Math.hypot(dx, dy) || 1;
      const lo = s.inside ? rMin : rMin - 6;
      const clamped = Math.min(rMax, Math.max(lo, d));
      if (clamped !== d) {
        s.x = geo.c + (dx / d) * clamped;
        s.y = geo.c + (dy / d) * clamped;
      }
    }
    if (!moved) break;
  }
  return spots;
}

/** Smallest radius stop that reaches `km` (null when it's beyond the radar). */
export function stopFor(km: number): RadiusKm | null {
  return RADIUS_STOPS.find((s) => s >= km) ?? null;
}

export function vacantes(n: number) {
  return n === 1 ? "1 vacante" : `${n} vacantes`;
}

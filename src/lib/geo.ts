export type LatLng = { lat: number; lng: number };

/** Plaza de Armas, Saltillo — default when we don't know where the user lives. */
export const SALTILLO_CENTER: LatLng = { lat: 25.4232, lng: -101.0005 };

export const RADIUS_STOPS = [2, 5, 10, 15] as const;
export type RadiusKm = (typeof RADIUS_STOPS)[number];
export const MAX_RADIUS: RadiusKm = 15;

export type Band = "nopal" | "cielo" | "maiz" | "rosa" | "fuera";

const R = 6371;
const toRad = (d: number) => (d * Math.PI) / 180;

export function distanceKm(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Bearing in degrees (0 = north, clockwise). */
export function bearing(a: LatLng, b: LatLng): number {
  const y = Math.sin(toRad(b.lng - a.lng)) * Math.cos(toRad(b.lat));
  const x =
    Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) -
    Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(toRad(b.lng - a.lng));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

export function bandFor(km: number): Band {
  if (km <= 2) return "nopal";
  if (km <= 5) return "cielo";
  if (km <= 10) return "maiz";
  if (km <= 15) return "rosa";
  return "fuera";
}

export const BAND_LABEL: Record<Band, string> = {
  nopal: "Muy cerca",
  cielo: "Cerca",
  maiz: "A media ciudad",
  rosa: "Lejos",
  fuera: "Fuera de tu radio",
};

/** CSS color var for a band — use in style={{ color }} / SVG stroke. */
export function bandColor(band: Band): string {
  return band === "fuera" ? "var(--muted-foreground)" : `var(--${band})`;
}

export function formatKm(km: number): string {
  if (km < 1) return `${Math.max(100, Math.round((km * 1000) / 50) * 50)} m`;
  return `${km.toLocaleString("es-MX", { maximumFractionDigits: 1, minimumFractionDigits: 1 })} km`;
}

/** Round coordinates to ~500 m so exact homes are never exposed. */
export function approximate(p: LatLng): LatLng {
  const step = 0.005;
  return { lat: Math.round(p.lat / step) * step, lng: Math.round(p.lng / step) * step };
}

// ---- Commute model (estimates for Saltillo, 2026) ----
const ROAD_FACTOR = 1.3; // straight line → street distance
const BUS_FARE = 13; // MXN per trip
const CAR_COST_PER_KM = 2.1; // gasoline ~$25/L at ~12 km/L
const WORK_DAYS = 22;
/** Typical one-way commute in the Saltillo–Ramos Arizpe metro area. */
export const CITY_AVG_KM = 14;

export type CommuteMode = "caminando" | "bici" | "camion" | "auto";
export type Commute = { mode: CommuteMode; label: string; minutes: number; costPerDay: number };

export function commuteOptions(km: number): Commute[] {
  const road = km * ROAD_FACTOR;
  const out: Commute[] = [];
  if (road <= 3.5) out.push({ mode: "caminando", label: "Caminando", minutes: Math.round((road / 4.8) * 60), costPerDay: 0 });
  if (road <= 9) out.push({ mode: "bici", label: "En bici", minutes: Math.round((road / 14) * 60), costPerDay: 0 });
  out.push({ mode: "camion", label: "En camión", minutes: Math.round((road / 16) * 60 + 8), costPerDay: BUS_FARE * 2 });
  out.push({ mode: "auto", label: "En auto", minutes: Math.max(3, Math.round((road / 28) * 60)), costPerDay: Math.round(road * 2 * CAR_COST_PER_KM) });
  return out;
}

/** Monthly hours and pesos saved vs. the city-average commute, working within `km`. */
export function monthlySavings(km: number) {
  const diff = Math.max(0, CITY_AVG_KM - km) * ROAD_FACTOR;
  const hours = Math.round(((diff / 20) * 2 * WORK_DAYS * 10) / 10);
  const pesos = Math.round((diff * 2 * WORK_DAYS * CAR_COST_PER_KM) / 10) * 10;
  return { hours, pesos };
}

/** GeoJSON polygon approximating a circle, for map radius overlays. */
export function circlePolygon(center: LatLng, radiusKm: number, steps = 72) {
  const coords: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * 2 * Math.PI;
    const dLat = (radiusKm / R) * (180 / Math.PI) * Math.cos(t);
    const dLng = ((radiusKm / R) * (180 / Math.PI) * Math.sin(t)) / Math.cos(toRad(center.lat));
    coords.push([center.lng + dLng, center.lat + dLat]);
  }
  return {
    type: "Feature" as const,
    properties: {},
    geometry: { type: "Polygon" as const, coordinates: [coords] },
  };
}

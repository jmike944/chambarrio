/*
 * Interview places and map links. Pure: safe in server components.
 */
import type { Branch } from "@/lib/data/types";
import { PIPELINE_LIMITS } from "./steps";

type BranchLike = Pick<Branch, "name" | "colonia"> & Partial<Pick<Branch, "location">>;

const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

/**
 * The prefilled interview place for a branch: "Farmacias Bienestar · Sucursal Lourdes" or
 * "Logística Zapalinamé · CEDIS Santa Mónica · Parque Industrial Santa Mónica" (the colonia is
 * skipped when the branch name already says it). Max 160 chars, like the database.
 */
export function defaultInterviewPlace(branch: BranchLike, companyName?: string | null): string {
  const parts: string[] = [];
  const push = (s: string | null | undefined) => {
    const v = s?.trim();
    if (v && !parts.some((p) => fold(p).includes(fold(v)))) parts.push(v);
  };
  push(companyName);
  push(branch.name);
  if (!fold(branch.name).includes(fold(branch.colonia))) push(branch.colonia);
  return parts.join(" · ").slice(0, PIPELINE_LIMITS.place);
}

const HAS_CITY = /saltillo|ramos arizpe|arteaga|derramadero|coahuila|coah\b/i;

/**
 * Google Maps link (opens the app on phones). Uses the branch pin when the place is empty or is
 * the branch itself; otherwise searches the typed place in Saltillo. Null when there's nothing.
 */
export function mapsLink(target: { place?: string | null; branch?: BranchLike | null; companyName?: string | null }): string | null {
  const place = target.place?.trim() || null;
  const b = target.branch ?? null;
  const loc = b?.location;
  const isBranch =
    !!b && (!place || place === defaultInterviewPlace(b, target.companyName) || fold(place).includes(fold(b.name)));
  if (loc && isBranch) return `https://www.google.com/maps/search/?api=1&query=${loc.lat},${loc.lng}`;
  const text = place ?? (b ? defaultInterviewPlace(b, target.companyName) : null);
  if (!text) return null;
  const q = HAS_CITY.test(text) ? text : `${text}, Saltillo, Coah.`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

/** Turn-by-turn directions to a point ("Cómo llegar"). */
export function directionsLink(location: { lat: number; lng: number }): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${location.lat},${location.lng}`;
}

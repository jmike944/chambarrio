import type { CategoryId } from "@/lib/data/types";

/*
 * Vacancies from other job boards. Careerjet's (asked per visit, with the visitor's IP) live in their
 * own section ("Más vacantes en Saltillo"). Jooble's are also synced into the database every hour
 * (SyncJob, /api/vacantes-externas?solo=jooble → public.external_jobs_tick) so they show on Inicio,
 * the map and the radar, at an approximate location. Each one links back to the board to apply.
 */

export type ExternalProvider = "jooble" | "careerjet";

export type ExternalJob = {
  /** `${provider}:${their id}`. */
  id: string;
  provider: ExternalProvider;
  title: string;
  company: string | null;
  /** As the board writes it: "Saltillo, Coahuila", "Ramos Arizpe"… */
  location: string;
  /** Our category, guessed from the title (vacancies that fit none aren't returned). */
  category: CategoryId;
  /** Ready to show ("$9,000 – $11,000 al mes"), or null. Never a board's estimate. */
  pay: string | null;
  /** Short excerpt, plain text. */
  snippet: string;
  /** ISO instant, when the board says. */
  postedAt: string | null;
  /** Where to apply: the board's own link (they count the click). */
  url: string;
};

export type ExternalJobsResponse = {
  jobs: ExternalJob[];
  /** Boards that answered (attribution is shown for these). */
  providers: ExternalProvider[];
};

export const PROVIDER_META: Record<ExternalProvider, { label: string; home: string }> = {
  jooble: { label: "Jooble", home: "https://mx.jooble.org" },
  careerjet: { label: "Careerjet", home: "https://www.careerjet.com.mx" },
};

/** One Jooble vacancy as the database sync takes it (GET /api/vacantes-externas?solo=jooble). */
export type SyncJob = {
  /** Jooble's own id. */
  id: string;
  title: string;
  company: string;
  city: "saltillo" | "ramos-arizpe" | "arteaga" | "derramadero";
  category: CategoryId;
  /** 0 when the board doesn't say (shown as "Sueldo no publicado"). */
  payMin: number;
  payMax: number | null;
  period: "semana" | "quincena" | "mes" | "dia";
  snippet: string;
  postedAt: string | null;
  url: string;
};

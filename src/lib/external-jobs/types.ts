import type { CategoryId } from "@/lib/data/types";

/*
 * Vacancies from other job boards (Jooble, Careerjet), shown in their own section
 * ("Más vacantes en Saltillo"), never on the map or the radar: they only say the city, not the
 * branch. Read-only and never stored: each one links back to the board, where people apply.
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

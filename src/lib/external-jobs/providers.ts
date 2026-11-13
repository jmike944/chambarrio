import "server-only";
import { categorize, dedupeKey, inOurArea, payText, plainSnippet } from "./classify";
import type { ExternalJob, ExternalProvider, ExternalJobsResponse } from "./types";

/*
 * Server-side fetchers for the outside job boards. Each one runs only when its key is set (Vercel →
 * Settings → Environment Variables; see .env.example), so without keys nothing is called and the
 * section doesn't show. Keys never reach the browser.
 *
 *   Jooble     POST {JOOBLE_API_HOST}/api/{key}               JOOBLE_API_KEY (a key for Mexico)
 *   Careerjet  GET  search.api.careerjet.net/v4/query         CAREERJET_API_KEY (Basic auth)
 *
 * Jooble's answers are cached for an hour (Next fetch cache: shared by every visitor, survives
 * instances), which keeps us far under its free key's 100 requests a day.
 * Careerjet requires the visitor's IP and user agent on every query, so it's asked live, per visit.
 * Careerjet also only answers servers on the account's IP allowlist ("Unauthorized access from IP"):
 * it needs a fixed outbound IP, which Vercel functions don't have without the Static IPs add-on.
 */

const TIMEOUT_MS = 4500;
const REVALIDATE_S = 3600;
/** Raw items asked per board (before keeping only operative jobs in our area). */
const PER_BOARD = 100;
/** At most this many go back to the page. */
const MAX_JOBS = 60;

type Raw = Omit<ExternalJob, "category"> & { category?: undefined };

const num = (v: unknown): number | null => {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
};
const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
const isoOrNull = (v: unknown): string | null => {
  const t = Date.parse(str(v));
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
};
const httpUrl = (v: unknown): string | null => {
  const s = str(v);
  return /^https?:\/\/\S+$/i.test(s) ? s : null;
};

function withTimeout(ms: number): AbortSignal {
  return AbortSignal.timeout(ms);
}

// ------------------------------------------------------------------ Jooble

/**
 * Two searches, one per group of trades: commas work as "or" in Jooble's keywords. With no keywords
 * the feed is mostly office and engineering jobs (~15% operative); grouped, ~75–95% are. Two calls
 * an hour, cached, stay well under the free key's 100 a day.
 */
const JOOBLE_QUERIES = [
  "operador, ayudante general, auxiliar de produccion, almacenista, montacargas, chofer, repartidor, guardia de seguridad",
  "cajero, vendedor, mesero, cocinero, limpieza, intendencia, tecnico de mantenimiento, albañil, recepcionista",
];

async function joobleSearch(host: string, key: string, keywords: string): Promise<unknown[]> {
  const res = await fetch(`${host}/api/${encodeURIComponent(key)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ keywords, location: "Saltillo, Coahuila", radius: "26", page: "1", ResultOnPage: String(PER_BOARD) }),
    // A POST is only cached when asked to explicitly.
    cache: "force-cache",
    next: { revalidate: REVALIDATE_S },
    signal: withTimeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`jooble ${res.status}`);
  const data = (await res.json()) as { jobs?: unknown[] };
  return data.jobs ?? [];
}

async function fetchJooble(): Promise<Raw[] | null> {
  const key = process.env.JOOBLE_API_KEY?.trim();
  if (!key) return null;
  const host = (process.env.JOOBLE_API_HOST?.trim() || "https://mx.jooble.org").replace(/\/+$/, "");
  const settled = await Promise.allSettled(JOOBLE_QUERIES.map((q) => joobleSearch(host, key, q)));
  if (settled.every((s) => s.status === "rejected")) throw (settled[0] as PromiseRejectedResult).reason;
  const items = settled.flatMap((s) => (s.status === "fulfilled" ? s.value : []));
  return items.flatMap((r): Raw[] => {
    const j = r as Record<string, unknown>;
    const url = httpUrl(j.link);
    const title = plainSnippet(str(j.title), 120);
    if (!url || !title) return [];
    // Their salary is already text ("$11,000 - $13,000", "$2,720 por semana"); keep it as they wrote it.
    const salary = plainSnippet(str(j.salary), 48);
    return [
      {
        id: `jooble:${str(String(j.id ?? "")) || url}`,
        provider: "jooble",
        title,
        company: str(j.company) || null,
        location: str(j.location),
        pay: /\d/.test(salary) ? salary : null,
        snippet: plainSnippet(str(j.snippet)),
        postedAt: isoOrNull(j.updated),
        url,
      },
    ];
  });
}

// ------------------------------------------------------------------ Careerjet

const CAREERJET_PER: Record<string, "al mes" | "a la semana" | "al día" | "por hora"> = {
  M: "al mes",
  W: "a la semana",
  D: "al día",
  H: "por hora",
};

/** The visitor: Careerjet refuses queries without their IP and user agent (fraud checks). */
export type Visitor = { ip: string; userAgent: string };

async function fetchCareerjet(visitor: Visitor | null): Promise<Raw[] | null> {
  const key = process.env.CAREERJET_API_KEY?.trim();
  if (!key || !visitor?.ip || !visitor.userAgent) return null;
  const q = new URLSearchParams({
    locale_code: "es_MX",
    location: "Saltillo",
    radius: "25",
    sort: "date",
    page_size: String(PER_BOARD),
    fragment_size: "180",
    user_ip: visitor.ip,
    user_agent: visitor.userAgent,
  });
  const res = await fetch(`https://search.api.careerjet.net/v4/query?${q}`, {
    headers: { Authorization: `Basic ${Buffer.from(`${key}:`).toString("base64")}`, Accept: "application/json" },
    cache: "no-store",
    signal: withTimeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`careerjet ${res.status}`);
  const data = (await res.json()) as { type?: string; jobs?: unknown[] };
  if (data.type !== "JOBS") return [];
  return (data.jobs ?? []).flatMap((r, i): Raw[] => {
    const j = r as Record<string, unknown>;
    const url = httpUrl(j.url);
    const title = plainSnippet(str(j.title), 120);
    if (!url || !title) return [];
    const type = str(j.salary_type).toUpperCase();
    let min = num(j.salary_min);
    let max = num(j.salary_max);
    let per = CAREERJET_PER[type];
    if (type === "Y") {
      min = min != null ? min / 12 : null;
      max = max != null ? max / 12 : null;
      per = "al mes";
    }
    const currency = str(j.salary_currency_code).toUpperCase();
    const pay = per && (!currency || currency === "MXN") ? payText(min, max, per) : null;
    return [
      {
        id: `careerjet:${url.length > 200 ? `${i}-${title}` : url}`,
        provider: "careerjet",
        title,
        company: str(j.company) || null,
        location: str(j.locations),
        pay,
        snippet: plainSnippet(str(j.description)),
        postedAt: isoOrNull(j.date),
        url,
      },
    ];
  });
}

// ------------------------------------------------------------------ all of them

/** True when at least one board has its key (the page shows the section only then). */
export const externalJobsConfigured = () => !!(process.env.JOOBLE_API_KEY?.trim() || process.env.CAREERJET_API_KEY?.trim());

/**
 * Operative vacancies in Saltillo / Ramos Arizpe / Arteaga from every configured board: classified
 * into our categories, de-duplicated across boards (the one that shows pay wins), newest first. A
 * board that fails or times out is skipped (logged), never the whole answer.
 */
export async function getExternalJobs(visitor: Visitor | null): Promise<ExternalJobsResponse> {
  const boards: [ExternalProvider, () => Promise<Raw[] | null>][] = [
    ["jooble", fetchJooble],
    ["careerjet", () => fetchCareerjet(visitor)],
  ];
  const settled = await Promise.allSettled(boards.map(([, run]) => run()));
  const providers: ExternalProvider[] = [];
  const byKey = new Map<string, ExternalJob>();
  settled.forEach((s, i) => {
    const provider = boards[i][0];
    if (s.status === "rejected") {
      console.warn(`[vacantes-externas] ${provider}: ${s.reason instanceof Error ? s.reason.message : String(s.reason)}`);
      return;
    }
    if (!s.value) return; // not configured
    providers.push(provider);
    for (const raw of s.value) {
      const category = categorize(raw.title);
      if (!category || !inOurArea(raw.location)) continue;
      const job: ExternalJob = { ...raw, category };
      const key = dedupeKey(job.title, job.company);
      const seen = byKey.get(key);
      if (!seen || (!seen.pay && job.pay)) byKey.set(key, job);
    }
  });
  const jobs = [...byKey.values()]
    .sort((a, b) => (b.postedAt ?? "").localeCompare(a.postedAt ?? ""))
    .slice(0, MAX_JOBS);
  return { jobs, providers };
}

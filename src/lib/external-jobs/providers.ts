import "server-only";
import { ProxyAgent, fetch as fetchVia } from "undici";
import { categorize, cityOf, dedupeKey, inOurArea, parsePayText, payText, plainSnippet } from "./classify";
import type { CategoryId } from "@/lib/data/types";
import type { ExternalJob, ExternalProvider, ExternalJobsResponse, SyncJob } from "./types";

/*
 * Server-side fetchers for the outside job boards. Each one runs only when its key is set (Vercel →
 * Settings → Environment Variables; see .env.example), so without keys nothing is called and the
 * section doesn't show. Keys never reach the browser.
 *
 *   Jooble     POST {JOOBLE_API_HOST}/api/{key}               JOOBLE_API_KEY (a key for Mexico)
 *   Careerjet  GET  search.api.careerjet.net/v4/query         CAREERJET_API_KEY (Basic auth) + FIXIE_URL
 *
 * Jooble's answers are cached for an hour (Next fetch cache: shared by every visitor, survives
 * instances), which keeps us far under its free key's 100 requests a day.
 * Careerjet requires the visitor's IP and user agent on every query, so it's asked live, per visit.
 * Careerjet also only answers servers on the account's IP allowlist ("Unauthorized access from IP"),
 * and Vercel functions have no fixed outbound IP. So Careerjet calls (only those) go out through a
 * static-IP proxy: Fixie from the Vercel Marketplace sets FIXIE_URL (CAREERJET_PROXY_URL overrides
 * it), and Fixie's two IPs go on Careerjet's allowlist. Without a proxy URL Careerjet isn't called.
 */

const TIMEOUT_MS = 4500;
const REVALIDATE_S = 3600;
/** Raw items asked per board (before keeping only operative jobs in our area). */
const PER_BOARD = 100;
/** At most this many go back to the page. */
const MAX_JOBS = 120;

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

/** "fetch failed" alone says nothing: add the network cause ("ECONNREFUSED 1.2.3.4:80"). Never the URL (it has keys). */
function describeError(e: unknown): string {
  if (!(e instanceof Error)) return String(e);
  const c = e.cause as { code?: unknown; address?: unknown; port?: unknown; message?: unknown } | undefined;
  if (!c) return e.message;
  const where = typeof c.address === "string" ? ` ${c.address}${c.port != null ? `:${String(c.port)}` : ""}` : "";
  const code = typeof c.code === "string" ? c.code : typeof c.message === "string" ? c.message : "";
  return code ? `${e.message} (${code}${where})` : e.message;
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

/** The page the results appear on, on the website declared in Careerjet's publisher account. */
const CAREERJET_REFERER = "https://chambarrio.com/vacantes";

const careerjetProxyUrl = () => (process.env.CAREERJET_PROXY_URL || process.env.FIXIE_URL)?.trim() || null;

let proxy: { url: string; agent: ProxyAgent } | null = null;
/** One keep-alive agent per instance (credentials go in the URL: http://user:pass@host:port). */
function careerjetProxy(url: string): ProxyAgent {
  if (proxy?.url !== url) proxy = { url, agent: new ProxyAgent(url) };
  return proxy.agent;
}

/**
 * What to ask Careerjet. With no keywords it sends mostly office jobs (3 of 100 operative), and each
 * search is one proxy request per visit (Fixie's free plan: 500 a month), so there's one search per
 * visit: about one of the visitor's interests when they have some, else one of the broad words that
 * brings the most operative ads. Careerjet ANDs words and has few Saltillo ads, so single broad words
 * work best (Nov 17 hit counts: "limpieza" 73, "promotor" 36, "cajero" 12, "auxiliar de almacén" 9,
 * "repartidor" 8, "montacargas" 7, "guardia de seguridad" 5, "operador de producción" 4, and 0 for
 * "ayudante de cocina", "albañil", "electricista", "auxiliar administrativo"). Results of any trade
 * are kept: the classifier sorts them into categories.
 */
const CAREERJET_KEYWORDS: Record<CategoryId, string[]> = {
  produccion: ["operador", "ayudante general", "secundaria"],
  almacen: ["auxiliar de almacén", "almacenista"],
  montacargas: ["montacargas"],
  chofer: ["chofer", "repartidor"],
  restaurante: ["mesero", "cocinero", "secundaria"],
  caja: ["cajero", "promotor"],
  ventas: ["promotor", "vendedor"],
  limpieza: ["limpieza"],
  mantenimiento: ["técnico", "mecánico"],
  construccion: ["construcción", "secundaria"],
  seguridad: ["guardia"],
  oficina: ["recepcionista", "administrativo"],
};
/** No interests: the broad words with the most operative ads. */
const CAREERJET_BROAD = ["limpieza", "promotor", "secundaria", "operador", "cajero"];
const pickOne = <T,>(xs: readonly T[]): T => xs[Math.floor(Math.random() * xs.length)];

export function careerjetKeywords(interests: readonly CategoryId[]): string {
  const valid = interests.filter((c) => Object.hasOwn(CAREERJET_KEYWORDS, c));
  return valid.length ? pickOne(CAREERJET_KEYWORDS[pickOne(valid)]) : pickOne(CAREERJET_BROAD);
}

async function fetchCareerjet(visitor: Visitor | null, interests: readonly CategoryId[]): Promise<Raw[] | null> {
  const key = process.env.CAREERJET_API_KEY?.trim();
  const proxyUrl = careerjetProxyUrl();
  if (!key || !proxyUrl || !visitor?.ip || !visitor.userAgent) return null;
  const keywords = careerjetKeywords(interests);
  const q = new URLSearchParams({
    locale_code: "es_MX",
    keywords,
    location: "Saltillo",
    radius: "25",
    sort: "date",
    page_size: String(PER_BOARD),
    fragment_size: "180",
    user_ip: visitor.ip,
    user_agent: visitor.userAgent,
  });
  // undici's own fetch (not Next's): it takes the proxy as `dispatcher`. Never cached (per visitor).
  const res = await fetchVia(`https://search.api.careerjet.net/v4/query?${q}`, {
    headers: {
      Authorization: `Basic ${Buffer.from(`${key}:`).toString("base64")}`,
      Accept: "application/json",
      // Careerjet refuses calls without a Referer on the website declared in the publisher account
      // ("Undeclared referrer"): chambarrio.com, where these results are shown.
      Referer: CAREERJET_REFERER,
    },
    dispatcher: careerjetProxy(proxyUrl),
    signal: withTimeout(TIMEOUT_MS),
  });
  if (!res.ok) {
    // Their error says why ("Unauthorized access from IP …", "Missing param user_ip …"). IPs keep only
    // their first three parts: enough to tell the proxy's from a visitor's, without logging the visitor.
    const why = await res
      .text()
      .then((t) => str((JSON.parse(t) as { error?: unknown }).error))
      .catch(() => "");
    const masked = why.replace(/\b(\d{1,3}\.\d{1,3}\.\d{1,3})\.\d{1,3}\b/g, "$1.x").slice(0, 160);
    throw new Error(`careerjet ${res.status}${masked ? `: ${masked}` : ""}`);
  }
  const data = (await res.json()) as { type?: string; hits?: unknown; jobs?: unknown[] };
  // For tuning CAREERJET_KEYWORDS (no visitor data): which search, how many results.
  console.info(`[vacantes-externas] careerjet "${keywords}": ${data.type === "JOBS" ? `${num(data.hits) ?? 0} hits` : str(data.type) || "?"}`);
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
export const externalJobsConfigured = () =>
  !!(process.env.JOOBLE_API_KEY?.trim() || (process.env.CAREERJET_API_KEY?.trim() && careerjetProxyUrl()));

/**
 * Operative vacancies in Saltillo / Ramos Arizpe / Arteaga from every configured board: classified
 * into our categories, de-duplicated across boards (the one that shows pay wins), newest first. A
 * board that fails or times out is skipped (logged), never the whole answer.
 */
export async function getExternalJobs(visitor: Visitor | null, interests: readonly CategoryId[] = []): Promise<ExternalJobsResponse> {
  const boards: [ExternalProvider, () => Promise<Raw[] | null>][] = [
    ["jooble", fetchJooble],
    ["careerjet", () => fetchCareerjet(visitor, interests)],
  ];
  const settled = await Promise.allSettled(boards.map(([, run]) => run()));
  const providers: ExternalProvider[] = [];
  const byKey = new Map<string, ExternalJob>();
  settled.forEach((s, i) => {
    const provider = boards[i][0];
    if (s.status === "rejected") {
      console.warn(`[vacantes-externas] ${provider}: ${describeError(s.reason)}`);
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
      byKey.set(key, seen ? pickDuplicate(seen, job) : job);
    }
  });
  return { jobs: interleave([...byKey.values()]).slice(0, MAX_JOBS), providers };
}

/**
 * The same vacancy on two boards: keep Careerjet's link (it pays Chambarrio per click), with the other
 * copy's pay and excerpt when Careerjet's has none. Otherwise the copy that shows pay.
 */
function pickDuplicate(a: ExternalJob, b: ExternalJob): ExternalJob {
  const paid = a.provider === "careerjet" ? a : b.provider === "careerjet" ? b : null;
  if (paid && a.provider !== b.provider) {
    const other = paid === a ? b : a;
    return { ...paid, pay: paid.pay ?? other.pay, snippet: paid.snippet || other.snippet };
  }
  return !a.pay && b.pay ? b : a;
}

/**
 * Newest first within each board, then the boards take turns, so one board's volume (Jooble sends
 * ~60 a search) never pushes the other off the first screen.
 */
function interleave(jobs: ExternalJob[]): ExternalJob[] {
  const newest = (a: ExternalJob, b: ExternalJob) => (b.postedAt ?? "").localeCompare(a.postedAt ?? "");
  const lanes = [...new Set(jobs.map((j) => j.provider))].map((p) => jobs.filter((j) => j.provider === p).sort(newest));
  const out: ExternalJob[] = [];
  for (let i = 0; out.length < jobs.length; i++) for (const lane of lanes) if (lane[i]) out.push(lane[i]);
  return out;
}

/**
 * Jooble's operative vacancies in the area, shaped for the hourly database sync
 * (public.external_jobs_tick). null when Jooble isn't configured. Needs a company and a town we know;
 * pay comes parsed (0 = not published).
 */
export async function getJoobleForSync(): Promise<SyncJob[] | null> {
  const raws = await fetchJooble();
  if (!raws) return null;
  const byId = new Map<string, SyncJob>();
  for (const r of raws) {
    const category = categorize(r.title);
    const city = cityOf(r.location);
    const id = r.id.replace(/^jooble:/, "");
    if (!category || !city || !r.company || !/^-?\d{1,30}$/.test(id)) continue;
    const pay = parsePayText(r.pay);
    byId.set(id, {
      id,
      title: r.title,
      company: r.company.slice(0, 120),
      city,
      category,
      payMin: pay?.min ?? 0,
      payMax: pay?.max ?? null,
      period: pay?.period ?? "mes",
      snippet: r.snippet,
      postedAt: r.postedAt,
      url: r.url,
    });
  }
  return [...byId.values()];
}

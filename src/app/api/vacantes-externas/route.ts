import type { NextRequest } from "next/server";
import { externalJobsConfigured, getExternalJobs, getJoobleForSync, type Visitor } from "@/lib/external-jobs/providers";
import { CATEGORY_BY_ID } from "@/lib/data/categories";
import type { CategoryId } from "@/lib/data/types";
import type { ExternalJobsResponse } from "@/lib/external-jobs/types";

/*
 * GET /api/vacantes-externas[?i=<interests>] → { jobs, providers }  (?solo=jooble → { jobs: SyncJob[] }): operative vacancies in Saltillo
 * from the outside job boards whose keys are configured (none configured: an empty list, nothing is
 * called). The page filters by category itself; `i` only picks the trade Careerjet is asked about. The visitor's IP and user agent are only passed to Careerjet, which
 * requires them; they aren't logged or stored.
 */

const EMPTY: ExternalJobsResponse = { jobs: [], providers: [] };

function visitorOf(request: NextRequest): Visitor | null {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || request.headers.get("x-real-ip")?.trim() || "";
  const userAgent = request.headers.get("user-agent")?.slice(0, 400) ?? "";
  return ip && userAgent ? { ip, userAgent } : null;
}

/** ?i=produccion,chofer: the visitor's interests (up to 3 known categories), to pick Careerjet's trade. */
function interestsOf(request: NextRequest): CategoryId[] {
  const raw = request.nextUrl.searchParams.get("i") ?? "";
  return [...new Set(raw.split(","))].filter((c): c is CategoryId => Object.hasOwn(CATEGORY_BY_ID, c)).slice(0, 3);
}

export async function GET(request: NextRequest) {
  // Read the request first: the answer depends on runtime config and the visitor, never prerender it.
  const visitor = visitorOf(request);
  // ?solo=jooble: the hourly database sync (public.external_jobs_tick, via pg_net). Jooble only (its
  // answer is cached for an hour); Careerjet is never asked here: it needs a real visitor's IP.
  if (request.nextUrl.searchParams.get("solo") === "jooble") {
    try {
      const jobs = await getJoobleForSync();
      return Response.json({ jobs: jobs ?? [] }, { headers: { "Cache-Control": "no-store" } });
    } catch (e) {
      console.warn(`[vacantes-externas] sync: ${e instanceof Error ? e.message : String(e)}`);
      return Response.json({ error: "jooble" }, { status: 502, headers: { "Cache-Control": "no-store" } });
    }
  }
  if (!externalJobsConfigured()) {
    return Response.json(EMPTY, { headers: { "Cache-Control": "public, max-age=3600" } });
  }
  try {
    const data = await getExternalJobs(visitor, interestsOf(request));
    // The browser may reuse it for a while; the boards' answers are cached server-side for an hour.
    return Response.json(data, { headers: { "Cache-Control": "private, max-age=600" } });
  } catch (e) {
    console.warn(`[vacantes-externas] ${e instanceof Error ? e.message : String(e)}`);
    return Response.json(EMPTY, { headers: { "Cache-Control": "no-store" } });
  }
}

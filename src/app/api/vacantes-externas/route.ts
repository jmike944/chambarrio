import type { NextRequest } from "next/server";
import { externalJobsConfigured, getExternalJobs, type Visitor } from "@/lib/external-jobs/providers";
import type { ExternalJobsResponse } from "@/lib/external-jobs/types";

/*
 * GET /api/vacantes-externas → { jobs, providers }: operative vacancies in Saltillo from the outside
 * job boards whose keys are configured (none configured: an empty list, nothing is called). The page
 * filters by category itself. The visitor's IP and user agent are only passed to Careerjet, which
 * requires them; they aren't logged or stored.
 */

const EMPTY: ExternalJobsResponse = { jobs: [], providers: [] };

function visitorOf(request: NextRequest): Visitor | null {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || request.headers.get("x-real-ip")?.trim() || "";
  const userAgent = request.headers.get("user-agent")?.slice(0, 400) ?? "";
  return ip && userAgent ? { ip, userAgent } : null;
}

export async function GET(request: NextRequest) {
  // Read the request first: the answer depends on runtime config and the visitor, never prerender it.
  const visitor = visitorOf(request);
  if (!externalJobsConfigured()) {
    return Response.json(EMPTY, { headers: { "Cache-Control": "public, max-age=3600" } });
  }
  try {
    const data = await getExternalJobs(visitor);
    // The browser may reuse it for a while; the boards' answers are cached server-side for an hour.
    return Response.json(data, { headers: { "Cache-Control": "private, max-age=600" } });
  } catch (e) {
    console.warn(`[vacantes-externas] ${e instanceof Error ? e.message : String(e)}`);
    return Response.json(EMPTY, { headers: { "Cache-Control": "no-store" } });
  }
}

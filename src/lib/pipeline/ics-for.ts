/*
 * The interview .ics for a pipeline + its vacancy, with the place / pin / phone filled the same way
 * the candidate screen shows them. Pure.
 */
import type { ApplicationPipeline, Branch, Company, Job } from "@/lib/data/types";
import { buildInterviewIcs, icsFileName } from "./ics";
import { defaultInterviewPlace } from "./places";

export const SITE_URL = "https://chambarrio.com";

export function interviewIcsFor(
  p: ApplicationPipeline,
  ctx: {
    job?: Pick<Job, "title" | "phone"> | null;
    company?: Pick<Company, "name" | "phone"> | null;
    branch?: Branch | null;
    /** Link back to the application; default https://chambarrio.com/postulaciones */
    url?: string | null;
    now?: number;
  },
): { ics: string; fileName: string } | null {
  if (!p.interview) return null;
  const companyName = ctx.company?.name ?? "la empresa";
  const jobTitle = ctx.job?.title ?? "Vacante";
  const branchPlace = ctx.branch ? defaultInterviewPlace(ctx.branch, ctx.company?.name) : null;
  const place = p.interview.place ?? branchPlace;
  const atBranch = !!ctx.branch && (!p.interview.place || p.interview.place === branchPlace);
  // SEQUENCE only has to grow with every file handed out for this UID, so a calendar that imported an
  // earlier one takes the new time. Minutes since applying grow by themselves; counting reschedule
  // events didn't (a timeline rebuilt from the row's stamps has a single interview event, and a
  // reopen added one without any change).
  const sequence = Math.max(0, Math.floor(((ctx.now ?? Date.now()) - Date.parse(p.appliedAt)) / 60_000));
  const ics = buildInterviewIcs({
    applicationId: p.id,
    start: p.interview.at,
    jobTitle,
    companyName,
    place,
    geo: atBranch && ctx.branch ? ctx.branch.location : null,
    note: p.interview.note,
    phone: ctx.job?.phone || ctx.company?.phone || null,
    url: ctx.url === undefined ? `${SITE_URL}/postulaciones` : ctx.url,
    sequence: Number.isFinite(sequence) ? sequence : 0,
    now: ctx.now,
  });
  return { ics, fileName: icsFileName(jobTitle) };
}

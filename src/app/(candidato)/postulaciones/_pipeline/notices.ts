/*
 * Application notices for /notificaciones, derived from the real pipeline events (what the company
 * did): seen, interview scheduled (with its day/time), rescheduled, hired, declined (with the
 * message). The candidate's own actions (apply, withdraw) aren't notices. Pure.
 */
import type { ApplicationPipeline, Branch, CategoryId, Company, Job } from "@/lib/data/types";
import { DEFAULT_DECLINE_MESSAGE, DEFAULT_UNHIRE_MESSAGE, UNHIRE_COPY } from "@/lib/pipeline/steps";
import { fmtDayTime, toMs } from "@/lib/pipeline/time";
import { defaultInterviewPlace } from "@/lib/pipeline/places";

export type NoticeKind = "vacante" | "entrevista" | "reagendada" | "vista" | "contratada" | "cerrada";

export type Notice = {
  id: string;
  href: string;
  kind: NoticeKind;
  tag: string;
  title: string;
  body: string;
  /** When it happened (ms). */
  at: number;
  category?: CategoryId;
  /** A day/time to show big (interviews). */
  highlight?: string;
  /** The interview this notice is about already happened / was replaced (quiet styling). */
  stale?: boolean;
  /** A later notice changed this interview's time (strike the old time). */
  replaced?: boolean;
};

type Lookup = {
  jobById: Record<string, Job>;
  companyById: Record<string, Company>;
  branchById: Record<string, Branch>;
};

export function pipelineNotices(pipes: ApplicationPipeline[], c: Lookup, now: number): Notice[] {
  const out: Notice[] = [];
  for (const p of pipes) {
    const job = c.jobById[p.jobId];
    const company = job ? c.companyById[job.companyId] : undefined;
    const branch = job ? c.branchById[job.branchId] : undefined;
    const companyName = company?.name ?? "La empresa";
    const jobTitle = job?.title ?? "Vacante cerrada";
    const href = `/vacantes/${p.jobId}#tu-postulacion`;
    const base = { href, category: job?.category };
    const interviews = p.events.filter((e) => e.status === "entrevista");
    let interviewNo = 0;
    p.events.forEach((e, i) => {
      if (e.actor !== "empresa") return;
      const id = `${p.id}-${e.status}-${i}`;
      const at = toMs(e.at);
      switch (e.status) {
        case "vista":
          out.push({
            ...base,
            id,
            at,
            kind: "vista",
            tag: "Te vieron",
            title: `${companyName} vio tu postulación`,
            body: `${jobTitle} · Ten tu teléfono a la mano: pueden llamarte.`,
          });
          break;
        case "entrevista": {
          const first = interviewNo === 0;
          const latest = interviews.at(-1) === e;
          interviewNo++;
          const when = e.interviewAt ? fmtDayTime(e.interviewAt, { now, capitalize: true }) : undefined;
          const place = p.interview?.place ?? (branch ? defaultInterviewPlace(branch, company?.name) : null);
          const stale = !latest || p.status !== "entrevista" || (e.interviewAt ? toMs(e.interviewAt) < now : false);
          out.push(
            first
              ? {
                  ...base,
                  id,
                  at,
                  kind: "entrevista",
                  tag: "Entrevista",
                  title: `${companyName} te invitó a entrevista`,
                  body: [jobTitle, latest ? place : null].filter(Boolean).join(" · "),
                  highlight: when,
                  stale,
                  replaced: !latest,
                }
              : {
                  ...base,
                  id,
                  at,
                  kind: "reagendada",
                  tag: "Cambió la hora",
                  title: "Cambiaron la hora de tu entrevista",
                  body: `${companyName} · ${jobTitle}`,
                  highlight: when ? `Ahora: ${when}` : undefined,
                  stale,
                  replaced: !latest,
                },
          );
          break;
        }
        case "contratada":
          out.push({
            ...base,
            id,
            at,
            kind: "contratada",
            tag: "¡Contratada!",
            title: `¡${companyName} te contrató!`,
            body: p.companyMessage?.trim() || `${jobTitle} · Acuerda tu primer día con la empresa.`,
          });
          break;
        case "cerrada": {
          // A cancelled hire never reads as "no quedaste".
          const unhired = p.events[i - 1]?.status === "contratada";
          out.push({
            ...base,
            id,
            at,
            kind: "cerrada",
            tag: unhired ? UNHIRE_COPY.label : "No quedó",
            title: unhired ? `${companyName} canceló tu contratación` : job ? `Esta vez no quedaste en ${job.title}` : "Esta vez no quedaste",
            body: `${companyName}: “${p.companyMessage?.trim() || (unhired ? DEFAULT_UNHIRE_MESSAGE : DEFAULT_DECLINE_MESSAGE)}”`,
          });
          break;
        }
      }
    });
  }
  return out;
}

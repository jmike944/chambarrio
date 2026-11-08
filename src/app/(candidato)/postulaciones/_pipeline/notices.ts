/*
 * Application notices for /notificaciones, derived from the real pipeline events (what the company
 * did): seen, interview scheduled (with its day/time), a new time, place or instructions, hired, a
 * message after the hire, declined (with the message it had then), reopened. The candidate's own
 * actions (apply, withdraw) aren't notices. Pure.
 */
import type { ApplicationPipeline, Branch, CategoryId, Company, Job } from "@/lib/data/types";
import { DEFAULT_DECLINE_MESSAGE, DEFAULT_UNHIRE_MESSAGE, UNHIRE_COPY, eventChange } from "@/lib/pipeline/steps";
import { fmtDayTime, toMs } from "@/lib/pipeline/time";
import { defaultInterviewPlace } from "@/lib/pipeline/places";

export type NoticeKind = "vacante" | "entrevista" | "reagendada" | "cambio" | "vista" | "contratada" | "mensaje" | "cerrada" | "reabierta";

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
    const jobTitle = job?.title ?? "Tu postulación";
    const href = `/vacantes/${p.jobId}#tu-postulacion`;
    const base = { href, category: job?.category };
    const changes = p.events.map((_, i) => eventChange(p.events, i));
    // The events that set the interview's day and time (the first one and every new time).
    const timeEvents = p.events.filter((e, i) => e.status === "entrevista" && (changes[i] === null || changes[i] === "hora"));
    const lastIndex = p.events.length - 1;
    const hasMessageEvent = changes.includes("mensaje");
    p.events.forEach((e, i) => {
      if (e.actor !== "empresa") return;
      const id = `${p.id}-${e.status}-${i}`;
      const at = toMs(e.at);
      const change = changes[i];
      // A later event replaced this one (a newer interview detail, a reopen after a decline…).
      const superseded = i < lastIndex;
      if (change === "reabierta") {
        out.push({
          ...base,
          id,
          at,
          kind: "reabierta",
          tag: "Buenas noticias",
          title: `${companyName} retomó tu postulación`,
          body: `${jobTitle} · Olvida el aviso anterior: sigues en el proceso.`,
        });
        return;
      }
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
          const latestTime = timeEvents.at(-1) === e;
          const current = p.status === "entrevista";
          const when = e.interviewAt ? fmtDayTime(e.interviewAt, { now, capitalize: true }) : undefined;
          const past = e.interviewAt ? toMs(e.interviewAt) < now : false;
          if (change === "lugar" || change === "indicaciones") {
            // Only the newest change shows the details as they are now (older ones were replaced).
            const fresh = current && !superseded;
            const place = p.interview?.place ?? (branch ? defaultInterviewPlace(branch, company?.name) : null);
            const detail = change === "lugar" ? (place ? `Nuevo lugar: ${place}` : null) : p.interview?.note?.trim() || null;
            out.push({
              ...base,
              id,
              at,
              kind: "cambio",
              tag: change === "lugar" ? "Cambió el lugar" : "Nuevas indicaciones",
              title: change === "lugar" ? "Cambiaron el lugar de tu entrevista" : "Hay nuevas indicaciones para tu entrevista",
              body: [fresh ? detail : null, `${companyName} · ${jobTitle}`].filter(Boolean).join(" · "),
              highlight: when ? `Sigue: ${when}` : undefined,
              stale: !fresh || past,
            });
            break;
          }
          const stale = !latestTime || !current || past;
          const place = p.interview?.place ?? (branch ? defaultInterviewPlace(branch, company?.name) : null);
          out.push(
            change === "hora"
              ? {
                  ...base,
                  id,
                  at,
                  kind: "reagendada",
                  tag: "Cambió la hora",
                  title: "Cambiaron la hora de tu entrevista",
                  body: `${companyName} · ${jobTitle}`,
                  highlight: when ? `Ahora: ${when}` : undefined,
                  stale,
                  replaced: !latestTime,
                }
              : {
                  ...base,
                  id,
                  at,
                  kind: "entrevista",
                  tag: "Entrevista",
                  title: `${companyName} te invitó a entrevista`,
                  body: [jobTitle, latestTime && current ? place : null].filter(Boolean).join(" · "),
                  highlight: when,
                  stale,
                  replaced: !latestTime,
                },
          );
          break;
        }
        case "contratada": {
          if (change === "mensaje") {
            out.push({
              ...base,
              id,
              at,
              kind: "mensaje",
              tag: "Mensaje",
              title: `${companyName} te dejó un mensaje`,
              body: (e.message ?? (superseded ? null : p.companyMessage))?.trim() || `${jobTitle} · Ábrela para leerlo.`,
            });
            break;
          }
          // The message it was hired with; older rows only have the current one.
          const message = e.message ?? (p.status === "contratada" && !hasMessageEvent ? p.companyMessage : null);
          out.push({
            ...base,
            id,
            at,
            kind: "contratada",
            tag: "¡Contratada!",
            title: `¡${companyName} te contrató!`,
            body: message?.trim() || `${jobTitle} · Acuerda tu primer día con la empresa.`,
          });
          break;
        }
        case "cerrada": {
          // A cancelled hire never reads as "no quedaste".
          const unhired = p.events.slice(0, i).findLast((x) => x.status !== "cerrada")?.status === "contratada";
          // The message it was declined with (a later reopen / hire changes the row's message).
          const message = e.message ?? (!superseded && p.status === "cerrada" ? p.companyMessage : null);
          out.push({
            ...base,
            id,
            at,
            kind: "cerrada",
            tag: unhired ? UNHIRE_COPY.label : "No quedó",
            title: unhired ? `${companyName} canceló tu contratación` : job ? `Esta vez no quedaste en ${job.title}` : "Esta vez no quedaste",
            body: `${companyName}: “${message?.trim() || (unhired ? DEFAULT_UNHIRE_MESSAGE : DEFAULT_DECLINE_MESSAGE)}”`,
            stale: superseded,
          });
          break;
        }
      }
    });
  }
  return out;
}

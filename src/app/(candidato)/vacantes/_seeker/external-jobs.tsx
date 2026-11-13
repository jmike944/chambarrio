"use client";

import { useEffect, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { LinkSquare02Icon } from "@hugeicons/core-free-icons";
import { CategoryIcon } from "@/components/chamba/job-icons";
import { CATEGORY_BY_ID } from "@/lib/data/categories";
import type { CategoryId } from "@/lib/data/types";
import { formatMinutesAgo } from "@/lib/format";
import { PROVIDER_META, type ExternalJob, type ExternalJobsResponse, type ExternalProvider } from "@/lib/external-jobs/types";
import { cn } from "@/lib/utils";

/*
 * "Más vacantes en Saltillo": vacancies from other job boards (GET /api/vacantes-externas). Live mode
 * only (the demo never calls anything). They only say the city, so they live in this list, never on
 * the map or the radar, and people apply on the board's own page. Each card names its board with a
 * link. Renders nothing until there's something to show.
 */

const EMPTY: ExternalJobsResponse = { jobs: [], providers: [] };
const PROVIDERS = new Set<ExternalProvider>(["jooble", "careerjet"]);

let flight: Promise<ExternalJobsResponse> | null = null;

/** One request per visit (the server caches the boards for an hour anyway). */
function loadExternalJobs(): Promise<ExternalJobsResponse> {
  return (flight ??= fetch("/api/vacantes-externas")
    .then((r) => (r.ok ? r.json() : EMPTY))
    .then((d: Partial<ExternalJobsResponse>) => ({
      jobs: Array.isArray(d.jobs) ? d.jobs.filter((j) => j && PROVIDERS.has(j.provider) && /^https?:\/\//.test(j.url) && !!CATEGORY_BY_ID[j.category]) : [],
      providers: Array.isArray(d.providers) ? d.providers.filter((p) => PROVIDERS.has(p)) : [],
    }))
    .catch(() => {
      flight = null; // offline: try again next time
      return EMPTY;
    }));
}

function useExternalJobs(enabled: boolean): ExternalJobsResponse | null {
  const [data, setData] = useState<ExternalJobsResponse | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    void loadExternalJobs().then((d) => {
      if (alive) setData(d);
    });
    return () => {
      alive = false;
    };
  }, [enabled]);
  return enabled ? data : null;
}

const minutesSince = (iso: string | null) => {
  const t = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(t) ? Math.max(0, Math.round((Date.now() - t) / 60000)) : null;
};

export function ExternalJobs({
  enabled,
  category,
  query,
  className,
}: {
  /** Live mode only. */
  enabled: boolean;
  category: CategoryId | null;
  /** The search box, lowercased and trimmed. */
  query: string;
  className?: string;
}) {
  const data = useExternalJobs(enabled);
  if (!data || data.jobs.length === 0) return null;
  const jobs = data.jobs.filter(
    (j) => (!category || j.category === category) && (!query || [j.title, j.company, j.location].join(" ").toLowerCase().includes(query)),
  );
  if (jobs.length === 0) return null;
  const shown = data.providers.filter((p) => jobs.some((j) => j.provider === p));

  return (
    <section aria-labelledby="vacantes-externas" className={cn("mt-10", className)}>
      <div className="mb-1.5 flex items-end justify-between gap-3">
        <h2 id="vacantes-externas" className="flex items-center gap-2 font-display text-[1.45rem] leading-tight font-extrabold tracking-[-0.03em]">
          Más vacantes en Saltillo
          <span className="grid h-7 min-w-7 -rotate-3 place-items-center rounded-md bg-ink px-2 font-sans text-[0.85rem] font-bold tracking-normal text-limon tabular-nums dark:bg-limon dark:text-ink">
            {jobs.length}
          </span>
        </h2>
      </div>
      <p className="mb-4 max-w-prose text-[0.95rem] text-muted-foreground">
        De otras bolsas de trabajo. Te postulas en su página, y como no dicen la sucursal exacta, no salen en el mapa.
      </p>
      <ul className="grid grid-cols-1 gap-3">
        {jobs.map((j, i) => (
          <li key={j.id} className="min-w-0 animate-rise [--rise:16px]" style={{ "--i": Math.min(i, 8) } as React.CSSProperties}>
            <ExternalJobCard job={j} />
          </li>
        ))}
      </ul>
      <p className="mt-4 text-[0.85rem] text-muted-foreground">
        Vacantes de{" "}
        {shown.map((p, i) => (
          <span key={p}>
            {i > 0 ? (i === shown.length - 1 ? " y " : ", ") : null}
            <a href={PROVIDER_META[p].home} target="_blank" rel="noopener nofollow" className="font-semibold underline decoration-2 underline-offset-2">
              {PROVIDER_META[p].label}
            </a>
          </span>
        ))}
        . Chambarrio no las revisa: confirma los datos con la empresa.
      </p>
    </section>
  );
}

function ExternalJobCard({ job }: { job: ExternalJob }) {
  const meta = PROVIDER_META[job.provider];
  const ago = minutesSince(job.postedAt);
  return (
    <article className="group relative flex gap-3.5 rounded-panel border-2 border-ink bg-card p-4 transition-[translate,box-shadow] duration-200 focus-within:ring-4 focus-within:ring-ring/60 hover:-translate-y-0.5 hover:shadow-[5px_5px_0_0_var(--ink)] dark:hover:shadow-[5px_5px_0_0_rgb(0_0_0/0.7)]">
      <CategoryIcon category={job.category} size="md" className="shrink-0" title={CATEGORY_BY_ID[job.category].label} />
      <div className="min-w-0 flex-1">
        <h3 className="text-[1.06rem] leading-snug font-semibold">
          {/* The whole card opens the vacancy on the board (stretched link); the board's name stays its own link. */}
          <a href={job.url} target="_blank" rel="noopener nofollow" className="outline-none after:absolute after:inset-0 after:rounded-panel">
            {job.title}
          </a>
        </h3>
        <p className="truncate text-[0.93rem] text-muted-foreground">
          {[job.company, job.location].filter(Boolean).join(" · ")}
        </p>
        {job.pay ? <p className="mt-1 font-semibold tabular-nums">{job.pay}</p> : null}
        {job.snippet ? <p className="mt-1.5 line-clamp-2 text-[0.9rem] leading-snug text-muted-foreground">{job.snippet}</p> : null}
        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[0.82rem]">
          <a
            href={meta.home}
            target="_blank"
            rel="noopener nofollow"
            className="relative z-10 inline-flex h-7 items-center rounded-md border-2 border-ink bg-white px-2 font-bold text-ink hover:bg-block-sol"
          >
            vía {meta.label}
          </a>
          {ago !== null ? <span className="text-muted-foreground">{formatMinutesAgo(ago)}</span> : null}
          <span className="ml-auto inline-flex items-center gap-1 font-semibold">
            Ver y postularme
            <HugeiconsIcon icon={LinkSquare02Icon} className="size-4" strokeWidth={2.2} />
          </span>
        </div>
      </div>
    </article>
  );
}

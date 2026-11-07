"use client";

import Link from "next/link";
import { getCatalog } from "@/lib/data/catalog";
import { companyLabelOf } from "@/lib/data/jobs";
import type { Job } from "@/lib/data/types";
import { formatPay } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CategoryIcon } from "./job-icons";
import { DistanceRing } from "./primitives";

/**
 * "Empresa · Sucursal" for companies with more than one location, otherwise just the company name.
 * Shared by the seeker screens (search, map, postulaciones) so the branch reads the same everywhere.
 * Reads the active catalog (demo mock or live Supabase): call it from a component that already
 * subscribes via useCatalog()/useJobsByDistance()/useJob() so it re-renders when data arrives.
 */
export function companyLabel(job: Pick<Job, "companyId" | "branchId">): string {
  const c = getCatalog();
  return companyLabelOf(c.companyById[job.companyId], c.branchById[job.branchId]);
}

/** One vacancy: cartoon category icon (animates on hover/focus) · title · pay · distance ring. */
export function JobRow({
  job,
  km,
  radiusKm,
  meta,
  className,
}: {
  job: Job;
  km: number;
  radiusKm: number;
  meta?: string;
  className?: string;
}) {
  return (
    <Link
      href={`/vacantes/${job.id}`}
      className={cn(
        "group press -mx-2 flex items-center gap-3.5 rounded-2xl px-2 py-2.5 outline-none transition-colors hover:bg-white/45 focus-visible:ring-3 focus-visible:ring-ring/50 dark:hover:bg-white/5",
        className,
      )}
    >
      <CategoryIcon category={job.category} size="md" className="transition-transform duration-300 ease-[var(--ease-spring)] group-hover:-rotate-6 group-hover:scale-110" />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-[1.06rem] leading-snug font-semibold">{job.title}</span>
          {job.urgent ? (
            <span className="shrink-0 rounded-full bg-chile px-2 py-0.5 text-[0.68rem] font-bold tracking-wide text-white uppercase">
              Urge
            </span>
          ) : null}
        </span>
        <span className="block truncate text-[0.93rem] text-muted-foreground">
          <span className="font-semibold text-foreground tabular-nums">{formatPay(job)}</span>
          {" · "}
          {meta ?? companyLabel(job)}
        </span>
      </span>
      <DistanceRing km={km} radiusKm={radiusKm} />
    </Link>
  );
}

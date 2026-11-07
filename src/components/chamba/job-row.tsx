import Link from "next/link";
import { COMPANY_BY_ID } from "@/lib/data/jobs";
import type { Job } from "@/lib/data/types";
import { formatPay } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CategoryIcon } from "./job-icons";
import { DistanceRing } from "./primitives";

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
  const company = COMPANY_BY_ID[job.companyId];
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
          {meta ?? company.name}
        </span>
      </span>
      <DistanceRing km={km} radiusKm={radiusKm} />
    </Link>
  );
}

"use client";

import Link from "next/link";
import { useMemo } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { CategoryIcon } from "@/components/chamba/job-icons";
import { formatKm } from "@/lib/geo";
import { formatPay } from "@/lib/format";
import { useJobsByDistance } from "@/lib/data/catalog";
import type { CategoryId } from "@/lib/data/types";
import { useApp } from "@/lib/store";
import { cn } from "@/lib/utils";

/**
 * Nearby open vacancies like this one (same category first, then the person's interests),
 * skipping the ones already applied to. Falls back to the nearest ones.
 */
export function useSimilarJobs(category: CategoryId | null | undefined, excludeId?: string | null, limit = 3) {
  const jobs = useJobsByDistance();
  const applied = useApp((s) => s.applications);
  const interests = useApp((s) => s.interests);
  const radiusKm = useApp((s) => s.radiusKm);
  return useMemo(() => {
    const skip = new Set([...applied.map((a) => a.jobId), excludeId ?? ""]);
    const open = jobs.filter((j) => !skip.has(j.id));
    const near = (km: number) => km <= Math.max(radiusKm, 5);
    const pick = [
      ...open.filter((j) => j.category === category && near(j.km)),
      ...open.filter((j) => j.category !== category && interests.includes(j.category) && near(j.km)),
      ...open.filter((j) => near(j.km)),
      ...open,
    ];
    const seen = new Set<string>();
    return pick.filter((j) => (seen.has(j.id) ? false : (seen.add(j.id), true))).slice(0, limit);
  }, [jobs, applied, interests, radiusKm, category, excludeId, limit]);
}

export function SimilarJobs({
  category,
  excludeId,
  title = "Vacantes parecidas cerca",
  limit = 3,
  className,
}: {
  category?: CategoryId | null;
  excludeId?: string | null;
  title?: string;
  limit?: number;
  className?: string;
}) {
  const jobs = useSimilarJobs(category, excludeId, limit);
  return (
    <section aria-label={title} className={cn("min-w-0 rounded-tile bg-white/55 p-3.5 sm:p-4", className)}>
      <h3 className="font-display text-[1.15rem] leading-tight font-extrabold tracking-[-0.02em]">{title}</h3>
      {jobs.length ? (
        <ul className="mt-2 space-y-1">
          {jobs.map((j) => (
            <li key={j.id}>
              <Link
                href={`/vacantes/${j.id}`}
                className="group press -mx-1.5 flex items-center gap-3 rounded-xl px-1.5 py-2 outline-none hover:bg-white/55 focus-visible:ring-3 focus-visible:ring-ink/30"
              >
                <CategoryIcon category={j.category} size="sm" className="shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 leading-snug font-semibold">{j.title}</span>
                  <span className="block text-[0.88rem] text-muted-foreground tabular-nums">
                    <span className="font-semibold text-foreground">{formatPay(j)}</span> · a {formatKm(j.km)}
                  </span>
                </span>
                <HugeiconsIcon icon={ArrowRight01Icon} className="size-4 shrink-0 transition-transform group-hover:translate-x-0.5" strokeWidth={2.4} />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-[0.95rem] text-muted-foreground">Por ahora no hay otras cerca. Te avisamos cuando salga una.</p>
      )}
      <Link
        href="/vacantes"
        className="press mt-2 inline-flex min-h-11 items-center gap-1.5 font-semibold underline decoration-2 underline-offset-4 outline-none focus-visible:ring-3 focus-visible:ring-ink/30"
      >
        Ver todas las vacantes cerca
        <HugeiconsIcon icon={ArrowRight01Icon} className="size-4" strokeWidth={2.4} />
      </Link>
    </section>
  );
}

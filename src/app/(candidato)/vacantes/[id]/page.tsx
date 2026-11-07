import type { Metadata } from "next";
import { Suspense } from "react";
import { COMPANY_BY_ID, JOBS, JOB_BY_ID } from "@/lib/data/jobs";
import { JobDetail } from "./job-detail";

/*
 * The seeded vacancies (same ids in demo and live) are prerendered. Any other id (a vacancy published
 * live after the build) renders on request: with cacheComponents, params missing from
 * generateStaticParams are always allowed (`dynamicParams` isn't supported), so we never 404 here.
 * The client detail reads useJob(id) and shows "not found" only once the catalog is ready.
 */
export function generateStaticParams() {
  return JOBS.map((j) => ({ id: j.id }));
}

export async function generateMetadata({ params }: PageProps<"/vacantes/[id]">): Promise<Metadata> {
  const { id } = await params;
  // The server can't know the mode (it lives in localStorage): seeded ids get their title, the rest a generic one.
  const job = JOB_BY_ID[id];
  if (!job) return { title: "Vacante", description: "Una vacante cerca de tu casa en Saltillo." };
  return {
    title: `${job.title} en ${COMPANY_BY_ID[job.companyId]?.name ?? "Saltillo"}`,
    description: job.description,
  };
}

async function Detail({ params }: { params: PageProps<"/vacantes/[id]">["params"] }) {
  const { id } = await params;
  return <JobDetail jobId={id} />;
}

export default function VacantePage({ params }: PageProps<"/vacantes/[id]">) {
  return (
    <Suspense fallback={<div className="mt-16 h-96 animate-pulse rounded-panel bg-card" />}>
      <Detail params={params} />
    </Suspense>
  );
}

// Shell renders children client-side only, so skip dev instant-navigation validation.
export const instant = false;

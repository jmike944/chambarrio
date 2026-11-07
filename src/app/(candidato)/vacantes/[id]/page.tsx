import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { COMPANY_BY_ID, JOBS, JOB_BY_ID } from "@/lib/data/jobs";
import { JobDetail } from "./job-detail";

export function generateStaticParams() {
  return JOBS.map((j) => ({ id: j.id }));
}

export async function generateMetadata({ params }: PageProps<"/vacantes/[id]">): Promise<Metadata> {
  const { id } = await params;
  const job = JOB_BY_ID[id];
  if (!job) return { title: "Vacante no encontrada" };
  return {
    title: `${job.title} en ${COMPANY_BY_ID[job.companyId]?.name ?? "Saltillo"}`,
    description: job.description,
  };
}

async function Detail({ params }: { params: PageProps<"/vacantes/[id]">["params"] }) {
  const { id } = await params;
  if (!JOB_BY_ID[id]) notFound();
  return <JobDetail jobId={id} />;
}

export default function VacantePage({ params }: PageProps<"/vacantes/[id]">) {
  return (
    <Suspense fallback={<div className="mt-16 h-96 animate-pulse rounded-panel bg-card" />}>
      <Detail params={params} />
    </Suspense>
  );
}

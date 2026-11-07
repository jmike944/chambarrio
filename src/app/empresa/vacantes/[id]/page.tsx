import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { JOBS, JOB_BY_ID } from "@/lib/data/jobs";
import { VacancyApplicants } from "./vacancy-applicants";

const COMPANY_ID = "logistica-zapaliname";

export function generateStaticParams() {
  return JOBS.filter((j) => j.companyId === COMPANY_ID).map((j) => ({ id: j.id }));
}

export async function generateMetadata({ params }: PageProps<"/empresa/vacantes/[id]">): Promise<Metadata> {
  const { id } = await params;
  const job = JOB_BY_ID[id];
  return { title: job ? `Postulaciones · ${job.title}` : "Vacante no encontrada" };
}

async function Applicants({ params }: { params: PageProps<"/empresa/vacantes/[id]">["params"] }) {
  const { id } = await params;
  const job = JOB_BY_ID[id];
  if (!job || job.companyId !== COMPANY_ID) notFound();
  return <VacancyApplicants jobId={id} />;
}

export default function EmpresaVacantePage({ params }: PageProps<"/empresa/vacantes/[id]">) {
  return (
    <Suspense fallback={<div className="mt-16 h-96 animate-pulse rounded-panel bg-card" />}>
      <Applicants params={params} />
    </Suspense>
  );
}

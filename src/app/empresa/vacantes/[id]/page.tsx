import type { Metadata } from "next";
import { Suspense } from "react";
import { DEMO_COMPANY_ID, JOBS, JOB_BY_ID } from "@/lib/data/jobs";
import { EmployerSkeleton } from "@/components/empresa/employer-gate";
import { VacancyApplicants } from "./vacancy-applicants";

/**
 * Static params / metadata come from the seed (its ids are the same in live). Live vacancies have
 * uuid ids and render on request; whether the id is one of MY vacancies is decided on the client
 * (useMyCompany), never with notFound() on mock data.
 */
export function generateStaticParams() {
  return JOBS.filter((j) => j.companyId === DEMO_COMPANY_ID).map((j) => ({ id: j.id }));
}

export async function generateMetadata({ params }: PageProps<"/empresa/vacantes/[id]">): Promise<Metadata> {
  const { id } = await params;
  const job = JOB_BY_ID[id];
  return { title: job ? `Postulaciones · ${job.title}` : "Vacante" };
}

async function Applicants({ params }: { params: PageProps<"/empresa/vacantes/[id]">["params"] }) {
  const { id } = await params;
  return <VacancyApplicants jobId={id} />;
}

export default function EmpresaVacantePage({ params }: PageProps<"/empresa/vacantes/[id]">) {
  return (
    <Suspense fallback={<EmployerSkeleton shape="detail" className="pt-6 lg:pt-10" />}>
      <Applicants params={params} />
    </Suspense>
  );
}

// Shell renders children client-side only, so skip dev instant-navigation validation.
export const instant = false;

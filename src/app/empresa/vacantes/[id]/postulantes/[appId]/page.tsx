import type { Metadata } from "next";
import { Suspense } from "react";
import { APPLICANTS } from "@/lib/data/applicants";
import { JOB_BY_ID } from "@/lib/data/jobs";
import { EmployerSkeleton } from "@/components/empresa/employer-gate";
import { ApplicantPage } from "./applicant-page";

/**
 * One applicant of one of my vacancies: full profile + hiring pipeline + private notes.
 * Static params come from the demo applicants; live applications (uuid ids) render on request and
 * are resolved on the client (useApplicationPipeline), never with notFound() on mock data.
 * The title never carries a name (contact may still be locked).
 */
export function generateStaticParams() {
  return APPLICANTS.map((a) => ({ id: a.jobId, appId: a.id }));
}

export async function generateMetadata({ params }: PageProps<"/empresa/vacantes/[id]/postulantes/[appId]">): Promise<Metadata> {
  const { id } = await params;
  const job = JOB_BY_ID[id];
  return { title: job ? `Postulante · ${job.title}` : "Postulante" };
}

async function Applicant({ params }: { params: PageProps<"/empresa/vacantes/[id]/postulantes/[appId]">["params"] }) {
  const { id, appId } = await params;
  return <ApplicantPage jobId={id} applicationId={appId} />;
}

export default function EmpresaPostulantePage({ params }: PageProps<"/empresa/vacantes/[id]/postulantes/[appId]">) {
  return (
    <Suspense fallback={<EmployerSkeleton shape="detail" className="pt-6 lg:pt-10" />}>
      <Applicant params={params} />
    </Suspense>
  );
}

// Shell renders children client-side only, so skip dev instant-navigation validation.
export const instant = false;

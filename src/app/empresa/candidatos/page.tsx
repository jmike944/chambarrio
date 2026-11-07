import type { Metadata } from "next";
import { PageHeader } from "@/components/chamba/page-header";
import { CandidatesList } from "./candidates-list";

export const metadata: Metadata = { title: "Candidatos" };

export default function CandidatosPage() {
  return (
    <>
      <PageHeader title="Candidatos" eyebrow="Cerca de Parque Industrial Santa Mónica" />
      <CandidatesList />
    </>
  );
}

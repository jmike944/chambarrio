import type { Metadata } from "next";
import { PageHeader } from "@/components/chamba/page-header";
import { NewJobForm } from "./new-job-form";

export const metadata: Metadata = { title: "Publicar vacante" };

export default function NuevaVacantePage() {
  return (
    <>
      <PageHeader title="Publicar vacante" eyebrow="Logística Zapalinamé" />
      <NewJobForm />
    </>
  );
}

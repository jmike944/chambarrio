"use client";

import { PageHeader } from "@/components/chamba/page-header";
import { useMyCompany } from "@/lib/data/catalog";

/** Eyebrow = the employer's own company (demo: Logística Zapalinamé; live: theirs, never the mock). */
export function NewJobHeader() {
  const { company } = useMyCompany();
  return <PageHeader title="Publicar vacante" eyebrow={company?.name} />;
}

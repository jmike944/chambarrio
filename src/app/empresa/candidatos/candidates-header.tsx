"use client";

import { PageHeader } from "@/components/chamba/page-header";
import { useHydrated } from "@/lib/store";

/** Both modes list the people who applied to my vacancies (nobody else, by design). */
export function CandidatesHeader() {
  const hydrated = useHydrated();
  return <PageHeader title="Candidatos" eyebrow={hydrated ? "Quienes se postularon a tus vacantes" : undefined} />;
}

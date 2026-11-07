"use client";

import { PageHeader } from "@/components/chamba/page-header";
import { useHydrated, useIsLive } from "@/lib/store";

/** Demo: the showcase eyebrow (the demo company's park). Live: no invented place. */
export function CandidatesHeader() {
  const hydrated = useHydrated();
  const live = useIsLive();
  const eyebrow = !hydrated ? undefined : live ? "Quienes se postularon a tus vacantes" : "Cerca de Parque Industrial Santa Mónica";
  return <PageHeader title="Candidatos" eyebrow={eyebrow} />;
}

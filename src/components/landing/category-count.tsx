"use client";

import { useCatalog } from "@/lib/data/catalog";
import type { CategoryId } from "@/lib/data/types";

/**
 * "12 vacantes cerca" for one category on the landing, from the active catalog: the mock in the
 * demo, the real vacancies in live. While the live catalog loads (or if it fails) it says
 * "Vacantes cerca" instead of a made-up number.
 */
export function CategoryCount({ category }: { category: CategoryId }) {
  const { status, jobs } = useCatalog();
  if (status !== "ready") return <>Vacantes cerca</>;
  const n = jobs.filter((j) => j.category === category).length;
  return (
    <>
      {n} {n === 1 ? "vacante" : "vacantes"} cerca
    </>
  );
}

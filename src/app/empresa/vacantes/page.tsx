import type { Metadata } from "next";
import { PageHeader } from "@/components/chamba/page-header";
import { VacanciesAside } from "./vacancies-aside";
import { VacancyList } from "./vacancy-list";

export const metadata: Metadata = { title: "Tus vacantes" };

export default function EmpresaVacantesPage() {
  return (
    <>
      <PageHeader title="Vacantes" />
      {/* Desktop: both columns end on the same line. "Así de fácil" grows when the list is longer,
          the last box of the list when it's shorter. */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-7">
        <VacanciesAside />
        <div className="min-w-0 lg:col-span-7 lg:flex lg:flex-col">
          <VacancyList />
        </div>
      </div>
    </>
  );
}

// Shell renders children client-side only, so skip dev instant-navigation validation.
export const instant = false;

import type { Metadata } from "next";
import { PageHeader } from "@/components/chamba/page-header";
import { JobSearch } from "./job-search";

export const metadata: Metadata = { title: "Buscar chamba" };

export default function VacantesPage() {
  return (
    <>
      <PageHeader title="Buscar" />
      <JobSearch />
    </>
  );
}

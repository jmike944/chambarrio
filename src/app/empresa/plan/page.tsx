import type { Metadata } from "next";
import { PageHeader } from "@/components/chamba/page-header";
import { PlanCards } from "./plan-cards";

export const metadata: Metadata = { title: "Planes" };

export default function PlanPage() {
  return (
    <>
      <PageHeader title="Planes" eyebrow="Para empresas de todos los tamaños" />
      <PlanCards />
    </>
  );
}

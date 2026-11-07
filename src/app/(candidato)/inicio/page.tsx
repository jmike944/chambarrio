import type { Metadata } from "next";
import { PageHeader } from "@/components/chamba/page-header";
import { HomeDashboard } from "./home-dashboard";

export const metadata: Metadata = { title: "Cerca de ti" };

export default function InicioPage() {
  return (
    <>
      <PageHeader title="Cerca de ti" />
      <HomeDashboard />
    </>
  );
}

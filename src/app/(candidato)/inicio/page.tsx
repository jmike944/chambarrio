import type { Metadata } from "next";
import { PageHeader } from "@/components/chamba/page-header";
import { HomeDashboard } from "./home-dashboard";
import { InstallCard } from "@/components/install/install-promos";

export const metadata: Metadata = { title: "Cerca de ti" };

export default function InicioPage() {
  return (
    <>
      <PageHeader title="Cerca de ti" />
      <InstallCard side="candidato" />
      <HomeDashboard />
    </>
  );
}

// Shell renders children client-side only, so skip dev instant-navigation validation.
export const instant = false;

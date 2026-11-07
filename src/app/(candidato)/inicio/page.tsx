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

// Shell renders children client-side only, so skip dev instant-navigation validation.
export const instant = false;

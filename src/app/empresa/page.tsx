import type { Metadata } from "next";
import { PageHeader } from "@/components/chamba/page-header";
import { EmployerDashboard } from "./employer-dashboard";

export const metadata: Metadata = { title: "Panel de empresa" };

export default function EmpresaPage() {
  return (
    <>
      <PageHeader title="Panel" />
      <EmployerDashboard />
    </>
  );
}

// Shell renders children client-side only, so skip dev instant-navigation validation.
export const instant = false;

import type { Metadata } from "next";
import { PageHeader } from "@/components/chamba/page-header";
import { BranchManager } from "./branch-manager";

export const metadata: Metadata = { title: "Sucursales" };

export default function SucursalesPage() {
  return (
    <>
      <PageHeader title="Sucursales" />
      <BranchManager />
    </>
  );
}

// Shell renders children client-side only, so skip dev instant-navigation validation.
export const instant = false;

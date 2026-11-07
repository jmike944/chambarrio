import type { Metadata } from "next";
import { PageHeader } from "@/components/chamba/page-header";
import { ApplicationsList } from "./applications-list";

export const metadata: Metadata = { title: "Postulaciones" };

export default function PostulacionesPage() {
  return (
    <>
      <PageHeader title="Postulaciones" />
      <ApplicationsList />
    </>
  );
}

// Shell renders children client-side only, so skip dev instant-navigation validation.
export const instant = false;

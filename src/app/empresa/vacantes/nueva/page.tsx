import type { Metadata } from "next";
import { NewJobHeader } from "./new-job-header";
import { NewJobForm } from "./new-job-form";

export const metadata: Metadata = { title: "Publicar vacante" };

export default function NuevaVacantePage() {
  return (
    <>
      <NewJobHeader />
      <NewJobForm />
    </>
  );
}

// Shell renders children client-side only, so skip dev instant-navigation validation.
export const instant = false;

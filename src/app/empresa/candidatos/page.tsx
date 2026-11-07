import type { Metadata } from "next";
import { CandidatesHeader } from "./candidates-header";
import { CandidatesList } from "./candidates-list";

export const metadata: Metadata = { title: "Candidatos" };

export default function CandidatosPage() {
  return (
    <>
      <CandidatesHeader />
      <CandidatesList />
    </>
  );
}

// Shell renders children client-side only, so skip dev instant-navigation validation.
export const instant = false;

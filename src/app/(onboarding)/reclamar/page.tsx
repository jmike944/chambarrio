import type { Metadata } from "next";
import { ClaimCompany } from "@/components/onboarding/claim-company";

export const metadata: Metadata = {
  title: "Reclama tu empresa",
  robots: { index: false, follow: false },
};

/**
 * /reclamar?empresa=<id>: a company whose vacancies Chambarrio published from public information
 * ("vacantes curadas") becomes the claimer's, proven by the SMS-verified celular printed in them.
 * The id is read on the client only, so the page stays static.
 */
export default function ReclamarPage() {
  return <ClaimCompany />;
}

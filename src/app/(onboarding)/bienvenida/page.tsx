import type { Metadata } from "next";
import { CandidateFlow } from "@/components/onboarding/candidate-flow";

export const metadata: Metadata = {
  title: "Crea tu cuenta",
  description: "Regístrate gratis con tu WhatsApp y ve vacantes cerca de tu casa en Saltillo.",
};

export default function BienvenidaPage() {
  return <CandidateFlow />;
}

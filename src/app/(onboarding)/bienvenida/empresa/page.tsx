import type { Metadata } from "next";
import { BusinessFlow } from "@/components/onboarding/business-flow";

export const metadata: Metadata = {
  title: "Registra tu negocio",
  description: "Publica vacantes y encuentra personal que vive cerca de tu negocio en Saltillo.",
};

export default function BienvenidaEmpresaPage() {
  return <BusinessFlow />;
}

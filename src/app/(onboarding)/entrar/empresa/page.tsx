import type { Metadata } from "next";
import { SignIn } from "@/components/onboarding/sign-in";

// Same screen as /entrar, for the business side (/empresas links here): its demo and sign-up are a business's.
export const metadata: Metadata = { title: "Entrar", referrer: "no-referrer" };

export default function EntrarEmpresaPage() {
  return <SignIn side="empresa" />;
}

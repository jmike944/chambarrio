import type { Metadata } from "next";
import { SignIn } from "@/components/onboarding/sign-in";

export const metadata: Metadata = { title: "Entrar" };

export default function EntrarPage() {
  return <SignIn />;
}

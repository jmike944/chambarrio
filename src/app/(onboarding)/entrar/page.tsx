import type { Metadata } from "next";
import { SignIn } from "@/components/onboarding/sign-in";

// ?next= may carry a team invite's token (/entrar?next=/unirse?t=…): don't leak it as a referrer.
export const metadata: Metadata = { title: "Entrar", referrer: "no-referrer" };

export default function EntrarPage() {
  return <SignIn />;
}

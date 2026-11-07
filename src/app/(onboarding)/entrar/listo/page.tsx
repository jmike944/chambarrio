import type { Metadata } from "next";
import { EmailLinkLanding } from "@/components/onboarding/email-link-landing";

export const metadata: Metadata = { title: "Entrando", robots: { index: false } };

/** Where /auth/confirm sends people after a valid sign-in link (the session cookie is already set). */
export default function EntrarListoPage() {
  return <EmailLinkLanding />;
}

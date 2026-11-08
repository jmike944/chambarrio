import type { Metadata } from "next";
import { JoinTeam } from "@/components/onboarding/join-team";

export const metadata: Metadata = {
  title: "Únete al equipo",
  // The link carries the invite token: never send it to other sites, never index it.
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};

/**
 * /unirse?t=<token>: accept an invite to a business's team (/unirse?demo=1: the demo walk).
 * The token is read on the client only (this page doesn't read searchParams, so it stays static).
 */
export default function UnirsePage() {
  return <JoinTeam />;
}

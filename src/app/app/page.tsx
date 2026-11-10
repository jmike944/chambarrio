import type { Metadata } from "next";
import { AppLauncher } from "@/components/install/app-launcher";

export const metadata: Metadata = { title: "Abriendo", robots: { index: false } };

/** The installed app's start page (manifest start_url): routes to the right side. */
export default function AppPage() {
  return <AppLauncher />;
}

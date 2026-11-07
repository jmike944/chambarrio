import type { Metadata } from "next";
import { NotificationsFeed } from "./notifications-feed";

export const metadata: Metadata = { title: "Avisos" };

/** Demo: the curated feed. Live: derived from your applications and fresh vacancies nearby. */
export default function NotificacionesPage() {
  return <NotificationsFeed />;
}

// Shell renders children client-side only, so skip dev instant-navigation validation.
export const instant = false;

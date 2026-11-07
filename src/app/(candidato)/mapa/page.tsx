import type { Metadata } from "next";
import { MapScreen } from "@/components/map/map-screen";

export const metadata: Metadata = { title: "Mapa de vacantes" };

export default function MapaPage() {
  return <MapScreen />;
}

// Shell renders children client-side only, so skip dev instant-navigation validation.
export const instant = false;

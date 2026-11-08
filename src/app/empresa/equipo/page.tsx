import type { Metadata } from "next";
import { TeamHeader, TeamPage } from "./team-page";

export const metadata: Metadata = { title: "Tu equipo" };

export default function EquipoPage() {
  return (
    <>
      <TeamHeader />
      <TeamPage />
    </>
  );
}

// Shell renders children client-side only, so skip dev instant-navigation validation.
export const instant = false;

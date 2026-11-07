import type { Metadata } from "next";
import { PageHeader } from "@/components/chamba/page-header";
import { ProfileForm } from "./profile-form";

export const metadata: Metadata = { title: "Perfil" };

export default function PerfilPage() {
  return (
    <>
      <PageHeader title="Tu perfil" />
      <ProfileForm />
    </>
  );
}

// Shell renders children client-side only, so skip dev instant-navigation validation.
export const instant = false;

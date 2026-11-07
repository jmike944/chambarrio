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

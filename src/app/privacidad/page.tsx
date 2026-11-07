import type { Metadata } from "next";
import { LegalPage } from "@/components/landing/legal-page";

export const metadata: Metadata = { title: "Aviso de privacidad" };

export default function PrivacidadPage() {
  return (
    <LegalPage
      title="Aviso de privacidad"
      tone="cielo"
      intro="Tu ubicación es la base de Chambarrio, así que la cuidamos en serio. Aquí explicamos qué datos usamos, para qué y cómo puedes controlarlos."
      sections={[
        {
          title: "Qué datos usamos",
          body: [
            "Candidatos: nombre, número de celular, correo, colonia o ubicación aproximada, tipo de trabajo que buscas y experiencia.",
            "Empresas: razón social o nombre comercial, ubicación del centro de trabajo, datos de contacto y datos de facturación.",
          ],
        },
        {
          title: "Cómo usamos tu ubicación",
          body: [
            "Usamos tu ubicación solo para calcular qué tan lejos te quedan las vacantes y para avisarte de vacantes nuevas dentro de tu radio.",
            "Guardamos tu ubicación redondeada a unos 500 metros. Las empresas ven tu colonia y la distancia aproximada, nunca tu dirección ni tus coordenadas exactas.",
            "Puedes cambiar tu ubicación o quitarla en cualquier momento desde tu perfil.",
          ],
        },
        {
          title: "Con quién compartimos tus datos",
          body: [
            "Solo compartimos tu perfil con las empresas a cuyas vacantes te postulas o a las que decides contactar. No vendemos tus datos personales.",
          ],
        },
        {
          title: "Tus derechos",
          body: [
            "Puedes acceder, rectificar, cancelar u oponerte al uso de tus datos (derechos ARCO), así como revocar tu consentimiento, escribiendo a privacidad@chambalado.mx. Te responderemos en los plazos que marca la ley aplicable en materia de protección de datos personales.",
          ],
        },
      ]}
    />
  );
}

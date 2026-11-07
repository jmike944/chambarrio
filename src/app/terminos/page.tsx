import type { Metadata } from "next";
import { LegalPage } from "@/components/landing/legal-page";

export const metadata: Metadata = { title: "Términos y condiciones" };

export default function TerminosPage() {
  return (
    <LegalPage
      title="Términos y condiciones"
      intro="Estas reglas explican qué hace Chamb-a lado, qué no hace, y qué le toca a cada quien. Si usas la plataforma, aceptas estos términos."
      sections={[
        {
          title: "Qué es Chamb-a lado",
          body: [
            "Chamb-a lado es una plataforma que conecta a personas que buscan empleo con empresas y negocios cercanos a su domicilio, usando la ubicación como herramienta principal.",
            "No somos agencia de reclutamiento, colocación ni outsourcing. No contratamos personal, no somos patrón de nadie y no intervenimos en la relación laboral entre candidatos y empresas.",
          ],
        },
        {
          title: "Responsabilidades de las empresas",
          body: [
            "Cada empresa es la única responsable de entrevistar, seleccionar y contratar, así como de cumplir sus obligaciones laborales y de seguridad social conforme a la Ley Federal del Trabajo y demás leyes aplicables.",
            "Las vacantes deben ser reales, indicar sueldo, horario y prestaciones con veracidad, y no pueden incluir requisitos discriminatorios por edad, sexo, embarazo, estado civil, origen, religión, discapacidad, apariencia o cualquier otro motivo prohibido por la ley.",
            "Está prohibido cobrar a los candidatos por postularse, por capacitación o por cualquier otro concepto relacionado con la vacante.",
          ],
        },
        {
          title: "Uso para candidatos",
          body: [
            "Buscar trabajo en Chamb-a lado es gratis. Nunca te pediremos dinero para postularte.",
            "Te comprometes a dar información verdadera en tu perfil y a tratar con respeto a las empresas que contactes.",
          ],
        },
        {
          title: "Planes y pagos de empresas",
          body: [
            "Publicar vacantes es gratis. Para ver los nombres y datos de contacto de quienes se postulan, la empresa paga una cuota mensual por vacante o una suscripción mensual. La cuota por vacante aplica por cada mes en que sus postulaciones estén desbloqueadas. Las tarifas vigentes se muestran antes de pagar y se facturan conforme a las disposiciones fiscales aplicables.",
            "Las suscripciones se renuevan cada mes y pueden cancelarse en cualquier momento; la cancelación aplica al siguiente periodo.",
          ],
        },
        {
          title: "Reportes y moderación",
          body: [
            "Cualquier persona puede reportar una vacante o perfil sospechoso. Podemos pausar o eliminar publicaciones y cuentas que incumplan estos términos.",
          ],
        },
        {
          title: "Limitación de responsabilidad",
          body: [
            "Chamb-a lado no garantiza la contratación ni la permanencia en un empleo, ni responde por las decisiones, condiciones laborales o actos de las empresas o de los candidatos.",
          ],
        },
      ]}
    />
  );
}

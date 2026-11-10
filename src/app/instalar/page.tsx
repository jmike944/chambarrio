import type { Metadata } from "next";
import { SITE_URL } from "@/lib/site";
import { QrCode } from "@/components/install/qr-code";
import { InstallPageView } from "@/components/install/install-page";

export const metadata: Metadata = {
  title: "Instala la app",
  description: "Instala Chambarrio en tu teléfono: gratis, sin tienda de apps y en pocos toques.",
};

const URLS = {
  candidato: `${SITE_URL}/instalar`,
  empresa: `${SITE_URL}/instalar?lado=empresa`,
};

/** "How to install": shareable link, QR codes, and where phones land after leaving an in-app browser. */
export default function InstalarPage() {
  return (
    <InstallPageView
      urls={URLS}
      qr={{
        candidato: <QrCode value={URLS.candidato} label="Código QR para abrir Chambarrio en tu teléfono" className="block size-full" />,
        empresa: <QrCode value={URLS.empresa} label="Código QR para abrir Chambarrio en tu teléfono" className="block size-full" />,
      }}
    />
  );
}

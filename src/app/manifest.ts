import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Chambarrio",
    short_name: "Chambarrio",
    description: "El trabajo que buscas, cerca de ti. Vacantes a 2, 5, 10 o 15 km de tu casa.",
    lang: "es-MX",
    start_url: "/inicio",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#4318e0",
    theme_color: "#4318e0",
    categories: ["business", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // Extra safe-zone padding so Android's crop never cuts the briefcase.
      { src: "/icons/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Vacantes cerca", url: "/inicio" },
      { name: "Mapa", url: "/mapa" },
      { name: "Mis postulaciones", url: "/postulaciones" },
    ],
  };
}

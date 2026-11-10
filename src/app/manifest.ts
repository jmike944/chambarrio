import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Chambarrio",
    short_name: "Chambarrio",
    description: "El trabajo que buscas, cerca de ti. Vacantes a 2, 5, 10 o 15 km de tu casa.",
    lang: "es-MX",
    // The app's identity: what start_url used to be, so phones that already installed it keep one app.
    id: "/inicio",
    // /app opens each person on their side (job seeker / company), signed in or not.
    start_url: "/app",
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
    // Phone screenshots: Chrome on Android shows its app-store-style install sheet instead of a small dialog.
    screenshots: [
      { src: "/screenshots/inicio.jpg", sizes: "750x1624", type: "image/jpeg", form_factor: "narrow", label: "Vacantes cerca de tu casa" },
      { src: "/screenshots/vacante.jpg", sizes: "750x1624", type: "image/jpeg", form_factor: "narrow", label: "Postúlate en un toque" },
      { src: "/screenshots/panel.jpg", sizes: "750x1624", type: "image/jpeg", form_factor: "narrow", label: "Panel para tu negocio" },
    ],
    // Lets a Chrome tab ask "is my app installed?" (navigator.getInstalledRelatedApps) to hide "Instalar".
    related_applications: [{ platform: "webapp", url: "/manifest.webmanifest" }],
    prefer_related_applications: false,
    shortcuts: [
      { name: "Vacantes cerca", url: "/inicio" },
      { name: "Mapa", url: "/mapa" },
      { name: "Mis postulaciones", url: "/postulaciones" },
    ],
  };
}

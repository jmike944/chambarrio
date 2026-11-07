import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Lexend } from "next/font/google";
import "./globals.css";
import { THEME_SCRIPT } from "@/components/theme";
import { Providers } from "@/components/providers";
import { cn } from "@/lib/utils";

/** Body copy: highly legible on small, low-DPI screens. */
const lexend = Lexend({ subsets: ["latin"], variable: "--font-lexend", display: "swap" });
/** Display: chunky, playful headings and big numbers (variable weight + optical size). */
const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-bricolage",
  display: "swap",
  // Optical size axis: the Chambarrio wordmark is drawn at opsz 48 (see brand/chambarrio-logo.tsx).
  axes: ["opsz"],
});

/**
 * Absolute base for Open Graph / Twitter image URLs. NEXT_PUBLIC_SITE_URL wins (set it when a custom
 * domain goes live); on Vercel it falls back to the project's production domain; locally, localhost.
 */
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "Chambarrio · El trabajo que buscas, cerca de ti", template: "%s · Chambarrio" },
  description:
    "Encuentra vacantes cerca de tu casa en Saltillo. Elige 2, 5, 10 o 15 km y ahorra tiempo y dinero en traslados.",
  applicationName: "Chambarrio",
  appleWebApp: { capable: true, title: "Chambarrio", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // Keep in sync with THEME_COLOR in components/theme.tsx (a client module, so it can't be read here).
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f2ff" },
    { media: "(prefers-color-scheme: dark)", color: "#0f0b26" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es-MX" className={cn("antialiased", lexend.variable, bricolage.variable)} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-dvh">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

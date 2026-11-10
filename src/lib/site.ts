/**
 * Absolute base for Open Graph / Twitter image URLs and printed links (the /instalar QR code).
 * NEXT_PUBLIC_SITE_URL wins; production is the canonical https://chambarrio.com; Vercel previews use
 * their own URL; locally, localhost.
 */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_ENV === "production"
    ? "https://chambarrio.com"
    : process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000");

/*
 * Renders the social media kit (src/app/social-kit, development only) to PNG files in chambarrio-brand/social/posts/.
 *
 *   npm run dev                       (in another terminal)
 *   node scripts/social-posts.mjs     (all posts)
 *   node scripts/social-posts.mjs 01-lanzamiento 07-empresas
 *
 * Needs Playwright with Chromium (not a project dependency): npm i -g playwright && npx playwright install chromium.
 * BASE_URL overrides http://localhost:3000.
 */
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const { chromium } = createRequire(import.meta.url)("playwright");

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "chambarrio-brand", "social", "posts");

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1700, height: 2000 }, deviceScaleFactor: 1, colorScheme: "light" });
await mkdir(OUT, { recursive: true });

const only = process.argv.slice(2);

await page.goto(`${BASE}/social-kit`, { waitUntil: "networkidle" });
// Hide the Next.js dev indicator and wait for the web fonts before taking the pictures.
await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
await page.evaluate(() => document.fonts.ready);

for (const post of await page.locator("[data-post]").all()) {
  const id = await post.getAttribute("data-post");
  if (only.length > 0 && !only.includes(id)) continue;
  await post.screenshot({ path: path.join(OUT, `${id}.png`), animations: "disabled" });
  console.log(`✓ ${id}.png`);
}

await browser.close();

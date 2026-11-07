# Prompt for Claude Code

Unzip this folder into the root of the project as `chambarrio-brand/`, then paste everything below the line into Claude Code.

---

We're rebranding this app from **"Chamb-a lado"** to **"Chambarrio"**. The brand kit is in `./chambarrio-brand/`. Read `chambarrio-brand/BRAND.md` first, then do the following. The app is Next.js (App Router) with Tailwind, and the brand colors already exist as CSS tokens (`--primary`, `--uva`, `--uva-ink`, `--limon`, `--chile`, `--ink`), including dark-mode values under `.dark`.

### 1. Rename the product everywhere users can see it
- Replace "Chamb-a lado" with "Chambarrio" in page titles and the title template (pages currently end in " · Chamb-a lado"), metadata, `aria-label`s (for example "Chamb-a lado, inicio"), the manifest, page copy, legal and terms pages, email and WhatsApp message templates, and the README.
- Search case-insensitively for `chamb-a`, `chamb‑a` (with a non-breaking hyphen), `chamb<span`, `chambalado`, `chamb_a_lado` and `chamb-a-lado`. The header splits the old name across a `<span>`, so a plain search for "Chamb-a lado" will miss it.
- **Don't** rename database tables, columns, env vars, package names, storage buckets or URLs on your own. List any you find so I can decide.

### 2. Replace the logo in the UI
- Move `chambarrio-brand/react/ChambarrioLogo.tsx` into the project's components folder (for example `components/brand/ChambarrioLogo.tsx`) and fix imports to match the project's conventions.
- The header logo link (`aria-label="Chamb-a lado, inicio"`) currently has an inline 40x40 SVG (purple rounded tile, white ring, a line and a lime dot) followed by the "chamb-a lado" text. Replace that SVG and text with `<ChambarrioLogo />`. Keep the link, focus styles and the `group-hover:animate-wiggle` on the icon (pass it via `iconClassName`). Update the link's `aria-label` to "Chambarrio, inicio".
- Find any other place the old icon or wordmark is drawn (footer, auth screens, onboarding, empty states, emails) and switch it to the matching component: `ChambarrioLogo`, `ChambarrioAppIcon`, `ChambarrioMark` or `ChambarrioWordmark`.
- If there's a full-screen loading or splash state, use `<ChambarrioPulse />` on the purple background.

### 3. Icons and metadata (use Next.js file conventions)
- Replace `app/favicon.ico` with `chambarrio-brand/png/favicon.ico`.
- Add `app/icon.svg` from `chambarrio-brand/app-icon/chambarrio-favicon.svg`.
- Add `app/apple-icon.png` from `chambarrio-brand/png/apple-icon.png`.
- The manifest serves icons from `/icons/192` and `/icons/512`, probably through a route handler that draws them. Find it and make it serve the new artwork: either have it return `png/icon-192.png` and `png/icon-512.png`, or copy those into `public/icons/` and point the manifest at them and delete the generator.
- The manifest's `purpose: "maskable"` entry currently reuses the 512 icon. Point it at `png/icon-maskable-512.png` instead (and add a 192 maskable from `png/icon-maskable-192.png`). The maskable files have extra padding so Android's crop doesn't cut the briefcase. Don't reuse the regular icon for maskable.
- Add `app/opengraph-image.png` and `app/twitter-image.png` from `chambarrio-brand/social/opengraph-image.png`, with `.alt.txt` files containing "Chambarrio · El trabajo que buscas, cerca de ti".

### 4. Manifest
- Set `name` and `short_name` to "Chambarrio".
- Set `theme_color` and `background_color` to `#4318e0`, so the install splash is purple with the new icon. Leave the light and dark `theme-color` meta tags in the page as they are.

### 5. Check your work
- Check the header in light and dark mode (toggle the `.dark` class), on a phone-width viewport and on desktop. The ring "o" at the end of the wordmark should sit on the baseline like a normal letter.
- Check the favicon in the browser tab, and that `/manifest.webmanifest` lists the new icons with correct sizes.
- Run lint, typecheck and a production build. Fix anything that breaks.
- Finish with a list of every file you changed, anything you left alone on purpose (like database names), and anything you weren't sure about.

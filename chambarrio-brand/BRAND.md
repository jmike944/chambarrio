# Chambarrio brand guide

**Chambarrio** = *chamba* (job) + *barrio* (neighborhood). Jobs close to home.

- Write the name as **Chambarrio** in sentences, one word, no hyphen. The logo itself is lowercase: `chambarrio`.
- Tagline: **El trabajo que buscas, cerca de ti.**
- Supporting line: *Vacantes a 2, 5, 10 o 15 km de tu casa.*

## The mark

A small **house** (tu casa) in the center, two **rings** (your 2 and 5 km radius), and a **briefcase** sitting on the outer ring (a job nearby). It is the same idea as the app's radius map.

- The wordmark's final **o** is a ring with a dot: the radius idea carried into the name.
- Below about 24 px, use the **simplified mark** (one thick ring and the house, no briefcase). The favicon already does this.

## Colors

These already exist as CSS tokens in the app. Use the tokens in code, the hex values in other tools.

| Name | Hex (light) | Dark mode | Token | Used for |
|---|---|---|---|---|
| Uva | `#4318e0` | `#6440fa` | `--uva`, `--primary` | Tile, rings on light backgrounds |
| Uva ink | `#4318e0` | `#b9a8ff` | `--uva-ink` | Rings and ring-o on the page background |
| Limón | `#ddf78a` | `#ddf78a` | `--limon` | Rings on purple |
| Chile | `#ff5a36` | `#ff6a45` | `--chile` | Briefcase (the only coral element) |
| Tinta | `#160f33` | `#160f33` | `--ink` | Wordmark text, house on light backgrounds |
| Lavanda | `#f4f2ff` | `#0f0b26` | `--background` | Page background |

## Type

- **Logo:** Bricolage Grotesque ExtraBold (800), lowercase, letter-spacing −3.5%. The SVG files are outlined (optical size 48), so they don't need the font installed.
- **Interface:** Bricolage Grotesque for headings, Lexend for body text (as the app already does).

## Which file to use

| Background | Use |
|---|---|
| White, lavender, light photos | `*-color.svg` |
| Uva purple, the dark-mode background, dark photos | `*-color-on-dark.svg` |
| One-color printing, stamps, embroidery, watermarks | `*-mono-ink.svg` or `*-mono-white.svg` |

- **Clear space:** keep empty space around the logo at least the height of the briefcase on all sides.
- **Minimum size:** full mark 24 px, wordmark 80 px wide, full logo 120 px wide.

## Don't

- Don't add a door to the house or a line to the briefcase. Both were removed on purpose.
- Don't recolor the briefcase, except in one-color versions.
- Don't retype the wordmark in another font or with a hyphen ("chamb-a lado" is retired).
- Don't stretch, rotate, outline, or add shadows or gradients.
- Don't put the color logo on busy photos. Use the mono-white version on a dark overlay instead.

## Files

```
logo/       mark + wordmark lockups (color, color-on-dark, mono-ink, mono-white)
wordmark/   wordmark only, same four variants
mark/       mark only, plus a simplified small version of each
app-icon/   app icon SVGs: rounded, full-bleed square, maskable, favicon, WhatsApp avatar
png/        ready-to-use PNGs and favicon.ico (16/32/48)
social/     Open Graph image (1200x630) and WhatsApp Business profile photo (640x640)
react/      ChambarrioLogo.tsx: drop-in components that use the app's CSS tokens
```

import { useId, type CSSProperties, type SVGProps } from "react";

/**
 * Chambarrio brand components.
 *
 * Colors come from the app's existing CSS tokens, so light and dark mode
 * (the `.dark` class) work automatically:
 *   --primary / --uva   purple tile
 *   --uva-ink           purple for rings on light backgrounds (lighter in dark mode)
 *   --limon             lime rings on purple
 *   --chile             coral briefcase
 *
 * All artwork is drawn on a 48 x 48 grid. See BRAND.md for usage rules.
 */

type Variant = "color" | "on-dark" | "mono";

const PALETTE: Record<Variant, { ring: string; house: string; job: string }> = {
  // Light backgrounds. House follows the text color (ink in light, near-white in dark mode).
  color: { ring: "var(--uva-ink)", house: "currentColor", job: "var(--chile)" },
  // On the purple tile or any dark/brand background.
  "on-dark": { ring: "var(--limon)", house: "#fff", job: "var(--chile)" },
  // One color (inherits `color`). For print, stamps, watermarks.
  mono: { ring: "currentColor", house: "currentColor", job: "currentColor" },
};

const HOUSE = "M24 19.2 28.6 23V28.4H19.4V23Z";
const HOUSE_SMALL = "M24 15.6 31.2 21.6V30.2H16.8V21.6Z";
const CASE_HANDLE = "M-2.6-2.2v-0.9a0.8 0.8 0 0 1 0.8-0.8h3.6a0.8 0.8 0 0 1 0.8 0.8v0.9";
const CASE_AT = "translate(37.1 11.4)";

type MarkProps = SVGProps<SVGSVGElement> & {
  variant?: Variant;
  /** Thick single ring + house, no briefcase. Use below ~24px. */
  simplified?: boolean;
  /** Accessible name. Omit when the mark sits next to visible "Chambarrio" text. */
  title?: string;
};

function a11y(title?: string) {
  return title ? { role: "img" as const, "aria-label": title } : { "aria-hidden": true as const };
}

/** The radius mark: house in the center, two rings, briefcase on the outer ring. */
export function ChambarrioMark({ variant = "color", simplified = false, title, ...props }: MarkProps) {
  const maskId = `chb-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const c = PALETTE[variant];

  if (simplified) {
    return (
      <svg viewBox="0 0 48 48" {...a11y(title)} {...props}>
        <circle cx="24" cy="24" r="17" fill="none" stroke={c.ring} strokeWidth="6" />
        <path d={HOUSE_SMALL} fill={c.house} stroke={c.house} strokeWidth="1.4" strokeLinejoin="round" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 48 48" {...a11y(title)} {...props}>
      <defs>
        {/* Cuts a gap in the rings around the briefcase, so it works on any background */}
        <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="48" height="48">
          <rect width="48" height="48" fill="#fff" />
          <g transform={CASE_AT}>
            <rect x="-5.2" y="-2.2" width="10.4" height="6.6" rx="1.4" fill="#000" stroke="#000" strokeWidth="4.4" />
            <path d={CASE_HANDLE} fill="none" stroke="#000" strokeWidth="5.4" />
          </g>
        </mask>
      </defs>
      <g mask={`url(#${maskId})`} fill="none" stroke={c.ring} strokeWidth="3.6">
        <circle cx="24" cy="24" r="18.5" />
        <circle cx="24" cy="24" r="10.8" />
      </g>
      <path d={HOUSE} fill={c.house} stroke={c.house} strokeWidth="1" strokeLinejoin="round" />
      <g transform={CASE_AT}>
        <path d={CASE_HANDLE} fill="none" stroke={c.job} strokeWidth="1.5" />
        <rect x="-5.2" y="-2.2" width="10.4" height="6.6" rx="1.4" fill={c.job} />
      </g>
    </svg>
  );
}

/** Purple rounded tile with the mark, like the app icon. Used in the header. */
export function ChambarrioAppIcon({
  simplified = false,
  title,
  ...props
}: SVGProps<SVGSVGElement> & { simplified?: boolean; title?: string }) {
  return (
    <svg viewBox="0 0 48 48" {...a11y(title)} {...props}>
      <rect width="48" height="48" rx="12" fill="var(--primary)" />
      <g transform="translate(6 6) scale(0.75)">
        <ChambarrioMark variant="on-dark" simplified={simplified} width="48" height="48" />
      </g>
    </svg>
  );
}

/**
 * Wordmark: "chambarri" set in the display font (Bricolage Grotesque 800)
 * plus a ring "o" with a center dot. Size it with font-size.
 */
export function ChambarrioWordmark({ className = "", style }: { className?: string; style?: CSSProperties }) {
  return (
    <span
      translate="no"
      className={`font-display font-extrabold leading-none whitespace-nowrap ${className}`}
      // opsz 48 matches the outlined logo files; ignored if the loaded font has no opsz axis
      style={{ letterSpacing: "-0.035em", fontVariationSettings: "'opsz' 48", ...style }}
    >
      <span className="sr-only">Chambarrio</span>
      <span aria-hidden="true">
        chambarri
        <svg
          viewBox="0 0 24 24"
          style={{ display: "inline-block", width: "0.6em", height: "0.6em", verticalAlign: "-0.035em" }}
        >
          <circle cx="12" cy="12" r="8.7" fill="none" stroke="var(--uva-ink)" strokeWidth="5.6" />
          <circle cx="12" cy="12" r="2.9" fill="currentColor" />
        </svg>
      </span>
    </span>
  );
}

/** Header lockup: app-icon tile + wordmark. Mirrors the old header markup sizes. */
export function ChambarrioLogo({
  iconClassName = "size-9 shrink-0",
  wordmarkClassName = "text-[1.2rem]",
  className = "",
}: {
  iconClassName?: string;
  wordmarkClassName?: string;
  className?: string;
}) {
  return (
    <span className={`flex items-center gap-2.5 ${className}`} translate="no">
      <ChambarrioAppIcon className={iconClassName} />
      <ChambarrioWordmark className={wordmarkClassName} />
    </span>
  );
}

/**
 * Loading state: rings ripple out from the house, as if searching for jobs nearby.
 * Uses SVG <animate>, so it needs no CSS. Ripples are hidden for reduced motion.
 */
export function ChambarrioPulse({ variant = "on-dark", ...props }: SVGProps<SVGSVGElement> & { variant?: Variant }) {
  const c = PALETTE[variant];
  const ripple = (begin: string) => (
    <circle cx="24" cy="24" r="6" fill="none" stroke={c.ring} strokeWidth="2" className="motion-reduce:hidden">
      <animate attributeName="r" values="6;22" dur="2.4s" begin={begin} repeatCount="indefinite" />
      <animate attributeName="opacity" values="0.9;0" dur="2.4s" begin={begin} repeatCount="indefinite" />
    </circle>
  );
  return (
    <svg viewBox="0 0 48 48" role="status" aria-label="Buscando vacantes cerca" {...props}>
      {ripple("0s")}
      {ripple("1.2s")}
      <path d={HOUSE} fill={c.house} stroke={c.house} strokeWidth="1" strokeLinejoin="round" />
    </svg>
  );
}

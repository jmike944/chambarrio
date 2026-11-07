/*
 * Chambarrio · DOODLES — "bold workwear sticker" decorations.
 *
 * Server-component safe: no hooks, no "use client", fully deterministic (seeded PRNG, never
 * Math.random at render). All motion is CSS (./doodles.css, `dd`-prefixed global classes),
 * transform/opacity only, gated by `data-animated` and turned off by prefers-reduced-motion.
 * Every drawing = flat fill + thick ink (#160F33) outline + hard 2px down-right ink offset shadow
 * (printed patch look) + one white highlight. No faces, no hearts, no pink.
 *
 * EXPORTS
 *  - <Doodle name color animated className>        40×40 sticker doodle (default size-8).
 *      estrella (chunky star · twinkle), chispa (welding spark + embers · flash), garabato
 *      (squiggle · wiggle), espiral (spin), corazon (rendered as a HEX NUT — no hearts in the
 *      rugged direction · tightens 60° at a time), flecha (curvy arrow · nudge), zigzag (zig),
 *      circulo (scribbled ring · slow spin), nube (dust puff · drift), rayo (lightning · jolt).
 *  - <DoodleField density palette seed animated scale className>
 *      Absolutely-positioned, pointer-events:none, z-index 0 layer of scattered doodles
 *      (best-candidate layout = no clumps, mixed sizes/rotations, staggered floats).
 *      LAYERING: give the parent `relative isolate overflow-hidden` and render the field as the
 *      FIRST child. Any later sibling is auto-made `position: relative` (zero-specificity rule),
 *      so it paints above the field. Or pass `className="-z-10"` and keep the parent `isolate`.
 *  - <Marquee items speed reverse separator gap className>
 *      Endless ticker band. Content is repeated to fill + duplicated for a seamless -50% loop;
 *      edges fade via mask; pauses on hover/focus; under reduced motion it is a static wrapped row
 *      (copies hidden, so screen readers / static view see each item once).
 *
 * EXTRAS (new — additive)
 *  - <Squiggle variant="underline"|"circle"|"highlight" color animated>word</Squiggle>
 *      Inline wrapper that marks a word in a headline (wobbly ink-outlined underline, scribbled
 *      ring, or chunky marker block behind the text). Inherits font; text stays real text.
 *  - <Blob color seed outline animated className>  wobbly organic background shape (svg, fills
 *      its box — size it with className e.g. "absolute -right-12 -top-10 size-56 -z-10").
 *  - <Burst size color points animated className>content</Burst>  starburst sticker with ink
 *      outline + offset shadow; slowly spins while the content pulses (e.g. "¡HOY!", "+20").
 *  - <HazardTape animated className>optional label</HazardTape>  safety-yellow/ink caution
 *      stripe band (stripes crawl sideways). Height via className (default h-5); label optional.
 */
import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";
import "./doodles.css";

const INK = "#160F33";
const SHADOW = "translate(1.8 1.8)";

export type DoodleName =
  | "estrella"
  | "chispa"
  | "garabato"
  | "espiral"
  | "corazon"
  | "flecha"
  | "zigzag"
  | "circulo"
  | "nube"
  | "rayo";

const DOODLE_NAMES: DoodleName[] = [
  "estrella",
  "chispa",
  "garabato",
  "espiral",
  "corazon",
  "flecha",
  "zigzag",
  "circulo",
  "nube",
  "rayo",
];

type Shape =
  | { kind: "fill"; d: string; evenodd?: boolean; hl: string; extra?: { cx: number; cy: number; r: number }[] }
  | { kind: "line"; d: string };

const SHAPES: Record<DoodleName, Shape> = {
  estrella: {
    kind: "fill",
    d: "M20 3 L24.7 13.5 L36.2 14.8 L27.6 22.5 L30 33.8 L20 28 L10 33.8 L12.4 22.5 L3.8 14.8 L15.3 13.5Z",
    hl: "M19.6 9.4 L17.9 13.6",
  },
  chispa: {
    kind: "fill",
    d: "M20 2 Q22.4 17.6 38 20 Q22.4 22.4 20 38 Q17.6 22.4 2 20 Q17.6 17.6 20 2Z",
    hl: "M18.9 10.5 L18.3 15",
    extra: [
      { cx: 33, cy: 7, r: 2.6 },
      { cx: 7.5, cy: 33, r: 1.9 },
    ],
  },
  rayo: {
    kind: "fill",
    d: "M22 2 L9 22.5 H18.5 L14.5 38 L31.5 15.5 H21.5 L27 2Z",
    hl: "M20.5 7 L15 16.5",
  },
  nube: {
    kind: "fill",
    d: "M9 31 C3 31 2.6 22 9.5 21.5 C9 14 18 11 22 16 C25 9.8 34.5 12 33 19.6 C39.5 20 39.5 31 32 31Z",
    hl: "M13.2 20.2 C13.6 17.6 15.6 16.6 17.8 17",
  },
  corazon: {
    // hex nut (evenodd hole) — replaces the heart for the rugged direction
    kind: "fill",
    d: "M36 20 L28 33.9 L12 33.9 L4 20 L12 6.1 L28 6.1Z M26.2 20 A6.2 6.2 0 1 0 13.8 20 A6.2 6.2 0 1 0 26.2 20Z",
    evenodd: true,
    hl: "M9.6 14.6 L12.8 9.2",
  },
  garabato: { kind: "line", d: "M4 25 C7.5 12 12.5 12 14 20 S20 31 23 21 S29.5 9.5 36 17" },
  espiral: {
    kind: "line",
    d: "M20.5 20.5 C22.5 19 25 21 24 23.6 C22.6 27 17 27 15.6 23 C13.8 17.6 19 13.6 24 14.6 C30.4 16 32.4 23.4 28.6 28.4 C24 34.4 13.6 33.6 10.4 27 C6.8 19.4 11 9.6 20 8.4",
  },
  flecha: { kind: "line", d: "M5 34 C8 21 17 12.5 31 10.5 M23.5 4.5 L32 10 L26 18" },
  zigzag: { kind: "line", d: "M3.5 26 L10 14 L16.5 26 L23 14 L29.5 26 L36 14" },
  circulo: {
    kind: "line",
    d: "M30 9.5 C22 3.6 6.4 7 5.2 20 C4.2 31.6 18 37 28 33 C37 29.2 37 14.6 27.4 8.6 C22.4 5.6 15 6 11.2 9.2",
  },
};

export type DoodleProps = {
  name: DoodleName;
  /** Fill/stroke color (CSS color or var). Default currentColor. */
  color?: string;
  /** Idle motion (spin, twinkle, wiggle, drift — depends on the doodle). Default true. */
  animated?: boolean;
  className?: string;
};

function DoodleSvg({
  name,
  color = "currentColor",
  animated = true,
  className,
  style,
}: DoodleProps & { style?: CSSProperties }) {
  const s = SHAPES[name] ?? SHAPES.estrella;
  return (
    <svg
      viewBox="0 0 40 40"
      className={cn("ddDoodle size-8", className)}
      style={style}
      aria-hidden
      focusable="false"
      data-doodle={name}
      data-animated={animated || undefined}
    >
      {s.kind === "fill" ? (
        <>
          <path d={s.d} transform={SHADOW} fill={INK} fillRule={s.evenodd ? "evenodd" : undefined} />
          <path
            d={s.d}
            fill={color}
            fillRule={s.evenodd ? "evenodd" : undefined}
            stroke={INK}
            strokeWidth="2.6"
            strokeLinejoin="round"
          />
          {s.extra?.map((c) => (
            <circle key={`e${c.cx}`} className="ddEmber" cx={c.cx} cy={c.cy} r={c.r} fill={color} stroke={INK} strokeWidth="2" />
          ))}
          <path d={s.hl} fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
        </>
      ) : (
        <g fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path d={s.d} transform={SHADOW} stroke={INK} strokeWidth="7.4" />
          <path d={s.d} stroke={INK} strokeWidth="7.4" />
          <path d={s.d} stroke={color} strokeWidth="3.4" />
        </g>
      )}
    </svg>
  );
}

export function Doodle(props: DoodleProps) {
  return <DoodleSvg {...props} />;
}

/* ------------------------------------------------------------------ DoodleField */

/** mulberry32 — tiny deterministic PRNG. */
function prng(seed: number) {
  let a = (Math.floor(seed) * 2654435761) >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DEFAULT_PALETTE = ["#FFC93C", "#FF6B2C", "#5CC3FF", "#DDF78A", "#5EE0A0"];
const COUNT = { calm: 4, normal: 7, loco: 12 } as const;
const SIZES = [22, 26, 30, 36, 46, 56];

type Spot = { x: number; y: number; size: number; rot: number; name: DoodleName; color: string; delay: number; k: number };

function layoutField(n: number, seed: number, palette: string[], scale: number): Spot[] {
  const rnd = prng(seed * 7919 + n);
  const pts: { x: number; y: number }[] = [];
  const offset = Math.floor(rnd() * DOODLE_NAMES.length);
  const colorOffset = Math.floor(rnd() * palette.length);
  const out: Spot[] = [];
  for (let i = 0; i < n; i++) {
    // Mitchell's best-candidate: keep the candidate farthest from everything placed so far.
    let best = { x: 50, y: 50 };
    let bestD = -1;
    for (let c = 0; c < 14; c++) {
      const cand = { x: 5 + rnd() * 90, y: 7 + rnd() * 86 };
      let d = Infinity;
      for (const p of pts) d = Math.min(d, Math.hypot(p.x - cand.x, (p.y - cand.y) * 0.8));
      // gentle preference for the edges so the middle (where text lives) stays readable
      const edge = Math.max(Math.abs(cand.x - 50), Math.abs(cand.y - 50)) / 50;
      const score = (pts.length ? d : 50) + edge * 12;
      if (score > bestD) {
        bestD = score;
        best = cand;
      }
    }
    pts.push(best);
    const big = i % 4 === 0; // every 4th one is a hero-sized doodle
    const size = (big ? SIZES[4 + Math.floor(rnd() * 2)] : SIZES[Math.floor(rnd() * 4)]) * scale;
    out.push({
      x: best.x,
      y: best.y,
      size,
      rot: Math.round(rnd() * 70 - 35),
      name: DOODLE_NAMES[(offset + i * 3) % DOODLE_NAMES.length],
      color: palette[(colorOffset + i) % palette.length],
      delay: -Math.round(rnd() * 40) / 10,
      k: Math.round((0.8 + rnd() * 0.6) * 100) / 100,
    });
  }
  return out;
}

export type DoodleFieldProps = {
  /** How many doodles: calm ≈ 4, normal ≈ 7, loco ≈ 12. Default normal. */
  density?: "calm" | "normal" | "loco";
  /** Colors cycled through (CSS colors/vars). Default brand mix. */
  palette?: string[];
  /** Deterministic layout seed so different blocks get different arrangements. */
  seed?: number;
  /** Idle float + per-doodle motion. Default true. */
  animated?: boolean;
  /** Size multiplier for every doodle (base sizes 22–56px). Default 1. */
  scale?: number;
  className?: string;
};

/**
 * Absolutely-positioned layer of floating doodles (pointer-events none, z-index 0).
 * Parent: `relative isolate overflow-hidden`; render the field FIRST so later siblings paint above.
 */
export function DoodleField({
  density = "normal",
  palette = DEFAULT_PALETTE,
  seed = 1,
  animated = true,
  scale = 1,
  className,
}: DoodleFieldProps) {
  const spots = layoutField(COUNT[density] ?? COUNT.normal, seed, palette.length ? palette : DEFAULT_PALETTE, scale);
  return (
    <span aria-hidden className={cn("ddField", className)} data-animated={animated || undefined}>
      {spots.map((s, i) => (
        <span
          key={i}
          className="ddSpot"
          style={
            {
              left: `${s.x}%`,
              top: `${s.y}%`,
              "--dd-s": `${s.size}px`,
              "--dd-r": `${s.rot}deg`,
              "--dd-delay": `${s.delay}s`,
              "--dd-k": s.k,
            } as CSSProperties
          }
        >
          <DoodleSvg name={s.name} color={s.color} animated={animated} className="size-full" />
        </span>
      ))}
    </span>
  );
}

/* ---------------------------------------------------------------------- Marquee */

export type MarqueeProps = {
  items: React.ReactNode[];
  /** Seconds per loop. Default 28. */
  speed?: number;
  reverse?: boolean;
  /** Optional node rendered after every item (e.g. <Doodle name="estrella" className="size-5" />). */
  separator?: ReactNode;
  /** Space between items (CSS length). Default 1.5rem. */
  gap?: string;
  className?: string;
};

/** Endless scrolling band (e.g. "¡Chamba cerca! ★ Sin currículum ★ …"). Pauses on hover; static when reduced motion. */
export function Marquee({ items, speed = 28, reverse = false, separator, gap, className }: MarqueeProps) {
  const reps = Math.max(1, Math.ceil(10 / Math.max(1, items.length)));
  const row = (copy: boolean) =>
    Array.from({ length: reps }, (_, r) =>
      items.map((it, i) => (
        <span key={`${r}-${i}`} className="ddItem" data-copy={copy || r > 0 || undefined} aria-hidden={copy || r > 0 || undefined}>
          {it}
          {separator ? <span className="ddSep" aria-hidden>{separator}</span> : null}
        </span>
      )),
    );
  return (
    <div
      className={cn("ddMarquee py-3", className)}
      data-reverse={reverse || undefined}
      style={{ "--dd-speed": `${speed}s`, ...(gap ? { "--dd-gap": gap } : null) } as CSSProperties}
    >
      <div className="ddTrack">
        <div className="ddHalf">{row(false)}</div>
        <div className="ddHalf" data-copy aria-hidden>
          {row(true)}
        </div>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------------- Squiggle */

export type SquiggleProps = {
  children: ReactNode;
  /** underline = wobbly stroke under the word · circle = scribbled ring · highlight = marker block behind. */
  variant?: "underline" | "circle" | "highlight";
  /** Default safety yellow #FFC93C. */
  color?: string;
  animated?: boolean;
  className?: string;
};

const SQ = {
  underline: { vb: "0 0 120 16", d: "M4 10 C16 3 26 3 36 9 S56 15 66 8 S92 2 116 8" },
  circle: { vb: "0 0 120 60", d: "M101 11 C80 0 22 2 9 25 C-1 45 40 58 82 54 C118 50 121 22 96 12 C80 6 56 6 40 9" },
  highlight: { vb: "0 0 120 16", d: "M3 4 L117 1.5 L115 14 L5 15Z" },
} as const;

export function Squiggle({ children, variant = "underline", color = "#FFC93C", animated = true, className }: SquiggleProps) {
  const s = SQ[variant];
  return (
    <span className={cn("ddSquiggle", className)} data-animated={animated || undefined}>
      <svg className="ddSqArt" data-variant={variant} viewBox={s.vb} preserveAspectRatio="none" aria-hidden focusable="false">
        {variant === "highlight" ? (
          <>
            <path d={s.d} transform="translate(2 2.4)" fill={INK} />
            <path d={s.d} fill={color} stroke={INK} strokeWidth="2.5" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          </>
        ) : (
          <g fill="none" strokeLinecap="round" strokeLinejoin="round">
            <path d={s.d} stroke={INK} strokeWidth="9" vectorEffect="non-scaling-stroke" />
            <path d={s.d} stroke={color} strokeWidth="4.5" vectorEffect="non-scaling-stroke" />
          </g>
        )}
      </svg>
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------------- Blob */

function blobPath(seed: number) {
  const rnd = prng(seed * 31 + 5);
  const n = 7;
  const pts = Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2 + rnd() * 0.3;
    const r = 70 + rnd() * 24;
    return [100 + Math.cos(a) * r, 100 + Math.sin(a) * r] as const;
  });
  // closed Catmull-Rom → cubic Bézier
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return `${d}Z`;
}

export type BlobProps = {
  /** Default sky #5CC3FF. */
  color?: string;
  /** Shape seed — different seeds, different wobbles. Default 1. */
  seed?: number;
  /** Ink outline + hard offset shadow (sticker look). Default false (flat background shape). */
  outline?: boolean;
  animated?: boolean;
  className?: string;
};

export function Blob({ color = "#5CC3FF", seed = 1, outline = false, animated = true, className }: BlobProps) {
  const d = blobPath(seed);
  return (
    <svg viewBox="0 0 200 200" className={cn("ddBlob size-40", className)} aria-hidden focusable="false" data-animated={animated || undefined}>
      {outline ? <path d={d} transform="translate(6 6)" fill={INK} /> : null}
      <path d={d} fill={color} stroke={outline ? INK : undefined} strokeWidth={outline ? 5 : undefined} />
    </svg>
  );
}

/* ------------------------------------------------------------------------ Burst */

function burstPath(points: number) {
  const n = Math.max(6, Math.min(32, Math.round(points)));
  let d = "";
  for (let i = 0; i < n * 2; i++) {
    const a = (i / (n * 2)) * Math.PI * 2 - Math.PI / 2;
    const r = i % 2 === 0 ? 48 : 39;
    d += `${i ? "L" : "M"}${(50 + Math.cos(a) * r).toFixed(1)} ${(50 + Math.sin(a) * r).toFixed(1)}`;
  }
  return `${d}Z`;
}

export type BurstProps = {
  children?: ReactNode;
  /** px. Default 88. */
  size?: number;
  /** Default safety yellow #FFC93C. */
  color?: string;
  /** Number of spikes (6–32). Default 14. */
  points?: number;
  animated?: boolean;
  className?: string;
};

export function Burst({ children, size = 88, color = "#FFC93C", points = 14, animated = true, className }: BurstProps) {
  const d = burstPath(points);
  return (
    <span
      className={cn("ddBurst font-display font-extrabold text-ink", className)}
      style={{ width: size, height: size }}
      data-animated={animated || undefined}
    >
      <svg viewBox="0 0 100 100" aria-hidden focusable="false">
        <path d={d} transform="translate(3 3)" fill={INK} />
        <path d={d} fill={color} stroke={INK} strokeWidth="3" strokeLinejoin="round" />
      </svg>
      {children != null ? <span className="ddBurstBody">{children}</span> : null}
    </span>
  );
}

/* ------------------------------------------------------------------- HazardTape */

export type HazardTapeProps = {
  /** Optional label in an ink tag over the stripes (e.g. "¡Urge!"). */
  children?: ReactNode;
  /** Stripes crawl sideways. Default true. */
  animated?: boolean;
  className?: string;
};

export function HazardTape({ children, animated = true, className }: HazardTapeProps) {
  return (
    <span className={cn("ddHazard h-5", className)} data-animated={animated || undefined}>
      <span className="ddHazardStripes" aria-hidden />
      {children != null ? <span className="ddHazardLabel">{children}</span> : null}
    </span>
  );
}

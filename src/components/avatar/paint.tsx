/*
 * Avatar engine · "union painting" kit.
 *
 * Every layer of the figure is painted twice from the same description:
 *   1. ink pass  — each shape fattened by the outline width `sw`, all in ink → ONE clean silhouette,
 *   2. fill pass — each shape in its colour (optionally preceded by a thin ink ring `sep`, which draws
 *      an inner contour where it overlaps earlier shapes of the same layer).
 * Shapes in one layer therefore fuse (shoulder→arm→hand reads as one limb, no seams), outlines have a
 * single consistent weight, and a hard sticker shadow is just the ink pass again, offset.
 *
 * No ids, no hooks, deterministic output: safe in Server Components and in lists.
 */
import type { ReactNode } from "react";

export const INK = "#160F33";
export const WHITE = "#FFFFFF";

export type Pt = readonly [number, number];
export type Mode = "ink" | "fill";

/** A paintable primitive. */
export type Shape =
  | { d: string; evenodd?: boolean } // closed path
  | { c: Pt; r: number } // disc
  | { p: Pt; q: Pt; w: number } // straight round-capped tube
  | { path: string; w: number }; // stroked (open) path tube

/* ── geometry ────────────────────────────────────────────────────────── */

export const r1 = (v: number) => Math.round(v * 10) / 10;
export const add = (a: Pt, b: Pt): Pt => [a[0] + b[0], a[1] + b[1]];
export const sub = (a: Pt, b: Pt): Pt => [a[0] - b[0], a[1] - b[1]];
export const mul = (a: Pt, k: number): Pt => [a[0] * k, a[1] * k];
const RAD = Math.PI / 180;
/** Vector of length `len` at `deg` (0 = +x, 90 = down; SVG y-down). */
export const polar = (deg: number, len: number): Pt => [len * Math.cos(deg * RAD), len * Math.sin(deg * RAD)];
export const pt = (p: Pt) => `${r1(p[0])} ${r1(p[1])}`;

/** Closed polygon path. */
export const poly = (ps: readonly Pt[]) => `M${ps.map(pt).join("L")}Z`;

/** Mirror an absolute path's x coordinates (only for paths written with absolute commands M L C Q Z). */
export function mirrorD(d: string) {
  let i = 0;
  return d.replace(/-?\d*\.?\d+/g, (n) => {
    const out = i % 2 === 0 ? String(r1(-parseFloat(n))) : n;
    i++;
    return ` ${out}`;
  });
}

/* ── colour helpers ──────────────────────────────────────────────────── */

function hexRgb(h: string): [number, number, number] {
  const s = h.replace("#", "");
  const n = parseInt(s.length === 3 ? s.replace(/./g, (c) => c + c) : s, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Linear mix of two hex colours (t = 0 → a, 1 → b). */
export function mix(a: string, b: string, t: number) {
  const A = hexRgb(a);
  const B = hexRgb(b);
  const c = A.map((v, i) => Math.round(v + (B[i] - v) * t));
  return `#${c.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

/** Relative luminance (0..1). */
export function luma(h: string) {
  const [r, g, b] = hexRgb(h).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Darker tone of a fill for folds, cuffs, ridges. */
export const shade = (h: string, t = 0.16) => mix(h, INK, t);

/** Colour for detail lines drawn ON a fill: ink, or a light tint on very dark fills. */
export const detailOn = (h: string) => (luma(h) < 0.06 ? mix(h, WHITE, 0.38) : INK);

/* ── kit ─────────────────────────────────────────────────────────────── */

export type Kit = {
  m: Mode;
  /** Outline width (outside the shape). */
  sw: number;
  /** Inner contour width. */
  sep: number;
  /** Low level of detail (tiny avatars). */
  lo: boolean;
  /** Shapes that belong to the layer silhouette. `sep`: true → inner contour of `kit.sep`, or a width. */
  part: (shapes: Shape | readonly Shape[], fill: string, sep?: boolean | number) => ReactNode;
  /** Fill-pass-only stroke (features, seams). Width is in the kit's units. */
  line: (d: string, w: number, color?: string, opts?: { cap?: "round" | "butt"; opacity?: number }) => ReactNode;
  /** Fill-pass-only flat fill (no outline). */
  flat: (shape: Shape, fill: string, opacity?: number) => ReactNode;
  /** Same kit for a sub-group drawn at scale `f` (keeps on-screen stroke widths constant). */
  scaled: (f: number) => Kit;
};

function el(s: Shape, color: string, grow: number, key: number | undefined, opacity?: number): ReactNode {
  if ("c" in s) {
    return <circle key={key} cx={r1(s.c[0])} cy={r1(s.c[1])} r={r1(s.r + grow)} fill={color} opacity={opacity} />;
  }
  if ("p" in s) {
    return (
      <line
        key={key}
        x1={r1(s.p[0])}
        y1={r1(s.p[1])}
        x2={r1(s.q[0])}
        y2={r1(s.q[1])}
        stroke={color}
        strokeWidth={r1(s.w + 2 * grow)}
        strokeLinecap="round"
        opacity={opacity}
      />
    );
  }
  if ("path" in s) {
    return (
      <path
        key={key}
        d={s.path}
        fill="none"
        stroke={color}
        strokeWidth={r1(s.w + 2 * grow)}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={opacity}
      />
    );
  }
  return (
    <path
      key={key}
      d={s.d}
      fill={color}
      fillRule={s.evenodd ? "evenodd" : undefined}
      stroke={grow ? color : undefined}
      strokeWidth={grow ? r1(2 * grow) : undefined}
      strokeLinejoin="round"
      opacity={opacity}
    />
  );
}

export function makeKit(m: Mode, sw: number, sep: number, lo: boolean): Kit {
  const k: Kit = {
    m,
    sw,
    sep,
    lo,
    part(shapes, fill, sepArg) {
      const list = (Array.isArray(shapes) ? shapes : [shapes]) as readonly Shape[];
      if (m === "ink") return <g>{list.map((s, i) => el(s, INK, sw, i))}</g>;
      const s = sepArg === true ? sep : sepArg || 0;
      return (
        <g>
          {s ? list.map((x, i) => el(x, INK, s, i)) : null}
          {list.map((x, i) => el(x, fill, 0, i + 1000))}
        </g>
      );
    },
    line(d, w, color = INK, opts) {
      if (m === "ink") return null;
      return (
        <path
          d={d}
          fill="none"
          stroke={color}
          strokeWidth={r1(w)}
          strokeLinecap={opts?.cap ?? "round"}
          strokeLinejoin="round"
          opacity={opts?.opacity}
        />
      );
    },
    flat(shape, fill, opacity) {
      if (m === "ink") return null;
      return el(shape, fill, 0, undefined, opacity);
    },
    scaled(f) {
      return makeKit(m, sw / f, sep / f, lo);
    },
  };
  return k;
}

/** Draw callback for one fused layer. */
export type Draw = (k: Kit) => ReactNode;

export type PaintCtx = { sw: number; sep: number; lo: boolean };

/** One fused layer: optional own hard shadow, ink pass, fill pass. */
export function Layer({ ctx, draw, shadow = 0 }: { ctx: PaintCtx; draw: Draw; shadow?: number }) {
  return (
    <>
      {shadow ? <g transform={`translate(${shadow} ${shadow})`}>{draw(makeKit("ink", ctx.sw, ctx.sep, ctx.lo))}</g> : null}
      {draw(makeKit("ink", ctx.sw, ctx.sep, ctx.lo))}
      {draw(makeKit("fill", ctx.sw, ctx.sep, ctx.lo))}
    </>
  );
}

/**
 * The ink pass of several layers at once, offset: the figure's single hard sticker shadow.
 * Each copy is keyed by its layer's name, like the colour passes: keyed by position, adding or
 * removing a layer (a hat, a badge) would remount the arm's shadow, restart its CSS wave and leave
 * it out of step with the visible arm.
 */
export function ShadowOf({
  ctx,
  layers,
  offset,
}: {
  ctx: PaintCtx;
  layers: readonly { key: string; draw: Draw }[];
  offset: number;
}) {
  const k = makeKit("ink", ctx.sw, ctx.sep, ctx.lo);
  return (
    <g transform={`translate(${offset} ${offset})`}>
      {layers.map((l) => (
        <g key={l.key}>{l.draw(k)}</g>
      ))}
    </g>
  );
}

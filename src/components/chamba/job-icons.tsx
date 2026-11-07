import type { CSSProperties, ReactNode } from "react";
import type { CategoryId } from "@/lib/data/types";
import { cn } from "@/lib/utils";
import styles from "./job-icons.module.css";

/* The stylesheet may arrive as a CSS Module (hashed names) or as plain global
   CSS (this project's Turbopack rule); fall back to the raw class name. */
const MOD = (styles ?? {}) as Record<string, string | undefined>;
const k = (name: string) => MOD[name] ?? name;
const C = {
  tile: k("ciTile"),
  xs: k("ciXs"),
  sm: k("ciSm"),
  md: k("ciMd"),
  lg: k("ciLg"),
  xl: k("ciXl"),
  art: k("ciArt"),
  animated: k("ciAnimated"),
  drop: k("ciDrop"),
  noDrop: k("ciNoDrop"),
  pivot: k("ciPivot"),
  fine: k("ciFine"),
  d2: k("ciD2"),
  d3: k("ciD3"),
  spin: k("ciSpin"),
  bob: k("ciBob"),
  rise: k("ciRise"),
  lift: k("ciLift"),
  hop: k("ciHop"),
  slam: k("ciSlam"),
  swing: k("ciSwing"),
  pop: k("ciPop"),
  print: k("ciPrint"),
  coin: k("ciCoin"),
  flash: k("ciFlash"),
  beam: k("ciBeam"),
  dash: k("ciDash"),
  puff: k("ciPuff"),
  nod: k("ciNod"),
  flip: k("ciFlip"),
  flicker: k("ciFlicker"),
  spray: k("ciSpray"),
  wrench: k("ciWrench"),
  jab: k("ciJab"),
  hammer: k("ciHammer"),
  grow: k("ciGrow"),
};

/* ------------------------------------------------------------------ */
/* Palette — bold workwear: safety yellow, orange, denim, steel, ink   */
/* ------------------------------------------------------------------ */

const INK = "#160F33";
const SUN = "#FFC93C";
const ORANGE = "#FF6B2C";
const CHILE = "#FF5A36";
const LIME = "#DDF78A";
const DENIM = "#2F6FD6";
const SKY = "#5CC3FF";
const MINT = "#5EE0A0";
const STEEL = "#C9C6D6";
const CREAM = "#FFF6E0";
const WHITE = "#FFFFFF";

type Tile = { light: string; dark: string };

/* Workwear pastels (light) and deep, desaturated twins (dark). */
const T = {
  cielo: { light: "#CFE8FF", dark: "#163A63" },
  limon: { light: "#E6F7B0", dark: "#33450F" },
  lila: { light: "#DCD6FF", dark: "#2D2768" },
  durazno: { light: "#FFDCC6", dark: "#5B2C16" },
  menta: { light: "#C6F1D9", dark: "#10442F" },
  sol: { light: "#FFE7A0", dark: "#4E3D0D" },
} satisfies Record<string, Tile>;

type BlockPastel = "lila" | "chicle" | "limon" | "cielo" | "sol" | "menta" | "durazno";
type ToneKey = keyof typeof T;

const TONE: Record<CategoryId, ToneKey> = {
  produccion: "cielo",
  almacen: "limon",
  montacargas: "cielo",
  chofer: "durazno",
  restaurante: "menta",
  caja: "sol",
  ventas: "cielo",
  limpieza: "menta",
  mantenimiento: "sol",
  seguridad: "durazno",
  oficina: "limon",
  construccion: "cielo",
};

/** Per-category tile colours, so chips/cards can be tinted to match. */
export const CATEGORY_TILE: Record<CategoryId, Tile> = Object.fromEntries(
  Object.entries(TONE).map(([id, tone]) => [id, T[tone]]),
) as Record<CategoryId, Tile>;

/** Color-block tone that matches each category's tile — for category-tinted cards and chips. */
export const CATEGORY_BLOCK: Record<CategoryId, BlockPastel> = TONE;

/* ------------------------------------------------------------------ */
/* Shared bits                                                         */
/* ------------------------------------------------------------------ */

const f = (n: number) => Math.round(n * 100) / 100;

/** White "shine" stroke — the single highlight on a main object. */
function Shine({ d, w = 2.6 }: { d: string; w?: number }) {
  return <path d={d} fill="none" stroke={WHITE} strokeWidth={w} />;
}

/** A thick outlined bar (robot arm, mop handle, hammer handle). */
function Bar({ x1, y1, x2, y2, w, fill }: { x1: number; y1: number; x2: number; y2: number; w: number; fill: string }) {
  const d = `M${x1} ${y1}L${x2} ${y2}`;
  return (
    <>
      <path d={d} strokeWidth={w + 6} />
      <path d={d} stroke={fill} strokeWidth={w} />
    </>
  );
}

function gearPath(cx: number, cy: number, rIn: number, rOut: number, teeth: number) {
  const step = (Math.PI * 2) / teeth;
  const pt = (r: number, a: number) => `${f(cx + r * Math.cos(a))} ${f(cy + r * Math.sin(a))}`;
  let d = "";
  for (let i = 0; i < teeth; i++) {
    const a = i * step - Math.PI / 2;
    d += `${i === 0 ? "M" : "L"}${pt(rIn, a - step * 0.26)}L${pt(rOut, a - step * 0.16)}L${pt(rOut, a + step * 0.16)}L${pt(rIn, a + step * 0.26)}`;
    d += `A${rIn} ${rIn} 0 0 1 ${pt(rIn, a + step - step * 0.26)}`;
  }
  return `${d}Z`;
}

function hexPath(cx: number, cy: number, r: number) {
  let d = "";
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i;
    d += `${i ? "L" : "M"}${f(cx + r * Math.cos(a))} ${f(cy + r * Math.sin(a))}`;
  }
  return `${d}Z`;
}

function starPath(cx: number, cy: number, R: number, r: number, n = 5) {
  let d = "";
  for (let i = 0; i < n * 2; i++) {
    const rad = i % 2 === 0 ? R : r;
    const a = (Math.PI / n) * i - Math.PI / 2;
    d += `${i ? "L" : "M"}${f(cx + rad * Math.cos(a))} ${f(cy + rad * Math.sin(a))}`;
  }
  return `${d}Z`;
}

/** A licking flame whose base sits at (cx, 57). */
const flameOuter = (cx: number, h = 13) => {
  const top = 57 - h;
  return `M${cx} ${top}c4.5 4 6.5 7.5 5 ${h - 3.5}c-1 2.3-2.8 3.5-5 3.5s-4-1.2-5-3.5C${cx - 6.5} ${top + 7.5} ${cx - 4.5} ${top + 4} ${cx} ${top}Z`;
};
const flameInner = (cx: number) => `M${cx} 49.5c2.2 2.2 3.2 3.8 2.4 5.6-.5 1-1.3 1.4-2.4 1.4s-1.9-.4-2.4-1.4c-.8-1.8.2-3.4 2.4-5.6Z`;

const pivot = (x: number, y: number): CSSProperties => ({ transformOrigin: `${x}px ${y}px` });

function Wheel({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  return (
    <g className={C.spin}>
      <circle cx={cx} cy={cy} r={r} fill={INK} />
      <circle cx={cx} cy={cy} r={r * 0.42} fill={STEEL} stroke="none" />
      <circle cx={cx} cy={cy - r * 0.7} r={0.95} fill={WHITE} stroke="none" />
    </g>
  );
}

/* ------------------------------------------------------------------ */
/* The twelve icons — 64×64, ink outlines, flat fills, hard drop       */
/* ------------------------------------------------------------------ */

const ART: Record<CategoryId, () => ReactNode> = {
  /* Producción — industrial robot arm next to a spinning gear */
  produccion: () => (
    <>
      <g className={C.spin}>
        <path d={gearPath(20, 42, 10.5, 15, 9)} fill={SUN} />
        <circle cx={20} cy={42} r={4.6} fill={WHITE} />
      </g>
      <Shine d="M10.5 36q1.8-4 5.6-5.6" />
      <rect x={38} y={50} width={21} height={6.5} rx={1.5} fill={SUN} />
      <path d="M42 56.5l4.5-6.5M49 56.5l4.5-6.5M56 56.5l3-4.3" strokeWidth={2.4} />
      <Bar x1={49} y1={49} x2={49} y2={30} w={6} fill={ORANGE} />
      <g className={cn(C.nod, C.pivot)} style={pivot(49, 30)}>
        <Bar x1={49} y1={30} x2={33} y2={19} w={6} fill={ORANGE} />
        <rect x={28.5} y={21} width={9} height={4.5} rx={1.2} fill={STEEL} />
        <path d="M30 25.5l-1.6 5M36 25.5l1.6 5" strokeWidth={3} />
        <circle cx={33} cy={19} r={3.6} fill={WHITE} />
        <g className={cn(C.flash, C.fine)}>
          <path d="M33 34v3.5M27 33.5l-2 2.6M39 33.5l2 2.6" strokeWidth={2.4} />
        </g>
      </g>
      <circle cx={49} cy={30} r={4.4} fill={WHITE} />
      <Shine d="M47.5 46v-9" w={2} />
    </>
  ),

  /* Almacén — taped cardboard boxes stacked on a pallet; the top one slams down */
  almacen: () => (
    <>
      <rect x={5} y={48} width={54} height={4.5} rx={1} fill={DENIM} />
      <rect x={8} y={52.5} width={7} height={4} fill={DENIM} />
      <rect x={28.5} y={52.5} width={7} height={4} fill={DENIM} />
      <rect x={49} y={52.5} width={7} height={4} fill={DENIM} />
      <rect x={7} y={29} width={24} height={19} rx={1.5} fill={ORANGE} />
      <rect x={16} y={29} width={6} height={8} fill={CREAM} strokeWidth={2.4} />
      <Shine d="M11 33v5" />
      <rect x={33} y={29} width={24} height={19} rx={1.5} fill={SUN} />
      <rect x={42} y={29} width={6} height={8} fill={CREAM} strokeWidth={2.4} />
      <path d="M38 44.5v-5.5m0 0-2 2m2-2 2 2M52 44.5v-5.5m0 0-2 2m2-2 2 2" strokeWidth={2} />
      <g className={C.slam}>
        <rect x={17} y={9} width={30} height={20} rx={1.5} fill={SUN} />
        <rect x={29} y={9} width={6} height={20} fill={ORANGE} strokeWidth={2.4} />
        <Shine d="M21 13v6" />
      </g>
    </>
  ),

  /* Montacargas — yellow forklift with a flashing beacon raising a crate */
  montacargas: () => (
    <>
      <rect x={41} y={10} width={5.5} height={45} rx={2} fill={DENIM} />
      <g className={C.lift}>
        <rect x={45.5} y={30} width={3.5} height={24} rx={1} fill={INK} />
        <path d="M46 53.5h15" strokeWidth={3.6} />
        <rect x={48} y={46.5} width={13} height={4.5} rx={1} fill={STEEL} />
        <rect x={49} y={33} width={11} height={13.5} rx={1.5} fill={ORANGE} />
        <path d="M54.5 33v5" stroke={CREAM} strokeWidth={2.6} />
      </g>
      <path d="M12 34l2.5-18.5H34l5 18.5" strokeWidth={3.4} />
      <rect x={11} y={12.5} width={26} height={4.5} rx={2.25} fill={INK} />
      <g className={C.flash}>
        <path d="M20.5 12.5v-2.5a3.5 3.5 0 0 1 7 0v2.5Z" fill={ORANGE} />
      </g>
      <g className={cn(C.flash, C.d2, C.fine)}>
        <path d="M17 6.5l-2-1.5M31 6.5l2-1.5M24 4.2V2" strokeWidth={2.2} />
      </g>
      <rect x={15} y={22} width={6} height={13} rx={2.5} fill={INK} />
      <path d="M6 50V39q0-6 6-6h12q3 0 5 3l1 1h12v13Z" fill={SUN} />
      <path d="M6 41.5l4-4.5M6 48l9-10" strokeWidth={2.4} />
      <Shine d="M19 38h7" />
      <circle cx={17} cy={50.5} r={6.5} fill={INK} />
      <circle cx={17} cy={50.5} r={2.6} fill={STEEL} stroke="none" />
      <circle cx={35} cy={51} r={5.5} fill={INK} />
      <circle cx={35} cy={51} r={2.2} fill={STEEL} stroke="none" />
    </>
  ),

  /* Chofer y reparto — denim delivery van tearing along, wheels spinning */
  chofer: () => (
    <>
      <path className={C.dash} d="M3 27h7" />
      <path className={cn(C.dash, C.d2)} d="M1.5 35h5" />
      <path className={cn(C.dash, C.d3)} d="M3.5 43h4.5" />
      <circle className={cn(C.puff, C.fine)} cx={9} cy={51.5} r={3} fill={STEEL} strokeWidth={2.4} />
      <g className={C.bob}>
        <path d="M10 49V22q0-4 4-4h26q3 0 5 3l6 10q7 1 7 7v8q0 3-3 3Z" fill={DENIM} />
        <path d="M40 22h2.5q1 0 2 1.5l4.5 7.5H40Z" fill={SKY} strokeWidth={2.6} />
        <rect x={11.5} y={37} width={45} height={4} fill={SUN} stroke="none" />
        <path d="M34 21v26" strokeWidth={2.2} />
        <rect x={17} y={23} width={12} height={9.5} rx={1} fill={ORANGE} strokeWidth={2.4} />
        <path d="M23 23v4" strokeWidth={2.2} />
        <circle cx={55.5} cy={44} r={1.8} fill={SUN} strokeWidth={1.8} />
        <Shine d="M13.5 23v6" />
      </g>
      <Wheel cx={21} cy={49.5} r={6} />
      <Wheel cx={47} cy={49.5} r={6} />
    </>
  ),

  /* Restaurantes — a taco flipping off a hot comal over licking flames */
  restaurante: () => (
    <>
      <g className={C.flicker}>
        <path d={flameOuter(18, 12)} fill={CHILE} />
        <path d={flameInner(18)} fill={SUN} stroke="none" />
      </g>
      <g className={cn(C.flicker, C.d2)}>
        <path d={flameOuter(30, 14)} fill={CHILE} />
        <path d={flameInner(30)} fill={SUN} stroke="none" />
      </g>
      <g className={cn(C.flicker, C.d3)}>
        <path d={flameOuter(42, 12)} fill={CHILE} />
        <path d={flameInner(42)} fill={SUN} stroke="none" />
      </g>
      <g transform="rotate(-14 26 24)">
        <g className={C.flip}>
          <circle cx={18} cy={18.5} r={3} fill={ORANGE} strokeWidth={2.4} />
          <circle cx={25} cy={16.5} r={3.2} fill={CHILE} strokeWidth={2.4} />
          <circle cx={33} cy={18} r={3} fill={ORANGE} strokeWidth={2.4} />
          <path d="M10 23q1.5-4.5 5-2.5 2-3.5 5.5-1 2.5-3 5.5-.5 3-3 6 0 3.5-2 5.5 1.5 3.5-.5 4.5 2.5Z" fill={MINT} />
          <path d="M9.5 23a16.5 12 0 0 0 33 0Z" fill={SUN} />
          <path d="M9.5 23h33" strokeWidth={3} />
          <g fill={ORANGE} stroke="none">
            <circle cx={30} cy={28} r={1.4} />
            <circle cx={22} cy={31} r={1.3} />
            <circle cx={35} cy={31} r={1.1} />
          </g>
          <Shine d="M14 26.5q1.5 3.5 4.5 5" w={2.2} />
        </g>
      </g>
      <rect x={45} y={32} width={16} height={4.5} rx={2.25} fill={INK} />
      <path d="M7 35h44l-3 7q-1 2.5-3.5 2.5H13.5Q11 44.5 10 42Z" fill={STEEL} />
      <rect x={4} y={31.5} width={50} height={5} rx={2.5} fill={STEEL} />
      <Shine d="M14 39.5h7" />
    </>
  ),

  /* Caja y tienda — register printing a receipt, drawer popping, coin hopping */
  caja: () => (
    <>
      <g className={C.print}>
        <path d="M16 28V11l2.2-2.5 2.2 2.5 2.2-2.5 2.2 2.5 2.2-2.5 2 2.5v17Z" fill={WHITE} />
        <path d="M18.5 15.5h6M18.5 19.5h4" strokeWidth={2} />
      </g>
      <rect x={38} y={19} width={5} height={9} fill={INK} />
      <rect x={32} y={9} width={17} height={11} rx={2.5} fill={INK} />
      <rect className={C.flash} x={35} y={12} width={11} height={5} rx={1.2} fill={LIME} stroke="none" />
      <path d="M12 46l3.6-18q.4-2 2.4-2h28q2 0 2.4 2L52 46Z" fill={DENIM} />
      <rect x={20} y={30.5} width={5.5} height={4} rx={1} fill={SUN} strokeWidth={2} />
      <rect x={29.2} y={30.5} width={5.5} height={4} rx={1} fill={WHITE} strokeWidth={2} />
      <rect x={38.4} y={30.5} width={5.5} height={4} rx={1} fill={SUN} strokeWidth={2} />
      <rect x={19.5} y={37.5} width={5.5} height={4} rx={1} fill={WHITE} strokeWidth={2} />
      <rect x={29.2} y={37.5} width={5.5} height={4} rx={1} fill={SUN} strokeWidth={2} />
      <rect x={38.9} y={37.5} width={5.5} height={4} rx={1} fill={WHITE} strokeWidth={2} />
      <Shine d="M17.3 31l-.9 4.5" w={2.2} />
      <g className={C.pop}>
        <rect x={8} y={46} width={48} height={10} rx={2.5} fill={ORANGE} />
        <path d="M27 51h10" strokeWidth={3} />
      </g>
      <g className={C.coin}>
        <circle cx={56} cy={26} r={4.8} fill={SUN} />
        <path d="M56 23.5v5" strokeWidth={2} />
      </g>
    </>
  ),

  /* Ventas — orange shopping bag with a swinging barcode price tag */
  ventas: () => (
    <>
      <path d="M17 27v-6q0-7 9-7t9 7v6" strokeWidth={3.4} />
      <path d="M9 27h34l3 27.5q0 2-2 2H8q-2 0-2-2Z" fill={ORANGE} />
      <path d="M8.4 32.5h35.2" strokeWidth={2.2} />
      <g fill={WHITE} stroke="none">
        <circle cx={29} cy={40} r={1.7} />
        <circle cx={34.5} cy={40} r={1.7} />
        <circle cx={40} cy={40} r={1.7} />
        <circle cx={31.75} cy={45} r={1.35} />
        <circle cx={37.25} cy={45} r={1.35} />
        <circle cx={34.5} cy={50} r={1} />
        <circle cx={40} cy={50} r={1} />
      </g>
      <Shine d="M12.5 37v9" />
      <path d="M35 19q7-5 13 2" strokeWidth={2} />
      <g className={cn(C.swing, C.pivot)} style={pivot(48, 21)}>
        <path d="M48 21l7 6.5v18q0 2-2 2h-10q-2 0-2-2v-18Z" fill={SUN} />
        <circle cx={48} cy={27.5} r={1.9} fill={WHITE} strokeWidth={2} />
        <path d="M44.5 33v9M50 33v9" strokeWidth={1.8} />
        <path d="M47 33v9M52 33v9" strokeWidth={1} />
      </g>
    </>
  ),

  /* Limpieza — yellow mop bucket on casters and a spritzing spray bottle */
  limpieza: () => (
    <>
      <Bar x1={36} y1={30} x2={44} y2={5} w={3.5} fill={DENIM} />
      <path d="M27 31q1-5 5-4 2-4 5.5-1.5 3-2.5 5.5 1 3-.5 3.5 4.5Z" fill={WHITE} />
      <rect x={46} y={21} width={11} height={9} rx={1.5} fill={STEEL} />
      <path d="M24 34h34l-3 18.5q-.4 2.5-3 2.5H30q-2.6 0-3-2.5Z" fill={SUN} />
      <rect x={22} y={30} width={38} height={5} rx={2.5} fill={SUN} />
      <path d="M33 41l-2.5 6M40 41l-2.5 6M47 41l-2.5 6M54 41l-1.6 4" strokeWidth={2.4} />
      <Shine d="M28.5 38l.9 5" w={2.2} />
      <circle cx={32} cy={57.5} r={2.4} fill={INK} />
      <circle cx={50} cy={57.5} r={2.4} fill={INK} />
      <rect x={10} y={28} width={8} height={6.5} rx={1} fill={WHITE} />
      <rect x={8} y={20} width={14} height={8.5} rx={2} fill={ORANGE} />
      <rect x={3.5} y={21.5} width={6} height={4.5} rx={1} fill={ORANGE} />
      <path d="M12.5 28.5q-3 1.5-3 6" strokeWidth={2.6} />
      <path d="M5 54V40q0-6 5-6h8q5 0 5 6v14q0 2.5-2.5 2.5h-13Q5 56.5 5 54Z" fill={SKY} />
      <rect x={8.5} y={42} width={11} height={8} rx={1.5} fill={WHITE} strokeWidth={2.2} />
      <Shine d="M8 37.5v2" />
      <circle className={C.spray} cx={5} cy={15} r={2.4} fill={WHITE} strokeWidth={2} />
      <circle className={cn(C.spray, C.d2)} cx={11} cy={12} r={1.9} fill={WHITE} strokeWidth={2} />
      <circle className={cn(C.spray, C.d3, C.fine)} cx={4.5} cy={8} r={1.6} fill={WHITE} strokeWidth={1.8} />
    </>
  ),

  /* Mantenimiento — crossed steel wrench and screwdriver over a hex nut, sparks flying */
  mantenimiento: () => (
    <>
      <g className={cn(C.flash, C.fine)}>
        <path d="M32 3.5v5M24.5 6.5l2.8 3.2M39.5 6.5l-2.8 3.2" strokeWidth={2.6} />
      </g>
      <path d={hexPath(32, 51, 6.5)} fill={SUN} />
      <circle cx={32} cy={51} r={2.4} fill={WHITE} strokeWidth={2.4} />
      <g transform="translate(32 31) rotate(-45) scale(1.08)">
        <g className={C.jab}>
          <rect x={-1.8} y={-24} width={3.6} height={26} fill={STEEL} />
          <path d="M-1.8 -24l1.8-3.6 1.8 3.6Z" fill={STEEL} strokeWidth={2.2} />
          <rect x={-4.5} y={0} width={9} height={4} rx={1} fill={SUN} />
          <rect x={-5.5} y={4} width={11} height={20} rx={4.5} fill={ORANGE} />
          <path d="M-2 9v10M2 9v10" strokeWidth={1.8} />
        </g>
      </g>
      <g transform="translate(32 31) rotate(45) scale(1.08)">
        <g className={C.wrench}>
          <path
            d="M-3.5 -9.71A9 9 0 0 1 -3.5 -26.29L-3.5 -16L3.5 -16L3.5 -26.29A9 9 0 0 1 3.5 -9.71L3.5 16A3.5 3.5 0 0 1 -3.5 16Z"
            fill={STEEL}
          />
          <path d="M-1 -6v16" stroke={WHITE} strokeWidth={2} />
          <circle cx={0} cy={15.5} r={1.4} fill={INK} stroke="none" />
        </g>
      </g>
    </>
  ),

  /* Seguridad — shield badge under a guard cap, flashlight sweeping its beam */
  seguridad: () => (
    <>
      <path className={cn(C.beam, C.noDrop)} d="M48.5 29L39 3H62L58 29Z" fill={SUN} stroke="none" />
      <path d="M25 19c6.5 3.6 13 4.4 19 3.6V36c0 10.5-8.5 16.5-19 21-10.5-4.5-19-10.5-19-21V22.6c6 .8 12.5 0 19-3.6Z" fill={SKY} />
      <path
        d="M25 24.5c5 2.6 9.8 3.4 14 3V36c0 7.5-5.6 12.3-14 16-8.4-3.7-14-8.5-14-16v-8.5c4.2.4 9-.4 14-3Z"
        stroke={WHITE}
        strokeWidth={2}
      />
      <path d={starPath(25, 37.5, 8.6, 3.9)} fill={SUN} strokeWidth={2.6} />
      <g className={C.hop}>
        <path d="M12 17q.5-10 13-10.5Q37.5 7 38 17Z" fill={DENIM} />
        <path d="M9.5 17h31q2 0 1.2 2.4Q25 23.5 8.3 19.4q-.8-2.4 1.2-2.4Z" fill={INK} />
        <circle cx={25} cy={12} r={2.4} fill={SUN} strokeWidth={2} />
        <Shine d="M15.5 14q.6-3 3-4.5" w={2.2} />
      </g>
      <rect x={47} y={28} width={12} height={4} rx={1} fill={WHITE} />
      <path d="M47.5 32h11l-1.5 6h-8Z" fill={STEEL} />
      <rect x={49} y={38} width={8} height={18} rx={2} fill={INK} />
      <path d="M49 43h8M49 47h8" stroke={STEEL} strokeWidth={1.6} />
    </>
  ),

  /* Oficina — laptop with a growing bar chart and a steaming mug */
  oficina: () => (
    <>
      <rect x={8} y={15} width={36} height={27} rx={3} fill={DENIM} />
      <rect x={12} y={19} width={28} height={19} rx={1.5} fill={SKY} strokeWidth={2.4} />
      <rect className={C.grow} x={16} y={29} width={5} height={6} rx={0.8} fill={WHITE} strokeWidth={2} />
      <rect className={cn(C.grow, C.d2)} x={23.5} y={25.5} width={5} height={9.5} rx={0.8} fill={LIME} strokeWidth={2} />
      <rect className={cn(C.grow, C.d3)} x={31} y={22} width={5} height={13} rx={0.8} fill={SUN} strokeWidth={2} />
      <path d="M4 42h44l3 5q.8 2.2-1.4 2.2H2.4Q.2 49.2 1 47Z" fill={STEEL} />
      <path d="M21 45.5h10" strokeWidth={2} />
      <path className={cn(C.rise, C.fine)} d="M48.5 30q-2.5-3 0-6t0-6" />
      <path className={cn(C.rise, C.d2)} d="M54.5 30q-2.5-3 0-6t0-6" />
      <path d="M56 39q5 0 5 4.5T56 48" strokeWidth={3} />
      <rect x={44} y={34} width={13} height={18} rx={2.5} fill={ORANGE} />
      <path d="M44 39.5h13" strokeWidth={2.2} />
      <Shine d="M47.5 43v5" />
    </>
  ),

  /* Construcción — hard hat on a brick wall, hammer pounding beside it */
  construccion: () => (
    <>
      <rect x={4} y={43} width={46} height={13} rx={1.5} fill={CHILE} />
      <path
        d="M4 49.5h46M16 43v6.5M28 43v6.5M40 43v6.5M10 49.5V56M22 49.5V56M34 49.5V56M46 49.5V56"
        strokeWidth={2.2}
      />
      <g className={C.hop}>
        <path d="M10 38q0-22 17-22t17 22Z" fill={SUN} />
        <rect x={23.5} y={14.5} width={7} height={23} rx={3.5} fill={SUN} />
        <path d="M5 41q0-4 4-4h36q4 0 4 4 0 2-2 2H7q-2 0-2-2Z" fill={SUN} />
        <Shine d="M14.5 31q.5-6 4.5-9.5" />
      </g>
      <g className={cn(C.hammer, C.pivot)} style={pivot(56, 56)}>
        <Bar x1={56} y1={56} x2={56} y2={19} w={4} fill={ORANGE} />
        <path d="M49 11h11q2 0 2 2v5q0 2-2 2H49Z" fill={STEEL} />
        <path d="M49 11q-3 0-4 4.5 1.5-1 4-1Z" fill={STEEL} strokeWidth={2.4} />
      </g>
      <g className={cn(C.flash, C.fine)}>
        <path d="M44 8l-2.5-3M48 5.5V2" strokeWidth={2.2} />
      </g>
    </>
  ),
};

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

type ArtProps = {
  category: CategoryId;
  className?: string;
  animated?: boolean;
};

function ArtSvg({
  category,
  className,
  animated,
  title,
  size,
}: ArtProps & { title?: string; size: number | string }) {
  const draw = ART[category] ?? ART.produccion;
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={cn(C.art, animated && C.animated, className)}
      data-animated={animated ? "" : undefined}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      {title ? <title>{title}</title> : null}
      <g fill="none" stroke={INK} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
        {/* hard offset ink shadow: a printed-sticker drop, same shapes recoloured by CSS */}
        <g className={C.drop} transform="translate(2.2 2.4)">
          {draw()}
        </g>
        {draw()}
      </g>
    </svg>
  );
}

/** Bare cartoon art (no tile) — for map pins, stickers and hero collages. */
export function CategoryArt({ category, className, animated }: ArtProps) {
  return <ArtSvg category={category} className={className} animated={animated} size={48} />;
}

/** Cartoon category icon on its workwear-pastel tile. Server-component safe. */
export function CategoryIcon({
  category,
  size = "md",
  animated,
  className,
  title,
}: {
  category: CategoryId;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  animated?: boolean;
  className?: string;
  title?: string;
}) {
  const tile: Tile = CATEGORY_TILE[category] ?? CATEGORY_TILE.produccion;
  return (
    <span
      className={cn(C.tile, C[size], className)}
      style={{ "--tile-l": tile.light, "--tile-d": tile.dark } as CSSProperties}
    >
      <ArtSvg category={category} animated={animated} title={title} size="78%" />
    </span>
  );
}

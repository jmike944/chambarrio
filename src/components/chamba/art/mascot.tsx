/*
 * "Chambita" — a.k.a. el Chambas: the app mascot.
 * A stocky, confident cartoon WORKER drawn like a vintage workwear sticker patch:
 * safety-yellow hard hat, rolled-sleeve orange work shirt, denim overalls with the
 * violet "cerca de ti" pin patch, yellow work gloves, leather boots. Thick ink
 * outlines + hard offset ink shadow; bold, not cute (no blush, no shiny eyes).
 *
 * Moods = pose + expression; props = gear. Server-component safe (no hooks,
 * deterministic). All motion is CSS (mascot.css), gated by `data-animated` and
 * switched off under prefers-reduced-motion.
 *
 * Layout notes (viewBox 0 0 100 120): the character's arms are "A" (viewer-left)
 * and "B" (viewer-right). B performs the mood gesture; A holds the hand prop
 * (lupa, trofeo, paquete, telefono) or falls back to the mood's default pose.
 */
import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";
import "./mascot.css";

export type MascotMood = "feliz" | "saluda" | "festeja" | "piensa" | "duerme" | "wow";
export type MascotProp = "ninguno" | "casco" | "gorra" | "chef" | "lupa" | "trofeo" | "paquete" | "telefono";

export type MascotProps = {
  mood?: MascotMood;
  /** Accessory/prop it holds or wears. */
  prop?: MascotProp;
  /** Rendered width in px (height = width × 1.2). Default 120. */
  size?: number;
  /** Idle animation (blink + bob + mood-specific gesture). Default true. */
  animated?: boolean;
  className?: string;
  /** Accessible label; omit for decorative (aria-hidden). */
  title?: string;
};

/* ── palette ─────────────────────────────────────────────────────────── */
const INK = "#160F33";
const SOL = "#FFC93C";
const SOL_D = "#E9A21A";
const NARANJA = "#FF6B2C";
const NARANJA_D = "#E5521A";
const DENIM = "#2F6FD6";
const VIOLETA = "#4318E0";
const LIMON = "#DDF78A";
const CIELO = "#5CC3FF";
const MENTA = "#5EE0A0";
const CHILE = "#FF5A36";
const CONCRETO = "#C9C6D6";
const CREMA = "#FFF6E0";
const PIEL = "#B5764A";
const PIEL_D = "#7E4A2A";
const BOTA = "#6E4127";
const CARTON = "#E9A86A";

/** Hard offset of the printed-sticker ink shadow. */
const OFF = 2.5;

type Pt = readonly [number, number];
const pts = (p: readonly Pt[]) => p.map(([x, y]) => `${x},${y}`).join(" ");
const origin = ([x, y]: Pt): CSSProperties => ({ transformOrigin: `${x}px ${y}px` });

/* ── drawing helpers ─────────────────────────────────────────────────── */

/** Filled ink-outlined path with an optional hard offset shadow. */
function Shape({ d, fill, sw = 3, shadow = true }: { d: string; fill: string; sw?: number; shadow?: boolean }) {
  return (
    <>
      {shadow ? (
        <path d={d} transform={`translate(${OFF} ${OFF})`} fill={INK} stroke={INK} strokeWidth={sw} strokeLinejoin="round" />
      ) : null}
      <path d={d} fill={fill} stroke={INK} strokeWidth={sw} strokeLinejoin="round" />
    </>
  );
}

/** Ink-outlined tube (limbs, handles, straps) — outline 3 per side, round caps. */
function Tube({ p, w, color, shadow = true }: { p: readonly Pt[]; w: number; color: string; shadow?: boolean }) {
  const s = pts(p);
  const common = { fill: "none", strokeLinecap: "round", strokeLinejoin: "round" } as const;
  return (
    <>
      {shadow ? <polyline points={s} {...common} stroke={INK} strokeWidth={w + 6} transform={`translate(${OFF} ${OFF})`} /> : null}
      <polyline points={s} {...common} stroke={INK} strokeWidth={w + 6} />
      <polyline points={s} {...common} stroke={color} strokeWidth={w} />
    </>
  );
}

/** Plain ink stroke (features, seams). */
function Ln({ d, w = 3, color = INK }: { d: string; w?: number; color?: string }) {
  return <path d={d} fill="none" stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />;
}

/* ── gloves (local coords: wrist at 0,0, fingers toward −y) ──────────── */
type Hand = "fist" | "thumb" | "open";

function Glove({ type }: { type: Hand }) {
  if (type === "thumb") {
    // Fist turned sideways, thumb straight up — fixed orientation.
    return (
      <g>
        <Shape d="M-6 -5 L-6 -15 Q-6 -19 -2.5 -19 Q1 -19 1 -15 L1 -5Z" fill={SOL} sw={2.6} />
        <Shape d="M-8 -6 L5 -6 Q9 -6 9 -2 L9 4 Q9 8 5 8 L-8 8 Q-10 8 -10 5 L-10 -3 Q-10 -6 -8 -6Z" fill={SOL} sw={2.6} />
        <Ln d="M-4 -1 L6 -1 M-4 3 L6 3" w={1.8} />
        <Shape d="M-7 8 L6 8 L6 12 L-7 12Z" fill={SOL_D} sw={2.4} shadow={false} />
      </g>
    );
  }
  if (type === "open") {
    const fingers: Pt[][] = [
      [[-4.5, -6], [-7, -15]],
      [[-1.5, -8], [-2, -18]],
      [[2, -8], [3, -17]],
      [[4.8, -5], [7.5, -13]],
    ];
    return (
      <g>
        {fingers.map((f, i) => (
          <polyline key={i} points={pts(f)} fill="none" stroke={INK} strokeWidth={9} strokeLinecap="round" />
        ))}
        <polyline points={pts([[-5, -2], [-11, -7]])} fill="none" stroke={INK} strokeWidth={9} strokeLinecap="round" />
        <Shape d="M-6.5 2 Q-7.5 -9 0 -9.5 Q7.5 -9 6.5 2Z" fill={SOL} sw={2.6} shadow={false} />
        {fingers.map((f, i) => (
          <polyline key={i} points={pts(f)} fill="none" stroke={SOL} strokeWidth={4} strokeLinecap="round" />
        ))}
        <polyline points={pts([[-5, -2], [-11, -7]])} fill="none" stroke={SOL} strokeWidth={4} strokeLinecap="round" />
        <Shape d="M-6 1 L6 1 L6.5 5.5 L-6.5 5.5Z" fill={SOL_D} sw={2.4} shadow={false} />
      </g>
    );
  }
  return (
    <g>
      <Shape d="M-7 -1 Q-7.5 -13.5 0 -13.5 Q7.5 -13.5 7 -1Z" fill={SOL} sw={2.6} />
      <Ln d="M-3 -10.5 L-3 -7 M1 -11 L1 -7.5" w={1.8} />
      <Ln d="M-4.5 -4.5 Q-4.5 -8 -1 -8" w={1.6} color="#fff" />
      <Shape d="M-6.5 -1.5 L6.5 -1.5 L6.5 4 L-6.5 4Z" fill={SOL_D} sw={2.4} shadow={false} />
    </g>
  );
}

/* ── arms ────────────────────────────────────────────────────────────── */
type ArmPose = {
  s: Pt; // shoulder
  e: Pt; // elbow
  h: Pt; // hand (wrist)
  hand: Hand;
  cls?: string; // whole-arm animation (pivot: shoulder)
  fore?: string; // forearm animation (pivot: elbow)
};

function Arm({ pose, back, front }: { pose: ArmPose; back?: ReactNode; front?: ReactNode }) {
  const { s, e, h, hand } = pose;
  const ang = hand === "thumb" ? 0 : (Math.atan2(h[0] - e[0], -(h[1] - e[1])) * 180) / Math.PI;
  return (
    <g className={cn("mscPart", pose.cls)} style={origin(s)}>
      <Tube p={[s, e]} w={11} color={NARANJA} />
      <g className={cn("mscPart", pose.fore)} style={origin(e)}>
        <Tube p={[e, h]} w={7.5} color={PIEL} />
        {/* rolled sleeve cuff */}
        <circle cx={e[0]} cy={e[1]} r={6.2} fill={NARANJA_D} stroke={INK} strokeWidth={2.6} />
        {back}
        <g transform={`translate(${h[0]} ${h[1]}) rotate(${ang.toFixed(1)})`}>
          <Glove type={hand} />
        </g>
        {front}
      </g>
    </g>
  );
}

const SA: Pt = [33, 61];
const SB: Pt = [67, 61];
const A_HIP: ArmPose = { s: SA, e: [21, 72], h: [30, 83], hand: "fist" };
const A_HANG: ArmPose = { s: SA, e: [27, 75], h: [29, 88], hand: "fist" };

type MoodSpec = { a: ArmPose; b: ArmPose };
const MOODS: Record<MascotMood, MoodSpec> = {
  feliz: { a: A_HIP, b: { s: SB, e: [81, 71], h: [80, 57], hand: "thumb", cls: "mscThumb" } },
  saluda: { a: A_HIP, b: { s: SB, e: [82, 53], h: [84, 37], hand: "open", cls: "mscWave", fore: "mscWaveFore" } },
  festeja: {
    a: { s: SA, e: [19, 48], h: [22, 32], hand: "fist", cls: "mscPumpA" },
    b: { s: SB, e: [81, 48], h: [78, 32], hand: "fist", cls: "mscPumpB" },
  },
  piensa: { a: A_HIP, b: { s: SB, e: [84, 52], h: [70, 37], hand: "open", fore: "mscScratch" } },
  duerme: { a: A_HANG, b: { s: SB, e: [78, 70], h: [82, 54], hand: "fist" } },
  wow: {
    a: { s: SA, e: [19, 67], h: [12, 54], hand: "open", cls: "mscWhoaA" },
    b: { s: SB, e: [81, 67], h: [88, 54], hand: "open", cls: "mscWhoaB" },
  },
};

/** Arm-A override when a hand prop is carried. */
const PROP_ARM: Partial<Record<MascotProp, ArmPose>> = {
  trofeo: { s: SA, e: [19, 48], h: [22, 32], hand: "fist", cls: "mscPumpA" },
  paquete: { s: SA, e: [16, 62], h: [16, 48], hand: "fist" },
  lupa: { s: SA, e: [20, 75], h: [19, 63], hand: "fist", cls: "mscScan" },
  telefono: { s: SA, e: [20, 75], h: [22, 62], hand: "fist", fore: "mscBuzz" },
};

/* ── props ───────────────────────────────────────────────────────────── */

function Trophy() {
  // Held overhead by arm A (hand at 22,32).
  return (
    <g>
      <g className="mscFlash">
        <Ln d="M8 0 L4 -3 M36 0 L40 -3 M22 -6 L22 -10" w={2.6} />
      </g>
      <Tube p={[[13, 6], [8, 7], [9, 12], [14, 13]]} w={2.2} color={SOL} shadow={false} />
      <Tube p={[[31, 6], [36, 7], [35, 12], [30, 13]]} w={2.2} color={SOL} shadow={false} />
      <Shape d="M12 1 L32 1 Q32 15 22 16.5 Q12 15 12 1Z" fill={SOL} />
      <Ln d="M16 4 Q16 10 19 12.5" w={2} color="#fff" />
      <Shape d="M19.5 16 L24.5 16 L25 19.5 L19 19.5Z" fill={SOL_D} sw={2.4} shadow={false} />
      <Shape d="M14.5 19.5 L29.5 19.5 L29.5 23.5 L14.5 23.5Z" fill={VIOLETA} sw={2.6} />
    </g>
  );
}

function Parcel() {
  // Sits on the left shoulder, behind the head; arm A steadies it.
  return (
    <g transform="rotate(-8 22 38)">
      <Shape d="M7 26 L36 26 L36 49 L7 49Z" fill={CARTON} />
      <Ln d="M7 33 L36 33" w={2} />
      <path d="M18 26 L25 26 L25 33 L18 33Z" fill={CREMA} stroke={INK} strokeWidth={2} />
      {/* hazard label */}
      <rect x={11} y={38} width={13} height={7} fill={SOL} stroke={INK} strokeWidth={2} />
      <Ln d="M13 45 L17 38 M17.5 45 L21.5 38" w={2} />
    </g>
  );
}

function Lupa() {
  return (
    <g>
      <Tube p={[[19, 61], [14, 51]]} w={4} color={VIOLETA} shadow={false} />
      <circle cx={11} cy={43} r={9.5} fill={INK} transform={`translate(${OFF} ${OFF})`} />
      <circle cx={11} cy={43} r={8} fill={CIELO} fillOpacity={0.55} stroke={INK} strokeWidth={6.5} />
      <circle cx={11} cy={43} r={8} fill="none" stroke={VIOLETA} strokeWidth={2.6} />
      <Ln d="M6.5 41 Q7.5 37.5 11 37" w={2} color="#fff" />
    </g>
  );
}

function Phone() {
  return (
    <g transform="rotate(-6 22 44)">
      <Shape d="M15.5 30 Q15.5 27 18.5 27 L26.5 27 Q29.5 27 29.5 30 L29.5 55 L15.5 55Z" fill={INK} sw={2.6} />
      <rect x={17.5} y={30} width={10} height={17} rx={1.5} fill={VIOLETA} />
      <path d="M22.5 41 C20.5 38.6 19.6 37.6 19.6 36.2 A2.9 2.9 0 0 1 25.4 36.2 C25.4 37.6 24.5 38.6 22.5 41Z" fill="#fff" />
      <rect x={19} y={43} width={7} height={2} rx={1} fill={LIMON} />
      <g className="mscFlash">
        <Ln d="M12 30 L9 28 M12 35 L8.5 35 M33 30 L36 28" w={2} />
      </g>
    </g>
  );
}

function Shovel() {
  return (
    <g>
      <Tube p={[[84, 44], [87, 103]]} w={4} color={CARTON} />
      <Tube p={[[80, 41], [88, 40]]} w={3.5} color={CARTON} shadow={false} />
      <Shape d="M78 101 L95 100 L94 111 Q88 119 81 112Z" fill={CONCRETO} />
      <Ln d="M83 104 L84 110" w={1.8} color="#fff" />
    </g>
  );
}

/* ── headwear ────────────────────────────────────────────────────────── */
function Headwear({ prop }: { prop: MascotProp }) {
  if (prop === "gorra") {
    return (
      <g>
        <Shape d="M33.5 29 Q33.5 12 50 12 Q66.5 12 66.5 29Z" fill={VIOLETA} />
        <Ln d="M50 12.5 L50 28 M41 15 Q39 21 39.5 28" w={1.8} color="#2A0F9C" />
        <circle cx={50} cy={12} r={2.2} fill={VIOLETA} stroke={INK} strokeWidth={2} />
        <rect x={44.5} y={18} width={11} height={7} rx={1.5} fill={SOL} stroke={INK} strokeWidth={2} />
        <Shape d="M30 29 Q50 24 70 29 Q72.5 34 67 34 Q50 30.5 33 34 Q27.5 34 30 29Z" fill="#2A0F9C" />
        <Ln d="M38 18 Q39.5 14.5 43 13.5" w={2.2} color="#fff" />
      </g>
    );
  }
  if (prop === "chef") {
    return (
      <g>
        <Shape d="M36 30 L36 20 Q28 18 30 10 Q32 3 40 5 Q43 -1 50 -1 Q57 -1 60 5 Q68 3 70 10 Q72 18 64 20 L64 30Z" fill="#fff" />
        <Ln d="M43 22 L43 13 M50 22 L50 11 M57 22 L57 13" w={1.8} color={CONCRETO} />
        <Shape d="M34.5 25 L65.5 25 L65.5 32 L34.5 32Z" fill="#fff" sw={2.8} shadow={false} />
      </g>
    );
  }
  // Hard hat: the default look (ninguno / casco). `casco` adds a headlamp beacon.
  return (
    <g>
      <Shape d="M33 28 Q33 10 50 10 Q67 10 67 28Z" fill={SOL} />
      <path d="M47 10.5 L53 10.5 L53 27 L47 27Z" fill={SOL_D} stroke={INK} strokeWidth={2} strokeLinejoin="round" />
      <Ln d="M37.5 22 Q38 16 42.5 13.2" w={2.4} color="#fff" />
      {prop === "casco" ? (
        <g>
          <g className="mscBeacon">
            <Ln d="M42 6 L39 1.5 M50 4 L50 -1.5 M58 6 L61 1.5" w={2.4} color={SOL_D} />
          </g>
          <rect x={45} y={13} width={10} height={7.5} rx={2} fill={INK} />
          <circle cx={50} cy={16.7} r={2.5} fill={LIMON} className="mscBeaconLens" />
        </g>
      ) : null}
      <Shape d="M27 28.5 Q27 25 31 25 L69 25 Q73 25 73 28.5 Q73 32 69 32 L31 32 Q27 32 27 28.5Z" fill={SOL} />
      <Ln d="M33 28.5 L44 28.5" w={1.6} color="#fff" />
    </g>
  );
}

/* ── face ────────────────────────────────────────────────────────────── */
function Face({ mood }: { mood: MascotMood }) {
  const nose = <Ln d="M50.6 40 Q48.4 42.8 51 43.3" w={2} />;
  switch (mood) {
    case "saluda":
      return (
        <g>
          <Ln d="M39 34.5 Q42.5 32.5 46 34 M54 34 Q57.5 32.5 61 34.5" w={3.4} />
          <g className="mscBlink">
            <Ln d="M43 36.8 L43 40.8 M57 36.8 L57 40.8" w={3.7} />
          </g>
          {nose}
          <path d="M41.5 45.2 Q50 46.8 58.5 45.2 Q57 52.8 50 52.8 Q43 52.8 41.5 45.2Z" fill="#fff" stroke={INK} strokeWidth={2.6} strokeLinejoin="round" />
          <path d="M43.6 49.2 Q50 50.4 56.4 49.2 Q54.6 51.8 50 51.8 Q45.4 51.8 43.6 49.2Z" fill={INK} />
        </g>
      );
    case "festeja":
      return (
        <g>
          <Ln d="M39 33.5 Q42.5 31 46 33 M54 33 Q57.5 31 61 33.5" w={3.4} />
          <Ln d="M40.5 38.6 L46 37.8 M54 37.8 L59.5 38.6" w={3.5} />
          {nose}
          <g className="mscPart mscShout" style={origin([50, 45])}>
            <path d="M40.5 44.6 Q50 46.4 59.5 44.6 Q58.5 54.6 50 54.6 Q41.5 54.6 40.5 44.6Z" fill="#fff" stroke={INK} strokeWidth={2.6} strokeLinejoin="round" />
            <path d="M42.6 49.4 Q50 51 57.4 49.4 Q55.6 53.4 50 53.4 Q44.4 53.4 42.6 49.4Z" fill={INK} />
            <path d="M45.5 53 Q50 50.6 54.5 53 Q50 54 45.5 53Z" fill={CHILE} />
          </g>
        </g>
      );
    case "piensa":
      return (
        <g>
          <Ln d="M39 32.8 L46 34.2 M54 35.2 L61 34" w={3.4} />
          <g className="mscBlink">
            <Ln d="M45 36.5 L45 40.3 M59 36.5 L59 40.3" w={3.7} />
          </g>
          {nose}
          <Ln d="M44.5 48.5 L53 47.6 Q55.5 47.4 57 45.5" w={2.8} />
        </g>
      );
    case "duerme":
      return (
        <g>
          <Ln d="M41 38.5 Q43.5 40.5 46 38.5 M54 38.5 Q56.5 40.5 59 38.5" w={2.6} />
          {nose}
          <g className="mscPart mscSnore" style={origin([50, 48.5])}>
            <ellipse cx={50} cy={48.5} rx={2.6} ry={2} fill={INK} />
          </g>
        </g>
      );
    case "wow":
      return (
        <g>
          <Ln d="M38.5 31.5 Q42.5 29 46 31 M54 31 Q57.5 29 61.5 31.5" w={3.4} />
          <g className="mscBlink">
            <circle cx={43} cy={38} r={2.6} fill={INK} />
            <circle cx={57} cy={38} r={2.6} fill={INK} />
          </g>
          {nose}
          <g className="mscPart mscJaw" style={origin([50, 45])}>
            <path d="M45 45.4 Q50 44.2 55 45.4 Q56.2 53 50 53.4 Q43.8 53 45 45.4Z" fill={INK} stroke={INK} strokeWidth={2.4} strokeLinejoin="round" />
            <path d="M46.4 46.2 Q50 45.2 53.6 46.2 L53.5 48 Q50 47.2 46.5 48Z" fill="#fff" />
            <path d="M46.2 51.4 Q50 48.4 53.8 51.4 Q52.5 53.2 50 53.2 Q47.5 53.2 46.2 51.4Z" fill={CHILE} />
          </g>
        </g>
      );
    default:
      // feliz — confident smirk, one brow cocked
      return (
        <g>
          <Ln d="M39 35 L46 34 M54 33 Q57.5 31.5 61 32.5" w={3.4} />
          <g className="mscBlink">
            <Ln d="M43 36.8 L43 40.8 M57 36.3 L57 40.3" w={3.7} />
          </g>
          {nose}
          <path d="M42 45.5 Q50 47.5 58.5 44 Q56 51.5 49.5 51.5 Q43.5 51.5 42 45.5Z" fill="#fff" stroke={INK} strokeWidth={2.6} strokeLinejoin="round" />
          <Ln d="M44 47 Q50 48.5 56.5 46" w={1.4} />
        </g>
      );
  }
}

/* ── mood extras (outside the figure) ────────────────────────────────── */
const CONFETTI: ReadonlyArray<readonly [number, number, string, number]> = [
  [8, 16, SOL, 20],
  [90, 12, CIELO, -25],
  [4, 52, MENTA, 40],
  [95, 44, NARANJA, -15],
  [32, 2, LIMON, 60],
  [68, 0, CHILE, -50],
  [12, 84, CIELO, 15],
  [90, 78, SOL, 70],
];

function Extras({ mood }: { mood: MascotMood }) {
  if (mood === "festeja") {
    return (
      <g>
        {CONFETTI.map(([x, y, c, r], i) => (
          <g key={i} transform={`translate(${x} ${y}) rotate(${r})`}>
            <rect
              className="mscPart mscConfetti"
              style={{ animationDelay: `${(i * 0.13).toFixed(2)}s` }}
              x={0}
              y={0}
              width={3.5}
              height={6}
              rx={0.6}
              fill={c}
              stroke={INK}
              strokeWidth={1.4}
            />
          </g>
        ))}
        {[[20, 113], [80, 113], [12, 110], [88, 110]].map(([x, y], i) => (
          <circle
            key={i}
            className="mscPart mscDust"
            style={{ animationDelay: `${(i % 2) * 0.05}s` }}
            cx={x}
            cy={y}
            r={i < 2 ? 4.5 : 3}
            fill={CREMA}
            stroke={INK}
            strokeWidth={2}
          />
        ))}
      </g>
    );
  }
  if (mood === "piensa") {
    return (
      <g className="mscPart mscQuestion" style={origin([88, 14])}>
        <Tube p={[[82, 9], [82, 6], [85, 3], [89, 3], [92, 6], [92, 9], [88, 12.5], [88, 16]]} w={3.6} color={VIOLETA} />
        <circle cx={88} cy={22} r={3.2} fill={VIOLETA} stroke={INK} strokeWidth={2.6} />
      </g>
    );
  }
  if (mood === "duerme") {
    const z = (x: number, y: number, s: number) =>
      [
        [x, y],
        [x + 6 * s, y],
        [x, y + 6 * s],
        [x + 6 * s, y + 6 * s],
      ] as Pt[];
    return (
      <g>
        {[z(66, 14, 0.75), z(74, 5, 1), z(85, -5, 1.25)].map((p, i) => (
          <g key={i} className="mscPart mscZ" style={{ animationDelay: `${i * 0.7}s`, transformOrigin: `${p[0][0]}px ${p[0][1]}px` }}>
            <Tube p={p} w={2.4} color="#fff" shadow={false} />
          </g>
        ))}
      </g>
    );
  }
  if (mood === "wow") {
    return (
      <g className="mscFlash">
        <Ln d="M22 22 L27 26 M19 31 L25 32 M78 22 L73 26 M81 31 L75 32" w={2.8} />
      </g>
    );
  }
  if (mood === "saluda") {
    return (
      <g className="mscFlash">
        <Ln d="M93 30 Q96 36 93 42 M89 26 L92 22" w={2.6} />
      </g>
    );
  }
  return null;
}

/* ── the character ───────────────────────────────────────────────────── */
export function Mascot({ mood = "feliz", prop = "ninguno", size = 120, animated = true, className, title }: MascotProps) {
  const spec = MOODS[mood];
  const armA = PROP_ARM[prop] ?? spec.a;
  const chef = prop === "chef";

  // Hat behaviour per mood (static offset on the outer group, motion on the inner).
  const hatStatic =
    mood === "duerme" ? "translate(1 9) rotate(7 50 28)" : mood === "piensa" ? "translate(-1 -2) rotate(-9 34 28)" : undefined;

  const propBack = prop === "paquete" ? <Parcel /> : null;
  const handProp =
    prop === "trofeo" ? <Trophy /> : prop === "lupa" ? <Lupa /> : prop === "telefono" ? <Phone /> : null;

  return (
    <svg
      viewBox="0 0 100 120"
      width={size}
      height={size * 1.2}
      className={cn("mscRoot shrink-0 overflow-visible", className)}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      data-mood={mood}
      data-prop={prop}
      data-animated={animated || undefined}
    >
      {title ? <title>{title}</title> : null}

      {/* ground shadow */}
      <ellipse className="mscPart mscGround" style={origin([50, 116])} cx={50} cy={116} rx={33} ry={3.4} fill={INK} opacity={0.18} />

      <g transform={mood === "duerme" ? "rotate(4 50 116)" : undefined}>
        <g className={cn("mscPart", mood === "festeja" && "mscJump")} style={origin([50, 116])}>
          {mood === "duerme" ? <Shovel /> : null}

          <g className="mscPart mscBreathe" style={origin([50, 116])}>
            {propBack}

            {/* boots */}
            <Shape d="M29 103 L48 103 L48 112.5 Q48 116 44.5 116 L24.5 116 Q20.5 116 20.5 112 Q20.5 108 25.5 107 L29 106Z" fill={BOTA} />
            <Shape d="M71 103 L52 103 L52 112.5 Q52 116 55.5 116 L75.5 116 Q79.5 116 79.5 112 Q79.5 108 74.5 107 L71 106Z" fill={BOTA} />
            <Ln d="M22 112.5 L47 112.5 M53 112.5 L78 112.5" w={2} />
            <Ln d="M25 109 Q26.5 107.5 29 107.5 M75 109 Q73.5 107.5 71 107.5" w={1.8} color="#fff" />

            {/* neck + shirt */}
            <path d="M44 48 L56 48 L56 58 L44 58Z" fill={PIEL_D} stroke={INK} strokeWidth={3} />
            <Shape d="M29 66 Q29 57 38 56 L62 56 Q71 57 71 66 L70 92 L30 92Z" fill={NARANJA} />
            <path d="M44.5 56 L50 63 L55.5 56Z" fill={PIEL_D} stroke={INK} strokeWidth={2.4} strokeLinejoin="round" />
            <path d="M40 55 L50 64 L45 54Z M60 55 L50 64 L55 54Z" fill={NARANJA_D} stroke={INK} strokeWidth={2.4} strokeLinejoin="round" />

            {/* overalls (bib + pants, one piece) */}
            <Shape
              d="M38 68 L62 68 L62 86 L69 86 L70 105 L52 105 L51 96 Q50 94 49 96 L48 105 L30 105 L31 86 L38 86Z"
              fill={DENIM}
            />
            <Ln d="M38 86 L62 86" w={2} />
            <Ln d="M41 71 L41 84 M59 71 L59 84 M60 89 L60 101" w={1.4} color="#9DC0FF" />
            <Tube p={[[40, 69], [36, 57.5]]} w={4} color={DENIM} shadow={false} />
            <Tube p={[[60, 69], [64, 57.5]]} w={4} color={DENIM} shadow={false} />
            <circle cx={40} cy={69.5} r={2} fill={SOL} stroke={INK} strokeWidth={1.6} />
            <circle cx={60} cy={69.5} r={2} fill={SOL} stroke={INK} strokeWidth={1.6} />

            {chef ? (
              <g>
                <Ln d="M38 66 L44 56 M62 66 L56 56" w={2.4} />
                <Shape d="M36.5 65 L63.5 65 L65.5 103 Q65.5 105.5 63 105.5 L37 105.5 Q34.5 105.5 34.5 103Z" fill="#fff" sw={2.8} shadow={false} />
                <Ln d="M41 90 L59 90" w={1.8} color={CONCRETO} />
              </g>
            ) : null}

            {/* pin patch — the "cerca de ti" brand pin */}
            <g transform={chef ? "translate(0 2)" : undefined}>
              <path
                d="M50 85 C46.2 80.6 44 78.4 44 75.6 A6 6 0 0 1 56 75.6 C56 78.4 53.8 80.6 50 85Z"
                fill={VIOLETA}
                stroke={INK}
                strokeWidth={2.3}
                strokeLinejoin="round"
              />
              <circle cx={50} cy={75.6} r={2.1} fill="#fff" />
            </g>

            {/* head */}
            <g className={cn("mscPart", mood === "feliz" && "mscNod", mood === "saluda" && "mscTilt")} style={origin([50, 54])}>
              <g transform={mood === "piensa" ? "rotate(-4 50 54)" : undefined}>
                <circle cx={34} cy={40} r={4.2} fill={PIEL} stroke={INK} strokeWidth={2.6} />
                <circle cx={66} cy={40} r={4.2} fill={PIEL} stroke={INK} strokeWidth={2.6} />
                <Shape d="M34 32 Q34 18 50 18 Q66 18 66 32 L66 42 Q66 54 50 54 Q34 54 34 42Z" fill={PIEL} shadow={false} />
                <path d="M34.6 29 L39.5 29 L38.5 38 L34.6 36Z M65.4 29 L60.5 29 L61.5 38 L65.4 36Z" fill={INK} />
                <Face mood={mood} />
                <g transform={hatStatic}>
                  <g className={cn("mscPart", mood === "wow" && "mscHatPop")} style={origin([50, 28])}>
                    <Headwear prop={prop} />
                  </g>
                </g>
              </g>
            </g>

            {/* arms */}
            <Arm pose={armA} back={handProp} />
            <Arm pose={spec.b} />
          </g>
        </g>
      </g>

      <Extras mood={mood} />
    </svg>
  );
}

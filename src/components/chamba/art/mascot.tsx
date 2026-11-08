/*
 * "Chambita" — a.k.a. el Chambas: the app mascot, drawn by the avatar engine (@/components/avatar)
 * from its "chambas" preset: safety-yellow hard hat, orange shirt with rolled sleeves, denim
 * overalls with the violet "cerca de ti" pin, yellow work gloves, boots.
 *
 * Moods = arm pose + expression; props = headwear or something held in the viewer-left hand.
 * The figure is assembled here from the engine's painters (same fused-limb hands and arms, same
 * ink outline + hard shadow as every other avatar), because the mascot needs a few arm poses the
 * public <Avatar> doesn't offer (hand on hip, scratching the head, whoa, holding a prop).
 *
 * Server-component safe (no hooks, no ids, deterministic). All motion is CSS: the engine's
 * avatar.css (pivots at shoulder / elbow) + mascot.css, only with `data-animated` and never
 * under prefers-reduced-motion.
 *
 * viewBox: -213 -105.5 426 511.2 (engine figure units: face centre at 0,0, soles at y 400).
 * The viewer-RIGHT arm does the mood gesture; the viewer-LEFT arm holds the hand prop
 * (lupa, trofeo, paquete, telefono) or falls back to the mood's own pose.
 */
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { type ArmPose, L1, L2, POSE_SPECS, paintArm, placeArm } from "@/components/avatar/arms";
import { paintLegs, paintTorso } from "@/components/avatar/body";
import { AVATAR_PRESETS, type AvatarConfig, type Expression } from "@/components/avatar/config";
import { paintHairBack, paintHead, paintHeadwear, paintNeck } from "@/components/avatar/head";
import { type Look, resolveLook } from "@/components/avatar/look";
import { type Draw, INK, type Kit, Layer, type PaintCtx, ShadowOf, WHITE, mirrorD, polar, pt, r1 } from "@/components/avatar/paint";
import "@/components/avatar/avatar.css";
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
const SOL = "#FFC93C";
const SOL_D = "#E9A21A";
const NARANJA = "#FF6B2C";
const VIOLETA = "#4318E0";
const LIMON = "#DDF78A";
const CIELO = "#5CC3FF";
const MENTA = "#5EE0A0";
const CHILE = "#FF5A36";
const CONCRETO = "#C9C6D6";
const CREMA = "#FFF6E0";
const CARTON = "#F2B36B";
const TINTA = "#2B2452";

const VB = [-213, -105.5, 426, 511.2] as const;

/* ── looks ───────────────────────────────────────────────────────────── */

const CHAMBAS = AVATAR_PRESETS.chambas.config;

function configFor(prop: MascotProp): AvatarConfig {
  if (prop === "gorra") return { ...CHAMBAS, headwear: "gorra", headwearColor: "violeta" };
  // Chef: white double-breasted jacket; the toque is drawn here (the engine has no chef hat).
  if (prop === "chef") return { ...CHAMBAS, headwear: "ninguno", outfit: "filipina", outfitColor: "blanco" };
  return CHAMBAS;
}

/* ── poses ───────────────────────────────────────────────────────────── */

/** Hand resting on the hip, back of the hand out, fingers down along the hip. */
const HIP: ArmPose = { a1: 62, a2: 113, hand: "relax", hflip: true, hb: 4 };
/** Scratching under the hard hat (tilts it back a little). */
const SCRATCH: ArmPose = { a1: -40, a2: -128, hand: "relax", hflip: true, hb: 4, fore: "mscScratch" };
/** Whoa: both open palms up beside the face. */
const WHOA: ArmPose = { a1: 38, a2: -72, hand: "open", hb: 10, arm: "mscWhoa" };

type Face = "duerme" | "piensa" | "wow";
type MoodSpec = {
  R: ArmPose;
  L: ArmPose;
  expression: Expression;
  face?: Face;
  /** Head nods (dozing). */
  nod?: boolean;
  /** Static hat offset (head units). */
  hat?: string;
};

const P = POSE_SPECS;
const MOODS: Record<MascotMood, MoodSpec> = {
  feliz: { R: P.pulgar.R, L: HIP, expression: "guino" },
  saluda: { R: P.saluda.R, L: HIP, expression: "sonrisa" },
  festeja: { R: P.festeja.R, L: P.festeja.L, expression: "emocion" },
  piensa: { R: SCRATCH, L: HIP, expression: "sonrisa", face: "piensa", hat: "rotate(-9 -54 -30)" },
  duerme: {
    R: P["brazos-cruzados"].R,
    L: P["brazos-cruzados"].L,
    expression: "sonrisa",
    face: "duerme",
    nod: true,
    hat: "translate(0 9) rotate(5 0 -30)",
  },
  wow: { R: WHOA, L: WHOA, expression: "sonrisa", face: "wow" },
};

type HandProp = "lupa" | "trofeo" | "paquete" | "telefono";
/** Viewer-left arm when it carries something. "thumb" = side-on fist, thumb up along the handle. */
const HOLD: Record<HandProp, ArmPose> = {
  lupa: { a1: 86, a2: -56, hand: "thumb", screen: 2, fore: "mscScan" },
  telefono: { a1: 88, a2: -64, hand: "thumb", screen: 4, fore: "mscBuzz" },
  trofeo: { a1: -40, a2: -98, hand: "fist", hb: 6, arm: "avPump" },
  paquete: { a1: -24, a2: -102, hand: "relax", hb: 2 },
};
const isHandProp = (p: MascotProp): p is HandProp => p === "lupa" || p === "trofeo" || p === "paquete" || p === "telefono";

/* ── helpers ─────────────────────────────────────────────────────────── */

const ell = (cx: number, cy: number, rx: number, ry: number) =>
  `M${r1(cx - rx)} ${cy}a${rx} ${ry} 0 1 0 ${r1(2 * rx)} 0a${rx} ${ry} 0 1 0 ${r1(-2 * rx)} 0Z`;
const rrect = (x: number, y: number, w: number, h: number, r: number) =>
  `M${x + r} ${y}H${x + w - r}Q${x + w} ${y} ${x + w} ${y + r}V${y + h - r}Q${x + w} ${y + h} ${x + w - r} ${y + h}H${x + r}Q${x} ${y + h} ${x} ${y + h - r}V${y + r}Q${x} ${y} ${x + r} ${y}Z`;

/**
 * Something held in a hand, drawn in that hand's frame (wrist at 0,0, "up" = the hand's up) and
 * wrapped in the same shoulder / elbow animation groups as the arm, so it moves with the hand.
 */
function inHand(side: 1 | -1, A: ArmPose, L: Look, node: ReactNode) {
  const E = polar(A.a1, L1);
  const F = polar(A.a2, L2);
  const theta = A.screen ?? A.a2 + 90 + (A.hb ?? 0);
  return placeArm(
    side,
    L.B,
    <g className={A.arm ? `avA ${A.arm}` : undefined}>
      <g transform={`translate(${pt(E)})`}>
        <g className={A.fore ? `avA ${A.fore}` : undefined}>
          <g transform={`translate(${pt(F)}) rotate(${r1(theta)})`}>{node}</g>
        </g>
      </g>
    </g>,
  );
}

/* ── face tweaks (fill pass, on top of the engine face) ──────────────── */

function paintFaceFx(k: Kit, L: Look, face: Face): ReactNode {
  if (k.m === "ink") return null;
  const cover = (d: string) => k.flat({ d }, L.skin);
  const mouth = cover(ell(0, 26, 18.5, 10.8));
  if (face === "duerme") {
    return (
      <>
        {cover(ell(-14, -2, 8, 8.6))}
        {cover(ell(14, -2, 8, 8.6))}
        {mouth}
        {k.line("M-21-1Q-14 5.5-7-1M7-1Q14 5.5 21-1", k.lo ? 5 : 4.2)}
        <g className="mscSnore">{k.flat({ c: [2, 27], r: 4.8 }, INK)}</g>
      </>
    );
  }
  if (face === "piensa") {
    return (
      <>
        {cover(ell(15, -16.5, 11.5, 6.4))}
        {mouth}
        {k.line("M7-23Q15-29.5 23-23", k.lo ? 6.5 : 5.4)}
        {k.line("M-10 27.5Q0 27 7 24.5Q11.5 23 13.5 19.5", k.lo ? 5 : 4.2)}
      </>
    );
  }
  return (
    <>
      {cover(ell(-15, -16.5, 11.5, 6.4))}
      {cover(ell(15, -16.5, 11.5, 6.4))}
      {mouth}
      {k.line("M-23-23Q-15-30.5-7-24M7-24Q15-30.5 23-23", k.lo ? 6.5 : 5.4)}
      <g className="mscJaw">
        <path d={ell(0, 27, 8.6, 10.8)} fill={INK} />
        <path d="M-5.6 32.5Q0 27.5 5.6 32.5Q3.2 37.6 0 37.6Q-3.2 37.6-5.6 32.5Z" fill={CHILE} />
      </g>
    </>
  );
}

/* ── headwear extras ─────────────────────────────────────────────────── */

/** Chef toque: puffed crown + pleated band (head units). */
function paintToque(k: Kit): ReactNode {
  return (
    <>
      {k.part(
        [
          { c: [-27, -64], r: 21 },
          { c: [0, -78], r: 25 },
          { c: [27, -64], r: 21 },
          { d: "M-38-62H38V-40H-38Z" },
        ],
        WHITE,
      )}
      {k.lo ? null : k.line("M-14-66V-46M0-70V-46M14-66V-46", k.sep * 0.8, CONCRETO)}
      {k.part({ d: rrect(-41, -47, 82, 23, 6) }, WHITE, true)}
      {k.line("M-28-72Q-27-84-16-89", k.lo ? 6 : 5, CREMA)}
    </>
  );
}

/** Headlamp on the hard hat (prop "casco"); the lens flashes. */
function paintLamp(k: Kit): ReactNode {
  return (
    <>
      {k.part({ d: rrect(-13, -74, 26, 18, 6) }, TINTA, true)}
      <g className="mscLens">{k.part({ c: [0, -65], r: 5.6 }, LIMON, k.sep * 0.7)}</g>
    </>
  );
}

/* ── hand props (hand frame: wrist 0,0; the fist's top is at y ≈ −33) ─── */

function paintLupa(k: Kit): ReactNode {
  return (
    <>
      {k.part({ p: [4, 6], q: [4, -64], w: 10 }, VIOLETA)}
      {k.part({ c: [4, -88], r: 24 }, VIOLETA)}
      {k.part({ c: [4, -88], r: 16.5 }, CIELO, true)}
      {k.lo ? null : k.line("M-6-95Q-4-102 4-104", 4.5, WHITE)}
    </>
  );
}

/** Trophy gripped by the stem in a raised fist (fist top at y ≈ −32): cup above, plinth below. */
function paintTrofeo(k: Kit): ReactNode {
  const handle = "M-24-88Q-44-89-42-72Q-40-58-22-58";
  return (
    <>
      {k.part([{ path: handle, w: 6.5 }, { path: mirrorD(handle), w: 6.5 }], SOL)}
      {k.part({ d: "M-6-50H6V-8H-6Z" }, SOL_D)}
      {k.part({ d: "M-29-98H29Q30-58 0-50Q-30-58-29-98Z" }, SOL)}
      {k.part({ d: rrect(-31, -104, 62, 11, 4) }, SOL_D, true)}
      {k.lo ? null : k.part({ d: "M0-90L3.8-82.6L11.8-81.6L6-76L7.6-68L0-72L-7.6-68L-6-76L-11.8-81.6L-3.8-82.6Z" }, WHITE, k.sep * 0.6)}
      {k.lo ? null : k.line("M-20-92Q-19-70-9-61", 4.5, WHITE)}
    </>
  );
}

function paintPhone(k: Kit): ReactNode {
  return (
    <>
      {k.part({ d: rrect(-18, -100, 46, 84, 10) }, TINTA)}
      {k.flat({ d: rrect(-12, -92, 34, 50, 5) }, VIOLETA)}
      {k.flat({ d: "M5-58C-1.5-65.5-4.5-68.5-4.5-72.5A9.5 9.5 0 0 1 14.5-72.5C14.5-68.5 11.5-65.5 5-58Z" }, WHITE)}
      {k.flat({ c: [5, -72.5], r: 3.2 }, VIOLETA)}
      {k.lo ? null : k.flat({ d: rrect(-4, -52, 18, 5, 2.5) }, LIMON)}
    </>
  );
}

/** Parcel resting on the viewer-left shoulder, behind the head (figure units). */
function paintParcel(k: Kit): ReactNode {
  return (
    <g transform="rotate(-6 -112 14)">
      {k.part({ d: rrect(-170, -36, 116, 88, 6) }, CARTON)}
      {k.part({ d: "M-121-36H-103V-8H-121Z" }, CREMA, k.sep * 0.8)}
      {k.lo ? null : k.line("M-170-8H-54", k.sep * 0.8, INK, { opacity: 0.5 })}
      {k.lo ? null : (
        <>
          {k.part({ d: "M-90 14H-62V34H-90Z" }, SOL, k.sep * 0.7)}
          {k.line("M-85 34L-78 14M-74 34L-67 14", 3.4)}
        </>
      )}
    </g>
  );
}

/* ── extras around the figure (plain strokes, no kit) ─────────────────── */
/* Loose motion marks use currentColor, so they stay visible on dark surfaces (the text colour). */

const CONFETTI: ReadonlyArray<readonly [number, number, string, number]> = [
  [-182, -70, SOL, 20],
  [176, -86, CIELO, -25],
  [-204, 70, MENTA, 40],
  [198, 40, NARANJA, -15],
  [-112, -104, LIMON, 60],
  [104, -106, CHILE, -50],
  [-196, 214, CIELO, 15],
  [196, 196, SOL, 70],
];

function Ink({ d, w = 9, c = INK }: { d: string; w?: number; c?: string }) {
  return <path d={d} fill="none" stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />;
}

function Extras({ mood, prop }: { mood: MascotMood; prop: MascotProp }) {
  const out: ReactNode[] = [];
  if (mood === "festeja") {
    out.push(
      <g key="c">
        {CONFETTI.map(([x, y, c, r], i) => (
          <g key={i} transform={`translate(${x} ${y}) rotate(${r})`}>
            <rect
              className="mscConfetti"
              style={{ animationDelay: `${(i * 0.13).toFixed(2)}s` }}
              x={-8}
              y={-13}
              width={16}
              height={26}
              rx={3}
              fill={c}
              stroke={INK}
              strokeWidth={6}
            />
          </g>
        ))}
        {(
          [
            [-84, 395, 17],
            [84, 395, 17],
            [-118, 388, 11.5],
            [118, 388, 11.5],
          ] as const
        ).map(([x, y, r], i) => (
          <circle key={i} className="mscDust" style={{ animationDelay: `${(i % 2) * 0.05}s` }} cx={x} cy={y} r={r} fill={CREMA} stroke={INK} strokeWidth={7} />
        ))}
      </g>,
    );
  }
  if (mood === "piensa") {
    out.push(
      <g key="q" className="mscPart mscQuestion" style={{ transformOrigin: "176px -54px" }}>
        <Ink d="M152-74Q152-100 176-100Q200-100 200-78Q200-62 182-54Q176-51 176-40" w={25} />
        <Ink d="M152-74Q152-100 176-100Q200-100 200-78Q200-62 182-54Q176-51 176-40" w={12} c={VIOLETA} />
        <circle cx={176} cy={-14} r={10} fill={VIOLETA} stroke={INK} strokeWidth={6.5} />
      </g>,
    );
  }
  if (mood === "duerme") {
    out.push(
      <g key="z">
        {(
          [
            [72, -44, 0.75],
            [112, -78, 1],
            [158, -110, 1.25],
          ] as const
        ).map(([x, y, s], i) => {
          const d = `M${x} ${y}h${22 * s}l${-22 * s} ${22 * s}h${22 * s}`;
          return (
            <g key={i} className="mscZ" style={{ animationDelay: `${i * 0.7}s` }}>
              <Ink d={d} w={19} />
              <Ink d={d} w={8} c={WHITE} />
            </g>
          );
        })}
      </g>,
    );
  }
  if (mood === "wow") {
    out.push(
      <g key="w" className="mscFlash">
        <Ink d="M-74-96L-60-80M-100-66L-80-58M74-96L60-80M100-66L80-58" c="currentColor" />
      </g>,
    );
  }
  if (mood === "saluda") {
    out.push(
      <g key="s" className="mscFlash">
        <Ink d="M176-28Q190-4 176 20M196-46Q216-4 196 38" c="currentColor" />
      </g>,
    );
  }
  if (prop === "trofeo") {
    out.push(
      <g key="t" className="mscFlash">
        <Ink d="M-170-46L-186-58M-116-62L-108-80M-176 0L-196-2" c="currentColor" />
      </g>,
    );
  }
  if (prop === "casco" && mood !== "duerme") {
    out.push(
      <g key="b" className="mscBeacon">
        <Ink d="M-30-100L-38-112M0-106V-120M30-100L38-112" w={8} c={SOL_D} />
      </g>,
    );
  }
  return <>{out}</>;
}

/* ── the character ───────────────────────────────────────────────────── */

export function Mascot({ mood = "feliz", prop = "ninguno", size = 120, animated = true, className, title }: MascotProps) {
  const spec = MOODS[mood];
  const cfg = configFor(prop);
  const L = resolveLook(cfg, spec.expression);
  const held = isHandProp(prop) ? prop : null;
  const armL = held ? HOLD[held] : spec.L;
  const armR = spec.R;

  // Outline weight: the engine's 5 units, a bit heavier when small so the sticker edge survives.
  const sw = Math.min(9, Math.max(5, (1.8 * VB[2]) / size));
  const ctx: PaintCtx = { sw, sep: sw * 0.62, lo: size < 80 };

  const headWrap = (node: ReactNode) =>
    spec.nod ? (
      <g transform="translate(0 44)">
        <g className="avA avNod">
          <g transform="translate(0 -44)">{node}</g>
        </g>
      </g>
    ) : (
      node
    );

  const hat: Draw = (k) =>
    headWrap(
      <g transform={spec.hat}>
        <g className={mood === "wow" ? "mscPart mscHatPop" : undefined} style={mood === "wow" ? { transformOrigin: "0px -30px" } : undefined}>
          {prop === "chef" ? paintToque(k) : paintHeadwear(k, L)}
          {prop === "casco" ? paintLamp(k) : null}
        </g>
      </g>,
    );

  const festejaDelay = mood === "festeja" && !held ? -0.45 : undefined;
  const drawL: Draw = (k) => placeArm(-1, L.B, paintArm(k, armL, L, "full", festejaDelay));
  const drawR: Draw = (k) => placeArm(1, L.B, paintArm(k, armR, L, "full"));

  const layers: { key: string; draw: Draw; shadow?: number }[] = [
    { key: "hairBack", draw: (k) => headWrap(paintHairBack(k, L)) },
    { key: "legs", draw: (k) => paintLegs(k, L) },
    { key: "neck", draw: (k) => paintNeck(k, L) },
    {
      key: "torso",
      draw: (k) => (
        <>
          {paintTorso(k, L, "completo")}
          {prop === "chef" ? (
            <g transform="translate(-27 88) scale(1.1)">
              {k.part({ d: "M0 18C-4.2 13-7 10-7 6.5A7 7 0 0 1 7 6.5C7 10 4.2 13 0 18Z" }, VIOLETA, k.sep / 1.1)}
              {k.flat({ c: [0, 6.5], r: 2.6 }, WHITE)}
            </g>
          ) : null}
        </>
      ),
    },
    ...(held === "paquete" ? [{ key: "parcel", draw: paintParcel, shadow: 3 }] : []),
    {
      key: "head",
      draw: (k) =>
        headWrap(
          <>
            {paintHead(k, L)}
            {spec.face ? paintFaceFx(k, L, spec.face) : null}
          </>,
        ),
    },
    { key: "hat", draw: hat, shadow: 3 },
    ...(held === "lupa" || held === "trofeo" || held === "telefono"
      ? [
          {
            key: "held",
            draw: ((k) => inHand(-1, armL, L, held === "lupa" ? paintLupa(k) : held === "trofeo" ? paintTrofeo(k) : paintPhone(k))) as Draw,
            shadow: 3,
          },
        ]
      : []),
    { key: "armL", draw: drawL, shadow: 3 },
    { key: "armR", draw: drawR, shadow: 3 },
  ];

  return (
    <svg
      viewBox={VB.join(" ")}
      width={size}
      height={size * 1.2}
      className={cn("mscRoot avRoot shrink-0 overflow-visible", className)}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      data-mood={mood}
      data-prop={prop}
      data-animated={animated || undefined}
    >
      {title ? <title>{title}</title> : null}
      <ellipse className="mscGround" cx={0} cy={401} rx={94} ry={7.5} fill={INK} opacity={0.16} />
      {/* keyed by mood + prop: a change remounts the figure so every copy of an animated arm restarts in step */}
      <g key={`${mood}|${prop}|${size}`} className={cn("avA", mood === "festeja" ? "avHop" : "avBob")}>
        <ShadowOf ctx={ctx} layers={layers} offset={sw} />
        {layers.map((l) => (
          <Layer key={l.key} ctx={ctx} draw={l.draw} shadow={l.shadow} />
        ))}
      </g>
      <Extras mood={mood} prop={prop} />
    </svg>
  );
}

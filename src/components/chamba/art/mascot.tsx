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
 * viewBox: -198 -105.5 396 475.2 (engine figure units: face centre at 0,0, soles at y SOLE = 364).
 * The viewer-RIGHT arm does the mood gesture; the viewer-LEFT arm holds the hand prop
 * (lupa, trofeo, paquete, telefono) or falls back to the mood's own pose.
 *
 * `config`: someone else's look plays the part (inside the app: the signed-in user's own avatar, see
 * my-mascot.tsx). Their face, hair, skin, build, outfit, accessories and colours stay theirs; the moods
 * and the held props work the same, in their hands; the hat props (casco, gorra, chef) are the
 * mascot's own outfits, so they are ignored (the person keeps their own headwear, or none).
 */
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { type ArmPose, L1, L2, POSE_SPECS, paintArm, placeArm, shoulderCaps } from "@/components/avatar/arms";
import { SOLE, chestAccessoryShown, paintChestAccessory, paintLegs, paintTorso } from "@/components/avatar/body";
import { AVATAR_PRESETS, type AvatarConfig, type Expression, type HairStyle, sanitizeAvatar } from "@/components/avatar/config";
import {
  paintBeard,
  paintFacialHairOver,
  paintGlasses,
  paintHairBack,
  paintHairFront,
  paintHead,
  paintHeadsetBand,
  paintHeadsetCups,
  paintHeadwear,
  paintNeck,
} from "@/components/avatar/head";
import { type Look, resolveLook } from "@/components/avatar/look";
import { type Draw, INK, type Kit, Layer, type PaintCtx, ShadowOf, WHITE, mirrorD, polar, pt, r1 } from "@/components/avatar/paint";
import "@/components/avatar/avatar.css";
import "./mascot.css";

export type MascotMood = "feliz" | "saluda" | "festeja" | "piensa" | "duerme" | "wow";
export type MascotProp = "ninguno" | "casco" | "gorra" | "chef" | "lupa" | "trofeo" | "paquete" | "telefono";

export type MascotProps = {
  mood?: MascotMood;
  /** Accessory/prop it holds or wears. With a `config`, the hat props (casco, gorra, chef) are ignored. */
  prop?: MascotProp;
  /**
   * Whose look plays the part (sanitized on render). Omitted: el Chambas, the brand mascot. Given: that
   * person in the mascot's poses, with their own headwear and outfit (see the header).
   */
  config?: AvatarConfig;
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

/** Width : height = 1 : 1.2, from the hard-hat beacons down to just under the soles (SOLE + 5.7). */
const VB = [-198, -105.5, 396, 475.2] as const;

/* ── looks ───────────────────────────────────────────────────────────── */

const CHAMBAS = AVATAR_PRESETS.chambas.config;

/** The mascot's own outfits: worn by el Chambas only, never put on someone else's look. */
const isHatProp = (p: MascotProp) => p === "casco" || p === "gorra" || p === "chef";

/** Hair painted all over the head under a hat, so lifting the hat (wow) shows hair, not a bald crown. */
const FULL_UNDER_HAT: ReadonlySet<HairStyle> = new Set(["corto", "rapado", "chongo", "coleta", "calvo"]);

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
/**
 * Viewer-left arm when it carries something. "grip" = side-on fist closed round the handle (the handle
 * leaves its top); "thumb" = side-on fist, thumb up along the phone.
 */
const HOLD: Record<HandProp, ArmPose> = {
  lupa: { a1: 86, a2: -56, hand: "grip", screen: 2, fore: "mscScan" },
  telefono: { a1: 88, a2: -64, hand: "thumb", screen: 4, fore: "mscBuzz" },
  trofeo: { a1: -40, a2: -98, hand: "fist", hb: 6, arm: "avPump" },
  // carried at the shoulder on the upturned hand: the wrist just under the parcel's bottom edge, the hand
  // behind it, the fingertips curled over the edge onto its face (paintParcel)
  paquete: { a1: 37, a2: -80, hand: "relax", hb: -4 },
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
  // a beard comes back round the covered mouth (its lips cut out again), the moustache / goatee and the
  // glasses over the new features: the covers below would otherwise cut into them
  const mouth = (
    <>
      {/* square-ish, so the engine smile's corners (±15, 19) don't peek out beside the new mouth */}
      {cover(rrect(-19, 15, 38, 21, 4))}
      {paintBeard(k, L)}
    </>
  );
  const over = (
    <>
      {paintFacialHairOver(k, L)}
      {paintGlasses(k, L)}
    </>
  );
  if (face === "duerme") {
    return (
      <>
        {cover(ell(-14, -2, 8, 8.6))}
        {cover(ell(14, -2, 8, 8.6))}
        {mouth}
        {k.line("M-21-1Q-14 5.5-7-1M7-1Q14 5.5 21-1", k.lo ? 5 : 4.2)}
        <g className="mscSnore">{k.flat({ c: [2, 27], r: 4.8 }, INK)}</g>
        {over}
      </>
    );
  }
  // the brow covers reach the fringe's inner contour: the front hair goes back over them (the raised
  // brows then sit on top, as the engine's own brows do)
  if (face === "piensa") {
    return (
      <>
        {cover(ell(15, -16.5, 11.5, 6.4))}
        {paintHairFront(k, L)}
        {mouth}
        {k.line("M7-23Q15-29.5 23-23", k.lo ? 6.5 : 5.4)}
        {k.line("M-10 27.5Q0 27 7 24.5Q11.5 23 13.5 19.5", k.lo ? 5 : 4.2)}
        {over}
      </>
    );
  }
  return (
    <>
      {cover(ell(-15, -16.5, 11.5, 6.4))}
      {cover(ell(15, -16.5, 11.5, 6.4))}
      {paintHairFront(k, L)}
      {mouth}
      {k.line("M-23-23Q-15-30.5-7-24M7-24Q15-30.5 23-23", k.lo ? 6.5 : 5.4)}
      <g className="mscJaw">
        <path d={ell(0, 27, 8.6, 10.8)} fill={INK} />
        <path d="M-5.6 32.5Q0 27.5 5.6 32.5Q3.2 37.6 0 37.6Q-3.2 37.6-5.6 32.5Z" fill={CHILE} />
      </g>
      {over}
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

/**
 * Fingertips (gloved, or bare) curled up over the parcel's bottom edge (parcel frame): the hand carrying it from
 * below (HOLD.paquete, wrist at ≈ (−105, 62) here) is hidden behind it. Index → pinky, middle longest.
 */
const PARCEL_GRIP: ReadonlyArray<readonly [number, number]> = [
  [-116.5, 7.5],
  [-108.8, 10],
  [-101.1, 9],
  [-93.6, 6.5],
];

/** Parcel carried at the viewer-left shoulder, behind the head (figure units), with the carrying fingers. */
function paintParcel(k: Kit, L: Look): ReactNode {
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
      {PARCEL_GRIP.map(([x, h]) => (
        <g key={x}>{k.part({ p: [x, 55], q: [x, 55 - h], w: 9.6 }, L.glove ? L.gloveFill : L.skin, true)}</g>
      ))}
    </g>
  );
}

/* ── extras around the figure (plain strokes, no kit) ─────────────────── */
/* Loose motion marks use currentColor, so they stay visible on dark surfaces (the text colour). */

type Bit = readonly [number, number, string, number];
/** Where a raised trophy's cup is (HOLD.trofeo): no confetti there. */
const OVER_TROPHY: Bit = [-112, -98, LIMON, 60];
const CONFETTI: ReadonlyArray<Bit> = [
  [-172, -70, SOL, 20],
  [166, -86, CIELO, -25],
  [-178, 88, MENTA, 40], // under a shouldered parcel's corner (HOLD.paquete), not on it
  [178, 36, NARANJA, -15],
  OVER_TROPHY,
  [104, -100, CHILE, -50],
  [-176, 196, CIELO, 15],
  [176, 180, SOL, 70],
];

function Ink({ d, w = 9, c = INK }: { d: string; w?: number; c?: string }) {
  return <path d={d} fill="none" stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />;
}

function Extras({ mood, prop }: { mood: MascotMood; prop: MascotProp }) {
  const out: ReactNode[] = [];
  if (mood === "festeja") {
    out.push(
      <g key="c">
        {CONFETTI.filter((b) => prop !== "trofeo" || b !== OVER_TROPHY).map(([x, y, c, r], i) => (
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
            [-84, SOLE - 5, 17],
            [84, SOLE - 5, 17],
            [-118, SOLE - 12, 11.5],
            [118, SOLE - 12, 11.5],
          ] as const
        ).map(([x, y, r], i) => (
          <circle key={i} className="mscDust" style={{ animationDelay: `${(i % 2) * 0.05}s` }} cx={x} cy={y} r={r} fill={CREMA} stroke={INK} strokeWidth={7} />
        ))}
      </g>,
    );
  }
  if (mood === "piensa") {
    out.push(
      <g key="q" className="mscPart mscQuestion" style={{ transformOrigin: "160px -54px" }}>
        <Ink d="M136-74Q136-100 160-100Q184-100 184-78Q184-62 166-54Q160-51 160-40" w={25} />
        <Ink d="M136-74Q136-100 160-100Q184-100 184-78Q184-62 166-54Q160-51 160-40" w={12} c={VIOLETA} />
        <circle cx={160} cy={-14} r={10} fill={VIOLETA} stroke={INK} strokeWidth={6.5} />
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
    // a raised trophy fills the left side (it has its own shine marks): surprise marks on the right only
    const left = prop === "trofeo" ? "" : "M-74-96L-60-80M-100-66L-80-58";
    out.push(
      <g key="w" className="mscFlash">
        <Ink d={`${left}M74-96L60-80M100-66L80-58`} c="currentColor" />
      </g>,
    );
  }
  if (mood === "saluda") {
    out.push(
      <g key="s" className="mscFlash">
        <Ink d="M160-28Q174-4 160 20M180-46Q200-4 180 38" c="currentColor" />
      </g>,
    );
  }
  // shine marks out to the left of the raised trophy (festeja has its confetti there instead)
  if (prop === "trofeo" && mood !== "festeja") {
    out.push(
      <g key="t" className="mscFlash">
        <Ink d="M-140-92L-156-101M-158-52L-174-64M-164-6L-184-8" c="currentColor" />
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

export function Mascot({ mood = "feliz", prop: asked = "ninguno", config, size = 120, animated = true, className, title }: MascotProps) {
  const spec = MOODS[mood];
  // someone's own look: the mascot's outfits (hat props) don't go on it
  const prop: MascotProp = config !== undefined && isHatProp(asked) ? "ninguno" : asked;
  const cfg = config !== undefined ? sanitizeAvatar(config) : configFor(prop);
  const L = resolveLook(cfg, spec.expression);
  const held = isHandProp(prop) ? prop : null;
  // The mood's hat moves (pushed back while scratching, slid down while dozing, popping up in surprise)
  // suit a hat with a brim; a bandana or a hairnet stays put. It only pops when there's hair under it.
  const brimmed = prop === "chef" || L.headwear === "casco" || L.headwear === "gorra";
  const hatShift = brimmed ? spec.hat : undefined;
  const hatPop = mood === "wow" && brimmed && (prop === "chef" || FULL_UNDER_HAT.has(L.hairStyle));
  const armL = held ? HOLD[held] : spec.L;
  // crossed arms need both arms: holding something, the dozing mascot rests the other hand on its hip
  const crossed = mood === "duerme" && !held;
  const armR = mood === "duerme" && held ? HIP : spec.R;

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
      <g transform={hatShift}>
        <g className={hatPop ? "mscPart mscHatPop" : undefined} style={hatPop ? { transformOrigin: "0px -30px" } : undefined}>
          {prop === "chef" ? paintToque(k) : paintHeadwear(k, L)}
          {prop === "casco" ? paintLamp(k) : null}
        </g>
      </g>,
    );

  // the shoulders belong to the shirt: the torso paints each arm's cap, fused with the cloth
  const caps = shoulderCaps(L, armL, armR);
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
          {paintTorso(k, L, "completo", caps, crossed)}
          {/* the chef's chest pin hides behind crossed arms, like the avatar's chest accessories */}
          {prop === "chef" && !crossed ? (
            <g transform="translate(-27 88) scale(1.1)">
              {k.part({ d: "M0 18C-4.2 13-7 10-7 6.5A7 7 0 0 1 7 6.5C7 10 4.2 13 0 18Z" }, VIOLETA, k.sep / 1.1)}
              {k.flat({ c: [0, 6.5], r: 2.6 }, WHITE)}
            </g>
          ) : null}
        </>
      ),
    },
    // the person's badge / radio (a look's own accessory; hidden behind crossed arms, as on the avatar)
    ...(chestAccessoryShown(L, crossed) ? [{ key: "acc", draw: ((k) => paintChestAccessory(k, L)) as Draw }] : []),
    // the carrying arm goes behind the parcel (its hand is under it), the parcel behind the head
    ...(held === "paquete"
      ? [
          { key: "armL", draw: drawL, shadow: 3 },
          { key: "parcel", draw: ((k) => paintParcel(k, L)) as Draw, shadow: 3 },
        ]
      : []),
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
    // a headset's band goes over the hair but under any headwear, its ear cups over both
    ...(L.accessory === "audifonos" ? [{ key: "band", draw: ((k) => headWrap(paintHeadsetBand(k, L))) as Draw }] : []),
    ...(L.headwear !== "ninguno" || prop === "chef" ? [{ key: "hat", draw: hat, shadow: 3 }] : []),
    ...(L.accessory === "audifonos" ? [{ key: "cups", draw: ((k) => headWrap(paintHeadsetCups(k))) as Draw }] : []),
    ...(held === "lupa" || held === "trofeo" || held === "telefono"
      ? [
          {
            key: "held",
            draw: ((k) => inHand(-1, armL, L, held === "lupa" ? paintLupa(k) : held === "trofeo" ? paintTrofeo(k) : paintPhone(k))) as Draw,
            shadow: 3,
          },
        ]
      : []),
    ...(held === "paquete" ? [] : [{ key: "armL", draw: drawL, shadow: 3 }]),
    { key: "armR", draw: drawR, shadow: 3 },
    // crossed arms: the left upper arm again, over the right hand tucked under it
    ...(crossed ? [{ key: "armCover", draw: ((k) => placeArm(-1, L.B, paintArm(k, armL, L, "upper"))) as Draw, shadow: 3 }] : []),
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
      <ellipse className="mscGround" cx={0} cy={SOLE + 1} rx={94} ry={7.5} fill={INK} opacity={0.16} />
      {/* keyed by the look + mood + prop: a change remounts the figure so every copy of an animated arm restarts in step */}
      <g key={`${JSON.stringify(cfg)}|${mood}|${prop}|${size}`} className={cn("avA", mood === "festeja" ? "avHop" : "avBob")}>
        <ShadowOf ctx={ctx} layers={layers} offset={sw} />
        {layers.map((l) => (
          <Layer key={l.key} ctx={ctx} draw={l.draw} shadow={l.shadow} />
        ))}
      </g>
      <Extras mood={mood} prop={prop} />
    </svg>
  );
}

/**
 * The same box as `<Mascot size className />`, empty: holds the figure's spot (and its responsive
 * classes) while the look that goes in it is still loading, so the layout never jumps.
 */
export function MascotPlaceholder({ size = 120, className }: Pick<MascotProps, "size" | "className">) {
  return (
    <svg
      viewBox={VB.join(" ")}
      width={size}
      height={size * 1.2}
      className={cn("mscRoot avRoot shrink-0 overflow-visible", className)}
      aria-hidden
      data-placeholder
    />
  );
}

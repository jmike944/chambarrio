/*
 * Avatar engine · arms and poses — "Trabajador fuerte".
 *
 * No deltoid balls. Each arm is split at the armpit:
 *   · the SHOULDER CAP (capRegion) — from the joint it rises a little, rounds over the outer-top corner
 *     into the arm's outer edge and comes back down the inside to the armpit. The TORSO layer paints it,
 *     fused with the shirt, so the shoulder is part of the garment silhouette (no armhole line, no ball);
 *     raised, it lifts with the arm (a small shrug, never a balloon);
 *   · the ARM below it (armTube), outlined by the arm layer: the arm's own line starts at the armpit.
 * Upper arm tapers to the elbow, the forearm swells just under the elbow and tapers to the wrist (upper
 * arm a bit thicker than the forearm).
 *
 * Arms are laid out for the viewer-RIGHT side (+x frame, origin = shoulder joint) and mirrored with
 * scale(−1 1) for the viewer-left side. Animated groups pivot at their local origin (shoulder or
 * elbow). Arm length is the same in every pose and build.
 */
import type { CSSProperties, ReactNode } from "react";
import type { AvatarPose } from "./config";
import { type HandPose, paintHand } from "./hands";
import type { Build, Look } from "./look";
import { type Kit, type Pt, type Shape, add, detailOn, mul, polar, pt, r1, shade } from "./paint";

export const L1 = 52; // shoulder → elbow
export const L2 = 47; // elbow → wrist
const UP0 = 15.5; // upper arm half-width at the shoulder (bare)
const UP1 = 12.6; // … at the elbow
const FO0 = 12.2; // forearm radius at the elbow
const FOM = 12.5; // … at the forearm swell (30 % down)
const FO1 = 9.4; // … at the wrist
/**
 * Shoulder cap, in the arm frame (x down the arm, y across, +y = outer): its top point T sits where the
 * torso's trapezius line ends (the build's shoulder top) for the relaxed pose, leaving along the same
 * tangent, so the shoulder line runs smoothly into the arm's outer edge; S = the armpit (how far down
 * the arm the arm's own outline starts); OX = where the outer edge starts.
 */
const CAP_T: Pt = [-9, 2.6];
const CAP_DT: Pt = [0.42, 0.91];
const CAP_OX = 1.5;
const CAP_S = 15;
const HK = 0.52; // hand scale: hand ≈ 63 units ≈ 0.7 × head height (≈ 0.75 × the face)
/** Gesture hands read better a bit bigger (they're seen end-on / curled). */
const HAND_BOOST: Partial<Record<HandPose, number>> = { fist: 1.12, thumb: 1.3, grip: 1.3, point: 1.06 };

export type ArmPose = {
  /** Upper-arm direction (deg; 0 = +x, 90 = straight down). */
  a1: number;
  /** Forearm direction (deg, absolute). */
  a2: number;
  hand: HandPose;
  /** Wrist bend relative to the forearm (deg). */
  hb?: number;
  /** Absolute hand angle (deg) — overrides forearm-following (thumbs-up stays upright). */
  screen?: number;
  /** Mirror the hand (thumb to the other side, e.g. back of a hanging hand). */
  hflip?: boolean;
  /** Forearm overlaps its own upper arm → give it an inner contour. */
  fold?: boolean;
  /**
   * The hand slips under the other arm (crossed arms, back arm): drawn without the flared glove
   * gauntlet / shirt cuff, which are wider than the top forearm and would poke out below it.
   */
  tuck?: boolean;
  /** CSS animation class at the shoulder / elbow pivots. */
  arm?: string;
  fore?: string;
};

type PoseSpec = {
  L: ArmPose;
  R: ArmPose;
  /** drawn last (on top) */
  top: "L" | "R";
  /**
   * Crossed arms: the BACK arm's upper arm is painted once more over the top arm (armCover layer), so
   * the top arm's hand tucks under the opposite bicep instead of poking out past it.
   */
  cover?: boolean;
};

/** Relaxed: hangs a little away from the body, elbow at the waist, wrist at the belt. */
const RELAX: ArmPose = { a1: 75, a2: 84, hand: "relax", hflip: true, hb: -4 };

export const POSE_SPECS: Record<AvatarPose, PoseSpec> = {
  neutral: { L: RELAX, R: RELAX, top: "R" },
  saluda: { L: RELAX, R: { a1: 26, a2: -95, hand: "open", hb: -3, fold: true, arm: "avWave", fore: "avWaveFore" }, top: "R" },
  festeja: {
    L: { a1: -40, a2: -99, hand: "fist", arm: "avPump" },
    R: { a1: -40, a2: -99, hand: "fist", arm: "avPump" },
    top: "R",
  },
  pulgar: { L: RELAX, R: { a1: 80, a2: -58, hand: "thumb", screen: -6, fold: true, fore: "avThumb" }, top: "R" },
  senala: { L: RELAX, R: { a1: 75, a2: -63, hand: "point", hb: -10, fold: true, fore: "avPoint" }, top: "R" },
  // Upper arms hang at the sides; the forearms rise a little toward the opposite biceps and cross (the
  // right one on top, the left one a touch lower). Both hands tuck under the opposite upper arm: the
  // fingertips stay inside it for every build, nothing pokes out past the arms.
  "brazos-cruzados": {
    L: { a1: 92, a2: 194, hand: "relax", hflip: true, hb: 0, tuck: true },
    R: { a1: 92, a2: 198, hand: "relax", hflip: true, hb: -6, fold: true, tuck: true },
    top: "R",
    cover: true,
  },
};

export type ArmPart = "full" | "upper";

/** A tapered capsule: the hull of a disc of radius `ra` at `a` and one of radius `rb` at `b`. */
export function taper(a: Pt, b: Pt, ra: number, rb: number): Shape {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const d = Math.hypot(dx, dy) || 0.001;
  const u: Pt = [dx / d, dy / d];
  const n: Pt = [-u[1], u[0]];
  const c = Math.max(-0.99, Math.min(0.99, (ra - rb) / d));
  const s = Math.sqrt(1 - c * c);
  const at = (o: Pt, r: number, sg: number): Pt => [o[0] + r * (c * u[0] + sg * s * n[0]), o[1] + r * (c * u[1] + sg * s * n[1])];
  const A1 = at(a, ra, 1);
  const B1 = at(b, rb, 1);
  const B2 = at(b, rb, -1);
  const A2 = at(a, ra, -1);
  return {
    d: `M${pt(A1)}L${pt(B1)}A${r1(rb)} ${r1(rb)} 0 ${c < 0 ? 1 : 0} 0 ${pt(B2)}L${pt(A2)}A${r1(ra)} ${r1(ra)} 0 ${c > 0 ? 1 : 0} 0 ${pt(A1)}Z`,
  };
}

const K = 0.5523;

type Cap = { s: number };

/** Local → arm-frame mapper for an arm at angle a1 (x along the arm, y across it, +y = outer / top). */
function frame(a1: number) {
  const u = polar(a1, 1);
  const n: Pt = [u[1], -u[0]];
  return (x: number, y: number): Pt => [x * u[0] + y * n[0], x * u[1] + y * n[1]];
}

/**
 * The SHOULDER: the cap of an arm segment (everything above the armpit, `s` units down the arm, plus a
 * little overlap). It is painted in the TORSO layer, fused with the shirt, so the shoulder is part of
 * the garment's silhouette — no armhole line, no ball. `ox`/`oy` = the shoulder joint, `side` mirrors.
 */
export function capRegion(a1: number, len: number, R0: number, R1: number, o: Cap, ox: number, oy: number, side: 1 | -1): Shape {
  const W = frame(a1);
  const P = (x: number, y: number) => {
    const p = W(x, y);
    return pt([side * (ox + p[0]), oy + p[1]]);
  };
  const s = o.s;
  const R = (x: number) => R0 + (R1 - R0) * (x / len);
  const x2 = Math.min(len, s + 5);
  const [tx, ty] = CAP_T;
  const [dx, dy] = CAP_DT;
  const k1 = (CAP_OX - tx) * 0.55;
  const k2 = (R0 - ty) * 0.5;
  let d = `M${P(x2, R(x2))}L${P(CAP_OX, R0)}`;
  // rounded outer-top corner, arriving at T along the trapezius tangent
  d += `C${P(CAP_OX - k1, R0)} ${P(tx + k2 * dx, ty + k2 * dy)} ${P(tx, ty)}`;
  // back along the shoulder line (inside the torso) and down to the armpit
  d += `C${P(tx - 4 * dx, ty - 4 * dy)} ${P(s - (s - tx) * 0.62, -R(s))} ${P(s, -R(s))}`;
  d += `L${P(x2, -R(x2))}Z`;
  return { d };
}

/**
 * The arm below the shoulder (what the ARM layer outlines): from the armpit level `s` down to `len`,
 * with a flat top that sits inside the shoulder cap. `cover` is a fill-only patch over the top end's
 * outline (the cap continues the cloth there, so no line crosses the arm).
 */
function armTube(a1: number, len: number, R0: number, R1: number, o: Cap, end: "round" | "square", flare = 0) {
  const W = frame(a1);
  const P = (x: number, y: number) => pt(W(x, y));
  const s = o.s;
  const Rs = R0 + (R1 - R0) * (s / len);
  let d = `M${P(s, Rs)}L${P(len, R1 + flare)}`;
  if (end === "round") {
    d += `C${P(len + K * R1, R1)} ${P(len + R1, K * R1)} ${P(len + R1, 0)}`;
    d += `C${P(len + R1, -K * R1)} ${P(len + K * R1, -R1)} ${P(len, -R1)}`;
  } else {
    d += `L${P(len, -R1 - flare)}`;
  }
  d += `L${P(s, -Rs)}Z`;
  const tube: Shape = { d };
  // It reaches sw + 6 back: the arm's own shadow of that top end (offset up to 3√2 along the arm) must
  // stay under it too; the last 2 units are pulled in on the armpit side to stay inside the cap.
  const cover = (sw: number): Shape => ({
    d: `M${P(s + 1, Rs)}L${P(s - sw - 6, Rs)}L${P(s - sw - 6, -Rs + 2)}L${P(s - sw - 4, -Rs)}L${P(s + 1, -Rs)}Z`,
  });
  return { tube, cover };
}

/** The outermost garment's measurements at the shoulder (the cap the torso paints). */
export function armGarment(A: ArmPose, L: Look) {
  const t = L.B.arm;
  const long = L.sleeve === "long";
  const g0 = long ? 0.6 : 0;
  const g1 = long ? 3 : 0;
  const up0 = UP0 * t + g0;
  const up1 = UP1 * t + g1;
  const cap: Cap = { s: CAP_S };
  const a1 = A === RELAX ? A.a1 - L.B.splay : A.a1;
  if (long) return { a1, len: L1, R0: up0, R1: up1, cap, up0, up1 };
  const rolled = L.sleeve === "rolled";
  const h = L1 * (rolled ? 0.6 : 0.47);
  const gr = 2;
  const rh = up0 + (up1 - up0) * (h / L1) + gr;
  return { a1, len: h, R0: up0 + gr, R1: rh, cap, up0, up1, h, rolled };
}

/** Relaxed (hanging) arms cast no shadow of their own on the body: they hang beside it. */
export const isRelaxed = (A: ArmPose) => A === RELAX;

/** The two shoulder caps for a pose, in figure space (painted by the torso layer). */
export function shoulderCaps(L: Look, left: ArmPose, right: ArmPose): Shape[] {
  return ([[left, -1], [right, 1]] as const).map(([A, side]) => {
    const g = armGarment(A, L);
    return capRegion(g.a1, g.len, g.R0, g.R1, g.cap, L.B.sx, L.B.sy, side);
  });
}

/** Paint one arm in the +x frame (caller translates to the shoulder and mirrors if needed). */
export function paintArm(k: Kit, A: ArmPose, L: Look, part: ArmPart, delay?: number): ReactNode {
  const B = L.B;
  const t = B.arm;
  // relaxed arms hang a little wider on a wider build (they clear the belly)
  if (A === RELAX) A = { ...A, a1: A.a1 - B.splay, a2: A.a2 - B.splay * 0.7 };
  const E = polar(A.a1, L1);
  const F = polar(A.a2, L2);
  const long = L.sleeve === "long";
  const cloth = L.shirt;
  const G = armGarment(A, L);
  const { up0, up1 } = G;
  const g1 = long ? 3 : 0;
  const fo0 = FO0 * t + g1 * 0.95;
  const fom = FOM * t + g1 * 0.9;
  const fo1 = FO1 * t + g1 * 0.75;
  const u = polar(A.a1, 1);
  const nrm: Pt = [u[1], -u[0]];
  const armFill = long ? cloth : L.skin;
  const cap: Cap = { s: CAP_S };

  // the upper arm below the shoulder (the shoulder cap itself is painted by the torso)
  const up = armTube(A.a1, L1, up0, up1, cap, "round");

  let sleeve: ReactNode = null;
  if (!long && G.h) {
    const h = G.h;
    const rh = G.R1;
    const hem = mul(u, h);
    const sl = armTube(A.a1, h, G.R0, rh, G.cap, "square", G.rolled ? 0 : 0.6);
    sleeve = (
      <>
        {k.part(sl.tube, cloth, true)}
        {k.flat(sl.cover(k.sw), cloth)}
        {G.rolled ? k.part({ p: add(hem, mul(nrm, rh + 0.6)), q: add(hem, mul(nrm, -rh - 0.6)), w: 9 }, shade(cloth, 0.12), true) : null}
        {!G.rolled && !k.lo ? k.line(`M${pt(add(mul(u, h - 5.5), mul(nrm, rh - 1)))}L${pt(add(mul(u, h - 5.5), mul(nrm, -rh + 1)))}`, k.sep * 0.45, detailOn(cloth), { opacity: 0.45 }) : null}
      </>
    );
  }

  const style: CSSProperties | undefined = delay ? { animationDelay: `${delay}s` } : undefined;
  const hk = (L.glove ? HK * 1.05 : HK) * (HAND_BOOST[A.hand] ?? 1);
  const theta = A.screen ?? A.a2 + 90 + (A.hb ?? 0);
  const hkit = k.scaled(hk);
  const swell = mul(F, 0.3);
  const bent = Math.abs(((A.a2 - A.a1 + 540) % 360) - 180) < 130;

  const fore =
    part === "upper" ? null : (
      <g transform={`translate(${pt(E)})`}>
        <g className={A.fore ? `avA ${A.fore}` : undefined} style={style}>
          {k.part([taper([0, 0], swell, fo0, fom), taper(swell, F, fom, fo1)], armFill, A.fold ? true : 0)}
          {long && bent && !k.lo ? k.line(elbowFold(A, fo0), k.sep * 0.6, detailOn(cloth), { opacity: 0.5 }) : null}
          <g transform={`translate(${pt(F)}) rotate(${r1(theta)}) scale(${A.hflip ? -hk : hk} ${hk})`}>
            {paintHand(hkit, A.hand, L.glove ? { fill: L.gloveFill, glove: !A.tuck, gauntlet: L.gauntlet } : { fill: L.skin })}
            {long && !L.glove && !A.tuck ? (
              <>
                {hkit.part({ d: "M-27-4L27-4L28 21L-28 21Z" }, cloth, true)}
                {hkit.lo ? null : hkit.part({ c: [-15, 9], r: 3.4 }, shade(cloth, 0.08), hkit.sep * 0.6)}
              </>
            ) : null}
          </g>
        </g>
      </g>
    );

  return (
    <g className={A.arm ? `avA ${A.arm}` : undefined} style={style}>
      {k.part(up.tube, armFill)}
      {/* a short sleeve's own cover hides the bare arm's top end (two coincident edges would leave a hairline) */}
      {long ? k.flat(up.cover(k.sw), armFill) : null}
      {sleeve}
      {fore}
    </g>
  );
}

/** Short crease on the inside of a bent elbow (long sleeves). */
function elbowFold(A: ArmPose, r: number) {
  const back = polar(A.a1 + 180, 1);
  const f = polar(A.a2, 1);
  const bis: Pt = [back[0] + f[0], back[1] + f[1]];
  const m = Math.hypot(bis[0], bis[1]) || 1;
  const b: Pt = [(bis[0] / m) * r * 0.75, (bis[1] / m) * r * 0.75];
  const side: Pt = [-bis[1] / m, bis[0] / m];
  return `M${pt(add(b, mul(side, -5)))}Q${pt(mul(b, 1.25))} ${pt(add(b, mul(side, 5)))}`;
}

/** Place an arm: +1 = viewer-right, −1 = viewer-left (mirrored), hung from the build's shoulder joint. */
export function placeArm(side: 1 | -1, B: Build, node: ReactNode) {
  return <g transform={`${side === -1 ? "scale(-1 1) " : ""}translate(${B.sx} ${B.sy})`}>{node}</g>;
}

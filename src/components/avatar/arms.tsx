/*
 * Avatar engine · arms and poses — built from masses.
 *
 * Every arm is: a round deltoid ball at the shoulder joint → an upper-arm mass that tapers to the
 * elbow → a forearm mass that swells just under the elbow and tapers to a narrow wrist → the hand.
 * All of it fused into one silhouette by the union painting, so the arm reads as one limb with a
 * shoulder cap, a real elbow and a wrist. Sleeves wrap the upper mass (short: a flared tube over the
 * deltoid; long: the whole arm in cloth, a touch fuller, ending in a cuff).
 *
 * Arms are laid out for the viewer-RIGHT side (+x frame, origin = shoulder joint) and mirrored with
 * scale(−1 1) for the viewer-left side. Animated groups pivot at their local origin (shoulder or
 * elbow), so a wave really swings from the shoulder. Arm length is the same in every pose and build.
 */
import type { CSSProperties, ReactNode } from "react";
import type { AvatarPose } from "./config";
import { type HandPose, paintHand } from "./hands";
import type { Build, Look } from "./look";
import { type Kit, type Pt, type Shape, add, detailOn, mul, polar, poly, pt, r1, shade } from "./paint";

export const L1 = 57; // shoulder → elbow
export const L2 = 51; // elbow → wrist
const UP0 = 16; // upper arm radius at the shoulder (bare)
const UP1 = 11.6; // … at the elbow
const FO0 = 12; // forearm radius at the elbow
const FOM = 12.6; // … at the forearm swell (30 % down)
const FO1 = 8.8; // … at the wrist
const HK = 0.52; // hand scale: hand ≈ 63 units ≈ 0.7 × head height (≈ 0.75 × the face)
/** Gesture hands read better a bit bigger (they're seen end-on / curled). */
const HAND_BOOST: Partial<Record<HandPose, number>> = { fist: 1.12, thumb: 1.3, point: 1.06 };

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

type PoseSpec = { L: ArmPose; R: ArmPose; /** drawn last (on top) */ top: "L" | "R" };

/** Relaxed: hangs a little away from the body, elbow at the waist, wrist at the belt. */
const RELAX: ArmPose = { a1: 74, a2: 95, hand: "relax", hflip: true, hb: -6 };

export const POSE_SPECS: Record<AvatarPose, PoseSpec> = {
  neutral: { L: RELAX, R: RELAX, top: "R" },
  saluda: { L: RELAX, R: { a1: 20, a2: -97, hand: "open", hb: -3, fold: true, arm: "avWave", fore: "avWaveFore" }, top: "R" },
  festeja: {
    L: { a1: -40, a2: -99, hand: "fist", arm: "avPump" },
    R: { a1: -40, a2: -99, hand: "fist", arm: "avPump" },
    top: "R",
  },
  pulgar: { L: RELAX, R: { a1: 80, a2: -58, hand: "thumb", screen: -6, fold: true, fore: "avThumb" }, top: "R" },
  senala: { L: RELAX, R: { a1: 75, a2: -63, hand: "point", hb: -10, fold: true, fore: "avPoint" }, top: "R" },
  "brazos-cruzados": {
    L: { a1: 101, a2: 170, hand: "relax", hflip: true, hb: 24, tuck: true },
    R: { a1: 104, a2: 187, hand: "relax", hflip: true, hb: -6, fold: true },
    top: "R",
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

/** Paint one arm in the +x frame (caller translates to the shoulder and mirrors if needed). */
export function paintArm(k: Kit, A: ArmPose, L: Look, part: ArmPart, delay?: number): ReactNode {
  const B = L.B;
  const t = B.arm;
  const E = polar(A.a1, L1);
  const F = polar(A.a2, L2);
  const long = L.sleeve === "long";
  const cloth = L.shirt;
  // long sleeves: the arm in cloth, a touch fuller (fabric volume)
  const g = long ? 3.4 : 0;
  const up0 = UP0 * t + g;
  const up1 = UP1 * t + g;
  const fo0 = FO0 * t + g * 0.9;
  const fom = FOM * t + g * 0.9;
  const fo1 = FO1 * t + g * 0.75;
  const u = polar(A.a1, 1);
  const nrm: Pt = [-u[1], u[0]];
  const armFill = long ? cloth : L.skin;

  // the upper-arm mass and the deltoid ball it hangs from
  const upper: Shape[] = [taper([0, 0], E, up0, up1)];
  const ball: Shape = { c: [0, 0], r: B.dr + g * 0.8 };

  let sleeve: ReactNode = null;
  if (!long) {
    const rolled = L.sleeve === "rolled";
    const h = L1 * (rolled ? 0.6 : 0.47);
    const R = ball.r + 2.6;
    const hw = up0 + (up1 - up0) * (h / L1) + 4.2;
    const hem = mul(u, h);
    sleeve = (
      <>
        {k.part([{ c: [0, 0], r: R }, { d: poly([mul(nrm, R), add(hem, mul(nrm, hw)), add(hem, mul(nrm, -hw)), mul(nrm, -R)]) }], cloth, true)}
        {rolled ? k.part({ p: add(hem, mul(nrm, hw + 1.2)), q: add(hem, mul(nrm, -hw - 1.2)), w: 9 }, shade(cloth, 0.12), true) : null}
        {!rolled && !k.lo ? k.line(`M${pt(add(mul(u, h - 5.5), mul(nrm, hw - 1.5)))}L${pt(add(mul(u, h - 5.5), mul(nrm, -hw + 1.5)))}`, k.sep * 0.45, detailOn(cloth), { opacity: 0.45 }) : null}
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
      {k.part(upper, armFill)}
      {long ? k.part(ball, cloth) : !k.lo || part === "upper" ? k.part(ball, L.skin) : null}
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

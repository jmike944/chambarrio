/*
 * Avatar engine · arms and poses.
 *
 * Every arm is shoulder ball → upper arm → elbow → forearm → wrist → hand, fused into one silhouette.
 * Arms are laid out for the viewer-RIGHT side ("+x frame", shoulder joint at (50, 84)) and mirrored
 * with scale(−1 1) for the viewer-left side. Animated groups pivot at their local origin (shoulder or
 * elbow), so a wave really swings from the shoulder.
 */
import type { CSSProperties, ReactNode } from "react";
import type { AvatarPose } from "./config";
import { type HandPose, paintHand } from "./hands";
import type { Look } from "./look";
import { type Kit, type Pt, add, mul, polar, poly, pt, r1, shade } from "./paint";

export const SHOULDER: Pt = [55, 86];
const L1 = 66; // shoulder → elbow
const L2 = 58; // elbow → wrist
const UW = 27; // upper arm (bare)
const FW = 23; // forearm (bare)
const RS = 18; // sleeve cap radius
const HK = 0.5; // hand scale: hand ≈ 61 units ≈ 0.68 × head height (≈ 0.75 × face incl. jaw)
/** Gesture hands read better a bit bigger (they're seen end-on / curled). */
const HAND_BOOST: Partial<Record<HandPose, number>> = { fist: 1.15, thumb: 1.38, point: 1.08 };

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
  /** CSS animation class at the shoulder / elbow pivots. */
  arm?: string;
  fore?: string;
};

type PoseSpec = { L: ArmPose; R: ArmPose; /** drawn last (on top) */ top: "L" | "R" };

const RELAX: ArmPose = { a1: 71, a2: 95, hand: "relax", hflip: true };

export const POSE_SPECS: Record<AvatarPose, PoseSpec> = {
  neutral: { L: RELAX, R: RELAX, top: "R" },
  saluda: { L: RELAX, R: { a1: 24, a2: -86, hand: "open", hb: -2, arm: "avWave", fore: "avWaveFore" }, top: "R" },
  festeja: {
    L: { a1: -38, a2: -100, hand: "fist", arm: "avPump" },
    R: { a1: -38, a2: -100, hand: "fist", arm: "avPump" },
    top: "R",
  },
  pulgar: { L: RELAX, R: { a1: 78, a2: -58, hand: "thumb", screen: -6, fore: "avThumb" }, top: "R" },
  senala: { L: RELAX, R: { a1: 72, a2: -62, hand: "point", hb: -10, fore: "avPoint" }, top: "R" },
  "brazos-cruzados": {
    L: { a1: 93, a2: 186, hand: "relax", hflip: true, hb: 16 },
    R: { a1: 95, a2: 199, hand: "relax", hflip: true, hb: 4 },
    top: "R",
  },
};

export type ArmPart = "full" | "upper";

/** Paint one arm in the +x frame (caller translates to the shoulder and mirrors if needed). */
export function paintArm(k: Kit, A: ArmPose, L: Look, part: ArmPart, delay?: number): ReactNode {
  const E = polar(A.a1, L1);
  const F = polar(A.a2, L2);
  const long = L.sleeve === "long";
  const cloth = L.shirt;
  const upW = long ? UW + 4 : UW;
  const foW = long ? FW + 3 : FW;
  const u = polar(A.a1, 1);
  const n: Pt = [-u[1], u[0]];

  let sleeve: ReactNode;
  if (long) {
    // set-in sleeve: cap just wider than the arm (a bigger ball reads as a shoulder pad)
    sleeve = k.part({ c: [0, 0], r: upW / 2 + 1.5 }, cloth);
  } else {
    const h = L1 * (L.sleeve === "rolled" ? 0.62 : 0.5);
    const HW = 19;
    const hem = mul(u, h);
    sleeve = (
      <>
        {k.part(
          [{ c: [0, 0], r: RS }, { d: poly([mul(n, RS), add(hem, mul(n, HW)), add(hem, mul(n, -HW)), mul(n, -RS)]) }],
          cloth,
          true,
        )}
        {L.sleeve === "rolled" ? k.part({ p: add(hem, mul(n, HW + 1.5)), q: add(hem, mul(n, -HW - 1.5)), w: 9 }, shade(cloth, 0.12), true) : null}
      </>
    );
  }

  const style: CSSProperties | undefined = delay ? { animationDelay: `${delay}s` } : undefined;
  const hk = (L.glove ? HK * 1.06 : HK) * (HAND_BOOST[A.hand] ?? 1);
  const theta = A.screen ?? A.a2 + 90 + (A.hb ?? 0);
  const hkit = k.scaled(hk);

  const fore =
    part === "upper" ? null : (
      <g transform={`translate(${pt(E)})`}>
        <g className={A.fore ? `avA ${A.fore}` : undefined} style={style}>
          {k.part({ p: [0, 0], q: F, w: foW }, long ? cloth : L.skin, A.fold ? true : 0)}
          <g transform={`translate(${pt(F)}) rotate(${r1(theta)}) scale(${A.hflip ? -hk : hk} ${hk})`}>
            {paintHand(hkit, A.hand, L.glove ? { fill: L.gloveFill, glove: true, gauntlet: L.gauntlet } : { fill: L.skin })}
            {long && !L.glove ? (
              <>
                {hkit.part({ d: "M-28-6L28-6L29 19L-29 19Z" }, cloth, true)}
                {hkit.lo ? null : hkit.part({ c: [-16, 7], r: 3.4 }, shade(cloth, 0.08), hkit.sep * 0.6)}
              </>
            ) : null}
          </g>
        </g>
      </g>
    );

  return (
    <g className={A.arm ? `avA ${A.arm}` : undefined} style={style}>
      {k.part({ p: [0, 0], q: E, w: upW }, long ? cloth : L.skin)}
      {sleeve}
      {fore}
    </g>
  );
}

/** Place an arm: +1 = viewer-right, −1 = viewer-left (mirrored). */
export function placeArm(side: 1 | -1, node: ReactNode) {
  return <g transform={`${side === -1 ? "scale(-1 1) " : ""}translate(${SHOULDER[0]} ${SHOULDER[1]})`}>{node}</g>;
}

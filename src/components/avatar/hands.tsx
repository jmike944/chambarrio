/*
 * Avatar engine · hands.
 *
 * Hand units (drawn at ~0.46× inside a figure, 1× in <AvatarHand>): wrist at (0,0), fingers toward −y,
 * thumb on the −x side. Every hand is a fused union (palm + thumb + 4 fingers) with thin inner contours
 * between the fingers, so it reads at 20 px and still looks like a hand at 400 px.
 * Proportions: palm ≈ 0.55 of the hand length, middle finger the longest, thumb set low on the palm.
 */
import type { ReactNode } from "react";
import { type Kit, type Pt, type Shape, WHITE, r1 } from "./paint";

export type HandPose = "open" | "choca" | "fist" | "thumb" | "point" | "relax";

type Digit = { b: Pt; t: number; l: number; w: number };
const RAD = Math.PI / 180;
/** A finger: base point, tilt from vertical (deg, + toward +x), length (base→tip centre), width. */
const tube = ({ b, t, l, w }: Digit, extra = 0): Shape => ({
  p: b,
  q: [r1(b[0] + l * Math.sin(t * RAD)), r1(b[1] - l * Math.cos(t * RAD))],
  w: w + extra,
});

/* palm silhouettes */
const PALM_OPEN = "M-21 2C-25-14-30-30-30-46Q-30-64-12-65H13Q30-64 30-46C30-30 26-14 21 2Z";
const PALM_BACK = "M-19 2C-22-12-26-28-26-42Q-26-57-10-58H11Q26-57 26-42C26-28 22-12 19 2Z";
const FIST_BODY = "M-21 2C-25-10-29-22-29-34Q-29-52-12-53H12Q29-52 29-34C29-22 25-10 21 2Z";
/** Thumbs-up fist: screen-aligned box, wrist at the bottom. */
const THUMB_BODY = "M-17 2C-21-8-23-20-23-30Q-23-44-10-45H12Q25-44 25-30C25-18 22-8 18 2Z";

const OPEN: { thumb: Digit; fingers: Digit[] } = {
  thumb: { b: [-17, -18], t: -50, l: 40, w: 17 },
  fingers: [
    { b: [19, -50], t: 15, l: 39, w: 14 }, // pinky
    { b: [6.5, -56], t: 5.5, l: 51, w: 15 }, // ring
    { b: [-6.5, -57], t: -2, l: 56, w: 15.5 }, // middle
    { b: [-19.5, -54], t: -9, l: 49, w: 15 }, // index
  ],
};

const CHOCA: { thumb: Digit; fingers: Digit[] } = {
  thumb: { b: [-17, -20], t: -38, l: 40, w: 17 },
  fingers: [
    { b: [18.5, -52], t: 6, l: 40, w: 14.5 },
    { b: [6.5, -57], t: 2, l: 51, w: 15.5 },
    { b: [-6, -58], t: -1, l: 55, w: 15.5 },
    { b: [-18.5, -55], t: -4, l: 49, w: 15.5 },
  ],
};

const RELAX: { thumb: Digit; fingers: Digit[] } = {
  thumb: { b: [-16, -16], t: -20, l: 36, w: 16 },
  fingers: [
    { b: [15, -47], t: 4, l: 35, w: 14 },
    { b: [5, -51], t: 1.5, l: 45, w: 14.5 },
    { b: [-5, -52], t: -0.5, l: 48, w: 14.5 },
    { b: [-15, -49], t: -2.5, l: 43, w: 14.5 },
  ],
};

const POINT_CURLED: Digit[] = [
  { b: [-1.5, -44], t: 0, l: 8, w: 13 },
  { b: [10, -43], t: 2, l: 7, w: 13 },
  { b: [21, -39], t: 5, l: 5, w: 12 },
];

export type HandLook = {
  fill: string;
  glove?: boolean;
  /** Glove gauntlet colour (gloves only). */
  gauntlet?: string;
};

/** Work-glove gauntlet: flared cuff over the wrist. */
const GAUNTLET = "M-25-12H25L31 22H-31Z";

/**
 * Paint one hand with a (scaled) kit. Order matters only in the fill pass: digits that should show an
 * inner contour are painted after what they overlap, the palm last so finger roots disappear into it.
 */
export function paintHand(k: Kit, pose: HandPose, look: HandLook): ReactNode {
  const g = look.glove ? 3 : 0;
  const fill = look.fill;
  const sep = true;
  let body: ReactNode;

  if (pose === "open" || pose === "choca" || pose === "relax") {
    const spec = pose === "open" ? OPEN : pose === "choca" ? CHOCA : RELAX;
    const palm = pose === "relax" ? PALM_BACK : PALM_OPEN;
    body = (
      <>
        {k.part(tube(spec.thumb, g), fill)}
        {spec.fingers.map((f, i) => (
          <g key={i}>{k.part(tube(f, g), fill, sep)}</g>
        ))}
        {k.part({ d: palm }, fill)}
        {/* thumb root: a short crease where the thumb meets the palm (palm side only) */}
        {pose !== "relax" && !k.lo ? k.line("M-22-20Q-17-30-19-40", k.sep * 0.9) : null}
      </>
    );
  } else if (pose === "fist") {
    // Fist seen from the palm side (raised in a cheer): 4 curled fingers side by side, thumb across them.
    const fingers: Digit[] = [
      { b: [19.5, -30], t: 0, l: 16, w: 13.5 },
      { b: [6.5, -32], t: 0, l: 19, w: 14 },
      { b: [-6.5, -32], t: 0, l: 19, w: 14 },
      { b: [-19.5, -30], t: 0, l: 16, w: 13.5 },
    ];
    body = (
      <>
        {k.part({ d: FIST_BODY }, fill)}
        {fingers.map((f, i) => (
          <g key={i}>{k.part(tube(f, g), fill, sep)}</g>
        ))}
        {k.part({ p: [-31, -19], q: [3, -24], w: 15 + g }, fill, sep)}
      </>
    );
  } else if (pose === "thumb") {
    // Thumbs-up, screen aligned: fist on its side, curled fingers stacked on the outer side, thumb up.
    const rolls = [-35, -25.5, -16, -6.5];
    body = (
      <>
        {k.part({ p: [-9, -36], q: [-10, -72], w: 16.5 + g }, fill)}
        {k.part({ d: THUMB_BODY }, fill)}
        {rolls.map((y, i) => (
          <g key={i}>{k.part({ p: [-2, y], q: [21 - Math.abs(i - 1.5) * 1.5, y], w: 10.5 + g * 0.6 }, fill, sep)}</g>
        ))}
        {/* thumbnail */}
        {!k.lo && !look.glove ? k.line("M-14.5-70Q-10-75-5.5-70", k.sep * 0.75) : null}
      </>
    );
  } else {
    // point: back of the hand, index straight out, three fingers curled, thumb tucked along the side.
    body = (
      <>
        {k.part({ p: [-15, -42], q: [-17.5, -99], w: 15 + g }, fill)}
        {k.part({ d: FIST_BODY }, fill)}
        {POINT_CURLED.map((f, i) => (
          <g key={i}>{k.part(tube(f, g), fill, sep)}</g>
        ))}
        {k.part({ p: [-22, -12], q: [-31, -38], w: 15 + g }, fill, sep)}
      </>
    );
  }

  return (
    <>
      {body}
      {look.glove ? (
        <>
          {k.part({ d: GAUNTLET }, look.gauntlet ?? "#E9A21A", sep)}
          {!k.lo ? k.line("M-21 4H22", k.sep * 0.7, WHITE, { opacity: 0.7 }) : null}
        </>
      ) : null}
      {look.glove && !k.lo && pose !== "thumb" ? k.line(pose === "fist" ? "M-20-44Q-20-50-13-51" : "M-21-42Q-22-54-13-58", k.sep * 1.1, WHITE) : null}
    </>
  );
}

/** Wrist (hand units) at which a sleeve cuff should sit; hands are drawn from y=0 up. */
export const HAND_LEN = 122;

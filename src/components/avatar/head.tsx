/*
 * Avatar engine · head: neck, ears, face, expressions, facial hair, glasses, hair (front + back),
 * headwear and the headset. Face centre at (0,0); head is 74 × 90 (y −46 … 44).
 *
 * Hair is drawn per "hat mode": with a hat (casco / gorra / paliacate) only what shows below the brim is
 * painted (side hair, curls, long hair from under the hat, a ponytail out the back; a bun is dropped);
 * with a cofia (hairnet) no hair is painted at all. That is what keeps every combination clean.
 */
import type { ReactNode } from "react";
import type { Expression } from "./config";
import type { Look } from "./look";
import { INK, type Kit, type Shape, WHITE, detailOn, mirrorD, mix } from "./paint";

export const HEAD_D = "M-37-8C-37-34-21-46 0-46C21-46 37-34 37-8L37 6C37 30 22 44 0 44C-22 44-37 30-37 6Z";

/* ── neck ────────────────────────────────────────────────────────────── */

/** A short, thick neck sized by the build; its base hides under the collar (torso layer). */
export function paintNeck(k: Kit, L: Look) {
  const n = L.B.nk;
  return (
    <>
      {k.part({ d: `M${-n + 2} 24L${n - 2} 24L${n} 68L${-n} 68Z` }, L.skin)}
      {k.flat({ d: `M${-n + 2.5} 28L${n - 2.5} 28L${n - 1.5} 41Q0 51 ${-n + 1.5} 41Z` }, L.skinShade)}
    </>
  );
}

/* ── hair ────────────────────────────────────────────────────────────── */

const both = (d: string): Shape[] => [{ d }, { d: mirrorD(d) }];

const CORTO = "M-40-5C-43-36-24-56 2-55C26-54 43-38 40-6C38-16 34-22 27-25C20-27 12-26 6-30C0-24-12-24-22-24C-31-22-37-14-40-5Z";
const RAPADO = "M-38.6-10C-39-38-22-50 0-50C22-50 39-38 38.6-10C36-20 31-27 22-30C10-33-10-33-22-30C-31-27-36-20-38.6-10Z";
const SLICK = "M-39.5-6C-41-38-24-52 0-52C24-52 41-38 39.5-6C37-18 32-27 20-31C8-34-8-34-20-31C-32-27-37-18-39.5-6Z";
const LARGO_FRONT =
  "M-46 26C-50-18-36-57 0-57C36-57 50-18 46 26L37 26C38 4 36-14 28-24C18-33 4-33-4-36C-12-26-24-24-32-16C-37-8-38 6-37 26Z";
const LARGO_SIDE = "M-46 26C-48 2-47-14-44-28L-36-28C-38-10-38 6-37 26Z";
const LARGO_BACK = "M-46-10C-48-46-26-60 0-60C26-60 48-46 46-10L52 70Q52 82 40 82L22 82L20 40L-20 40L-22 82L-40 82Q-52 82-52 70Z";
const LARGO_BACK_HAT = "M-44-27L44-27L52 70Q52 82 40 82L22 82L20 40L-20 40L-22 82L-40 82Q-52 82-52 70Z";
const COLETA = "M22-44C46-52 62-30 60-6C58 18 64 42 53 64C50 50 45 34 43 18C41 2 40-16 30-28Z";

/** Bumpy curly crown: a union of discs (fill pass rings the whole union once). */
function curls(hat: boolean): Shape[] {
  if (hat) {
    return [
      { c: [-42, -20], r: 10 },
      { c: [-44, -6], r: 9 },
      { c: [-40, 6], r: 7 },
      { c: [42, -20], r: 10 },
      { c: [44, -6], r: 9 },
      { c: [40, 6], r: 7 },
    ];
  }
  const out: Shape[] = [{ d: "M-42-4C-46-40-24-58 0-58C24-58 46-40 42-4C38-22 26-31 0-32C-26-31-38-22-42-4Z" }];
  for (const [deg, r] of [
    [186, 10],
    [204, 12],
    [222, 12.5],
    [241, 12.5],
    [260, 12.5],
    [280, 12.5],
    [299, 12.5],
    [318, 12.5],
    [336, 12],
    [354, 10],
  ] as const) {
    const a = (deg * Math.PI) / 180;
    out.push({ c: [Math.round(42 * Math.cos(a) * 10) / 10, Math.round((-14 + 46 * Math.sin(a)) * 10) / 10], r });
  }
  out.push({ c: [-44, -4], r: 9 }, { c: [44, -4], r: 9 });
  for (const x of [-24, -8, 8, 24]) out.push({ c: [x, -33 + Math.abs(x) * 0.12], r: 8.5 });
  return out;
}

/** Hair that sits behind the head / neck (drawn before the torso). */
export function paintHairBack(k: Kit, L: Look): ReactNode {
  if (L.hatMode === "net") return null;
  const hat = L.hatMode === "hat";
  switch (L.hairStyle) {
    case "largo":
      return k.part({ d: hat ? LARGO_BACK_HAT : LARGO_BACK }, L.hair);
    case "coleta":
      return (
        <>
          {k.part({ d: COLETA }, L.hair)}
          {k.line("M44-14C46 6 50 26 52 44", k.sep * 0.8, L.hairShade)}
          {k.part({ p: [34, -40], q: [40, -30], w: 8 }, "#FF5A36", true)}
        </>
      );
    case "chongo":
      if (hat)
        return (
          <>
            {k.part({ c: [33, 37], r: 13.5 }, L.hair)}
            {k.line("M30 28Q40 31 40 42", k.sep * 0.8, L.hairShade)}
          </>
        );
      return (
        <>
          {k.part({ c: [0, -63], r: 15 }, L.hair)}
          {k.line("M-8-70Q0-76 8-70", k.sep * 0.8, L.hairShade)}
        </>
      );
    default:
      return null;
  }
}

/** Hair over the head (part of the head layer, ringed with an inner contour). */
function paintHairFront(k: Kit, L: Look): ReactNode {
  if (L.hatMode === "net") return null;
  const hat = L.hatMode === "hat";
  const h = L.hair;
  switch (L.hairStyle) {
    case "corto":
      return (
        <>
          {k.part({ d: CORTO }, h, true)}
          {!k.lo && !hat ? k.line("M8-46Q2-40 0-31", k.sep * 0.75, L.hairShade) : null}
        </>
      );
    case "rapado":
      return k.part({ d: RAPADO }, mix(h, L.skin, 0.3), true);
    case "rizado":
      return k.part(curls(hat), h, true);
    case "largo":
      return (
        <>
          {k.part(hat ? both(LARGO_SIDE) : { d: LARGO_FRONT }, h, true)}
          {!k.lo && !hat ? k.line("M-4-55Q-6-46-4-37", k.sep * 0.75, L.hairShade) : null}
        </>
      );
    case "chongo":
    case "coleta":
      return (
        <>
          {k.part({ d: SLICK }, h, true)}
          {!k.lo && !hat ? k.line("M-27-34Q-18-45-5-49M27-34Q18-45 5-49", k.sep * 0.7, L.hairShade) : null}
        </>
      );
    case "calvo":
      return !hat && !k.lo ? k.line("M-24-31Q-19-39-9-42", 4, WHITE) : null;
  }
}

/* ── face ────────────────────────────────────────────────────────────── */

function Eyes({ k, e }: { k: Kit; e: Expression }) {
  const rx = k.lo ? 5.6 : 4.5;
  const ry = k.lo ? 7.2 : 6.1;
  const shut = (cx: number) => k.line(`M${cx - 6.5} 0Q${cx} -7.5 ${cx + 6.5} 0`, k.lo ? 5 : 4.2);
  if (k.m === "ink") return null;
  if (e === "emocion")
    return (
      <>
        {shut(-14)}
        {shut(14)}
      </>
    );
  return (
    <g className="avEye avBlink">
      <ellipse cx={-14} cy={-2} rx={rx} ry={ry} fill={INK} />
      {e === "guino" ? shut(14) : <ellipse cx={14} cy={-2} rx={rx} ry={ry} fill={INK} />}
    </g>
  );
}

const BROWS: Record<Expression, string> = {
  sonrisa: "M-23-15Q-15-19.5-7-15.5M7-15.5Q15-19.5 23-15",
  seria: "M-23-15.5L-7-12.5M7-12.5L23-15.5",
  guino: "M-23-17Q-15-22-7-17.5M7-12.5Q15-14.5 23-11.5",
  emocion: "M-23-19Q-15-25-7-20M7-20Q15-25 23-19",
};

function Mouth({ k, e }: { k: Kit; e: Expression }) {
  if (k.m === "ink") return null;
  const sw = k.lo ? 4.5 : 3.6;
  switch (e) {
    case "seria":
      return k.line("M-10 24Q0 26.5 10 22.5", k.lo ? 5 : 4.2);
    case "guino":
      return <path d="M-14 20Q0 24 15 17Q12 31-1 31Q-11 31-14 20Z" fill={WHITE} stroke={INK} strokeWidth={sw} strokeLinejoin="round" />;
    case "emocion":
      return (
        <>
          <path d="M-16 17Q0 21 16 17Q15 38 0 38Q-15 38-16 17Z" fill={INK} stroke={INK} strokeWidth={sw} strokeLinejoin="round" />
          <path d="M-13 19.5Q0 22.5 13 19.5L12.4 24Q0 26.2-12.4 24Z" fill={WHITE} />
          <path d="M-8 35.5Q0 28 8 35.5Q4 37.6 0 37.6Q-4 37.6-8 35.5Z" fill="#FF5A36" />
        </>
      );
    default:
      return <path d="M-15 19Q0 23 15 19Q13 33 0 33Q-13 33-15 19Z" fill={WHITE} stroke={INK} strokeWidth={sw} strokeLinejoin="round" />;
  }
}

const MOUSTACHE = "M-17.5 21C-16.5 12.5-8 10.5 0 13.5C8 10.5 16.5 12.5 17.5 21C13 18.2 7 17.6 0 18.8C-7 17.6-13 18.2-17.5 21Z";
const BEARD =
  "M-38-6L-37.5 6C-37 31-22 50 0 51C22 50 37 31 37.5 6L38-6C35 8 30 15 24 17C17 14 9 13 0 14C-9 13-17 14-24 17C-30 15-35 8-38-6Z";
const LIPS = "M-14 18Q0 14 14 18Q16 30 0 35Q-16 30-14 18Z";
const GOATEE = "M-10 35Q0 32 10 35L9 45Q0 51-9 45Z";

function paintFace(k: Kit, L: Look): ReactNode {
  const e = L.expression;
  const hairInk = L.hair;
  return (
    <>
      <Eyes k={k} e={e} />
      {k.line(BROWS[e], k.lo ? 6.5 : 5.4)}
      {L.facial === "barba" ? (
        <>
          {k.part({ d: BEARD }, hairInk, true)}
          {k.part({ d: LIPS }, L.skin, true)}
        </>
      ) : null}
      <Mouth k={k} e={e} />
      {L.facial === "candado" ? k.part([{ d: GOATEE }, { p: [-14, 22], q: [-11, 36], w: 4.5 }, { p: [14, 22], q: [11, 36], w: 4.5 }], hairInk, true) : null}
      {L.facial === "bigote" || L.facial === "barba" || L.facial === "candado" ? k.part({ d: MOUSTACHE }, hairInk, true) : null}
      {k.lo ? null : k.line("M-1 3Q5 9 0 12.5", 3.6, detailOn(L.skin))}
      {L.glasses ? (
        k.m === "fill" ? (
          <g>
            <rect x={-25} y={-11} width={21} height={17} rx={6} fill={WHITE} fillOpacity={0.22} stroke={INK} strokeWidth={k.lo ? 4.5 : 3.8} />
            <rect x={4} y={-11} width={21} height={17} rx={6} fill={WHITE} fillOpacity={0.22} stroke={INK} strokeWidth={k.lo ? 4.5 : 3.8} />
            {k.line("M-4-4Q0-7.5 4-4M-25-5L-36.5-6M25-5L36.5-6", k.lo ? 4.5 : 3.6)}
            {k.lo ? null : k.line("M-11-7.5L-8.5-5M18-7.5L20.5-5", 2.4, WHITE)}
          </g>
        ) : null
      ) : null}
    </>
  );
}

/** Ears + head + front hair + face: one fused layer. */
export function paintHead(k: Kit, L: Look): ReactNode {
  return (
    <>
      {k.part(
        [
          { c: [-37, 3], r: 9.5 },
          { c: [37, 3], r: 9.5 },
        ],
        L.skin,
      )}
      {k.lo ? null : k.line("M-40.5-1.5Q-44.5 3-40.5 7.5M40.5-1.5Q44.5 3 40.5 7.5", 2.6, detailOn(L.skin))}
      {k.part({ d: HEAD_D }, L.skin, true)}
      {paintHairFront(k, L)}
      {paintFace(k, L)}
    </>
  );
}

/* ── headwear ────────────────────────────────────────────────────────── */

const CASCO_DOME = "M-45-26C-45-62-26-84 0-84C26-84 45-62 45-26Z";
const CASCO_RIDGE = "M-7.5-82.5L7.5-82.5L8.5-30L-8.5-30Z";
const CASCO_BRIM = "M-56-31Q-56-38-49-38L49-38Q56-38 56-31L56-29Q56-22 49-22L-49-22Q-56-22-56-29Z";
const GORRA_DOME = "M-42-28C-42-62-22-74 0-74C22-74 42-62 42-28Z";
const GORRA_VISOR = "M-48-32Q0-46 48-32Q50-24 42-22Q0-32-42-22Q-50-24-48-32Z";
const PALIACATE = "M-41-18C-44-54-24-64 0-64C24-64 44-54 41-18C28-24 14-26 0-26C-14-26-28-24-41-18Z";
const COFIA = "M-46-18C-57-44-38-73 0-73C38-73 57-44 46-18C30-24 16-26 0-26C-16-26-30-24-46-18Z";

export function paintHeadwear(k: Kit, L: Look): ReactNode {
  const c = L.hw;
  const ink = detailOn(c);
  switch (L.headwear) {
    case "casco":
      return (
        <>
          {k.part({ d: CASCO_DOME }, c)}
          {k.lo ? null : k.part({ d: CASCO_RIDGE }, L.hwShade, true)}
          {k.part({ d: CASCO_BRIM }, c, true)}
          {k.line("M-33-40Q-31-62-15-72", k.lo ? 6 : 5, WHITE)}
          {k.lo ? null : k.line("M-46-30H-30", 3, WHITE, { opacity: 0.85 })}
        </>
      );
    case "gorra":
      return (
        <>
          {k.part({ d: GORRA_DOME }, c)}
          {k.lo ? null : k.line("M0-73L0-34M-19-68Q-27-50-26-33M19-68Q27-50 26-33", k.sep * 0.7, ink, { opacity: 0.55 })}
          {k.part({ c: [0, -74], r: 4.5 }, c, true)}
          {k.lo ? null : k.part({ d: "M-10-60H10V-46H-10Z" }, L.hw === "#DDF78A" ? "#4318E0" : "#DDF78A", true)}
          {k.part({ d: GORRA_VISOR }, L.hwShade, true)}
          {k.line("M-30-42Q-28-58-16-64", k.lo ? 6 : 5, WHITE)}
        </>
      );
    case "paliacate":
      return (
        <>
          {k.part(
            [
              { d: "M-42-33L-63-45Q-66-34-59-27Z" },
              { d: "M-42-25L-61-12Q-53-6-46-14Z" },
            ],
            L.hwShade,
          )}
          {k.part({ d: PALIACATE }, c)}
          {k.part({ c: [-42, -29], r: 6.5 }, c, true)}
          {k.lo
            ? null
            : k.m === "fill"
              ? (
                  <g fill={WHITE}>
                    {(
                      [
                        [-24, -42],
                        [-8, -52],
                        [10, -46],
                        [26, -38],
                        [-30, -28],
                        [-12, -36],
                        [6, -32],
                        [22, -26],
                        [0, -58],
                        [-20, -54],
                        [20, -54],
                      ] as const
                    ).map(([x, y], i) => (
                      <circle key={i} cx={x} cy={y} r={i % 3 === 0 ? 3 : 2.1} />
                    ))}
                  </g>
                )
              : null}
          {k.line("M-40-22C-28-28-14-30 0-30C14-30 28-28 40-22", k.sep * 0.7, WHITE, { opacity: 0.8 })}
        </>
      );
    case "cofia":
      return (
        <>
          {k.part({ d: COFIA }, c)}
          {k.lo ? null : k.line("M0-72V-52M-20-68Q-24-56-22-46M20-68Q24-56 22-46M-36-56Q-38-46-34-38M36-56Q38-46 34-38", k.sep * 0.6, ink, { opacity: 0.35 })}
          {k.line(
            "M-45-20Q-41-26-36-23Q-31-28-26-25Q-21-29-16-26.5Q-10.5-30-5.5-27.5Q0-30.5 5.5-27.5Q10.5-30 16-26.5Q21-29 26-25Q31-28 36-23Q41-26 45-20",
            k.sep * 0.8,
            ink,
          )}
          {k.line("M-30-50Q-26-62-14-67", k.lo ? 6 : 4.5, WHITE)}
        </>
      );
    default:
      return null;
  }
}

/* ── headset (accessory "audifonos") ─────────────────────────────────── */

/** Top of whatever the headset band has to clear. */
function bandTop(L: Look) {
  if (L.headwear !== "ninguno") return -48;
  switch (L.hairStyle) {
    case "rizado":
      return -66;
    case "corto":
    case "largo":
      return -58;
    case "chongo":
    case "coleta":
      return -54;
    case "rapado":
      return -52;
    default:
      return -48;
  }
}

/** The band: in front of hair, but behind any headwear (earmuff style) → call from the right layer. */
export function paintHeadsetBand(k: Kit, L: Look): ReactNode {
  const t = Math.round(((bandTop(L) - 3) / 0.75) * 10) / 10;
  return k.part({ path: `M-43 0C-46 ${t} 46 ${t} 43 0`, w: 6 }, "#2B2452", true);
}

export function paintHeadsetCups(k: Kit): ReactNode {
  const cup = "M35-9Q35-14 40-14L45-14Q51-14 51-9L51 10Q51 15 45 15L40 15Q35 15 35 10Z";
  return (
    <>
      {k.part({ path: "M-44 9Q-38 30-21 30", w: 4 }, "#2B2452")}
      {k.part({ c: [-20, 30], r: 4.6 }, "#2B2452", true)}
      {k.part([{ d: cup }, { d: mirrorD(cup) }], "#2B2452", true)}
      {k.part(
        [
          { c: [43, 0.5], r: 4.6 },
          { c: [-43, 0.5], r: 4.6 },
        ],
        "#4318E0",
        true,
      )}
    </>
  );
}

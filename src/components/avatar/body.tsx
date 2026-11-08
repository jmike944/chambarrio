/*
 * Avatar engine · torso, outfits, legs, feet and chest accessories.
 * Figure space: face centre (0,0), shoulders y≈66–100 (joints at x ±50, y 84), waist y≈200,
 * crotch y≈258, soles y≈428.
 */
import type { ReactNode } from "react";
import type { Look } from "./look";
import { INK, type Kit, type Shape, WHITE, detailOn, luma, mirrorD } from "./paint";

/** Torso (shirt) silhouette down to `b`. Shoulder corners sit inside the sleeve caps. */
export const torsoD = (b: number) =>
  `M-16 56C-28 59-42 63-53 67C-66 72-72 82-71 97L-67 150C-65 170-62 186-61 200L-61 ${b}L61 ${b}L61 200C62 186 65 170 67 150L71 97C72 82 66 72 53 67C42 63 28 59 16 56Q0 68-16 56Z`;

const PIN = "M0 18C-4.2 13-7 10-7 6.5A7 7 0 0 1 7 6.5C7 10 4.2 13 0 18Z";

/** The Chambarrio "cerca de ti" location-pin patch, centred at (x, y). */
function Pin({ k, x, y, s = 1 }: { k: Kit; x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      {k.part({ d: PIN }, "#4318E0", k.sep / s)}
      {k.flat({ c: [0, 6.5], r: 2.6 }, WHITE)}
    </g>
  );
}

function Buttons({ k, x, ys, color }: { k: Kit; x: number; ys: number[]; color: string }) {
  if (k.lo) return null;
  return (
    <>
      {ys.map((y) => (
        <g key={y}>{k.part({ c: [x, y], r: 2.8 }, color, k.sep * 0.6)}</g>
      ))}
    </>
  );
}

const CREW = "M-18 53.5Q0 70 18 53.5L20 58Q0 78-20 58Z";
const COLLAR_L = "M-17 52L-2 68L-9 84L-31 62Z";
const MANDARIN = "M-18 48L18 48L19.5 62Q0 69-19.5 62Z";
const VEST_L = "M-71 97C-72 82-66 72-53 67L-31 60C-25 80-16 100-13 120L-13 BOTL-61 BOTL-61 200C-62 186-65 170-67 150Z";
const POCKET_L = "M-42 98H-20V120Q-31 124-42 120Z";

/**
 * The torso layer: shirt + whatever is worn over it. `bottom`: where the torso is cut (frame edge for
 * busto / medio, the hem for completo). `hem`: completo only — hem line height.
 */
export function paintTorso(k: Kit, L: Look, bottom: number): ReactNode {
  const shirtInk = detailOn(L.shirt);
  const o = L.outfit;
  const parts: ReactNode[] = [];
  parts.push(<g key="t">{k.part({ d: torsoD(bottom) }, L.shirt)}</g>);

  // collar / neckline
  if (o === "camisa" || o === "uniforme" || o === "overol") {
    parts.push(
      <g key="c">
        {k.part({ d: "M-13 57L0 74L13 57Z" }, L.skin, true)}
        {k.part([{ d: COLLAR_L }, { d: mirrorD(COLLAR_L) }], L.shirt, true)}
      </g>,
    );
  } else if (o === "filipina") {
    parts.push(<g key="c">{k.part({ d: MANDARIN }, L.shirt, true)}</g>);
  } else {
    parts.push(<g key="c">{k.part({ d: CREW }, L.shirtShade, true)}</g>);
  }

  // garment details
  if (o === "camisa") {
    parts.push(
      <g key="d">
        {k.line(`M0 74V${bottom}`, k.sep * 0.8, shirtInk)}
        <Buttons k={k} x={4} ys={[94, 120, 146, 172, 198]} color={L.shirt} />
        {k.lo ? null : k.line(POCKET_L, k.sep * 0.7, shirtInk)}
      </g>,
    );
  }
  if (o === "uniforme") {
    parts.push(
      <g key="d">
        {k.line(`M0 74V${bottom}`, k.sep * 0.8, shirtInk)}
        <Buttons k={k} x={4} ys={[96, 124, 152, 180]} color={L.shirt} />
        {k.lo ? null : k.line(`${POCKET_L}M-42 106H-20${mirrorD(POCKET_L)}M42 106H20`, k.sep * 0.7, shirtInk)}
        {k.lo ? null : (
          <g>
            {k.part({ d: "M22 86H40V94Q40 102 31 106Q22 102 22 94Z" }, "#FFC93C", k.sep * 0.7)}
            {k.line("M27 92L31 97L36 90", k.sep * 0.55)}
          </g>
        )}
      </g>,
    );
  }
  if (o === "filipina") {
    parts.push(
      <g key="d">
        {k.line(`M17 61C20 70 24 76 26 84V${bottom}`, k.sep * 0.8, shirtInk)}
        <Buttons k={k} x={-13} ys={[92, 120, 148, 176]} color={L.shirt} />
        <Buttons k={k} x={13} ys={[92, 120, 148, 176]} color={L.shirt} />
      </g>,
    );
  }

  // over-garments
  if (o === "chaleco" && L.over) {
    const vl = VEST_L.replaceAll("BOT", String(bottom));
    parts.push(
      <g key="o">
        {k.part([{ d: vl }, { d: mirrorD(vl) }], L.over, true)}
        {k.part(
          [
            { d: "M-65 146H-13V158H-65.6Z" },
            { d: "M-63.5 174H-13V186H-62.4Z" },
            { d: "M65 146H13V158H65.6Z" },
            { d: "M63.5 174H13V186H62.4Z" },
          ],
          "#C9C6D6",
          k.sep * 0.7,
        )}
        {k.lo ? null : k.line("M-62 152H-16M-61 180H-16M62 152H16M61 180H16", 2.4, WHITE)}
      </g>,
    );
  }
  if (o === "mandil" && L.over) {
    const ab = Math.max(bottom, 300);
    parts.push(
      <g key="o">
        {k.part(
          [
            { p: [-15, 57], q: [-27, 98], w: 5 },
            { p: [15, 57], q: [27, 98], w: 5 },
          ],
          L.over,
          true,
        )}
        {k.part({ d: `M-31 96L31 96L35 ${ab}L-35 ${ab}Z` }, L.over, true)}
        {k.part(
          [
            { p: [-35, 198], q: [-61, 196], w: 6 },
            { p: [35, 198], q: [61, 196], w: 6 },
          ],
          L.over,
          true,
        )}
        {k.lo ? null : k.line("M-20 146H20V164Q0 170-20 164Z M0 146V167", k.sep * 0.7, detailOn(L.over))}
      </g>,
    );
  }
  if (o === "overol" && L.over) {
    const ov = L.over;
    parts.push(
      <g key="o">
        {k.part(
          [
            { p: [-29, 114], q: [-37, 61], w: 9 },
            { p: [29, 114], q: [37, 61], w: 9 },
          ],
          ov,
          true,
        )}
        {k.part({ d: `M-35 110L35 110L36 ${bottom}L-36 ${bottom}Z` }, ov, true)}
        {k.lo ? null : k.line(`M-28 118V${Math.min(bottom, 200) - 6}M28 118V${Math.min(bottom, 200) - 6}`, 1.8, "#9DC0FF", { opacity: ov === "#2F6FD6" ? 1 : 0.45 })}
        {k.part(
          [
            { c: [-29, 116], r: 4.2 },
            { c: [29, 116], r: 4.2 },
          ],
          "#FFC93C",
          k.sep * 0.7,
        )}
        <Pin k={k} x={0} y={128} s={1.25} />
      </g>,
    );
  }
  return <>{parts}</>;
}

/* ── legs + feet (completo) ──────────────────────────────────────────── */

const BOOT = "M10 378L56 378L58 396Q75 399 77 412L77 422L10 422Z";
const SNEAKER = "M11 392L54 392Q75 396 77 411L77 422L11 422Z";
const SHOE = "M13 393L52 393Q72 397 74 411L74 422L13 422Z";

export function paintLegs(k: Kit, L: Look): ReactNode {
  const foot = L.feet === "boots" ? BOOT : L.feet === "sneakers" ? SNEAKER : SHOE;
  const footFill = L.feet === "boots" ? "#6E4127" : L.feet === "sneakers" ? WHITE : "#2B2452";
  const legs: Shape[] = [
    { d: "M-61 194L61 194L63 256L-63 256Z" },
    { p: [-34, 240], q: [-36, 368], w: 50 },
    { p: [34, 240], q: [36, 368], w: 50 },
  ];
  const belt = L.outfit === "camisa" || L.outfit === "uniforme";
  return (
    <>
      {k.part([{ d: foot }, { d: mirrorD(foot) }], footFill)}
      {k.line("M11 414H77M-11 414H-77", k.sep * 0.8, L.feet === "sneakers" ? INK : "#160F33")}
      {L.feet === "sneakers" && !k.lo ? k.line("M32 404Q47 398 60 404M-32 404Q-47 398-60 404", 3.4, "#FF5A36") : null}
      {L.feet !== "sneakers" ? k.line("M61 404Q67 403 69 406M-61 404Q-67 403-69 406", 3.4, WHITE) : null}
      {k.part(legs, L.pants, true)}
      {k.line("M0 260V230", k.sep * 0.7, detailOn(L.pants))}
      {L.outfit === "overol" ? null : k.lo ? null : k.line("M-60 372H-12M60 372H12", k.sep * 0.7, detailOn(L.pants))}
      {belt ? (
        <>
          {k.part({ d: "M-61.5 196H61.5V209H-61.5Z" }, "#3A2418", k.sep * 0.7)}
          {k.part({ d: "M-9 194H9V211H-9Z" }, "#FFC93C", k.sep * 0.7)}
        </>
      ) : null}
      {L.outfit === "overol" ? k.line("M-54 246Q-44 250-34 246M54 246Q44 250 34 246", 2, "#9DC0FF", { opacity: 0.7 }) : null}
    </>
  );
}

/* ── chest accessories ───────────────────────────────────────────────── */

export function paintChestAccessory(k: Kit, L: Look): ReactNode {
  if (L.accessory === "gafete") {
    return (
      <>
        {k.part({ d: "M-38 90H-14V118H-38Z" }, WHITE, true)}
        {k.part({ d: "M-29 84H-23V94H-29Z" }, "#C9C6D6", k.sep * 0.7)}
        {k.lo ? null : k.flat({ d: "M-34 98H-26V107H-34Z" }, "#5CC3FF")}
        {k.lo ? null : k.line("M-23 100H-18M-23 105H-19M-34 112H-18", 2.2, INK)}
        {k.flat({ d: "M-38 90H-14V95H-38Z" }, "#4318E0")}
      </>
    );
  }
  if (L.accessory === "radio") {
    // black radio, or a yellow one when it would vanish on a dark garment
    const behind = L.outfit === "chaleco" || L.outfit === "overol" || L.outfit === "mandil" ? (L.over ?? L.shirt) : L.shirt;
    const body = luma(behind) < 0.06 ? "#FFC93C" : "#2B2452";
    return (
      <>
        {k.part({ p: [36, 86], q: [36, 66], w: 4 }, "#2B2452")}
        {k.part({ d: "M22 86Q22 82 26 82H38Q42 82 42 86V114Q42 118 38 118H26Q22 118 22 114Z" }, body, true)}
        {k.flat({ d: "M26 87H38V96H26Z" }, "#DDF78A")}
        {k.lo ? null : k.line("M27 103H37M27 108H37M27 113H37", 2, body === "#FFC93C" ? INK : "#6B6494")}
      </>
    );
  }
  return null;
}

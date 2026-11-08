/*
 * Avatar engine · torso, outfits, hips, legs, feet and chest accessories — a MASS-BASED build.
 *
 * The body is a few rounded masses fused by the union painting: a ribcage / chest mass (the shirt),
 * a pelvis mass (the top of the pants, with the belt across it) and, in the arm layers, a round
 * deltoid ball per shoulder that the arm hangs from. Where the ribcage narrows into the wider pelvis
 * the silhouette pinches: that is the waist. Widths come from the build (look.ts · BUILDS); heights
 * are shared landmarks (Y), so every build fits every pose and framing.
 *
 * Figure space: face centre (0,0), chin y 44, collar y≈54–64, shoulder joints (±sx, sy≈88),
 * waist y≈180, belt y 191–205, hips y≈230, crotch y≈262, soles y 392.
 */
import type { ReactNode } from "react";
import { taper } from "./arms";
import type { Build, Look } from "./look";
import { INK, type Kit, type Pt, type Shape, WHITE, detailOn, luma, mirrorD, pt, r1 } from "./paint";

/** Shared vertical landmarks. */
export const Y = { beltTop: 191, beltH: 14, hem: 226, hip: 232, frame: 276 } as const;

/* ── symmetric paths ─────────────────────────────────────────────────── */

/** A cubic segment: [control 1, control 2, end]. */
type Seg = readonly [Pt, Pt, Pt];

/**
 * Closed, left-right symmetric path from the +x half: `start` (usually on the centre line, top), the
 * right side as cubic segments going down, then across the bottom (straight, or sagging by `sag`) and
 * back up the mirrored left side. Absolute M/L/C/Q only, so mirrorD works on pieces of it.
 */
function symPath(start: Pt, segs: readonly Seg[], sag = 0): string {
  const m = (p: Pt): Pt => [-p[0], p[1]];
  const ends = [start, ...segs.map((s) => s[2])];
  const last = ends[ends.length - 1];
  let d = `M${pt(start)}`;
  for (const [a, b, c] of segs) d += `C${pt(a)} ${pt(b)} ${pt(c)}`;
  d += sag ? `Q0 ${r1(last[1] + 2 * sag)} ${pt(m(last))}` : `L${pt(m(last))}`;
  for (let i = segs.length - 1; i >= 0; i--) {
    const [a, b] = segs[i];
    d += `C${pt(m(b))} ${pt(m(a))} ${pt(m(ends[i]))}`;
  }
  return `${d}Z`;
}

/** x of a cubic segment (starting at p0) at height y (sampled; the side curves are monotonic in y). */
function xAt(p0: Pt, s: Seg, y: number) {
  let best = p0[0];
  let err = Infinity;
  for (let i = 0; i <= 48; i++) {
    const t = i / 48;
    const u = 1 - t;
    const yy = u * u * u * p0[1] + 3 * u * u * t * s[0][1] + 3 * u * t * t * s[1][1] + t * t * t * s[2][1];
    const e = Math.abs(yy - y);
    if (e < err) {
      err = e;
      best = u * u * u * p0[0] + 3 * u * u * t * s[0][0] + 3 * u * t * t * s[1][0] + t * t * t * s[2][0];
    }
  }
  return best;
}

/* ── the masses ──────────────────────────────────────────────────────── */

const NECK_DIP: Pt = [0, 64];

/**
 * Right half of the ribcage / shirt mass, from the neckline down: neckline → trapezius → shoulder
 * (tucked inside the deltoid ball) → armpit → chest → waist → belt (tucked) or hip hem (untucked).
 */
function shirtSide(B: Build, end: "belt" | "hem"): Seg[] {
  const { nk, sx, sy, dr, chest, waist, beltW, hip } = B;
  const belly = waist > chest - 2;
  const segs: Seg[] = [
    [[9, 64], [nk - 1, 59], [nk + 1, 54]],
    [[nk + 11, 57], [sx - 17, 62], [sx - 5, sy - dr + 4]],
    [[sx + 8, sy - dr + 6], [sx + dr - 3, sy - 3], [sx + 9, sy + 14]],
    [[sx + 5, sy + 22], [chest, 110], [chest, 124]],
    belly ? [[chest + 1, 142], [waist, 150], [waist, 170]] : [[chest, 146], [waist, 160], [waist, 180]],
  ];
  if (end === "belt") {
    segs.push(belly ? [[waist, 186], [beltW + 2, 195], [beltW, Y.beltTop + 8]] : [[waist, 188], [beltW, 193], [beltW, Y.beltTop + 8]]);
  } else {
    segs.push(belly ? [[waist, 190], [hip + 3, 206], [hip + 3, Y.hem]] : [[waist, 196], [hip + 2, 210], [hip + 3, Y.hem]]);
  }
  return segs;
}

const ends = (segs: readonly Seg[]) => [NECK_DIP, ...segs.map((s) => s[2])];

/** Side x of the shirt mass at height y (for stripes and pockets that must stay inside it). */
function sideX(B: Build, y: number) {
  const segs = shirtSide(B, "hem");
  const e = ends(segs);
  for (let i = 0; i < segs.length; i++) {
    if (y <= segs[i][2][1]) return xAt(e[i], segs[i], y);
  }
  return segs[segs.length - 1][2][0];
}

/** Pelvis mass: the top of the pants, from just under the waist to `bottom`. */
function pelvisD(B: Build, bottom: number) {
  const { beltW, hip } = B;
  return symPath(
    [0, Y.beltTop - 4],
    [
      [[beltW * 0.6, Y.beltTop - 4], [beltW - 2, Y.beltTop - 4], [beltW, Y.beltTop]],
      [[beltW + 2, Y.beltTop + 14], [hip, 214], [hip, Y.hip]],
      [[hip, Y.hip + 16], [hip - 0.5, bottom - 10], [hip - 1, bottom]],
    ],
  );
}

/** Belt band (dips under a belly) + buckle. */
function Belt({ k, B }: { k: Kit; B: Build }) {
  const T = Y.beltTop;
  const H = Y.beltH;
  const w = B.beltW + 1.5;
  const s = B.sag;
  const band = `M${-w} ${T}Q0 ${T + 2 * s} ${w} ${T}L${w + 0.5} ${T + H}Q0 ${T + H + 2 * s} ${-w - 0.5} ${T + H}Z`;
  const by = T + s - 2;
  return (
    <>
      {k.part({ d: band }, "#3A2418", k.sep * 0.75)}
      {k.lo ? null : k.line(`M${-w + 16} ${T + 2 + s * 0.6}V${T + H - 2 + s * 0.6}M${w - 16} ${T + 2 + s * 0.6}V${T + H - 2 + s * 0.6}`, 3.2, "#5A3A26")}
      {k.part({ d: `M-9.5 ${by}H9.5V${by + H + 4}H-9.5Z` }, "#FFC93C", k.sep * 0.75)}
      {k.lo ? null : k.flat({ d: `M-4.5 ${by + 4.5}H4.5V${by + H - 0.5}H-4.5Z` }, "#3A2418")}
    </>
  );
}

/** Pants details visible in medio: fly and front-pocket openings. */
function PantsDetails({ k, B, color, from }: { k: Kit; B: Build; color: string; from: number }) {
  if (k.lo) return null;
  const ink = detailOn(color);
  const px = B.beltW - 10;
  return (
    <>
      {k.line(`M3 ${from}V${Y.frame}`, k.sep * 0.7, ink)}
      {k.line(`M${-px} ${from}Q${-px + 2} ${from + 18} ${-B.hip + 1} ${from + 26}M${px} ${from}Q${px - 2} ${from + 18} ${B.hip - 1} ${from + 26}`, k.sep * 0.7, ink)}
    </>
  );
}

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

const pocketL = (x: number, y: number, w = 22, h = 22) => `M${x} ${y}H${x + w}V${y + h}Q${x + w / 2} ${y + h + 4} ${x} ${y + h}Z`;

/**
 * The torso layer: hips (medio), shirt, belt, collar, garment details, over-garments.
 * `framing`: medio paints the pelvis down past the frame edge; completo leaves the pelvis to the legs
 * layer (so pants and legs fuse); busto stops at the chest.
 */
export function paintTorso(k: Kit, L: Look, framing: "busto" | "medio" | "completo"): ReactNode {
  const B = L.B;
  const o = L.outfit;
  const shirtInk = detailOn(L.shirt);
  const nk = B.nk;
  const tucked = L.tucked;
  const beltShown = tucked && o !== "overol";
  const segs = shirtSide(B, tucked ? "belt" : "hem");
  // Overalls hold the belly in: the bib sits straight on the waistband, so the shirt under it doesn't
  // sag (a sagging hem would show between the bib and the overall's waist).
  const sag = o === "overol" ? 0 : B.sag;
  const shirtD = symPath(NECK_DIP, segs, tucked ? sag : 2 + sag * 0.5);
  const shirtBottom = tucked ? Y.beltTop + 8 : Y.hem;
  const parts: ReactNode[] = [];

  // pelvis (top of the pants) — medio only; behind the shirt
  if (framing === "medio") {
    parts.push(
      <g key="p">
        {k.part({ d: pelvisD(B, Y.frame) }, L.pants)}
        <PantsDetails k={k} B={B} color={L.pants} from={tucked ? Y.beltTop + Y.beltH + B.sag : Y.hem + 2} />
      </g>,
    );
  }

  // the shirt mass (ringed where it overlaps the pants)
  parts.push(<g key="t">{k.part({ d: shirtD }, L.shirt, framing === "medio" ? true : 0)}</g>);
  if (sag && !k.lo) {
    // the belly's overhang: a soft shade crescent above the belt / hem
    const y0 = tucked ? Y.beltTop + 1 : Y.hem - 2;
    const w = B.beltW - 6;
    // lower edge follows the belt / hem curve; upper edge is the belly's underside
    parts.push(
      <g key="bl">
        {k.flat({ d: `M${-w} ${y0}Q0 ${y0 + 2 * B.sag} ${w} ${y0}L${w - 10} ${y0 - 4}Q0 ${y0 + 2 * B.sag - 26} ${-w + 10} ${y0 - 4}Z` }, L.shirtShade)}
      </g>,
    );
  }
  if (!tucked && !k.lo) parts.push(<g key="hm">{k.line(`M${-B.hip} ${Y.hem - 7}Q0 ${Y.hem - 3} ${B.hip} ${Y.hem - 7}`, k.sep * 0.6, shirtInk, { opacity: 0.55 })}</g>);

  // collar / neckline
  if (o === "camisa" || o === "uniforme" || o === "overol") {
    const wing = `M${-nk + 0.5} 51L-2 69L-10 86L${-nk - 15} 63Z`;
    parts.push(
      <g key="c">
        {k.part({ d: `M${-nk + 4} 56L0 75L${nk - 4} 56Z` }, L.skin, true)}
        {k.part([{ d: wing }, { d: mirrorD(wing) }], L.shirt, true)}
      </g>,
    );
  } else if (o === "filipina") {
    parts.push(<g key="c">{k.part({ d: `M${-nk - 1} 47L${nk + 1} 47L${nk + 2.5} 62Q0 69 ${-nk - 2.5} 62Z` }, L.shirt, true)}</g>);
  } else {
    parts.push(<g key="c">{k.part({ d: `M${-nk} 53.5Q0 72 ${nk} 53.5L${nk + 2.5} 58.5Q0 80 ${-nk - 2.5} 58.5Z` }, L.shirtShade, true)}</g>);
  }

  // garment details
  if (o === "camisa") {
    parts.push(
      <g key="d">
        {k.line(`M0 74V${shirtBottom + B.sag}`, k.sep * 0.8, shirtInk)}
        <Buttons k={k} x={4} ys={[96, 122, 148, 174]} color={L.shirt} />
        {k.lo ? null : k.line(pocketL(-42, 100), k.sep * 0.7, shirtInk)}
      </g>,
    );
  }
  if (o === "uniforme") {
    parts.push(
      <g key="d">
        {k.line(`M0 74V${shirtBottom + B.sag}`, k.sep * 0.8, shirtInk)}
        <Buttons k={k} x={4} ys={[98, 126, 154, 180]} color={L.shirt} />
        {k.lo ? null : k.line(`${pocketL(-42, 100)}M-42 108H-20${mirrorD(pocketL(-42, 100))}M42 108H20`, k.sep * 0.7, shirtInk)}
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
        {k.line(`M${nk - 1} 61C${nk + 2} 70 24 76 26 84V${shirtBottom + B.sag}`, k.sep * 0.8, shirtInk)}
        <Buttons k={k} x={-13} ys={[94, 122, 150, 178]} color={L.shirt} />
        <Buttons k={k} x={13} ys={[94, 122, 150, 178]} color={L.shirt} />
      </g>,
    );
  }

  if (beltShown) parts.push(<g key="b"><Belt k={k} B={B} /></g>);

  // over-garments
  if (o === "chaleco" && L.over) {
    const hemY = Y.beltTop + Y.beltH + 12;
    const hs = shirtSide(B, "hem");
    const e = ends(hs);
    let vr = `M${pt(e[1])}`;
    for (const [a, b, c] of hs.slice(1, 5)) vr += `C${pt(a)} ${pt(b)} ${pt(c)}`;
    const sx = r1(sideX(B, hemY));
    const last = hs[5];
    vr += `C${pt(last[0])} ${pt([last[1][0] - 1, hemY - 12])} ${sx} ${hemY}L15 ${hemY}L15 116C15 92 ${nk + 5} 72 ${pt(e[1])}Z`;
    const stripe = (y: number) => {
      const x1 = r1(sideX(B, y) + 1);
      const x2 = r1(sideX(B, y + 11) + 1);
      return `M15 ${y}L${x1} ${y}L${x2} ${y + 11}L15 ${y + 11}Z`;
    };
    const s1 = stripe(146);
    const s2 = stripe(174);
    parts.push(
      <g key="o">
        {k.part([{ d: vr }, { d: mirrorD(vr) }], L.over, true)}
        {k.part([{ d: s1 }, { d: s2 }, { d: mirrorD(s1) }, { d: mirrorD(s2) }], "#C9C6D6", k.sep * 0.7)}
        {k.lo ? null : k.line(`M17 151.5H${r1(sideX(B, 151) - 2)}M17 179.5H${r1(sideX(B, 179) - 2)}M-17 151.5H${-r1(sideX(B, 151) - 2)}M-17 179.5H${-r1(sideX(B, 179) - 2)}`, 2.4, WHITE)}
      </g>,
    );
  }
  if (o === "mandil" && L.over) {
    const ab = framing === "completo" ? 318 : Y.frame;
    const tieY = 178;
    const tw = r1(sideX(B, tieY) - 1);
    const ww = Math.min(B.beltW - 6, 40);
    parts.push(
      <g key="o">
        {k.part(
          [
            { p: [-nk + 3, 56], q: [-25, 100], w: 5 },
            { p: [nk - 3, 56], q: [25, 100], w: 5 },
          ],
          L.over,
          true,
        )}
        {k.part({ d: `M-27 98L27 98C29 130 ${ww} 160 ${ww} ${tieY}L${ww + 4} ${ab}L${-ww - 4} ${ab}L${-ww} ${tieY}C${-ww} 160-29 130-27 98Z` }, L.over, true)}
        {k.part(
          [
            { p: [-ww, tieY], q: [-tw, tieY - 1], w: 6 },
            { p: [ww, tieY], q: [tw, tieY - 1], w: 6 },
          ],
          L.over,
          true,
        )}
        {k.lo ? null : k.line(`M-20 ${tieY + 26}H20V${tieY + 44}Q0 ${tieY + 50}-20 ${tieY + 44}Z M0 ${tieY + 26}V${tieY + 47}`, k.sep * 0.7, detailOn(L.over))}
      </g>,
    );
  }
  if (o === "overol" && L.over) {
    const ov = L.over;
    const wb = Y.beltTop + 6;
    parts.push(
      <g key="o">
        {k.part(
          [
            { p: [-27, 112], q: [-nk - 12, 60], w: 10 },
            { p: [27, 112], q: [nk + 12, 60], w: 10 },
          ],
          ov,
          true,
        )}
        {k.part({ d: `M-31 106L31 106L33 ${wb}L-33 ${wb}Z` }, ov, true)}
        {k.lo ? null : k.line(`M-25 114V${wb - 6}M25 114V${wb - 6}`, 1.8, "#9DC0FF", { opacity: ov === "#2F6FD6" ? 1 : 0.45 })}
        {framing === "medio" ? k.line(`M${-B.beltW - 1} ${wb}H${B.beltW + 1}`, k.sep * 0.8, detailOn(ov)) : null}
        {k.part(
          [
            { c: [-27, 113], r: 4.4 },
            { c: [27, 113], r: 4.4 },
          ],
          "#FFC93C",
          k.sep * 0.7,
        )}
        {k.lo || framing !== "medio" ? null : k.part([{ c: [-B.beltW + 4, wb + 9], r: 3.4 }, { c: [B.beltW - 4, wb + 9], r: 3.4 }], "#FFC93C", k.sep * 0.6)}
        <Pin k={k} x={0} y={128} s={1.25} />
      </g>,
    );
  }
  return <>{parts}</>;
}

/* ── legs + feet (completo) ──────────────────────────────────────────── */

const BOOT = "M13 356L57 356L59 374Q75 377 77 390L77 400L13 400Z";
const SNEAKER = "M14 370L55 370Q75 374 77 389L77 400L14 400Z";
const SHOE = "M16 371L53 371Q72 375 74 389L74 400L16 400Z";

/**
 * Pelvis + legs + feet: one layer, behind the torso (so the shirt / belt sit over the pants).
 * Legs are two masses each: a thigh tapering to the knee and a shin tapering to the ankle, set in a
 * slight A-stance so the crotch reads and the figure stands planted.
 */
export function paintLegs(k: Kit, L: Look): ReactNode {
  const B = L.B;
  const foot = L.feet === "boots" ? BOOT : L.feet === "sneakers" ? SNEAKER : SHOE;
  const footFill = L.feet === "boots" ? "#6E4127" : L.feet === "sneakers" ? WHITE : "#2B2452";
  const lx = B.hip / 2 + 0.5;
  const knee: Pt = [lx + 4, 306];
  const ankle: Pt = [lx + 7, 356];
  const legs: Shape[] = [{ d: pelvisD(B, 262) }];
  for (const sg of [-1, 1]) {
    const m = (p: Pt): Pt => [sg * p[0], p[1]];
    legs.push({ c: m([lx, 240]), r: lx }, taper(m([lx, 240]), m(knee), lx - 0.5, lx - 5.5), taper(m(knee), m(ankle), lx - 5.5, lx - 9));
  }
  const ink = detailOn(L.pants);
  const hem = 350;
  return (
    <>
      {k.part([{ d: foot }, { d: mirrorD(foot) }], footFill)}
      {k.line("M13 392H77M-13 392H-77", k.sep * 0.8, L.feet === "sneakers" ? INK : "#160F33")}
      {L.feet === "sneakers" && !k.lo ? k.line("M34 382Q49 376 62 382M-34 382Q-49 376-62 382", 3.4, "#FF5A36") : null}
      {L.feet !== "sneakers" ? k.line("M62 382Q68 381 70 384M-62 382Q-68 381-70 384", 3.4, WHITE) : null}
      {k.part(legs, L.pants, true)}
      {k.line(`M3 ${Y.beltTop + Y.beltH}V250`, k.sep * 0.7, ink)}
      {L.outfit === "overol" || k.lo ? null : k.line(`M${-ankle[0] - 17} ${hem}H${-ankle[0] + 17}M${ankle[0] + 17} ${hem}H${ankle[0] - 17}`, k.sep * 0.7, ink)}
      {L.outfit === "overol" ? k.line(`M${-knee[0] - 16} 296Q${-knee[0]} 301 ${-knee[0] + 16} 296M${knee[0] + 16} 296Q${knee[0]} 301 ${knee[0] - 16} 296`, 2, "#9DC0FF", { opacity: 0.7 }) : null}
      {L.outfit === "overol" ? k.line(`M${-B.beltW - 1} ${Y.beltTop + 6}H${B.beltW + 1}`, k.sep * 0.8, ink) : null}
    </>
  );
}

/* ── chest accessories ───────────────────────────────────────────────── */

export function paintChestAccessory(k: Kit, L: Look): ReactNode {
  // Keep the badge / radio on the chest, clear of the sleeve cap (narrower builds have their
  // shoulder joints closer in, so the accessory slides toward the centre line).
  const inset = r1(Math.max(0, 40 - (L.B.sx - L.B.dr - 6.7)));
  if (L.accessory === "gafete") {
    // a little more room on the badge side: its top corner sits level with the shoulder joint, where a
    // raised arm (festeja) exposes the whole underside of the sleeve cap
    const bi = inset + 2;
    return (
      <g transform={`translate(${r1(bi)} 0)`}>
        {k.part({ d: "M-40 94H-16V122H-40Z" }, WHITE, true)}
        {k.part({ d: "M-31 88H-25V98H-31Z" }, "#C9C6D6", k.sep * 0.7)}
        {k.lo ? null : k.flat({ d: "M-36 102H-28V111H-36Z" }, "#5CC3FF")}
        {k.lo ? null : k.line("M-25 104H-20M-25 109H-21M-36 116H-20", 2.2, INK)}
        {k.flat({ d: "M-40 94H-16V99H-40Z" }, "#4318E0")}
      </g>
    );
  }
  if (L.accessory === "radio") {
    // black radio, or a yellow one when it would vanish on a dark garment
    const behind = L.outfit === "chaleco" || L.outfit === "overol" || L.outfit === "mandil" ? (L.over ?? L.shirt) : L.shirt;
    const body = luma(behind) < 0.06 ? "#FFC93C" : "#2B2452";
    return (
      <g transform={inset ? `translate(${-inset} 0)` : undefined}>
        {k.part({ p: [37, 88], q: [37, 68], w: 4 }, "#2B2452")}
        {k.part({ d: "M23 88Q23 84 27 84H39Q43 84 43 88V116Q43 120 39 120H27Q23 120 23 116Z" }, body, true)}
        {k.flat({ d: "M27 89H39V98H27Z" }, "#DDF78A")}
        {k.lo ? null : k.line("M28 105H38M28 110H38M28 115H38", 2, body === "#FFC93C" ? INK : "#6B6494")}
      </g>
    );
  }
  return null;
}

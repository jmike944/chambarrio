/*
 * Avatar engine · components.
 *
 *   <Avatar config pose framing size animated flip expression className title />
 *   <AvatarCircle config size ring bg animated className title />   — bust in a coloured circle (UI avatars)
 *   <AvatarHand variant skin glove sleeve cuff mirror size animated className title />  — one big hand
 *
 * Server-component safe: no hooks, no ids, deterministic markup. Motion is CSS only (avatar.css), runs
 * only with `animated` and never under prefers-reduced-motion. Every config is sanitized on render,
 * so a raw jsonb value from the DB can be passed straight in.
 */
import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { type ArmPart, POSE_SPECS, paintArm, placeArm } from "./arms";
import { paintChestAccessory, paintLegs, paintTorso } from "./body";
import {
  type AvatarConfig,
  type AvatarFraming,
  type AvatarPose,
  type Expression,
  PALETTE,
  type PaletteKey,
  SKIN_HEX,
  type SkinTone,
  sanitizeAvatar,
} from "./config";
import { paintHairBack, paintHead, paintHeadsetBand, paintHeadsetCups, paintHeadwear, paintNeck } from "./head";
import { type HandPose, paintHand } from "./hands";
import { resolveLook } from "./look";
import { type Draw, INK, Layer, type PaintCtx, ShadowOf } from "./paint";
import "./avatar.css";

/** viewBox per framing: [minX, minY, width, height]. */
export const AVATAR_VIEWBOX: Record<AvatarFraming, readonly [number, number, number, number]> = {
  busto: [-82, -88, 164, 164],
  // Same aspect ratios as before (so avatarHeight() and every layout are unchanged), zoomed onto the
  // stockier figure: medio is cut just under the belt, completo ends at the soles.
  medio: [-142, -98, 284, 361.6],
  completo: [-142, -96, 284, 502],
};

const BUST_TIGHT = [-72, -80, 144, 144] as const;

/** Rendered height for a given width. */
export const avatarHeight = (framing: AvatarFraming, width: number) => {
  const [, , w, h] = AVATAR_VIEWBOX[framing];
  return Math.round((width * h) / w);
};

export type AvatarProps = {
  /** An AvatarConfig, or any untrusted value (sanitized on render). */
  config: AvatarConfig | unknown;
  pose?: AvatarPose;
  /** busto: head + shoulders (24–96 px circles) · medio: hips up, both arms · completo: full body. */
  framing?: AvatarFraming;
  /** Rendered width in px (height follows the framing). Defaults: busto 48, medio 200, completo 160. */
  size?: number;
  /** Idle motion (blink, breathe, pose gesture). Default true. */
  animated?: boolean;
  /** Override the config's expression (e.g. "emocion" for a celebration scene). */
  expression?: Expression;
  /** Do the gesture with the other arm (the figure is otherwise symmetric). */
  flip?: boolean;
  className?: string;
  style?: CSSProperties;
  /** Accessible label; omit for decorative (aria-hidden). */
  title?: string;
};

const DEFAULT_SIZE: Record<AvatarFraming, number> = { busto: 48, medio: 200, completo: 160 };

export function Avatar({
  config,
  pose = "neutral",
  framing = "medio",
  size,
  animated = true,
  expression,
  flip = false,
  className,
  style,
  title,
}: AvatarProps) {
  const cfg = sanitizeAvatar(config);
  const L = resolveLook(cfg, expression);
  const px = size ?? DEFAULT_SIZE[framing];
  const bust = framing === "busto";
  const lo = bust && px < 44;
  // tiny busts crop tighter so the face carries the circle
  const [vx, vy, vw, vh] = lo ? BUST_TIGHT : AVATAR_VIEWBOX[framing];
  const sw = bust ? (lo ? 7.5 : 6) : 5;
  const ctx: PaintCtx = { sw, sep: sw * 0.62, lo };
  const SH = bust ? 4.5 : 5;

  const realPose: AvatarPose = bust ? "neutral" : pose;
  const spec = POSE_SPECS[realPose];
  const right = flip ? spec.L : spec.R;
  const left = flip ? spec.R : spec.L;
  const topSide: 1 | -1 = (spec.top === "R") !== flip ? 1 : -1;
  const armPart: ArmPart = bust ? "upper" : "full";
  const nod = realPose === "brazos-cruzados";

  const headWrap = (node: ReactNode) =>
    nod ? (
      <g transform="translate(0 44)">
        <g className="avA avNod">
          <g transform="translate(0 -44)">{node}</g>
        </g>
      </g>
    ) : (
      node
    );

  const armL: Draw = (k) =>
    placeArm(-1, L.B, paintArm(k, left, L, armPart, realPose === "festeja" ? -0.45 : undefined));
  const armR: Draw = (k) => placeArm(1, L.B, paintArm(k, right, L, armPart));

  const figureKey = `${JSON.stringify(cfg)}|${realPose}|${framing}|${flip ? 1 : 0}|${expression ?? ""}|${px}`;
  const layers: { key: string; draw: Draw; shadow?: number }[] = [
    { key: "hairBack", draw: (k) => headWrap(paintHairBack(k, L)) },
    ...(framing === "completo" ? [{ key: "legs", draw: ((k) => paintLegs(k, L)) as Draw }] : []),
    { key: "neck", draw: (k) => paintNeck(k, L) },
    { key: "torso", draw: (k) => paintTorso(k, L, framing) },
    ...(L.accessory === "gafete" || L.accessory === "radio" ? [{ key: "acc", draw: ((k) => paintChestAccessory(k, L)) as Draw }] : []),
    { key: "head", draw: (k) => headWrap(paintHead(k, L)) },
    ...(L.accessory === "audifonos" ? [{ key: "band", draw: ((k) => headWrap(paintHeadsetBand(k, L))) as Draw }] : []),
    ...(L.headwear !== "ninguno" ? [{ key: "hat", draw: ((k) => headWrap(paintHeadwear(k, L))) as Draw, shadow: bust ? 0 : 3 }] : []),
    ...(L.accessory === "audifonos" ? [{ key: "cups", draw: ((k) => headWrap(paintHeadsetCups(k))) as Draw }] : []),
    { key: "armBack", draw: topSide === 1 ? armL : armR, shadow: bust ? 0 : 3 },
    { key: "armTop", draw: topSide === 1 ? armR : armL, shadow: bust ? 0 : 3 },
  ];

  return (
    <svg
      viewBox={`${vx} ${vy} ${vw} ${vh}`}
      width={px}
      height={Math.round((px * vh) / vw)}
      className={cn("avRoot shrink-0", className)}
      style={style}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      data-framing={framing}
      data-pose={realPose}
      data-animated={animated || undefined}
    >
      {title ? <title>{title}</title> : null}
      {framing === "completo" ? <ellipse cx={0} cy={401} rx={90} ry={6.5} fill={INK} opacity={0.16} /> : null}
      {/* Keyed by the look: a change remounts the whole figure, so the shadow, outline and colour
          copies of an animated arm restart their CSS motion together and stay in step. */}
      <g key={figureKey} className={cn("avA", realPose === "festeja" ? "avHop" : "avBob")}>
        <ShadowOf ctx={ctx} layers={layers} offset={SH} />
        {layers.map((l) => (
          <Layer key={l.key} ctx={ctx} draw={l.draw} shadow={l.shadow} />
        ))}
      </g>
    </svg>
  );
}

/* ── circle ──────────────────────────────────────────────────────────── */

const CIRCLE_BG = {
  lila: "#C7C2FF",
  cielo: "#BFE6FF",
  sol: "#FFE48A",
  limon: "#DDF78A",
  menta: "#BDF5D6",
} as const;

/** A pastel that contrasts with the outfit (deterministic). */
export function avatarCircleBg(config: AvatarConfig | unknown): string {
  const c = sanitizeAvatar(config);
  const alt = Number(c.skin.slice(-1)) % 2 === 0;
  switch (c.outfitColor) {
    case "sol":
    case "naranja":
    case "chile":
    case "crema":
      return alt ? CIRCLE_BG.cielo : CIRCLE_BG.lila;
    case "denim":
    case "cielo":
    case "violeta":
    case "tinta":
      return alt ? CIRCLE_BG.sol : CIRCLE_BG.limon;
    case "limon":
    case "menta":
      return alt ? CIRCLE_BG.lila : CIRCLE_BG.cielo;
    default:
      return alt ? CIRCLE_BG.limon : CIRCLE_BG.cielo;
  }
}

const colorOf = (c: string) => (c in PALETTE ? PALETTE[c as PaletteKey] : c);

export type AvatarCircleProps = {
  config: AvatarConfig | unknown;
  /** Diameter in px. Default 40. */
  size?: number;
  /** true → 2 px card-coloured ring (theme aware); a CSS colour → 2 px ring in that colour. */
  ring?: boolean | string;
  /** Background: a palette key or any CSS colour. Default: a pastel picked to contrast with the outfit. */
  bg?: PaletteKey | (string & {});
  /** Blink / breathe. Default false (UI avatars sit still). */
  animated?: boolean;
  className?: string;
  /** Accessible label (e.g. the person's name); omit for decorative. */
  title?: string;
};

export function AvatarCircle({ config, size = 40, ring = false, bg, animated = false, className, title }: AvatarCircleProps) {
  const cfg = sanitizeAvatar(config);
  return (
    <span
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      className={cn("relative inline-block shrink-0 overflow-hidden rounded-full align-middle", ring === true && "ring-2 ring-card", className)}
      style={{
        width: size,
        height: size,
        background: bg ? colorOf(bg) : avatarCircleBg(cfg),
        boxShadow: typeof ring === "string" ? `0 0 0 2px ${ring}` : undefined,
      }}
    >
      <Avatar config={cfg} framing="busto" size={size} animated={animated} className="absolute inset-0 block" />
    </span>
  );
}

/* ── single big hand ─────────────────────────────────────────────────── */

export type AvatarHandVariant = "palma" | "pulgar" | "choca";

export type AvatarHandProps = {
  /** palma: open hand facing you (wave, stop, one side of a high-five) · choca: fingers together, ready to
   * slap a high-five · pulgar: thumbs up. */
  variant: AvatarHandVariant;
  skin?: SkinTone;
  /** Yellow work glove with a gauntlet cuff. */
  glove?: boolean;
  /** Sleeve on the forearm stub (palette key), or false for a bare forearm. Default "denim". */
  sleeve?: PaletteKey | false;
  /** Shirt-cuff colour at the wrist (bare hands with a sleeve). Default "blanco". */
  cuff?: PaletteKey;
  /** Mirror (thumb on the other side) — pair two hands for a high-five. */
  mirror?: boolean;
  /** Rendered width in px (height = width × 1.375). Default 120. */
  size?: number;
  animated?: boolean;
  className?: string;
  style?: CSSProperties;
  title?: string;
};

export const AVATAR_HAND_VIEWBOX = [-80, -140, 160, 220] as const;

export function AvatarHand({
  variant,
  skin = "tono-4",
  glove = false,
  sleeve = "denim",
  cuff = "blanco",
  mirror = false,
  size = 120,
  animated = true,
  className,
  style,
  title,
}: AvatarHandProps) {
  const ctx: PaintCtx = { sw: 6, sep: 3.8, lo: false };
  const fill = glove ? PALETTE.sol : SKIN_HEX[skin];
  const pose: HandPose = variant === "palma" ? "open" : variant === "choca" ? "choca" : "thumb";
  const s = variant === "pulgar" ? 1.32 : 1;
  const foreW = 46;
  const anim = variant === "palma" ? "avHandWave" : variant === "choca" ? "avHi5" : "avThumbPop";
  const draw: Draw = (k) => {
    const hk = k.scaled(s);
    return (
      <g transform={mirror ? "scale(-1 1) translate(0 80)" : "translate(0 80)"}>
       <g className={`avA ${anim}`}>
       <g transform="translate(0 -80)">
        {k.part({ p: [0, 120], q: [0, 4], w: foreW }, sleeve ? PALETTE[sleeve] : fill)}
        {sleeve && !k.lo ? k.line("M-12 110V40", 5, "#FFFFFF", { opacity: 0.9 }) : null}
        <g transform={s !== 1 ? `scale(${s})` : undefined}>
          {paintHand(hk, pose, glove ? { fill, glove: true, gauntlet: "#E9A21A" } : { fill })}
          {!glove && sleeve ? hk.part({ d: "M-28-6L28-6L29 19L-29 19Z" }, PALETTE[cuff], true) : null}
        </g>
       </g>
       </g>
      </g>
    );
  };
  const [vx, vy, vw, vh] = AVATAR_HAND_VIEWBOX;
  return (
    <svg
      viewBox={`${vx} ${vy} ${vw} ${vh}`}
      width={size}
      height={Math.round((size * vh) / vw)}
      className={cn("avRoot shrink-0", className)}
      style={style}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      data-animated={animated || undefined}
      data-mirror={mirror || undefined}
    >
      {title ? <title>{title}</title> : null}
      <Layer ctx={ctx} draw={draw} shadow={6} />
    </svg>
  );
}

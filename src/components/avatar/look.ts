/*
 * Avatar engine · config → resolved colours / construction choices.
 */
import {
  type AvatarConfig,
  type Complexion,
  type Expression,
  type FacialHair,
  type HairStyle,
  HAIR_HEX,
  type Headwear,
  type Outfit,
  PALETTE,
  type PaletteKey,
  SKIN_HEX,
} from "./config";
import { INK, mix, shade } from "./paint";

export type HatMode = "none" | "hat" | "net";
export type Sleeve = "short" | "rolled" | "long";
export type Feet = "boots" | "sneakers" | "shoes";

/**
 * Body build ("Trabajador fuerte"): the measurements every body part is laid out from (figure units,
 * +x half-widths). Vertical landmarks are shared (body.tsx · Y), so poses and framings fit every build.
 *
 * The shoulder is NOT a separate ball: the torso's trapezius line runs from the neck to the shoulder
 * top (shX, shY), where the arm's sleeve cap takes over (arms.tsx · capRegion) and turns down into the
 * arm's outer edge. Head = 74 wide × 90 tall → shoulders ≈ 1.8 × 74 ≈ ±66 outer edge, collar (y≈56)
 * to belt (y 172) ≈ 1.3 × 90.
 */
export type Build = {
  /** Shoulder joint (arm pivot), +x side. */
  sx: number;
  sy: number;
  /** Shoulder top: where the trapezius line meets the sleeve cap. */
  shX: number;
  shY: number;
  /** Neck half-width at the collar. */
  nk: number;
  /** Torso half-width just under the armpit (y ≈ 102). */
  chest: number;
  /** Half-width at the waist (y ≈ 150; robusta: the belly). */
  waist: number;
  /** Belt half-width (where a tucked shirt ends). */
  beltW: number;
  /** Hip half-width (pants / an untucked hem). */
  hip: number;
  /** How far the belt dips under a belly (robusta). */
  sag: number;
  /** Limb thickness factor. */
  arm: number;
  /** Extra outward angle (deg) of the relaxed arms. */
  splay: number;
};

export const BUILDS: Record<Complexion, Build> = {
  recta: { sx: 50, sy: 76, shX: 50, shY: 66.5, nk: 18.5, chest: 55, waist: 45.5, beltW: 46.5, hip: 50, sag: 0, arm: 1, splay: 0 },
  curvas: { sx: 47, sy: 77, shX: 47, shY: 68, nk: 16.5, chest: 50.5, waist: 42, beltW: 44, hip: 50, sag: 0, arm: 0.9, splay: 2.5 },
  robusta: { sx: 53, sy: 76, shX: 53, shY: 66.5, nk: 20.5, chest: 58, waist: 60, beltW: 55.5, hip: 57, sag: 4, arm: 1.1, splay: 3 },
};

export type Look = {
  skin: string;
  skinShade: string;
  hair: string;
  hairShade: string;
  hairStyle: HairStyle;
  hatMode: HatMode;
  headwear: Headwear;
  hw: string;
  hwShade: string;
  facial: FacialHair;
  glasses: boolean;
  expression: Expression;
  accessory: AvatarConfig["accessory"];
  outfit: Outfit;
  complexion: Complexion;
  B: Build;
  /** Shirt tucked into belted pants (else a hem at the hip). */
  tucked: boolean;
  /** Torso / sleeve base colour (the shirt). */
  shirt: string;
  shirtShade: string;
  /** The over-garment colour (vest, apron, overalls) when there is one. */
  over: string | null;
  sleeve: Sleeve;
  pants: string;
  feet: Feet;
  glove: boolean;
  gloveFill: string;
  gauntlet: string;
};

const BLUES: PaletteKey[] = ["denim", "cielo", "violeta", "tinta"];
const LIGHT_NEUTRALS: PaletteKey[] = ["blanco", "crema", "concreto"];
const SLATE: string = "#45405F";
const DENIM: string = PALETTE.denim;

export function resolveLook(c: AvatarConfig, expression?: Expression): Look {
  const skin = SKIN_HEX[c.skin];
  const hair = HAIR_HEX[c.hairColor];
  const main = PALETTE[c.outfitColor];
  const hw = PALETTE[c.headwearColor];

  let shirtKey: PaletteKey = c.outfitColor;
  let over: string | null = null;
  if (c.outfit === "chaleco") {
    shirtKey = BLUES.includes(c.outfitColor) ? "blanco" : "denim";
    over = main;
  } else if (c.outfit === "mandil") {
    shirtKey = LIGHT_NEUTRALS.includes(c.outfitColor) ? "violeta" : BLUES.includes(c.outfitColor) ? "blanco" : "blanco";
    over = main;
  } else if (c.outfit === "overol") {
    over = c.outfitColor === "denim" || c.outfitColor === "cielo" ? SLATE : DENIM;
  }
  const shirt = PALETTE[shirtKey];

  const sleeve: Sleeve =
    c.outfit === "camisa" || c.outfit === "filipina" || c.outfit === "chaleco" ? "long" : c.outfit === "overol" ? "rolled" : "short";

  let pants: string = DENIM;
  if (c.outfit === "overol") pants = over ?? DENIM;
  else if (c.outfit === "camisa" || c.outfit === "filipina") pants = SLATE;
  else if (c.outfit === "uniforme") pants = c.outfitColor === "tinta" ? PALETTE.tinta : SLATE;
  else if (shirtKey === "denim") pants = SLATE;

  const glove = c.headwear === "casco" || c.outfit === "chaleco" || c.outfit === "overol";
  const feet: Feet =
    glove || c.outfit === "uniforme" ? "boots" : c.outfit === "camisa" || c.outfit === "filipina" ? "shoes" : "sneakers";

  const hatMode: HatMode = c.headwear === "cofia" ? "net" : c.headwear === "ninguno" ? "none" : "hat";

  return {
    skin,
    skinShade: mix(skin, INK, 0.2),
    hair,
    hairShade: c.hairColor === "negro" ? mix(hair, "#FFFFFF", 0.22) : shade(hair, 0.25),
    hairStyle: c.hair,
    hatMode,
    headwear: c.headwear,
    hw,
    hwShade: shade(hw, 0.14),
    facial: c.facialHair,
    glasses: c.glasses,
    expression: expression ?? c.expression,
    accessory: c.accessory,
    outfit: c.outfit,
    complexion: c.complexion ?? "recta",
    B: BUILDS[c.complexion ?? "recta"],
    tucked: c.outfit !== "playera",
    shirt,
    shirtShade: shade(shirt, 0.14),
    over,
    sleeve,
    pants,
    feet,
    glove,
    gloveFill: PALETTE.sol,
    gauntlet: "#E9A21A",
  };
}

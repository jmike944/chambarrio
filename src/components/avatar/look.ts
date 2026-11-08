/*
 * Avatar engine · config → resolved colours / construction choices.
 */
import {
  type AvatarConfig,
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

/*
 * Avatar engine · data layer (pure TS, no React — safe to import from server code, client
 * editors, route handlers and Edge Functions).
 *
 * An AvatarConfig is a small, versioned JSON value that can live in a `jsonb` column. Anything
 * read back from the DB (or a form) must go through `sanitizeAvatar()` before rendering.
 */
import type { CategoryId } from "@/lib/data/types";

/* ── palette (shared with the rest of the "bold workwear sticker" art) ── */

export const PALETTE = {
  sol: "#FFC93C",
  naranja: "#FF6B2C",
  chile: "#FF5A36",
  violeta: "#4318E0",
  limon: "#DDF78A",
  denim: "#2F6FD6",
  cielo: "#5CC3FF",
  menta: "#5EE0A0",
  concreto: "#C9C6D6",
  crema: "#FFF6E0",
  blanco: "#FFFFFF",
  tinta: "#2B2452",
} as const;
export type PaletteKey = keyof typeof PALETTE;
const PALETTE_KEYS = Object.keys(PALETTE) as PaletteKey[];

/* ── option vocabularies ─────────────────────────────────────────────── */

export const SKIN_TONES = ["tono-1", "tono-2", "tono-3", "tono-4", "tono-5", "tono-6"] as const;
export type SkinTone = (typeof SKIN_TONES)[number];

export const HAIR_STYLES = ["corto", "rapado", "rizado", "largo", "chongo", "coleta", "calvo"] as const;
export type HairStyle = (typeof HAIR_STYLES)[number];

export const HAIR_COLORS = ["negro", "castano", "miel", "rojizo", "canoso"] as const;
export type HairColor = (typeof HAIR_COLORS)[number];

export const HEADWEAR = ["ninguno", "casco", "gorra", "paliacate", "cofia"] as const;
export type Headwear = (typeof HEADWEAR)[number];

export const FACIAL_HAIR = ["ninguno", "bigote", "barba", "candado"] as const;
export type FacialHair = (typeof FACIAL_HAIR)[number];

export const OUTFITS = ["playera", "camisa", "chaleco", "mandil", "overol", "filipina", "uniforme"] as const;
export type Outfit = (typeof OUTFITS)[number];

export const EXPRESSIONS = ["sonrisa", "seria", "guino", "emocion"] as const;
export type Expression = (typeof EXPRESSIONS)[number];

export const ACCESSORIES = ["ninguno", "gafete", "radio", "audifonos"] as const;
export type Accessory = (typeof ACCESSORIES)[number];

export const POSES = ["neutral", "saluda", "festeja", "pulgar", "senala", "brazos-cruzados"] as const;
export type AvatarPose = (typeof POSES)[number];

export const FRAMINGS = ["busto", "medio", "completo"] as const;
export type AvatarFraming = (typeof FRAMINGS)[number];

export type AvatarConfig = {
  v: 1;
  skin: SkinTone;
  hair: HairStyle;
  hairColor: HairColor;
  headwear: Headwear;
  headwearColor: PaletteKey;
  facialHair: FacialHair;
  glasses: boolean;
  outfit: Outfit;
  /**
   * Main garment colour. playera / camisa / filipina / uniforme: the garment; chaleco: the vest;
   * mandil: the apron; overol: the SHIRT under the (always denim) overalls.
   */
  outfitColor: PaletteKey;
  expression: Expression;
  accessory: Accessory;
};

/* ── colour tables ───────────────────────────────────────────────────── */

/** Light → deep. */
export const SKIN_HEX: Record<SkinTone, string> = {
  "tono-1": "#F7D7BE",
  "tono-2": "#EDB98F",
  "tono-3": "#D69A66",
  "tono-4": "#B5764A",
  "tono-5": "#8A5634",
  "tono-6": "#66402A",
};

export const HAIR_HEX: Record<HairColor, string> = {
  negro: "#2A1C16",
  castano: "#5E3822",
  miel: "#B97E3E",
  rojizo: "#A4462A",
  canoso: "#C4C0CF",
};

/* ── Spanish labels for editors ──────────────────────────────────────── */

export type AvatarOption<T> = { value: T; label: string; swatch?: string };

const opts = <T extends string>(values: readonly T[], labels: Record<T, string>, swatch?: Record<T, string>): AvatarOption<T>[] =>
  values.map((value) => ({ value, label: labels[value], ...(swatch ? { swatch: swatch[value] } : {}) }));

const COLOR_LABEL: Record<PaletteKey, string> = {
  sol: "Amarillo",
  naranja: "Naranja",
  chile: "Rojo",
  violeta: "Morado",
  limon: "Verde limón",
  denim: "Mezclilla",
  cielo: "Azul cielo",
  menta: "Menta",
  concreto: "Gris",
  crema: "Crema",
  blanco: "Blanco",
  tinta: "Marino",
};

export const OPTIONS = {
  skin: opts(
    SKIN_TONES,
    { "tono-1": "Muy claro", "tono-2": "Claro", "tono-3": "Medio", "tono-4": "Moreno claro", "tono-5": "Moreno", "tono-6": "Oscuro" },
    SKIN_HEX,
  ),
  hair: opts(HAIR_STYLES, {
    corto: "Corto",
    rapado: "Rapado",
    rizado: "Rizado",
    largo: "Largo",
    chongo: "Chongo",
    coleta: "Coleta",
    calvo: "Sin cabello",
  }),
  hairColor: opts(HAIR_COLORS, { negro: "Negro", castano: "Castaño", miel: "Miel", rojizo: "Rojizo", canoso: "Canoso" }, HAIR_HEX),
  headwear: opts(HEADWEAR, { ninguno: "Nada", casco: "Casco", gorra: "Gorra", paliacate: "Paliacate", cofia: "Cofia" }),
  /** For both headwearColor and outfitColor. */
  color: opts(PALETTE_KEYS, COLOR_LABEL, PALETTE),
  facialHair: opts(FACIAL_HAIR, { ninguno: "Nada", bigote: "Bigote", barba: "Barba", candado: "Candado" }),
  glasses: [
    { value: false, label: "Sin lentes" },
    { value: true, label: "Con lentes" },
  ] as AvatarOption<boolean>[],
  outfit: opts(OUTFITS, {
    playera: "Playera",
    camisa: "Camisa",
    chaleco: "Chaleco",
    mandil: "Mandil",
    overol: "Overol",
    filipina: "Filipina",
    uniforme: "Uniforme",
  }),
  expression: opts(EXPRESSIONS, { sonrisa: "Sonrisa", seria: "Seria", guino: "Guiño", emocion: "Emoción" }),
  accessory: opts(ACCESSORIES, { ninguno: "Nada", gafete: "Gafete", radio: "Radio", audifonos: "Audífonos" }),
  pose: opts(POSES, {
    neutral: "Normal",
    saluda: "Saluda",
    festeja: "Festeja",
    pulgar: "Pulgar arriba",
    senala: "Señala",
    "brazos-cruzados": "Brazos cruzados",
  }),
} as const;

/** Default colour when a piece of headwear is first picked in an editor. */
export const HEADWEAR_DEFAULT_COLOR: Record<Headwear, PaletteKey> = {
  ninguno: "sol",
  casco: "sol",
  gorra: "violeta",
  paliacate: "chile",
  cofia: "blanco",
};

/** Default colour when an outfit is first picked in an editor. */
export const OUTFIT_DEFAULT_COLOR: Record<Outfit, PaletteKey> = {
  playera: "cielo",
  camisa: "blanco",
  chaleco: "naranja",
  mandil: "limon",
  overol: "naranja",
  filipina: "blanco",
  uniforme: "denim",
};

/* ── presets ─────────────────────────────────────────────────────────── */

export type AvatarPresetId = CategoryId | "chambas";
export type AvatarPreset = { label: string; config: AvatarConfig };

const look = (c: Omit<AvatarConfig, "v">): AvatarConfig => ({ v: 1, ...c });

/** Named worker looks: one per job category + "chambas" (the app mascot look). Inclusive on purpose. */
export const AVATAR_PRESETS: Record<AvatarPresetId, AvatarPreset> = {
  chambas: {
    label: "El Chambas",
    config: look({
      skin: "tono-4",
      hair: "corto",
      hairColor: "negro",
      headwear: "casco",
      headwearColor: "sol",
      facialHair: "ninguno",
      glasses: false,
      outfit: "overol",
      outfitColor: "naranja",
      expression: "sonrisa",
      accessory: "ninguno",
    }),
  },
  construccion: {
    label: "Construcción",
    config: look({
      skin: "tono-6",
      hair: "coleta",
      hairColor: "negro",
      headwear: "casco",
      headwearColor: "sol",
      facialHair: "ninguno",
      glasses: false,
      outfit: "chaleco",
      outfitColor: "naranja",
      expression: "sonrisa",
      accessory: "radio",
    }),
  },
  chofer: {
    label: "Chofer",
    config: look({
      skin: "tono-2",
      hair: "corto",
      hairColor: "negro",
      headwear: "gorra",
      headwearColor: "violeta",
      facialHair: "bigote",
      glasses: false,
      outfit: "camisa",
      outfitColor: "cielo",
      expression: "sonrisa",
      accessory: "ninguno",
    }),
  },
  restaurante: {
    label: "Restaurante",
    config: look({
      skin: "tono-3",
      hair: "largo",
      hairColor: "castano",
      headwear: "paliacate",
      headwearColor: "chile",
      facialHair: "ninguno",
      glasses: false,
      outfit: "filipina",
      outfitColor: "blanco",
      expression: "guino",
      accessory: "ninguno",
    }),
  },
  limpieza: {
    label: "Limpieza",
    config: look({
      skin: "tono-5",
      hair: "rizado",
      hairColor: "negro",
      headwear: "ninguno",
      headwearColor: "menta",
      facialHair: "candado",
      glasses: false,
      outfit: "uniforme",
      outfitColor: "menta",
      expression: "sonrisa",
      accessory: "gafete",
    }),
  },
  seguridad: {
    label: "Seguridad",
    config: look({
      skin: "tono-1",
      hair: "coleta",
      hairColor: "castano",
      headwear: "gorra",
      headwearColor: "tinta",
      facialHair: "ninguno",
      glasses: false,
      outfit: "uniforme",
      outfitColor: "tinta",
      expression: "seria",
      accessory: "radio",
    }),
  },
  almacen: {
    label: "Almacén",
    config: look({
      skin: "tono-4",
      hair: "rapado",
      hairColor: "negro",
      headwear: "ninguno",
      headwearColor: "sol",
      facialHair: "barba",
      glasses: false,
      outfit: "chaleco",
      outfitColor: "limon",
      expression: "sonrisa",
      accessory: "gafete",
    }),
  },
  montacargas: {
    label: "Montacargas",
    config: look({
      skin: "tono-2",
      hair: "coleta",
      hairColor: "rojizo",
      headwear: "casco",
      headwearColor: "blanco",
      facialHair: "ninguno",
      glasses: false,
      outfit: "overol",
      outfitColor: "cielo",
      expression: "guino",
      accessory: "ninguno",
    }),
  },
  produccion: {
    label: "Producción",
    config: look({
      skin: "tono-6",
      hair: "rapado",
      hairColor: "negro",
      headwear: "cofia",
      headwearColor: "blanco",
      facialHair: "bigote",
      glasses: true,
      outfit: "uniforme",
      outfitColor: "cielo",
      expression: "sonrisa",
      accessory: "gafete",
    }),
  },
  caja: {
    label: "Caja",
    config: look({
      skin: "tono-5",
      hair: "largo",
      hairColor: "negro",
      headwear: "ninguno",
      headwearColor: "chile",
      facialHair: "ninguno",
      glasses: false,
      outfit: "playera",
      outfitColor: "chile",
      expression: "sonrisa",
      accessory: "gafete",
    }),
  },
  ventas: {
    label: "Ventas",
    config: look({
      skin: "tono-1",
      hair: "corto",
      hairColor: "castano",
      headwear: "ninguno",
      headwearColor: "violeta",
      facialHair: "ninguno",
      glasses: true,
      outfit: "camisa",
      outfitColor: "blanco",
      expression: "guino",
      accessory: "gafete",
    }),
  },
  oficina: {
    label: "Oficina",
    config: look({
      skin: "tono-3",
      hair: "largo",
      hairColor: "castano",
      headwear: "ninguno",
      headwearColor: "violeta",
      facialHair: "ninguno",
      glasses: false,
      outfit: "camisa",
      outfitColor: "violeta",
      expression: "sonrisa",
      accessory: "audifonos",
    }),
  },
  mantenimiento: {
    label: "Mantenimiento",
    config: look({
      skin: "tono-4",
      hair: "corto",
      hairColor: "canoso",
      headwear: "gorra",
      headwearColor: "naranja",
      facialHair: "bigote",
      glasses: false,
      outfit: "uniforme",
      outfitColor: "denim",
      expression: "sonrisa",
      accessory: "ninguno",
    }),
  },
};

export const AVATAR_PRESET_IDS = Object.keys(AVATAR_PRESETS) as AvatarPresetId[];

/** The mascot look; also the fallback for anything unreadable. */
export const DEFAULT_AVATAR: AvatarConfig = AVATAR_PRESETS.chambas.config;

/* ── sanitize (DB / form input → safe config) ────────────────────────── */

const pick = <T extends string>(allowed: readonly T[], v: unknown, fallback: T): T =>
  typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;

/**
 * Coerce untrusted input (a jsonb value, a parsed form, `null`) into a valid AvatarConfig.
 * Unknown keys are dropped, unknown values fall back to the default look field by field.
 */
export function sanitizeAvatar(input: unknown, fallback: AvatarConfig = DEFAULT_AVATAR): AvatarConfig {
  let raw: unknown = input;
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      raw = null;
    }
  }
  const o = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  return {
    v: 1,
    skin: pick(SKIN_TONES, o.skin, fallback.skin),
    hair: pick(HAIR_STYLES, o.hair, fallback.hair),
    hairColor: pick(HAIR_COLORS, o.hairColor, fallback.hairColor),
    headwear: pick(HEADWEAR, o.headwear, fallback.headwear),
    headwearColor: pick(PALETTE_KEYS, o.headwearColor, fallback.headwearColor),
    facialHair: pick(FACIAL_HAIR, o.facialHair, fallback.facialHair),
    glasses: typeof o.glasses === "boolean" ? o.glasses : fallback.glasses,
    outfit: pick(OUTFITS, o.outfit, fallback.outfit),
    outfitColor: pick(PALETTE_KEYS, o.outfitColor, fallback.outfitColor),
    expression: pick(EXPRESSIONS, o.expression, fallback.expression),
    accessory: pick(ACCESSORIES, o.accessory, fallback.accessory),
  };
}

/** True when two configs draw the same avatar. */
export function sameAvatar(a: AvatarConfig, b: AvatarConfig): boolean {
  return (Object.keys(DEFAULT_AVATAR) as (keyof AvatarConfig)[]).every((k) => a[k] === b[k]);
}

/* ── deterministic random looks ──────────────────────────────────────── */

/** xmur3 string hash → 32-bit seed. */
function hashSeed(s: string) {
  let h = 1779033703 ^ s.length;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^= h >>> 16) >>> 0;
}

/** mulberry32 PRNG. */
function rng(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function weighted<T>(r: number, table: readonly (readonly [T, number])[]): T {
  const total = table.reduce((s, [, w]) => s + w, 0);
  let x = r * total;
  for (const [v, w] of table) {
    if ((x -= w) < 0) return v;
  }
  return table[table.length - 1][0];
}

const WORK_COLORS: PaletteKey[] = ["sol", "naranja", "chile", "violeta", "limon", "denim", "cielo", "menta", "concreto", "blanco", "tinta"];

/**
 * A deterministic look for a seed (user id, applicant name…). Same seed → same avatar, on the
 * server and the client. The spread is deliberately inclusive: every skin tone equally likely,
 * long / tied-up and short hair about half and half, facial hair on ~1 in 3 short-haired looks.
 */
export function randomAvatar(seed: string): AvatarConfig {
  const r = rng(hashSeed(seed || "chambarrio"));
  const skin = SKIN_TONES[Math.floor(r() * SKIN_TONES.length)];
  const hair = weighted(r(), [
    ["corto", 3],
    ["rapado", 2],
    ["rizado", 2.5],
    ["largo", 3],
    ["chongo", 2.5],
    ["coleta", 2.5],
    ["calvo", 1],
  ] as const);
  const hairColor = weighted(r(), [
    ["negro", 6],
    ["castano", 4],
    ["miel", 1.4],
    ["rojizo", 0.8],
    ["canoso", 1.2],
  ] as const);
  const shortHair = hair === "corto" || hair === "rapado" || hair === "calvo" || hair === "rizado";
  const facialHair: FacialHair =
    shortHair && r() < 0.36 ? weighted(r(), [["bigote", 2], ["barba", 1.5], ["candado", 1.2]] as const) : "ninguno";
  const headwear = weighted(r(), [
    ["ninguno", 5],
    ["casco", 2],
    ["gorra", 2],
    ["paliacate", 1],
    ["cofia", 0.8],
  ] as const);
  const outfit = OUTFITS[Math.floor(r() * OUTFITS.length)];
  let outfitColor = WORK_COLORS[Math.floor(r() * WORK_COLORS.length)];
  if (outfit === "chaleco") outfitColor = r() < 0.5 ? "naranja" : "limon";
  if (outfit === "filipina" && r() < 0.6) outfitColor = "blanco";
  let headwearColor: PaletteKey =
    headwear === "cofia" ? "blanco" : headwear === "casco" ? (r() < 0.6 ? "sol" : "blanco") : WORK_COLORS[Math.floor(r() * WORK_COLORS.length)];
  if (headwearColor === outfitColor && headwear !== "cofia") headwearColor = outfitColor === "sol" ? "violeta" : "sol";
  return {
    v: 1,
    skin,
    hair,
    hairColor,
    headwear,
    headwearColor,
    facialHair,
    glasses: r() < 0.2,
    outfit,
    outfitColor,
    expression: weighted(r(), [["sonrisa", 5], ["guino", 1.5], ["emocion", 1.5], ["seria", 1.5]] as const),
    accessory: weighted(r(), [["ninguno", 6], ["gafete", 1.5], ["radio", 1], ["audifonos", 1]] as const),
  };
}

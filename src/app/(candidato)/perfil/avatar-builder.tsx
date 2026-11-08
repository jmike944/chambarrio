"use client";

import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { motion } from "motion/react";
import { toast } from "sonner";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import {
  DiceFaces03Icon,
  DropletIcon,
  EyeIcon,
  HatIcon,
  IdCardLanyardIcon,
  InformationCircleIcon,
  PartyIcon,
  ScissorIcon,
  SmileIcon,
  ThumbsUpIcon,
  Tick02Icon,
  TShirtIcon,
  UserEdit01Icon,
  WavingHand01Icon,
} from "@hugeicons/core-free-icons";
import {
  Avatar,
  AVATAR_PRESETS,
  AVATAR_VIEWBOX,
  avatarCircleBg,
  HAIR_HEX,
  HEADWEAR_DEFAULT_COLOR,
  OPTIONS,
  OUTFIT_DEFAULT_COLOR,
  PALETTE,
  randomAvatar,
  sameAvatar,
  type AvatarConfig,
  type AvatarOption,
  type AvatarPose,
  type AvatarPresetId,
  type Outfit,
} from "@/components/avatar";
import type { BlockTone } from "@/components/chamba/primitives";
import { springs, useConfetti } from "@/components/chamba/motion";
import { CategoryIcon } from "@/components/chamba/job-icons";
import type { CategoryId } from "@/lib/data/types";
import { useApp, useMyAvatar } from "@/lib/store";
import { cn } from "@/lib/utils";
import { HARD_SM } from "../postulaciones/rugged";
import { Block, INK_BTN, SUBLABEL, WHITE_BTN } from "./ui";

/*
 * "Crea tu avatar" (/perfil): a live preview (pose switcher) + tabbed pickers whose thumbnails are the
 * user's own avatar with that option applied. Edits stay a local draft until "Guardar"; the store
 * writes it through (live: profiles.avatar_config). Every picker is a radio group (arrow keys move and
 * select, one tab stop per group); the tabs follow the ARIA tabs pattern.
 */

/** Rugged confetti: safety yellow, lime, orange, sky, white (no pink). */
const WORK_CONFETTI = ["#FFC93C", "#DDF78A", "#FF6B2C", "#5CC3FF", "#FFFFFF"];

type TabId = "piel" | "cabello" | "cabeza" | "cara" | "ropa" | "extra";
const TABS: { id: TabId; label: string; icon: IconSvgElement }[] = [
  { id: "piel", label: "Piel", icon: DropletIcon },
  { id: "cabello", label: "Cabello", icon: ScissorIcon },
  { id: "cabeza", label: "Cabeza", icon: HatIcon },
  { id: "cara", label: "Cara", icon: SmileIcon },
  { id: "ropa", label: "Ropa", icon: TShirtIcon },
  { id: "extra", label: "Extra", icon: IdCardLanyardIcon },
];

type PreviewPose = Extract<AvatarPose, "saluda" | "festeja" | "pulgar">;
const POSE_CHOICES: { value: PreviewPose; label: string; short: string; icon: IconSvgElement }[] = [
  { value: "saluda", label: "Saluda", short: "Saluda", icon: WavingHand01Icon },
  { value: "festeja", label: "Festeja", short: "Festeja", icon: PartyIcon },
  { value: "pulgar", label: "Pulgar arriba", short: "Pulgar", icon: ThumbsUpIcon },
];

/** The work gear a "chamba" preset brings (identity traits — skin, hair, face — stay the user's). */
const GEAR = ["headwear", "headwearColor", "outfit", "outfitColor", "accessory"] as const satisfies (keyof AvatarConfig)[];
const gearOf = (id: AvatarPresetId) => Object.fromEntries(GEAR.map((k) => [k, AVATAR_PRESETS[id].config[k]])) as Pick<AvatarConfig, (typeof GEAR)[number]>;
const sameGear = (a: AvatarConfig, id: AvatarPresetId) => GEAR.every((k) => a[k] === AVATAR_PRESETS[id].config[k]);

/** The two shortcut buttons under the preview: icon chip + title + one-line hint. */
const HELPER = "h-auto min-h-14 justify-start gap-2 px-2 py-1.5 text-left leading-tight";

const COLOR_HINT: Record<Outfit, string> = {
  playera: "Color de la playera",
  camisa: "Color de la camisa",
  chaleco: "Color del chaleco",
  mandil: "Color del mandil",
  overol: "Color de la camisa (el overol es de mezclilla)",
  filipina: "Color de la filipina",
  uniforme: "Color del uniforme",
};

/** Relative luminance of a #RRGGBB colour (0 dark … 1 light), for the check mark on a swatch. */
function luma(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

export function AvatarBuilder({ tone = "durazno", index }: { tone?: BlockTone; index: number }) {
  const saved = useMyAvatar();
  const everSaved = useApp((s) => s.avatarSaved);
  const localOnly = useApp((s) => s.mode === "live" && s.avatarLocalOnly);
  const interests = useApp((s) => s.interests);
  const firstName = useApp((s) => s.name.trim().split(/\s+/)[0] || "");
  const setAvatarConfig = useApp((s) => s.setAvatarConfig);

  const [draft, setDraft] = useState<AvatarConfig | null>(null);
  const [tab, setTab] = useState<TabId>("piel");
  const [pose, setPose] = useState<PreviewPose>("saluda");
  const [chambaTurn, setChambaTurn] = useState(0);
  const [announce, setAnnounce] = useState("");
  const [rolls, setRolls] = useState(0);
  const fire = useConfetti();

  const cfg = draft ?? saved;
  const dirty = draft !== null && !sameAvatar(draft, saved);
  const edit = (patch: Partial<AvatarConfig>) => setDraft({ ...cfg, ...patch });

  /* ---- "Usar el de mi chamba": the next interest (in order) whose gear isn't already on */
  const mine = interests.filter((id): id is CategoryId => id in AVATAR_PRESETS);
  const chambas: AvatarPresetId[] = mine.length ? mine : ["chambas"];
  const nextChamba = (() => {
    for (let i = 0; i < chambas.length; i++) {
      const id = chambas[(chambaTurn + i) % chambas.length];
      if (!sameGear(cfg, id)) return { id, turn: chambaTurn + i };
    }
    return { id: chambas[chambaTurn % chambas.length], turn: chambaTurn };
  })();
  const chambaLabel = AVATAR_PRESETS[nextChamba.id].label;

  function applyChamba() {
    edit(gearOf(nextChamba.id));
    setChambaTurn(nextChamba.turn + 1);
    setAnnounce(`Listo: ropa de ${chambaLabel}.`);
  }

  function surprise() {
    setDraft(randomAvatar(`${Date.now().toString(36)}:${Math.random().toString(36).slice(2)}`));
    setRolls((n) => n + 1);
    setAnnounce("Listo: un avatar nuevo al azar.");
  }

  async function save(e: React.MouseEvent<HTMLButtonElement>) {
    const first = !everSaved;
    const next = cfg;
    // The bar may unmount once saved: aim the confetti now.
    const r = e.currentTarget.getBoundingClientRect();
    // Optimistic: the store shows it right away. Live: if the server says no, the store rolls back and
    // toasts; the draft comes back so nothing they picked is lost.
    setDraft(null);
    const res = await setAvatarConfig(next);
    if (res.error) {
      setDraft(next);
      return;
    }
    if (first) {
      fire({ x: r.left + r.width / 2, y: r.top + r.height / 2, colors: WORK_CONFETTI, count: 56 });
      toast.success("¡Quedó tu avatar!", { description: "Así te presentas con las empresas cuando te postulas." });
    } else toast.success("Avatar guardado.");
  }

  function cancel() {
    setDraft(null);
    setAnnounce("Cambios descartados.");
  }

  // While editing, the "Sin guardar" chip sits on the preview instead.
  const badge = dirty ? null : everSaved ? (
    <span className="inline-flex h-7 items-center gap-1 rounded-full bg-ink px-2.5 text-[0.75rem] font-bold text-limon">
      <HugeiconsIcon icon={Tick02Icon} className="size-3.5" strokeWidth={3} />
      Guardado
    </span>
  ) : (
    <span className={cn("inline-flex h-7 rotate-3 items-center rounded-full bg-limon px-2.5 text-[0.75rem] font-extrabold tracking-[0.06em] text-ink uppercase", HARD_SM)}>
      Nuevo
    </span>
  );

  return (
    <Block
      id="avatar"
      tone={tone}
      index={index}
      icon={UserEdit01Icon}
      title="Crea tu avatar"
      why="Es tu cara en Chambarrio. Ármalo a tu modo: piel, cabello, casco, ropa de trabajo…"
      badge={badge}
      className="@container/avb"
    >
      {/* Wide: preview column | pickers column, same height (the pickers scroll inside); narrow: stacked. */}
      <div className="grid gap-5 @lg/avb:grid-cols-[minmax(0,16rem)_minmax(0,1fr)]">
        {/* ------------------------------------------------ preview */}
        <div className="min-w-0">
          <Stage config={cfg} pose={pose} onPose={setPose} name={firstName} dirty={dirty} />
          <div className="mt-3 grid grid-cols-2 gap-2 @lg/avb:grid-cols-1">
            <button type="button" onClick={surprise} className={cn(WHITE_BTN, HELPER)}>
              <motion.span
                key={rolls}
                aria-hidden
                className="grid size-8 shrink-0 place-items-center rounded-lg bg-block-sol"
                initial={rolls ? { rotate: -200, scale: 0.6 } : false}
                animate={{ rotate: 0, scale: 1 }}
                transition={springs.bouncy}
              >
                <HugeiconsIcon icon={DiceFaces03Icon} className="size-5" strokeWidth={2} />
              </motion.span>
              <span className="min-w-0">
                <span className="block text-[0.85rem]">Sorpréndeme</span>
                <span className="block truncate text-[0.72rem] font-medium opacity-70">Uno al azar</span>
              </span>
            </button>
            <button
              type="button"
              onClick={applyChamba}
              aria-label={`Usar el de mi chamba: ropa de ${chambaLabel}`}
              className={cn(WHITE_BTN, HELPER)}
            >
              {nextChamba.id === "chambas" ? (
                <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-lg bg-block-sol">
                  <HugeiconsIcon icon={HatIcon} className="size-5" strokeWidth={2} />
                </span>
              ) : (
                <CategoryIcon category={nextChamba.id as CategoryId} size="xs" className="shrink-0" />
              )}
              <span className="min-w-0">
                <span className="block text-[0.85rem]">Usar el de mi chamba</span>
                <span className="block truncate text-[0.72rem] font-medium opacity-70">{chambaLabel}</span>
              </span>
            </button>
          </div>
        </div>

        {/* ------------------------------------------------ pickers */}
        <div className="min-w-0 @lg/avb:relative">
          <div className="@container flex min-w-0 flex-col @lg/avb:absolute @lg/avb:inset-0">
            <Tabs value={tab} onChange={setTab} />
            <div
              id="avb-panel"
              role="tabpanel"
              aria-labelledby={`avb-tab-${tab}`}
              className="mt-3 space-y-5 rounded-tile border-2 border-ink/15 bg-white/45 p-3.5 sm:p-4 @lg/avb:min-h-0 @lg/avb:flex-1 @lg/avb:overflow-y-auto @lg/avb:overscroll-contain"
            >
              <Panel tab={tab} cfg={cfg} edit={edit} />
            </div>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------ privacy + save / cancel (sticks above the nav while editing) */}
      {/* narrow: `contents`, so the bar's sticky box is the whole section (it floats while you pick) */}
      <div className="contents @lg/avb:mt-4 @lg/avb:grid @lg/avb:grid-cols-[minmax(0,1fr)_auto] @lg/avb:items-center @lg/avb:gap-3">
          <p className="mt-4 flex items-start gap-2.5 @lg/avb:mt-0 rounded-tile border-2 border-dashed border-ink/35 bg-white/45 p-3 text-[0.9rem] leading-snug font-semibold">
            <HugeiconsIcon icon={EyeIcon} className="mt-0.5 size-5 shrink-0" strokeWidth={2.2} />
            <span>
              Las empresas ven tu avatar desde que te postulas; tu foto, cuando avanzan con tu postulación.
              {localOnly ? (
                <span className="mt-1 flex items-start gap-1.5 text-[0.82rem] font-normal text-muted-foreground">
                  <HugeiconsIcon icon={InformationCircleIcon} className="mt-px size-4 shrink-0" strokeWidth={2} />
                  Por ahora se guarda en este teléfono. Lo subimos a tu cuenta en cuanto se pueda.
                </span>
              ) : null}
            </span>
          </p>

          {dirty || !everSaved ? (
            <div className="sticky bottom-24 z-10 mt-3 lg:bottom-4 @lg/avb:mt-0">
              <div className={cn("flex items-center gap-2 rounded-full bg-white p-1.5 @lg/avb:min-w-[15rem]", HARD_SM)}>
                {/* narrow: the preview may be scrolled away, so the bar carries a mini of the draft */}
                <span
                  aria-hidden
                  className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-full border-2 border-ink @lg/avb:hidden"
                  style={{ background: avatarCircleBg(cfg) }}
                >
                  <Thumb config={cfg} crop="extra" size={40} />
                </span>
                {dirty ? (
                  <button type="button" onClick={cancel} className={cn(WHITE_BTN, "border-ink/25 px-3.5")}>
                    Cancelar
                  </button>
                ) : null}
                <button type="button" onClick={save} className={cn(INK_BTN, "flex-1 px-4 whitespace-nowrap")}>
                  <HugeiconsIcon icon={Tick02Icon} className="size-5 text-limon" strokeWidth={2.6} />
                  {dirty ? "Guardar" : "Guardar mi avatar"}
                </button>
              </div>
            </div>
          ) : null}
      </div>
      <p className="sr-only" aria-live="polite">
        {announce}
      </p>
    </Block>
  );
}

// ------------------------------------------------------------------ preview stage

function Stage({
  config,
  pose,
  onPose,
  name,
  dirty,
}: {
  config: AvatarConfig;
  pose: PreviewPose;
  onPose: (p: PreviewPose) => void;
  name: string;
  dirty: boolean;
}) {
  const bg = avatarCircleBg(config);
  return (
    <div className="relative">
      <figure
        className="relative h-[17.5rem] overflow-hidden rounded-[1.4rem] border-[2.5px] border-ink transition-colors duration-300 @lg/avb:h-[18rem]"
        style={{ background: bg }}
      >
        <span aria-hidden className="absolute inset-0 bg-dots text-ink" />
        <span aria-hidden className="absolute top-7 left-[42%] size-56 -translate-x-1/2 rounded-full bg-white/45 @lg/avb:left-1/2" />
        <motion.span
          key={`${pose}`}
          className="absolute bottom-0 left-[42%] block w-[13.75rem] -translate-x-1/2 @lg/avb:left-1/2 @lg/avb:w-[13.5rem]"
          initial={{ y: 10, scale: 0.97 }}
          animate={{ y: 0, scale: 1 }}
          transition={springs.bouncy}
        >
          <Avatar config={config} pose={pose} framing="medio" size={232} className="block h-auto w-full" title="Vista previa de tu avatar" />
        </motion.span>
        {name ? (
          <figcaption className="absolute right-3 bottom-3 max-w-[40%] truncate rounded-lg bg-ink px-2.5 py-1 text-[0.78rem] font-extrabold tracking-[0.08em] text-white uppercase">
            {name}
          </figcaption>
        ) : null}
        {dirty ? (
          <span className="absolute right-3 bottom-12 inline-flex h-7 -rotate-3 animate-pop-in items-center gap-1.5 rounded-full border-2 border-ink bg-white px-2.5 text-[0.75rem] font-bold text-ink">
            <span aria-hidden className="size-2 rounded-full bg-chile" />
            Sin guardar
          </span>
        ) : null}
      </figure>
      {/* pose switcher: three round buttons on the stage's right edge (narrow) / a row of pills under it (wide) */}
      <RadioGroup
        label="Pose de la vista previa"
        options={POSE_CHOICES}
        value={pose}
        onChange={onPose}
        className="absolute top-3 right-3 flex flex-col gap-2 @lg/avb:static @lg/avb:mt-3 @lg/avb:grid @lg/avb:grid-cols-3 @lg/avb:gap-1.5"
        renderItem={(o, on) => (
          <span
            title={o.label}
            className={cn(
              "grid size-11 place-items-center rounded-full border-2 border-ink transition-colors @lg/avb:flex @lg/avb:w-full @lg/avb:justify-center @lg/avb:gap-1",
              on ? "bg-ink text-white shadow-[2px_2px_0_0_var(--ink)]" : "bg-white text-ink hover:bg-white/80",
            )}
          >
            <HugeiconsIcon icon={o.icon} className={cn("size-5 shrink-0 @lg/avb:size-4", on && "text-limon")} strokeWidth={2} />
            <span className="sr-only text-[0.78rem] font-semibold @lg/avb:not-sr-only">{o.short}</span>
          </span>
        )}
        itemClassName="rounded-full"
      />
    </div>
  );
}

// ------------------------------------------------------------------ tabs

function Tabs({ value, onChange }: { value: TabId; onChange: (t: TabId) => void }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  function onKey(e: KeyboardEvent, i: number) {
    const n = TABS.length;
    const next =
      e.key === "ArrowRight" ? (i + 1) % n : e.key === "ArrowLeft" ? (i - 1 + n) % n : e.key === "Home" ? 0 : e.key === "End" ? n - 1 : -1;
    if (next < 0) return;
    e.preventDefault();
    onChange(TABS[next].id);
    refs.current[next]?.focus();
  }
  return (
    <div role="tablist" aria-label="Partes de tu avatar" className="grid grid-cols-3 gap-2 @md:grid-cols-6">
      {TABS.map((t, i) => {
        const on = value === t.id;
        return (
          <button
            key={t.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            id={`avb-tab-${t.id}`}
            type="button"
            role="tab"
            aria-selected={on}
            aria-controls="avb-panel"
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(t.id)}
            onKeyDown={(e) => onKey(e, i)}
            className={cn(
              "press flex min-h-12 items-center justify-center gap-1.5 rounded-2xl px-2 text-[0.9rem] font-semibold outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ink/60 @md:flex-col @md:gap-0.5 @md:py-1.5 @md:text-[0.8rem]",
              on ? cn("bg-ink text-white", HARD_SM) : "border-2 border-ink/25 bg-white/55 text-ink hover:bg-white/80",
            )}
          >
            <HugeiconsIcon icon={t.icon} className={cn("size-[1.15rem] shrink-0", on && "text-limon")} strokeWidth={2} />
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

// ------------------------------------------------------------------ panels

function Panel({ tab, cfg, edit }: { tab: TabId; cfg: AvatarConfig; edit: (p: Partial<AvatarConfig>) => void }) {
  switch (tab) {
    case "piel":
      return (
        <Group id="avb-skin" label="Tono de piel" current={labelOf(OPTIONS.skin, cfg.skin)}>
          <ThumbGrid
            label="Tono de piel"
            options={OPTIONS.skin}
            value={cfg.skin}
            onChange={(skin) => edit({ skin })}
            current={cfg}
            variant={(skin) => ({ ...cfg, skin })}
            crop="cara"
          />
        </Group>
      );
    case "cabello":
      return (
        <>
          <Group id="avb-hair" label="Estilo" current={labelOf(OPTIONS.hair, cfg.hair)}>
            {cfg.headwear !== "ninguno" ? (
              <p className="-mt-1 mb-2 text-[0.82rem] leading-snug text-muted-foreground">Lo mostramos sin {labelOf(OPTIONS.headwear, cfg.headwear).toLowerCase()} para que lo veas bien.</p>
            ) : null}
            <ThumbGrid
              label="Estilo de cabello"
              options={OPTIONS.hair}
              value={cfg.hair}
              onChange={(hair) => edit({ hair })}
              current={cfg}
              variant={(hair) => ({ ...cfg, hair, headwear: "ninguno" })}
            />
          </Group>
          <Group id="avb-haircolor" label="Color" current={labelOf(OPTIONS.hairColor, cfg.hairColor)}>
            <SwatchGrid label="Color de cabello" options={OPTIONS.hairColor} hex={(v) => HAIR_HEX[v]} value={cfg.hairColor} onChange={(hairColor) => edit({ hairColor })} />
          </Group>
        </>
      );
    case "cabeza":
      return (
        <>
          <Group id="avb-hat" label="En la cabeza" current={labelOf(OPTIONS.headwear, cfg.headwear)}>
            <ThumbGrid
              label="Qué llevas en la cabeza"
              options={OPTIONS.headwear}
              value={cfg.headwear}
              onChange={(headwear) =>
                edit({ headwear, headwearColor: headwear === cfg.headwear ? cfg.headwearColor : HEADWEAR_DEFAULT_COLOR[headwear] })
              }
              current={cfg}
              variant={(headwear) => ({
                ...cfg,
                headwear,
                headwearColor: headwear === cfg.headwear ? cfg.headwearColor : HEADWEAR_DEFAULT_COLOR[headwear],
              })}
            />
          </Group>
          {cfg.headwear !== "ninguno" ? (
            <Group id="avb-hatcolor" label="Color" current={labelOf(OPTIONS.color, cfg.headwearColor)}>
              <SwatchGrid
                label={`Color de ${labelOf(OPTIONS.headwear, cfg.headwear).toLowerCase()}`}
                options={OPTIONS.color}
                hex={(v) => PALETTE[v]}
                value={cfg.headwearColor}
                onChange={(headwearColor) => edit({ headwearColor })}
              />
            </Group>
          ) : null}
        </>
      );
    case "cara":
      return (
        <>
          <Group id="avb-expr" label="Expresión" current={labelOf(OPTIONS.expression, cfg.expression)}>
            <ThumbGrid
              label="Expresión"
              options={OPTIONS.expression}
              value={cfg.expression}
              onChange={(expression) => edit({ expression })}
              current={cfg}
              variant={(expression) => ({ ...cfg, expression })}
              crop="cara"
            />
          </Group>
          <Group id="avb-facial" label="Vello facial" current={labelOf(OPTIONS.facialHair, cfg.facialHair)}>
            <ThumbGrid
              label="Vello facial"
              options={OPTIONS.facialHair}
              value={cfg.facialHair}
              onChange={(facialHair) => edit({ facialHair })}
              current={cfg}
              variant={(facialHair) => ({ ...cfg, facialHair })}
              crop="cara"
            />
          </Group>
          <Group id="avb-glasses" label="Lentes" current={cfg.glasses ? "Con lentes" : "Sin lentes"}>
            <ThumbGrid
              label="Lentes"
              options={OPTIONS.glasses}
              value={cfg.glasses}
              onChange={(glasses) => edit({ glasses })}
              current={cfg}
              variant={(glasses) => ({ ...cfg, glasses })}
              crop="cara"
            />
          </Group>
        </>
      );
    case "ropa":
      return (
        <>
          <Group id="avb-outfit" label="Prenda" current={labelOf(OPTIONS.outfit, cfg.outfit)}>
            <ThumbGrid
              label="Prenda"
              options={OPTIONS.outfit}
              value={cfg.outfit}
              onChange={(outfit) => edit({ outfit, outfitColor: outfit === cfg.outfit ? cfg.outfitColor : OUTFIT_DEFAULT_COLOR[outfit] })}
              current={cfg}
              variant={(outfit) => ({ ...cfg, outfit, outfitColor: outfit === cfg.outfit ? cfg.outfitColor : OUTFIT_DEFAULT_COLOR[outfit] })}
              crop="ropa"
            />
          </Group>
          <Group id="avb-outfitcolor" label={COLOR_HINT[cfg.outfit]} current={labelOf(OPTIONS.color, cfg.outfitColor)}>
            <SwatchGrid label={COLOR_HINT[cfg.outfit]} options={OPTIONS.color} hex={(v) => PALETTE[v]} value={cfg.outfitColor} onChange={(outfitColor) => edit({ outfitColor })} />
          </Group>
          <Group id="avb-build" label="Complexión" current={labelOf(OPTIONS.complexion, cfg.complexion ?? "recta")}>
            <ThumbGrid
              label="Complexión"
              options={OPTIONS.complexion}
              value={cfg.complexion ?? "recta"}
              onChange={(complexion) => edit({ complexion })}
              current={cfg}
              variant={(complexion) => ({ ...cfg, complexion })}
              crop="cuerpo"
            />
          </Group>
        </>
      );
    case "extra":
      return (
        <Group id="avb-acc" label="Accesorio" current={labelOf(OPTIONS.accessory, cfg.accessory)}>
          <ThumbGrid
            label="Accesorio"
            options={OPTIONS.accessory}
            value={cfg.accessory}
            onChange={(accessory) => edit({ accessory })}
            current={cfg}
            variant={(accessory) => ({ ...cfg, accessory })}
            crop="extra"
          />
        </Group>
      );
  }
}

function labelOf<T>(options: readonly AvatarOption<T>[], value: T) {
  return options.find((o) => o.value === value)?.label ?? "";
}

/** A picker group: an uppercase label (the radio group's name) + the current choice. */
function Group({ id, label, current, children }: { id: string; label: string; current: string; children: ReactNode }) {
  return (
    <div>
      <p id={id} className={cn(SUBLABEL, "flex items-baseline gap-1.5 opacity-100")}>
        <span className="opacity-75">{label}</span>
        <span aria-hidden className="truncate font-bold tracking-normal normal-case opacity-100">
          · {current}
        </span>
      </p>
      {children}
    </div>
  );
}

// ------------------------------------------------------------------ radio groups

/**
 * ARIA radio group: one tab stop (the checked option), arrows / Home / End move and select (the
 * selection follows focus, like native radios). `renderItem` draws the inside of each option.
 */
function RadioGroup<T extends string | boolean, O extends { value: T; label: string }>({
  label,
  options,
  value,
  onChange,
  renderItem,
  className,
  itemClassName,
}: {
  label: string;
  options: readonly O[];
  value: T;
  onChange: (v: T) => void;
  renderItem: (o: O, on: boolean) => ReactNode;
  className?: string;
  itemClassName?: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const active = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );
  function onKey(e: KeyboardEvent, i: number) {
    const n = options.length;
    const next =
      e.key === "ArrowRight" || e.key === "ArrowDown"
        ? (i + 1) % n
        : e.key === "ArrowLeft" || e.key === "ArrowUp"
          ? (i - 1 + n) % n
          : e.key === "Home"
            ? 0
            : e.key === "End"
              ? n - 1
              : -1;
    if (next < 0) return;
    e.preventDefault();
    onChange(options[next].value);
    refs.current[next]?.focus();
  }
  return (
    <div role="radiogroup" aria-label={label} className={className}>
      {options.map((o, i) => {
        const on = o.value === value;
        return (
          <button
            key={String(o.value)}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={o.label}
            tabIndex={i === active ? 0 : -1}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => onKey(e, i)}
            className={cn("press outline-none focus-visible:ring-3 focus-visible:ring-ink/60 focus-visible:ring-offset-2", itemClassName)}
          >
            {renderItem(o, on)}
          </button>
        );
      })}
    </div>
  );
}

type Crop = "busto" | "cara" | "ropa" | "extra" | "cuerpo";

/**
 * Square windows into a framing's view box: [framing, centre y, side] in view-box units (centred on x = 0).
 * cara: the face · ropa: chin to waist (collars, vests, aprons) · extra: hair to chest (headset, badge, radio) ·
 * cuerpo: eyes to hips, shoulder to shoulder (the build).
 */
const CROPS: Record<Exclude<Crop, "busto">, readonly ["busto" | "medio", number, number]> = {
  cara: ["busto", -4, 126],
  ropa: ["medio", 66, 224],
  extra: ["medio", 36, 214],
  // ends at the medio frame's bottom edge (y ≈ 235.6), so the window never runs past the figure
  cuerpo: ["medio", 95, 280],
};

/** The user's own avatar with one option applied (the thumbnail IS the preview). */
function Thumb({ config, crop, size }: { config: AvatarConfig; crop: Crop; size: number }) {
  if (crop === "busto") return <Avatar config={config} framing="busto" size={size} animated={false} className="block" />;
  const [framing, cy, side] = CROPS[crop];
  const [vx, vy, vw] = AVATAR_VIEWBOX[framing];
  const k = size / side; // px per view-box unit
  return (
    <span className="relative block overflow-hidden" style={{ width: size, height: size }}>
      <Avatar
        config={config}
        framing={framing}
        size={Math.round(vw * k)}
        animated={false}
        className="absolute block max-w-none"
        style={{ left: Math.round((vx + side / 2) * k), top: Math.round((vy - (cy - side / 2)) * k) }}
      />
    </span>
  );
}

function ThumbGrid<T extends string | boolean>({
  label,
  options,
  value,
  onChange,
  variant,
  crop = "busto",
  current,
}: {
  label: string;
  options: readonly AvatarOption<T>[];
  value: T;
  onChange: (v: T) => void;
  variant: (v: T) => AvatarConfig;
  crop?: Crop;
  /** The draft: every thumbnail sits on the same backdrop (the preview's). */
  current: AvatarConfig;
}) {
  const bg = avatarCircleBg(current);
  return (
    <RadioGroup
      label={label}
      options={options}
      value={value}
      onChange={onChange}
      className="grid grid-cols-3 gap-2 @sm:grid-cols-4 @xl:grid-cols-5"
      itemClassName="rounded-tile"
      renderItem={(o, on) => {
        const c = variant(o.value);
        return (
          <span
            className={cn(
              "relative flex flex-col items-center gap-1 rounded-tile px-1 pt-1.5 pb-2 transition-colors",
              on ? cn("bg-white", HARD_SM) : "border-2 border-ink/20 bg-white/50 hover:bg-white/80",
            )}
          >
            <span className="grid size-[4.5rem] place-items-center overflow-hidden rounded-full" style={{ background: bg }}>
              <Thumb config={c} crop={crop} size={72} />
            </span>
            <span className="line-clamp-2 flex min-h-[2lh] items-center text-center text-[0.78rem] leading-[1.1] font-semibold text-ink">{o.label}</span>
            {on ? (
              <span aria-hidden className="absolute -top-2 -right-2 grid size-6 animate-pop-in place-items-center rounded-full border-2 border-ink bg-limon text-ink">
                <HugeiconsIcon icon={Tick02Icon} className="size-3.5" strokeWidth={3} />
              </span>
            ) : null}
          </span>
        );
      }}
    />
  );
}

function SwatchGrid<T extends string>({
  label,
  options,
  hex,
  value,
  onChange,
}: {
  label: string;
  options: readonly AvatarOption<T>[];
  hex: (v: T) => string;
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <RadioGroup
      label={label}
      options={options}
      value={value}
      onChange={onChange}
      className="flex flex-wrap gap-2.5"
      itemClassName="rounded-full"
      renderItem={(o, on) => {
        const h = hex(o.value);
        return (
          <span
            title={o.label}
            className={cn(
              "grid size-11 place-items-center rounded-full border-2 border-ink transition-transform",
              on ? "scale-110 shadow-[2px_2px_0_0_var(--ink),0_0_0_3px_#fff,0_0_0_5px_var(--ink)]" : "hover:scale-105",
            )}
            style={{ background: h }}
          >
            {on ? <HugeiconsIcon icon={Tick02Icon} className={cn("size-5", luma(h) < 0.25 ? "text-white" : "text-ink")} strokeWidth={3} /> : null}
          </span>
        );
      }}
    />
  );
}

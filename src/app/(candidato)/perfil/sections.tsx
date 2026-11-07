"use client";

import { useId, useState } from "react";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import {
  Add01Icon,
  Bicycle01Icon,
  Bus01Icon,
  Car01Icon,
  Clock01Icon,
  LanguageSkillIcon,
  LockIcon,
  Money01Icon,
  Mortarboard01Icon,
  Motorbike01Icon,
  QuoteDownIcon,
  StarIcon,
  WalkingIcon,
} from "@hugeicons/core-free-icons";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PERIOD_LONG } from "@/lib/format";
import { useApp } from "@/lib/store";
import {
  AVAILABILITY_LABEL,
  CERTIFICATION_SUGGESTIONS,
  EDUCATION_LABEL,
  EDUCATION_LEVELS,
  EXPECTED_PERIODS,
  LANGUAGE_SUGGESTIONS,
  PROFILE_LIMITS,
  SHIFT_HINT,
  SHIFTS,
  SKILL_SUGGESTIONS,
  START_AVAILABILITIES,
  STRENGTH_WEIGHTS,
  TRANSPORT_LABEL,
  TRANSPORTS,
  type Transport,
} from "@/lib/profile-strength";
import { cn } from "@/lib/utils";
import {
  AREA,
  Block,
  Counter,
  FIELD,
  LABEL,
  markEdited,
  PointsBadge,
  RemovableChip,
  Segmented,
  SUBLABEL,
  ToggleChip,
  useStrengthInput,
  WHITE_BTN,
} from "./ui";
import { strengthChecks } from "@/lib/profile-strength";
import type { BlockTone } from "@/components/chamba/primitives";

type SectionProps = { tone: BlockTone; index: number };

function useChecks() {
  return strengthChecks(useStrengthInput());
}

// ------------------------------------------------------------------ Presentación

export function PresentationBlock({ tone, index }: SectionProps) {
  const headline = useApp((s) => s.headline);
  const about = useApp((s) => s.about);
  const updateProfile = useApp((s) => s.updateProfile);
  const checks = useChecks();
  const h = headline ?? "";
  const a = about ?? "";
  return (
    <Block
      id="presentacion"
      tone={tone}
      index={index}
      icon={QuoteDownIcon}
      title="Presentación"
      why="Es lo primero que lee la empresa. Una frase clara te separa del montón."
      badge={<PointsBadge parts={[[STRENGTH_WEIGHTS.headline, checks.headline], [STRENGTH_WEIGHTS.about, checks.about]]} />}
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-end justify-between gap-2">
            <Label htmlFor="headline" className={LABEL}>
              Tu frase
            </Label>
            <Counter id="headline-count" value={h.length} max={PROFILE_LIMITS.headlineMax} />
          </div>
          <Input
            id="headline"
            value={h}
            maxLength={PROFILE_LIMITS.headlineMax}
            placeholder="Ej. Montacarguista con 5 años en CEDIS"
            aria-describedby="headline-count headline-hint"
            onChange={(e) => {
              markEdited();
              void updateProfile({ headline: e.target.value || null });
            }}
            className={FIELD}
          />
          <p id="headline-hint" className="text-[0.85rem] text-muted-foreground">
            Puesto + experiencia o tu mejor fuerte.{" "}
            {h.trim().length > 0 && h.trim().length < PROFILE_LIMITS.headlineMin ? (
              <strong className="font-semibold text-foreground">Escribe al menos {PROFILE_LIMITS.headlineMin} letras para que cuente.</strong>
            ) : null}
          </p>
        </div>
        <div className="space-y-2">
          <div className="flex items-end justify-between gap-2">
            <Label htmlFor="about" className={LABEL}>
              Sobre mí
            </Label>
            <Counter id="about-count" value={a.length} max={PROFILE_LIMITS.aboutMax} />
          </div>
          <Textarea
            id="about"
            value={a}
            maxLength={PROFILE_LIMITS.aboutMax}
            rows={4}
            placeholder="Dos o tres líneas: qué sabes hacer, qué buscas y en qué zona."
            aria-describedby="about-count about-hint"
            onChange={(e) => {
              markEdited();
              void updateProfile({ about: e.target.value || null });
            }}
            className={AREA}
          />
          <p id="about-hint" className="text-[0.85rem] text-muted-foreground">
            {a.trim().length > 0 && a.trim().length < PROFILE_LIMITS.aboutMin
              ? `Un poquito más: cuenta a partir de ${PROFILE_LIMITS.aboutMin} letras.`
              : "Sin datos personales: tu teléfono y nombre se comparten aparte."}
          </p>
        </div>
      </div>
    </Block>
  );
}

// ------------------------------------------------------------------ chip input

/** Suggestions visible before "+N más" (all of them while typing). */
const SUGGESTIONS_SHOWN = 5;

function ChipInput({
  id,
  label,
  values,
  onChange,
  suggestions,
  max,
  cert = false,
  placeholder,
}: {
  id: string;
  label: string;
  values: string[];
  onChange: (next: string[]) => void;
  suggestions: readonly string[];
  max: number;
  cert?: boolean;
  placeholder: string;
}) {
  const [draft, setDraft] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [allSuggestions, setAllSuggestions] = useState(false);
  const hintId = useId();
  const has = (v: string) => values.some((x) => x.toLowerCase() === v.toLowerCase());
  const full = values.length >= max;

  function add(raw: string) {
    const items = raw
      .split(/[,\n]/)
      .map((x) => x.trim().replace(/\s+/g, " ").slice(0, 40))
      .filter(Boolean);
    if (!items.length) return;
    const next = [...values];
    for (const it of items) {
      if (next.length >= max) {
        setNote(`Llegaste al máximo de ${max}.`);
        break;
      }
      if (!next.some((x) => x.toLowerCase() === it.toLowerCase())) next.push(it);
    }
    markEdited();
    onChange(next);
    setDraft("");
  }

  const q = draft.trim().toLowerCase();
  const matching = suggestions.filter((s) => !has(s) && (!q || s.toLowerCase().includes(q)));
  const shown = allSuggestions || q ? matching : matching.slice(0, SUGGESTIONS_SHOWN);
  const more = matching.length - shown.length;

  return (
    <div>
      <p id={`${id}-label`} className={cn(LABEL, "mb-2")}>
        {label} <span className="font-normal text-muted-foreground tabular-nums">· {values.length} de {max}</span>
      </p>
      {values.length ? (
        <ul aria-labelledby={`${id}-label`} className="mb-3 flex flex-wrap gap-2">
          {values.map((v) => (
            <li key={v} className="max-w-full">
              <RemovableChip label={v} cert={cert} onRemove={() => onChange(values.filter((x) => x !== v))} />
            </li>
          ))}
        </ul>
      ) : null}
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          add(draft);
        }}
      >
        <Input
          id={id}
          value={draft}
          disabled={full}
          maxLength={60}
          enterKeyHint="done"
          autoComplete="off"
          aria-label={`Agregar: ${label}`}
          aria-describedby={hintId}
          placeholder={full ? `Máximo ${max}` : placeholder}
          onChange={(e) => {
            setNote(null);
            const v = e.target.value;
            if (v.includes(",")) add(v);
            else setDraft(v);
          }}
          className={cn(FIELD, "min-w-0 flex-1")}
        />
        <button type="submit" disabled={full || !draft.trim()} className={cn(WHITE_BTN, "w-12 shrink-0 px-0 sm:w-auto sm:px-4")}>
          <HugeiconsIcon icon={Add01Icon} className="size-5" strokeWidth={2.4} />
          <span className="sr-only sm:not-sr-only">Agregar</span>
        </button>
      </form>
      <p id={hintId} className="mt-1.5 text-[0.8rem] text-muted-foreground" aria-live="polite">
        {note ?? "Escribe y toca +, o elige una sugerencia. Toca una para quitarla."}
      </p>
      {shown.length && !full ? (
        <div className="mt-2">
          <p className="sr-only">Sugerencias</p>
          <ul className="flex flex-wrap gap-2">
            {shown.map((s) => (
              <li key={s}>
                <button
                  type="button"
                  onClick={() => add(s)}
                  className="press inline-flex min-h-11 items-center gap-1 rounded-xl border-2 border-dashed border-ink/40 bg-white/35 px-3 text-[0.88rem] font-semibold text-ink outline-none hover:border-ink hover:bg-white/70 focus-visible:ring-3 focus-visible:ring-ink/50"
                >
                  <HugeiconsIcon icon={Add01Icon} className="size-4" strokeWidth={2.4} />
                  <span className="sr-only">Agregar </span>
                  {s}
                </button>
              </li>
            ))}
            {more > 0 ? (
              <li>
                <button
                  type="button"
                  onClick={() => setAllSuggestions(true)}
                  className="press inline-flex min-h-11 items-center rounded-xl px-3 text-[0.88rem] font-bold underline decoration-2 underline-offset-4 outline-none focus-visible:ring-3 focus-visible:ring-ink/50"
                >
                  +{more} más
                </button>
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

// ------------------------------------------------------------------ Habilidades y licencias

export function SkillsBlock({ tone, index }: SectionProps) {
  const skills = useApp((s) => s.skills);
  const certifications = useApp((s) => s.certifications);
  const updateProfile = useApp((s) => s.updateProfile);
  const total = skills.length + certifications.length;
  const need = PROFILE_LIMITS.skillsForPoints;
  return (
    <Block
      id="habilidades"
      tone={tone}
      index={index}
      icon={StarIcon}
      title="Habilidades y licencias"
      why="Las licencias (montacargas, DC-3, tipo C) son lo primero que filtran las empresas."
      badge={<PointsBadge parts={[[STRENGTH_WEIGHTS.skills, total >= need]]} />}
    >
      {total < need ? (
        <p className="mb-4 rounded-tile border-2 border-dashed border-ink/30 bg-white/40 px-3 py-2 text-[0.88rem] font-semibold">
          Llevas {total} de {need}: agrega {need - total} más para sumar +{STRENGTH_WEIGHTS.skills}%.
        </p>
      ) : null}
      <div className="space-y-5">
        <ChipInput
          id="certificaciones"
          label="Licencias y certificados"
          cert
          values={certifications}
          max={PROFILE_LIMITS.certificationsMax}
          suggestions={CERTIFICATION_SUGGESTIONS}
          placeholder="Ej. Licencia tipo B"
          onChange={(next) => void updateProfile({ certifications: next })}
        />
        <ChipInput
          id="habilidades-input"
          label="Habilidades"
          values={skills}
          max={PROFILE_LIMITS.skillsMax}
          suggestions={SKILL_SUGGESTIONS}
          placeholder="Ej. Inventarios"
          onChange={(next) => void updateProfile({ skills: next })}
        />
      </div>
    </Block>
  );
}

// ------------------------------------------------------------------ Disponibilidad

const TRANSPORT_ICON: Record<Transport, IconSvgElement> = {
  auto: Car01Icon,
  moto: Motorbike01Icon,
  bici: Bicycle01Icon,
  camion: Bus01Icon,
  caminando: WalkingIcon,
};

export function AvailabilityBlock({ tone, index }: SectionProps) {
  const shifts = useApp((s) => s.shifts);
  const availableFrom = useApp((s) => s.availableFrom);
  const transport = useApp((s) => s.transport);
  const updateProfile = useApp((s) => s.updateProfile);
  const earned = shifts.length > 0 && !!availableFrom;
  return (
    <Block
      id="disponibilidad"
      tone={tone}
      index={index}
      icon={Clock01Icon}
      title="Disponibilidad"
      why="Si puedes empezar ya, destacas con las empresas que tienen prisa."
      badge={<PointsBadge parts={[[STRENGTH_WEIGHTS.availability, earned]]} />}
    >
      <p id="turnos-l" className={SUBLABEL}>
        Turnos que puedes
      </p>
      <div role="group" aria-labelledby="turnos-l" className="flex flex-wrap gap-2">
        {SHIFTS.map((sh) => {
          const on = shifts.includes(sh);
          return (
            <ToggleChip
              key={sh}
              on={on}
              hint={SHIFT_HINT[sh]}
              onToggle={() => void updateProfile({ shifts: on ? shifts.filter((x) => x !== sh) : [...shifts, sh] })}
            >
              {sh}
            </ToggleChip>
          );
        })}
      </div>

      <p id="empezar-l" className={cn(SUBLABEL, "mt-5")}>
        Puedo empezar
      </p>
      <Segmented
        label="Puedo empezar"
        options={START_AVAILABILITIES.map((v) => ({ value: v, label: AVAILABILITY_LABEL[v] }))}
        value={availableFrom}
        clearable
        onChange={(v) => void updateProfile({ availableFrom: v })}
      />

      <p id="transporte-l" className={cn(SUBLABEL, "mt-5")}>
        Cómo llegas al trabajo
      </p>
      <div role="group" aria-labelledby="transporte-l" className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {TRANSPORTS.map((t) => {
          const on = transport.includes(t);
          return (
            <button
              key={t}
              type="button"
              aria-pressed={on}
              onClick={() => {
                markEdited();
                void updateProfile({ transport: on ? transport.filter((x) => x !== t) : [...transport, t] });
              }}
              className={cn(
                "press flex min-h-[4.75rem] flex-col items-center justify-center gap-1 rounded-tile px-1 py-2 text-center text-[0.8rem] leading-tight font-semibold outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ink/60",
                on
                  ? "border-2 border-ink bg-ink text-white shadow-[3px_3px_0_0_var(--ink)] dark:shadow-[3px_3px_0_0_rgb(255_255_255/0.16)]"
                  : "border-2 border-ink/25 bg-white/55 text-ink hover:bg-white/80",
              )}
            >
              <HugeiconsIcon icon={TRANSPORT_ICON[t]} className={cn("size-6", on && "text-limon")} strokeWidth={1.9} />
              {TRANSPORT_LABEL[t]}
            </button>
          );
        })}
      </div>
      {!earned ? (
        <p className="mt-3 text-[0.85rem] text-muted-foreground">
          Suma +{STRENGTH_WEIGHTS.availability}% con al menos un turno y cuándo puedes empezar.
        </p>
      ) : null}
    </Block>
  );
}

// ------------------------------------------------------------------ Escolaridad

export function EducationBlock({ tone, index }: SectionProps) {
  const education = useApp((s) => s.education);
  const updateProfile = useApp((s) => s.updateProfile);
  return (
    <Block
      id="escolaridad"
      tone={tone}
      index={index}
      icon={Mortarboard01Icon}
      title="Escolaridad"
      why="Solo el último nivel que terminaste. Algunas vacantes piden secundaria o prepa."
      badge={<PointsBadge parts={[[STRENGTH_WEIGHTS.education, !!education]]} />}
    >
      <Segmented
        label="Último nivel que terminaste"
        columns="grid-cols-2 sm:grid-cols-3"
        options={EDUCATION_LEVELS.map((v) => ({ value: v, label: EDUCATION_LABEL[v] }))}
        value={education}
        clearable
        onChange={(v) => void updateProfile({ education: v })}
      />
      {education ? (
        <p className="mt-2 text-[0.8rem] text-muted-foreground">Toca tu opción otra vez para quitarla.</p>
      ) : null}
    </Block>
  );
}

// ------------------------------------------------------------------ Sueldo esperado

export function PayBlock({ tone, index }: SectionProps) {
  const expectedPay = useApp((s) => s.expectedPay);
  const expectedPeriod = useApp((s) => s.expectedPeriod);
  const updateProfile = useApp((s) => s.updateProfile);
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? (expectedPay ? String(expectedPay) : "");
  const n = Number(shown.replace(/\D/g, ""));
  const invalid = shown !== "" && (n < PROFILE_LIMITS.expectedPayMin || n > PROFILE_LIMITS.expectedPayMax);

  function commit(raw: string) {
    const digits = raw.replace(/\D/g, "");
    if (!digits) {
      if (expectedPay !== null) void updateProfile({ expectedPay: null });
      return;
    }
    const v = Number(digits);
    if (v < PROFILE_LIMITS.expectedPayMin || v > PROFILE_LIMITS.expectedPayMax) return;
    markEdited();
    void updateProfile(expectedPeriod ? { expectedPay: v } : { expectedPay: v, expectedPeriod: "semana" });
  }

  return (
    <Block
      id="sueldo"
      tone={tone}
      index={index}
      icon={Money01Icon}
      title="Sueldo esperado"
      why="Opcional. Así no pierdes tiempo con vacantes que pagan menos de lo que buscas."
    >
      <div className="space-y-2">
        <Label htmlFor="pay" className={LABEL}>
          ¿Cuánto buscas ganar?
        </Label>
        <div className="relative">
          <span aria-hidden className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 font-display text-lg font-extrabold text-ink/60">
            $
          </span>
          <Input
            id="pay"
            inputMode="numeric"
            autoComplete="off"
            placeholder="2,800"
            value={shown ? Number(shown.replace(/\D/g, "") || 0).toLocaleString("es-MX") : ""}
            aria-invalid={invalid || undefined}
            aria-describedby="pay-hint"
            onChange={(e) => {
              const digits = e.target.value.replace(/\D/g, "").slice(0, 6);
              setDraft(digits);
              commit(digits);
            }}
            onBlur={() => {
              // Keep an invalid amount on screen (with its hint) instead of silently reverting it.
              if (!invalid) setDraft(null);
            }}
            className={cn(FIELD, "pl-8 font-semibold tabular-nums")}
          />
        </div>
        <p id="pay-hint" className={cn("text-[0.85rem]", invalid ? "font-semibold text-foreground" : "text-muted-foreground")}>
          {invalid ? "Escribe una cantidad entre $100 y $200,000." : "Déjalo vacío si prefieres no decirlo."}
        </p>
      </div>
      <p className={cn(SUBLABEL, "mt-4")}>Cada cuándo</p>
      <Segmented
        label="Periodo del sueldo"
        columns="grid-cols-2 sm:grid-cols-4"
        options={EXPECTED_PERIODS.map((p) => ({ value: p, label: PERIOD_LONG[p].replace(/^(por|al) /, "").replace(/^\w/, (c) => c.toUpperCase()) }))}
        value={expectedPeriod}
        onChange={(v) => void updateProfile({ expectedPeriod: v })}
      />
      <p className="mt-4 flex items-start gap-2 rounded-tile bg-white/45 p-3 text-[0.88rem] leading-snug font-semibold">
        <HugeiconsIcon icon={LockIcon} className="mt-0.5 size-4 shrink-0" strokeWidth={2.2} />
        Solo lo ve la empresa a la que te postulas. No sale en ninguna lista pública.
      </p>
    </Block>
  );
}

// ------------------------------------------------------------------ Idiomas

export function LanguagesBlock({ tone, index }: SectionProps) {
  const languages = useApp((s) => s.languages);
  const updateProfile = useApp((s) => s.updateProfile);
  return (
    <Block
      id="idiomas"
      tone={tone}
      index={index}
      icon={LanguageSkillIcon}
      title="Idiomas"
      why="El español lo damos por hecho. El inglés abre puertas en planta y oficinas."
    >
      <ChipInput
        id="idiomas-input"
        label="Otros idiomas"
        values={languages}
        max={PROFILE_LIMITS.languagesMax}
        suggestions={LANGUAGE_SUGGESTIONS}
        placeholder="Ej. Inglés básico"
        onChange={(next) => void updateProfile({ languages: next })}
      />
    </Block>
  );
}

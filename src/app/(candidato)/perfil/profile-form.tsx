"use client";

import Link from "next/link";
import { useState } from "react";
import { motion } from "motion/react";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowRight01Icon,
  Building06Icon,
  Gps01Icon,
  Location06Icon,
  LockIcon,
  Mail01Icon,
  Route01Icon,
  Tick02Icon,
  ToolsIcon,
  UserIcon,
} from "@hugeicons/core-free-icons";
import { BLOCK_CLASS, SectionLabel } from "@/components/chamba/primitives";
import { springs } from "@/components/chamba/motion";
import { CATEGORY_BLOCK, CategoryIcon } from "@/components/chamba/job-icons";
import { Doodle } from "@/components/chamba/art/doodles";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CATEGORIES } from "@/lib/data/categories";
import { COLONIAS } from "@/lib/data/jobs";
import type { Experience } from "@/lib/data/types";
import { bandColor, bandFor, RADIUS_STOPS } from "@/lib/geo";
import { STRENGTH_WEIGHTS } from "@/lib/profile-strength";
import { useApp } from "@/lib/store";
import { cn } from "@/lib/utils";
import { HARD, HARD_SM, HazardTape, STENCIL } from "../postulaciones/rugged";
import { AccountBlock } from "./account-block";
import { AvatarBuilder } from "./avatar-builder";
import { EmailAlertsBlock } from "./email-alerts-block";
import { EmployerPreview } from "./employer-preview";
import { ExperienceBlock } from "./experience-block";
import { FilesBlock } from "./files-block";
import { AvailabilityBlock, EducationBlock, LanguagesBlock, PayBlock, PresentationBlock, SkillsBlock } from "./sections";
import { StrengthHero } from "./strength-hero";
import { Block, markEdited, PointsBadge, SUBLABEL, type CSSVars } from "./ui";

/*
 * /perfil (candidate). Mobile-first, one column; on desktop the live "Así te ven las empresas"
 * preview sits in a sticky column next to the editor.
 *   1. Strength hero (who you are + meter + best next steps)   2. Crea tu avatar   3. Tus datos
 *   4. "Destácate": the optional richer profile, each section says why it helps
 *   5. Preview   6. Tu búsqueda (chamba, experiencia total + distancia, zona)   7. Avisos y cuenta
 */

const EXPERIENCE: Experience[] = ["Sin experiencia", "6 meses", "1 año", "2 años o más"];

/** "+52 844…" / "8441234567" → the 10 local digits. */
function digits10(raw: string) {
  return raw.replace(/\D/g, "").replace(/^52(?=\d{10}$)/, "").slice(0, 10);
}
function formatPhone10(raw: string) {
  const d = digits10(raw);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)} ${d.slice(3)}`;
  return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`;
}

const FIELD = "h-12 border-2 border-ink/25 bg-white/80 text-base text-ink dark:bg-white/80 focus-visible:border-ink";

export function ProfileForm() {
  return (
    <div className="space-y-6 lg:space-y-7">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-7">
        <div className="grid min-w-0 grid-cols-1 content-start gap-6 lg:col-span-7">
          <StrengthHero />
          <AvatarBuilder tone="durazno" index={1} />
          <DatosBlock index={2} />

          <SectionLabel
            className="mt-2 animate-rise"
            eyebrow="Todo es opcional"
            title="Destácate ante las empresas"
          />
          <PresentationBlock tone="lila" index={2} />
          <ExperienceBlock tone="menta" index={3} />
          <SkillsBlock tone="cielo" index={4} />
          <AvailabilityBlock tone="durazno" index={5} />
          <EducationBlock tone="sol" index={6} />
          <PayBlock tone="lila" index={7} />
          <LanguagesBlock tone="menta" index={8} />
          <FilesBlock tone="limon" index={8} />
        </div>

        <aside className="min-w-0 lg:col-span-5" aria-label="Vista previa">
          <div className="lg:sticky lg:top-6 lg:max-h-[calc(100dvh-3rem)] lg:overflow-y-auto lg:overscroll-contain lg:pr-2 lg:pb-3">
            <EmployerPreview index={2} />
          </div>
        </aside>
      </div>

      <SectionLabel className="pt-2" title="Tu búsqueda" eyebrow="Para recomendarte chambas" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-7">
        <InterestsBlock index={1} className="lg:col-span-7" />
        <div className="grid min-w-0 grid-cols-1 content-start gap-6 lg:col-span-5">
          <LevelAndRadiusBlock index={2} />
          <ZoneBlock index={3} />
        </div>
      </div>

      <SectionLabel className="pt-2" title="Avisos y cuenta" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-7">
        <Block tone="menta" index={1} title="Avisos por correo" icon={Mail01Icon} className="overflow-hidden" id="avisos">
          <Doodle name="chispa" color="#FFD23F" className="absolute top-5 right-5 size-8" />
          <EmailAlertsBlock onChange={markEdited} />
        </Block>
        <AccountBlock index={2} />
      </div>

      <Link
        href="/empresa"
        className={cn(
          "group lift press relative flex animate-rise items-center gap-3 overflow-hidden rounded-panel bg-card py-5 pr-5 pl-9 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 lg:hidden",
          HARD,
        )}
        style={{ "--i": 3 } as CSSVars}
      >
        <HazardTape className="absolute inset-y-0 left-0 w-4 border-y-0 border-r-2" />
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-ink text-white">
          <HugeiconsIcon icon={Building06Icon} className="size-6" strokeWidth={1.8} />
        </span>
        <span className="min-w-0 flex-1 text-[0.95rem] font-semibold">
          ¿Tienes un negocio?
          <span className="block font-normal text-muted-foreground">Cambia a modo empresa</span>
        </span>
        <HugeiconsIcon icon={ArrowRight01Icon} className="size-5 shrink-0 transition-transform group-hover:translate-x-1" strokeWidth={2} />
      </Link>
    </div>
  );
}

// ------------------------------------------------------------------ Tus datos

function DatosBlock({ index }: { index: number }) {
  const name = useApp((s) => s.name);
  const setName = useApp((s) => s.setName);
  const phone = useApp((s) => s.phone);
  const setPhone = useApp((s) => s.setPhone);
  const [phoneDraft, setPhoneDraft] = useState<string | null>(null);
  return (
    <Block
      id="datos"
      tone="sol"
      index={index}
      title="Tus datos"
      icon={UserIcon}
      why="Con esto la empresa te contacta cuando le interesas."
      badge={<PointsBadge parts={[[STRENGTH_WEIGHTS.name, name.trim().length >= 2], [STRENGTH_WEIGHTS.phone, phone.length > 0]]} />}
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name" className="text-[0.95rem] font-semibold">
            Nombre
          </Label>
          <Input
            id="name"
            autoComplete="given-name"
            value={name}
            onChange={(e) => {
              markEdited();
              setName(e.target.value);
            }}
            className={FIELD}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone" className="text-[0.95rem] font-semibold">
            Celular
          </Label>
          <Input
            id="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            placeholder="844 123 4567"
            value={phoneDraft ?? formatPhone10(phone)}
            onChange={(e) => setPhoneDraft(formatPhone10(e.target.value))}
            onBlur={() => {
              if (phoneDraft === null) return;
              const d = digits10(phoneDraft);
              setPhoneDraft(null);
              if (d.length === 10 && d !== digits10(phone)) {
                markEdited();
                void setPhone(d);
                toast.success("Celular actualizado.");
              } else if (d.length !== 10 && d.length > 0) toast.error("Escribe tu celular de 10 dígitos.");
            }}
            aria-describedby="phone-hint"
            className={FIELD}
          />
          <p id="phone-hint" className="text-sm text-muted-foreground">
            Solo lo ve la empresa cuando avanza con tu postulación, para contactarte por SMS o llamada.
          </p>
        </div>
      </div>
    </Block>
  );
}

// ------------------------------------------------------------------ ¿Qué chamba buscas?

function InterestsBlock({ index, className }: { index: number; className?: string }) {
  const interests = useApp((s) => s.interests);
  const setInterests = useApp((s) => s.setInterests);
  return (
    <Block
      id="intereses"
      tone="cielo"
      index={index}
      title="¿Qué chamba buscas?"
      icon={ToolsIcon}
      className={className}
      badge={<PointsBadge parts={[[STRENGTH_WEIGHTS.interests, interests.length > 0]]} />}
    >
      <fieldset>
        <legend className="mb-3 text-[0.95rem] text-muted-foreground">Toca las que te laten. Puedes elegir varias.</legend>
        <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
          {CATEGORIES.map((c) => {
            const on = interests.includes(c.id);
            return (
              <motion.button
                key={c.id}
                type="button"
                aria-pressed={on}
                onClick={() => {
                  markEdited();
                  setInterests(on ? interests.filter((x) => x !== c.id) : [...interests, c.id]);
                }}
                initial={false}
                animate={{ scale: on ? [1, 1.1, 0.97, 1] : [1, 0.94, 1], rotate: on ? [0, -4, 2, 0] : 0 }}
                whileTap={{ scale: 0.92, transition: springs.snappy }}
                transition={{ duration: 0.45, ease: "easeOut" }}
                className={cn(
                  "group relative flex min-h-[6.5rem] flex-col items-center justify-center gap-1.5 rounded-tile px-1.5 py-2.5 text-center text-[0.8rem] leading-tight font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ink/60",
                  on ? cn(BLOCK_CLASS[CATEGORY_BLOCK[c.id]], HARD_SM) : "border-2 border-dashed border-ink/30 bg-white/45 hover:bg-white/70",
                )}
              >
                <CategoryIcon category={c.id} size="md" animated={on} className={cn(!on && "opacity-80 grayscale-[0.35]")} />
                <span className="line-clamp-2">{c.label}</span>
                {on ? (
                  <span
                    aria-hidden
                    className="absolute -top-2 -right-2 grid size-6 animate-pop-in place-items-center rounded-full border-2 border-ink bg-limon text-ink"
                  >
                    <HugeiconsIcon icon={Tick02Icon} className="size-3.5" strokeWidth={3} />
                  </span>
                ) : null}
              </motion.button>
            );
          })}
        </div>
      </fieldset>
    </Block>
  );
}

// ------------------------------------------------------------------ experiencia total + radio

function LevelAndRadiusBlock({ index }: { index: number }) {
  const experience = useApp((s) => s.experience);
  const setExperience = useApp((s) => s.setExperience);
  const radiusKm = useApp((s) => s.radiusKm);
  const setRadius = useApp((s) => s.setRadius);
  return (
    <Block tone="lila" index={index} title="Experiencia total y distancia" icon={Route01Icon}>
      <p id="nivel-l" className={SUBLABEL}>
        ¿Cuánto tiempo has trabajado?
      </p>
      <div role="radiogroup" aria-labelledby="nivel-l" className="grid grid-cols-2 gap-2">
        {EXPERIENCE.map((x) => {
          const on = experience === x;
          return (
            <button
              key={x}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => {
                markEdited();
                setExperience(x);
              }}
              className={cn(
                "press flex h-12 items-center justify-center gap-1.5 rounded-full px-3 text-[0.92rem] font-semibold outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ink/60",
                on ? cn("bg-ink text-white", HARD_SM) : "border-2 border-ink/25 bg-white/55 hover:bg-white/80",
              )}
            >
              {on ? <HugeiconsIcon icon={Tick02Icon} className="size-4 text-limon" strokeWidth={3} /> : null}
              {x}
            </button>
          );
        })}
      </div>

      <p id="radio-l" className={cn(SUBLABEL, "mt-5")}>
        ¿Hasta dónde vas?
      </p>
      <div role="radiogroup" aria-labelledby="radio-l" className="grid grid-cols-4 gap-2">
        {RADIUS_STOPS.map((r) => {
          const on = radiusKm === r;
          return (
            <button
              key={r}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={`Hasta ${r} km`}
              onClick={() => setRadius(r)}
              className={cn(
                "press relative flex h-16 flex-col items-center justify-center rounded-tile outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ink/60",
                on ? cn("bg-white", HARD_SM) : "border-2 border-ink/20 bg-white/40 hover:bg-white/70",
              )}
            >
              <span className={cn("text-[1.5rem] leading-none", STENCIL)}>{r}</span>
              <span className="mt-0.5 flex items-center gap-1 text-[0.72rem] font-semibold">
                <span className="size-2 rounded-full" style={{ background: bandColor(bandFor(r - 0.01)) }} />
                km
              </span>
            </button>
          );
        })}
      </div>
    </Block>
  );
}

// ------------------------------------------------------------------ zona

function ZoneBlock({ index }: { index: number }) {
  const colonia = useApp((s) => s.colonia);
  const hasHome = useApp((s) => s.hasHome);
  const setHome = useApp((s) => s.setHome);

  function useGps() {
    if (!("geolocation" in navigator)) return toast.error("Tu teléfono no permite compartir ubicación. Elige tu colonia.");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        markEdited();
        setHome({ lat: p.coords.latitude, lng: p.coords.longitude }, "Mi ubicación", "gps");
        toast.success("Ubicación actualizada. Las distancias ya se calculan desde aquí.");
      },
      () => toast.error("No pudimos obtener tu ubicación. Elige tu colonia de la lista."),
      { enableHighAccuracy: false, timeout: 10000 },
    );
  }

  return (
    <Block
      id="zona"
      tone="durazno"
      index={index}
      title="Dónde vives"
      icon={Location06Icon}
      badge={<PointsBadge parts={[[STRENGTH_WEIGHTS.home, hasHome]]} />}
    >
      <div className="space-y-3">
        <Select
          value={COLONIAS.some((c) => c.name === colonia) ? colonia : undefined}
          onValueChange={(v) => {
            const c = COLONIAS.find((x) => x.name === v);
            markEdited();
            if (c) setHome(c.location, c.name, "colonia");
          }}
        >
          <SelectTrigger className={cn(FIELD, "w-full")} aria-label="Tu colonia">
            <SelectValue placeholder={hasHome ? colonia : "Elige tu colonia"} />
          </SelectTrigger>
          <SelectContent>
            {COLONIAS.map((c) => (
              <SelectItem key={c.name} value={c.name}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <button
          type="button"
          onClick={useGps}
          className="press group flex h-12 w-full items-center justify-center gap-2 rounded-full bg-ink text-[0.95rem] font-semibold text-white outline-none focus-visible:ring-3 focus-visible:ring-ink/60"
        >
          <HugeiconsIcon icon={Gps01Icon} className="size-5 group-hover:animate-wiggle" strokeWidth={2} />
          Usar mi ubicación actual
        </button>
        {/* A guarantee, not a setting: companies never get more than colonia + distance. */}
        <div className="flex items-start gap-3 rounded-tile border-2 border-dashed border-ink/25 bg-white/50 p-4">
          <HugeiconsIcon icon={LockIcon} className="mt-0.5 size-5 shrink-0" strokeWidth={2} />
          <p className="flex-1 text-[0.95rem] leading-snug font-semibold">
            Solo compartimos tu zona aproximada
            <span className="block text-sm font-normal text-muted-foreground">
              Las empresas ven tu colonia y la distancia, nunca tu dirección exacta.
            </span>
          </p>
          <span className="shrink-0 -rotate-3 rounded-full bg-ink px-2.5 py-1 text-[0.72rem] font-bold tracking-[0.08em] text-limon uppercase">
            Siempre
          </span>
        </div>
      </div>
    </Block>
  );
}

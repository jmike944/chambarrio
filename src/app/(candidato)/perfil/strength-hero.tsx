"use client";

import { useEffect, useRef } from "react";
import { motion } from "motion/react";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowDown01Icon, CheckmarkBadge01Icon, Location06Icon } from "@hugeicons/core-free-icons";
import { HeroCard } from "@/components/chamba/primitives";
import { CountUp, springs, Sticker, useConfetti } from "@/components/chamba/motion";
import { useOwnFileUrl } from "@/lib/live/profile-files";
import { useApp } from "@/lib/store";
import { PROFILE_COMPLETE_AT, pointsToComplete, STRENGTH_LEVEL_LABEL, strengthLevel } from "@/lib/profile-strength";
import { cn } from "@/lib/utils";
import { HARD, HARD_SM, HazardTape, Rivets } from "../postulaciones/rugged";
import { editedRecently, goToSection, sectionForTip, useProfileStrength, type CSSVars } from "./ui";

/** Rugged confetti: safety yellow, lime, orange, sky, white (no pink). */
const WORK_CONFETTI = ["#FFC93C", "#DDF78A", "#FF6B2C", "#5CC3FF", "#FFFFFF"];

/**
 * "Fuerza de tu perfil": the candidate's identity + a big 0–100 meter (same weights as the server),
 * a "Perfil completo" sticker at ≥ 80 and the three best next steps as tappable chips that jump to
 * their section. Confetti when the user's own edit crosses 80.
 */
export function StrengthHero() {
  const name = useApp((s) => s.name);
  const colonia = useApp((s) => s.colonia);
  const hasHome = useApp((s) => s.hasHome);
  const radiusKm = useApp((s) => s.radiusKm);
  const { url: photo } = useOwnFileUrl("avatar");
  const { value, tips } = useProfileStrength();
  const top = tips.slice(0, 3);
  const level = strengthLevel(value);
  const complete = value >= PROFILE_COMPLETE_AT;
  const missing = pointsToComplete(value);

  /* ---- celebrate crossing 80 (only when the user's own edit did it) */
  const heroRef = useRef<HTMLElement>(null);
  const prev = useRef(value);
  const fire = useConfetti();
  useEffect(() => {
    const was = prev.current;
    prev.current = value;
    if (was < PROFILE_COMPLETE_AT && value >= PROFILE_COMPLETE_AT && editedRecently()) {
      fire({ origin: heroRef.current ?? undefined, colors: WORK_CONFETTI, count: 48 });
      toast.success("¡Perfil completo!", { description: "Ahora sales con el sello «Perfil completo» y primero en la lista de las empresas." });
    } else if (was >= PROFILE_COMPLETE_AT && value < PROFILE_COMPLETE_AT && editedRecently()) {
      toast(`Tu perfil bajó a ${value}%`, { description: `Te faltan ${PROFILE_COMPLETE_AT - value} puntos para volver a «Perfil completo».` });
    }
  }, [value, fire]);

  const initials =
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("") || "?";
  const firstName = name.trim().split(/\s+/)[0] || "Tú";

  return (
    <HeroCard
      ref={heroRef}
      eyebrow="Fuerza de tu perfil"
      aria-label="Fuerza de tu perfil"
      className={cn("animate-rise overflow-visible", HARD, "shadow-[6px_6px_0_0_var(--ink)]!")}
      sticker={
        complete ? (
          <Sticker variant="lime" rotate={10} dot size="md" key="completo">
            <strong className="text-[1.25em]!">Perfil</strong>completo
          </Sticker>
        ) : null
      }
    >
      <span aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-[inherit]">
        <span className="absolute inset-0 bg-dots text-white opacity-[0.08]" />
        <HazardTape className="absolute inset-x-0 bottom-0 h-3 border-b-0" />
      </span>
      <Rivets className="text-white" />

      {/* ------------------------------------------------ who */}
      <div className={cn("mt-3 flex items-center gap-3.5", complete && "pr-20")}>
        <span
          className={cn(
            "grid size-16 shrink-0 -rotate-3 place-items-center overflow-hidden rounded-2xl bg-limon font-display text-[1.7rem] font-extrabold text-ink",
            HARD_SM,
          )}
          aria-hidden
        >
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element -- local blob / short-lived signed URL
            <img src={photo} alt="" className="size-full object-cover" />
          ) : (
            initials
          )}
        </span>
        <div className="min-w-0">
          <p className="truncate font-display text-[1.75rem] leading-[1.02] font-extrabold tracking-[-0.035em] sm:text-[2rem]">
            {firstName}
          </p>
          <p className="mt-1 flex items-start gap-1.5 text-[0.92rem] leading-snug text-primary-foreground/80">
            <HugeiconsIcon icon={Location06Icon} className="mt-0.5 size-4 shrink-0" strokeWidth={2} />
            <span className="min-w-0">
              {hasHome ? (
                <>
                  {colonia} <span className="whitespace-nowrap">· hasta {radiusKm} km</span>
                </>
              ) : (
                "Elige tu colonia"
              )}
            </span>
          </p>
        </div>
      </div>

      {/* ------------------------------------------------ big number + meter */}
      <div className="mt-5 flex items-end justify-between gap-3">
        <p className="font-display leading-none font-extrabold tracking-[-0.05em]" aria-hidden>
          <CountUp value={value} from={0} className="text-[4.2rem] sm:text-[4.8rem]" />
          <span className="ml-0.5 text-[2rem] text-limon">%</span>
        </p>
        <div className="min-w-0 pb-1.5 text-right">
          <p className={cn("text-[0.72rem] font-extrabold tracking-[0.14em] uppercase", complete ? "text-limon" : "text-primary-foreground/80")}>
            {STRENGTH_LEVEL_LABEL[level]}
          </p>
          <p className="mt-0.5 text-[0.92rem] leading-snug font-semibold text-balance">
            {complete
              ? value === 100
                ? "Lo tienes todo"
                : "Sales primero con las empresas"
              : `Te faltan ${missing} puntos para «Perfil completo»`}
          </p>
        </div>
      </div>
      <BigMeter value={value} />

      {/* ------------------------------------------------ next steps */}
      {top.length ? (
        <div className="mt-5">
          <p className="mb-2 text-[0.72rem] font-extrabold tracking-[0.14em] text-primary-foreground/80 uppercase">
            {complete ? "Para llegar al 100 %" : "Súbele rápido"}
          </p>
          <ul className="grid gap-2 sm:grid-cols-1">
            {top.map((t, i) => (
              <li key={t.key} className="animate-rise" style={{ "--i": i + 2 } as CSSVars}>
                <button
                  type="button"
                  onClick={() => goToSection(sectionForTip(t.key))}
                  className={cn(
                    "press group flex min-h-12 w-full items-center gap-3 rounded-2xl bg-white py-2 pr-3 pl-2 text-left text-ink outline-none focus-visible:ring-3 focus-visible:ring-limon",
                    HARD_SM,
                  )}
                >
                  <span className="grid h-8 min-w-[3.4rem] shrink-0 -rotate-3 place-items-center rounded-lg bg-limon px-1.5 font-display text-[1rem] font-extrabold tabular-nums">
                    +{t.points}%
                  </span>
                  <span className="min-w-0 flex-1 text-[0.95rem] leading-tight font-semibold">
                    {t.title}
                    <span className="sr-only">. {t.hint}</span>
                  </span>
                  <HugeiconsIcon
                    icon={ArrowDown01Icon}
                    className="size-5 shrink-0 transition-transform group-hover:translate-y-0.5"
                    strokeWidth={2.2}
                  />
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mt-5 flex items-center gap-2 rounded-2xl bg-white/12 p-3 text-[0.95rem] font-semibold">
          <HugeiconsIcon icon={CheckmarkBadge01Icon} className="size-6 shrink-0 text-limon" strokeWidth={2} />
          Tu perfil está al 100 %. Las empresas ven todo lo que ofreces.
        </p>
      )}
      <div className="h-3" aria-hidden />
    </HeroCard>
  );
}

/** Chunky 10-segment gauge on violet: lime fill, ink outline, a notch at 80 ("completo"). */
function BigMeter({ value }: { value: number }) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className="mt-3">
      <div
        role="meter"
        aria-label="Fuerza de tu perfil"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={v}
        aria-valuetext={`${v} de 100. ${v >= PROFILE_COMPLETE_AT ? "Perfil completo" : `Faltan ${PROFILE_COMPLETE_AT - v} puntos para perfil completo`}`}
        className="relative h-8 overflow-hidden rounded-[0.7rem] border-[2.5px] border-ink bg-white/15"
      >
        <motion.span
          aria-hidden
          className="absolute inset-0 origin-left bg-limon"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: v / 100 }}
          transition={springs.soft}
        />
        {/* segment cuts every 10 points, in the hero's violet */}
        <span
          aria-hidden
          className="absolute inset-0 bg-[repeating-linear-gradient(90deg,transparent_0_calc(10%_-_3px),var(--primary)_calc(10%_-_3px)_10%)]"
        />
      </div>
      <div aria-hidden className="relative mt-1 h-5 text-[0.7rem] font-bold tracking-[0.08em] text-primary-foreground/80 uppercase">
        <span className="absolute left-0">0</span>
        <span className="absolute left-[80%] -translate-x-1/2 text-limon">▲ 80</span>
        <span className="absolute right-0">100</span>
      </div>
    </div>
  );
}

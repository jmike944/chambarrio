"use client";

import { motion } from "motion/react";
import { HugeiconsIcon } from "@hugeicons/react";
import { CheckmarkBadge01Icon } from "@hugeicons/core-free-icons";
import { springs } from "@/components/chamba/motion";
import { PROFILE_COMPLETE_AT, strengthLevel } from "@/lib/profile-strength";
import { cn } from "@/lib/utils";

/*
 * Profile strength for the employer's applicant cards: a chunky 10-segment gauge (ink fill on a white,
 * ink-outlined track) and a rotated stamp — lime "Perfil completo" at ≥ 80, muted "Perfil básico" < 40.
 * Meant for pastel blocks (ink text). Reusable by the candidate's profile editor too.
 */

export function StrengthMeter({
  value,
  label = "Perfil",
  index = 0,
  className,
}: {
  value: number;
  label?: string;
  /** Stagger index for the fill animation. */
  index?: number;
  className?: string;
}) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  const complete = v >= PROFILE_COMPLETE_AT;
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <span className="w-[4.2rem] shrink-0 text-[0.72rem] leading-tight font-extrabold tracking-[0.12em] uppercase opacity-80">
        {label}
      </span>
      <span
        role="meter"
        aria-label={`${label}: ${v} de 100`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={v}
        className="relative h-[1.1rem] flex-1 overflow-hidden rounded-[0.45rem] border-2 border-ink bg-white"
      >
        <motion.span
          className={cn("absolute inset-y-0 left-0 origin-left", complete ? "bg-ink" : "bg-ink/80")}
          style={{ width: `${v}%` }}
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ ...springs.soft, delay: 0.15 + Math.min(index, 8) * 0.05 }}
        />
        {/* segment cuts every 10 points */}
        <span
          aria-hidden
          className="absolute inset-0 bg-[repeating-linear-gradient(90deg,transparent_0_calc(10%_-_2px),white_calc(10%_-_2px)_10%)]"
        />
      </span>
      <span className="w-[3.1rem] shrink-0 text-right font-display text-[1.35rem] leading-none font-extrabold tracking-[-0.03em] tabular-nums">
        {v}
        <span className="text-[0.7rem] font-bold tracking-normal opacity-70">%</span>
      </span>
    </div>
  );
}

/** Rotated workwear stamp for the card corner. Renders nothing for mid-range profiles. */
export function StrengthStamp({ value, className }: { value: number; className?: string }) {
  const level = strengthLevel(value);
  if (level === "medio") return null;
  if (level === "completo") {
    return (
      <span
        className={cn(
          "animate-pop-in inline-flex h-8 items-center gap-1.5 rounded-md border-2 border-ink bg-limon px-2.5 text-[0.72rem] font-extrabold tracking-[0.1em] whitespace-nowrap text-ink uppercase shadow-[2px_2px_0_0_var(--ink)] dark:shadow-[2px_2px_0_0_rgb(0_0_0/0.7)]",
          className,
        )}
        style={{ rotate: "-5deg" }}
      >
        <HugeiconsIcon icon={CheckmarkBadge01Icon} className="size-4" strokeWidth={2.4} />
        Perfil completo
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex h-7 items-center rounded-md border-2 border-dashed border-ink/45 bg-white/70 px-2 text-[0.68rem] font-bold tracking-[0.1em] whitespace-nowrap text-ink/70 uppercase",
        className,
      )}
      style={{ rotate: "3deg" }}
    >
      Perfil básico
    </span>
  );
}

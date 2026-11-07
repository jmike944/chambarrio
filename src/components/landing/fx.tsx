"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { toast } from "sonner";
import { Mascot, type MascotProp } from "@/components/chamba/art/mascot";
import { springs, useConfetti } from "@/components/chamba/motion";
import { cn } from "@/lib/utils";

/* Landing-only motion helpers. Transform/opacity only; calm under reduced motion. */

/** A hand-drawn squiggle that draws itself under a word. Parent must be `relative inline-block`. */
export function Squiggle({ className, color = "var(--ink)", delay = 0.45 }: { className?: string; color?: string; delay?: number }) {
  const reduce = useReducedMotion();
  return (
    <svg
      aria-hidden
      viewBox="0 0 200 24"
      preserveAspectRatio="none"
      className={cn("pointer-events-none absolute inset-x-[-4%] -bottom-[0.18em] h-[0.32em] w-[108%] overflow-visible", className)}
    >
      <motion.path
        d="M4 15 C 28 3, 46 22, 74 12 S 120 2, 146 13 S 184 20, 196 7"
        fill="none"
        stroke={color}
        strokeWidth={7}
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
        initial={reduce ? false : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.85, delay, ease: [0.3, 0.7, 0.3, 1] }}
      />
    </svg>
  );
}

const OUTFITS: { prop: MascotProp; line: string }[] = [
  { prop: "casco", line: "¡Quiubo! Soy Chambita. Te ayudo a encontrar chamba cerca de tu casa." },
  { prop: "chef", line: "¿Cocina? ¡Hay restaurantes buscando gente en tu colonia!" },
  { prop: "paquete", line: "¿Reparto? ¡Ándale, hay rutas a la vuelta de la esquina!" },
  { prop: "gorra", line: "¿Seguridad o almacén? ¡Chamba a la vista!" },
  { prop: "telefono", line: "Sin currículum: entras con tu WhatsApp y ¡ya quedó!" },
];

/** Tap Chambita: confetti, a dance and a new outfit each time. */
export function ChambitaHello({ size = 180, className }: { size?: number; className?: string }) {
  const [n, setN] = useState(0);
  const [party, setParty] = useState(false);
  const fire = useConfetti();
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const outfit = OUTFITS[n % OUTFITS.length];
  return (
    <motion.button
      type="button"
      aria-label="Saluda a Chambita"
      className={cn(
        "relative cursor-pointer rounded-full outline-none focus-visible:ring-4 focus-visible:ring-ink/70",
        className,
      )}
      whileHover={{ rotate: -5, y: -6 }}
      whileTap={{ scale: 0.88, rotate: 6 }}
      transition={springs.bouncy}
      onClick={(e) => {
        fire({ origin: e.currentTarget, count: 44, spread: 160 });
        toast(outfit.line);
        setN((v) => v + 1);
        setParty(true);
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => setParty(false), 1600);
      }}
    >
      <Mascot mood={party ? "festeja" : "saluda"} prop={outfit.prop} size={size} />
    </motion.button>
  );
}

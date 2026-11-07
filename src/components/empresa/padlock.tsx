"use client";

import { motion } from "motion/react";
import { springs } from "@/components/chamba/motion";
import { cn } from "@/lib/utils";

const INK = "#160F33";
const STEEL = "#C9C6D6";
const SAFETY = "#FFC93C";

/**
 * Chunky workwear padlock (safety-yellow body, riveted, steel shackle, ink outline + hard drop).
 * `open` lifts and swings the shackle with a spring and pops weld sparks — flip it to animate
 * the lock → unlock moment. Decorative (aria-hidden). Motion respects MotionConfig reducedMotion.
 */
export function Padlock({ open, className }: { open: boolean; className?: string }) {
  return (
    <svg viewBox="-6 -10 76 88" className={cn("size-20 overflow-visible", className)} aria-hidden focusable="false">
      {/* sparks */}
      {[
        "M58 8 L66 2",
        "M62 20 L72 19",
        "M50 0 L52 -8",
      ].map((d, i) => (
        <motion.path
          key={d}
          d={d}
          fill="none"
          stroke={i === 1 ? "#DDF78A" : SAFETY}
          strokeWidth={4}
          strokeLinecap="round"
          initial={false}
          animate={open ? { opacity: [0, 1, 1], pathLength: [0, 1, 1] } : { opacity: 0, pathLength: 0 }}
          transition={{ duration: 0.45, delay: 0.18 + i * 0.05 }}
        />
      ))}
      {/* shackle */}
      <motion.g
        initial={false}
        animate={open ? { y: -10, rotate: -22 } : { y: 0, rotate: 0 }}
        transition={springs.bouncy}
        style={{ transformBox: "fill-box", originX: 0, originY: 1 }}
      >
        <path d="M18 34 V22 a14 14 0 0 1 28 0 V34" fill="none" stroke={INK} strokeWidth={10} strokeLinecap="round" />
        <path d="M18 34 V22 a14 14 0 0 1 28 0 V34" fill="none" stroke={STEEL} strokeWidth={4.5} strokeLinecap="round" />
        <path d="M21.5 20 a10.5 10.5 0 0 1 6 -8" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" />
      </motion.g>
      {/* body + hard drop */}
      <rect x={10.5} y={32.5} width={48} height={38} rx={8} fill={INK} />
      <rect x={8} y={30} width={48} height={38} rx={8} fill={SAFETY} stroke={INK} strokeWidth={3} />
      <path d="M13 37 h38" stroke={INK} strokeWidth={2} strokeOpacity={0.25} />
      {[
        [14, 36],
        [50, 36],
        [14, 62],
        [50, 62],
      ].map(([cx, cy]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={2.2} fill={INK} />
      ))}
      {/* keyhole */}
      <circle cx={32} cy={47} r={5} fill={INK} />
      <path d="M29.5 49 h5 l1.5 9 h-8z" fill={INK} />
      <path d="M15 44 v14" stroke="#fff" strokeWidth={2.4} strokeLinecap="round" />
    </svg>
  );
}

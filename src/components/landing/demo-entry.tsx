"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowRight02Icon } from "@hugeicons/core-free-icons";
import { Reveal, Sticker } from "@/components/chamba/motion";
import { CategoryArt } from "@/components/chamba/job-icons";
import { Mascot } from "@/components/chamba/art/mascot";
import { useApp, type Role } from "@/lib/store";
import { cn } from "@/lib/utils";
import { HARD, HARD_SM, HazardStripe, PRESSABLE, Rivets, Scatter, Tape } from "./decor";

/** Enters the curated demo as `role` and jumps into the app (the candidate home or the company panel). */
export function useEnterDemo() {
  const router = useRouter();
  const enterDemo = useApp((s) => s.enterDemo);
  return useCallback(
    (role: Role) => {
      enterDemo(role);
      router.push(role === "empresa" ? "/empresa" : "/inicio");
    },
    [enterDemo, router],
  );
}

/** Entering the demo signs a live account out on this phone: say so before the tap. */
export function DemoLiveNote({ className }: { className?: string }) {
  const live = useApp((s) => s.mode === "live" && s.signedIn);
  if (!live) return null;
  return <p className={cn("text-[0.92rem] font-semibold", className)}>Al entrar a la demo se cierra tu sesión en este teléfono.</p>;
}

const BULLETS = ["Vacantes por distancia", "Postúlate en un toque", "Sigue tus postulaciones"];

/** The big "Busco chamba" card: enters the job-seeker demo. */
function SeekerDemoCard() {
  const enter = useEnterDemo();
  return (
    <Reveal inView index={1} className="relative min-w-0">
      <div className="absolute -top-6 -right-2 z-10 sm:-top-7 sm:-right-3">
        <Sticker variant="lime" size="md" rotate={10} className="border-[3px] border-ink">
          <strong>Demo</strong>sin registro
        </Sticker>
      </div>
      <button
        type="button"
        onClick={() => enter("candidato")}
        className={cn(
          "group relative isolate flex h-full min-h-[17rem] w-full flex-col overflow-hidden rounded-panel p-5 text-left outline-none block-sol focus-visible:ring-4 focus-visible:ring-ring/60 sm:p-7",
          HARD,
          PRESSABLE,
          "lg:rotate-[1deg]",
        )}
      >
        <span aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-dots opacity-50" />
        <span className="font-display text-[0.78rem] font-extrabold tracking-[0.14em] text-muted-foreground uppercase">
          Demo · busco chamba
        </span>
        <span className="mt-1 block max-w-[70%] font-display text-[2.1rem] leading-[0.98] font-extrabold tracking-[-0.04em] sm:text-[2.6rem]">
          Entra como Mariana
        </span>
        <span className="mt-2 block max-w-[62%] text-[1rem] leading-snug font-medium text-muted-foreground sm:text-[1.05rem]">
          Vive en la colonia Lourdes y busca chamba cerca de su casa.
        </span>
        <ul className="mt-4 mb-6 max-w-[62%] space-y-1.5 text-[0.95rem] font-semibold">
          {BULLETS.map((b) => (
            <li key={b} className="flex items-center gap-2">
              <span aria-hidden className="size-2 shrink-0 rotate-45 bg-ink" />
              {b}
            </li>
          ))}
        </ul>
        <span className="relative z-10 mt-auto inline-flex h-12 w-fit items-center gap-2 rounded-full border-[2.5px] border-ink bg-ink px-5 font-display text-[1rem] font-extrabold text-white">
          Ver vacantes cerca
          <HugeiconsIcon icon={ArrowRight02Icon} className="size-5 transition-transform group-hover:translate-x-1" strokeWidth={2.4} />
        </span>
        <span
          aria-hidden
          className="pointer-events-none absolute -right-6 -bottom-6 rotate-[-6deg] transition-transform duration-300 group-hover:scale-110 group-hover:rotate-[3deg]"
        >
          <CategoryArt category="almacen" className="size-40 sm:size-56 lg:size-60" />
        </span>
      </button>
    </Reveal>
  );
}

/**
 * "Pruébala sin registrarte": the job-seeker app, with example data from Saltillo, one tap away.
 * Demo mode never talks to the server; leaving it wipes everything.
 */
export function DemoShowcase() {
  return (
    <section id="demo" aria-labelledby="demo-entry-t" className="mx-auto max-w-6xl scroll-mt-6 px-4 py-12 sm:px-6 lg:px-10 lg:py-16">
      <div className={cn("relative isolate overflow-hidden rounded-panel block-lila", HARD)}>
        <HazardStripe className="h-4" />
        <span aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-dots opacity-50" />
        <Scatter count={5} seed={30} palette={["var(--ink)", "var(--block-mandarina)"]} className="-z-10" />
        <Rivets className="top-4" />
        {/* Both columns stretch to one height: the copy column ends with Chambita on the card's bottom line. */}
        <div className="grid gap-8 p-5 pt-7 sm:p-8 lg:grid-cols-[1fr_1.1fr] lg:items-stretch lg:gap-10 lg:p-10">
          <div className="min-w-0 lg:flex lg:flex-col">
            <Tape className="-rotate-2">Datos de ejemplo de Saltillo</Tape>
            <h2
              id="demo-entry-t"
              className="mt-4 font-display text-[2.4rem] leading-[0.98] font-extrabold tracking-[-0.045em] text-balance sm:text-[3.1rem]"
            >
              Pruébala sin registrarte.
            </h2>
            <p className="mt-4 max-w-[30rem] text-[1.05rem] leading-relaxed text-muted-foreground">
              Recorre la app completa con vacantes de ejemplo en colonias reales de Saltillo. No pedimos datos y nada se
              guarda: sales cuando quieras.
            </p>
            <DemoLiveNote className="mt-4" />
            <div className="mt-6 hidden lg:mt-auto lg:block lg:pt-6">
              <div className={cn("inline-block rounded-tile bg-white/70 p-2", HARD_SM)}>
                <Mascot mood="saluda" prop="casco" size={132} />
              </div>
            </div>
          </div>
          <SeekerDemoCard />
        </div>
      </div>
    </section>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowRight02Icon } from "@hugeicons/core-free-icons";
import { Reveal, Sticker } from "@/components/chamba/motion";
import { CategoryArt } from "@/components/chamba/job-icons";
import { Scene } from "@/components/chamba/art/scenes";
import { Mascot } from "@/components/chamba/art/mascot";
import { BLOCK_CLASS, type BlockTone } from "@/components/chamba/primitives";
import { useApp, type Role } from "@/lib/store";
import { cn } from "@/lib/utils";
import { HARD, HARD_SM, HazardStripe, PRESSABLE, Rivets, Scatter, Tape } from "./decor";

const CARDS: {
  role: Role;
  title: string;
  body: string;
  bullets: string[];
  tone: BlockTone;
  cta: string;
}[] = [
  {
    role: "candidato",
    title: "Busco chamba",
    body: "Entra como Mariana, de la colonia Lourdes.",
    bullets: ["Vacantes por distancia", "Postúlate en un toque", "Sigue tus postulaciones"],
    tone: "sol",
    cta: "Ver vacantes cerca",
  },
  {
    role: "empresa",
    title: "Tengo un negocio",
    body: "Entra como Logística Zapalinamé, con sus sucursales.",
    bullets: ["Publica una vacante", "Ve quién se postula", "Administra sucursales"],
    tone: "cielo",
    cta: "Abrir el panel",
  },
];

/** Big "start the demo as…" card. Enters the curated demo and jumps into the app. */
function DemoCard({ card, index }: { card: (typeof CARDS)[number]; index: number }) {
  const router = useRouter();
  const enterDemo = useApp((s) => s.enterDemo);
  return (
    <Reveal inView index={index} className="min-w-0">
      <button
        type="button"
        onClick={() => {
          enterDemo(card.role);
          router.push(card.role === "empresa" ? "/empresa" : "/inicio");
        }}
        className={cn(
          "group relative isolate flex h-full min-h-[15rem] w-full flex-col overflow-hidden rounded-panel p-5 text-left outline-none focus-visible:ring-4 focus-visible:ring-ring/60 sm:p-6",
          BLOCK_CLASS[card.tone],
          HARD,
          PRESSABLE,
          index % 2 ? "lg:rotate-[1deg]" : "lg:-rotate-[1deg]",
        )}
      >
        <span aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-dots opacity-50" />
        <span className="font-display text-[0.78rem] font-extrabold tracking-[0.14em] text-muted-foreground uppercase">
          Demo · {card.role === "empresa" ? "empresa" : "candidato"}
        </span>
        <span className="mt-1 block max-w-[70%] font-display text-[2rem] leading-[0.98] font-extrabold tracking-[-0.04em] sm:text-[2.3rem]">
          {card.title}
        </span>
        <span className="mt-2 block max-w-[70%] text-[1rem] leading-snug font-medium text-muted-foreground">{card.body}</span>
        <ul className="mt-3 mb-5 max-w-[66%] space-y-1 text-[0.92rem] font-semibold">
          {card.bullets.map((b) => (
            <li key={b} className="flex items-center gap-2">
              <span aria-hidden className="size-2 shrink-0 rotate-45 bg-ink" />
              {b}
            </li>
          ))}
        </ul>
        <span className="relative z-10 mt-auto inline-flex h-12 w-fit items-center gap-2 rounded-full border-[2.5px] border-ink bg-ink px-5 font-display text-[1rem] font-extrabold text-white">
          {card.cta}
          <HugeiconsIcon
            icon={ArrowRight02Icon}
            className="size-5 transition-transform group-hover:translate-x-1"
            strokeWidth={2.4}
          />
        </span>
        <span
          aria-hidden
          className="pointer-events-none absolute -right-6 -bottom-6 w-36 rotate-[-6deg] transition-transform duration-300 group-hover:scale-110 group-hover:rotate-[3deg] sm:w-48"
        >
          {card.role === "empresa" ? (
            <Scene name="negocio" className="w-full" />
          ) : (
            <CategoryArt category="almacen" className="size-36 sm:size-48" />
          )}
        </span>
      </button>
    </Reveal>
  );
}

/**
 * "Pruébala sin registrarte": the whole app, with example data from Saltillo, one tap away.
 * Demo mode never talks to the server; leaving it wipes everything.
 */
export function DemoShowcase() {
  const live = useApp((s) => s.mode === "live" && s.signedIn);
  return (
    <section id="demo" aria-labelledby="demo-entry-t" className="mx-auto max-w-6xl scroll-mt-6 px-4 py-12 sm:px-6 lg:px-10 lg:py-16">
      <div className={cn("relative isolate overflow-hidden rounded-panel block-lila", HARD)}>
        <HazardStripe className="h-4" />
        <span aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-dots opacity-50" />
        <Scatter count={5} seed={4} palette={["var(--ink)", "var(--block-mandarina)"]} className="-z-10" />
        <Rivets className="top-4" />
        <div className="absolute top-8 right-4 z-10 sm:top-10 sm:right-8 lg:top-auto lg:right-auto lg:bottom-12 lg:left-[24%]">
          <Sticker variant="lime" size="md" rotate={10} className="border-[3px] border-ink">
            <strong>Demo</strong>sin registro
          </Sticker>
        </div>
        <div className="grid gap-8 p-5 pt-7 sm:p-8 lg:grid-cols-[0.85fr_1.6fr] lg:items-center lg:gap-10 lg:p-10">
          <div className="min-w-0">
            <Tape className="mr-28 -rotate-2 sm:mr-36 lg:mr-0">Datos de ejemplo de Saltillo</Tape>
            <h2
              id="demo-entry-t"
              className="mt-4 pr-24 font-display text-[2.4rem] leading-[0.98] font-extrabold tracking-[-0.045em] text-balance sm:pr-32 sm:text-[3.1rem] lg:pr-0"
            >
              Pruébala sin registrarte.
            </h2>
            <p className="mt-4 max-w-[30rem] text-[1.05rem] leading-relaxed text-muted-foreground">
              Recorre la app completa con vacantes de ejemplo en colonias reales de Saltillo. No pedimos datos y nada se
              guarda: sales cuando quieras.
            </p>
            <div className="mt-6 hidden lg:block">
              <div className={cn("inline-block rounded-tile bg-white/70 p-2", HARD_SM)}>
                <Mascot mood="saluda" prop="casco" size={132} />
              </div>
            </div>
            {live ? (
              <p className="mt-4 text-[0.92rem] font-semibold">Al entrar a la demo se cierra tu sesión en este teléfono.</p>
            ) : null}
          </div>
          <div className="grid min-w-0 gap-5 sm:grid-cols-2">
            {CARDS.map((c, i) => (
              <DemoCard key={c.role} card={c} index={i} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

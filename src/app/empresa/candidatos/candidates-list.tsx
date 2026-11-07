"use client";

import { useState } from "react";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import { LockIcon, Message01Icon, Tick02Icon, UserIcon } from "@hugeicons/core-free-icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BLOCK_CLASS, DistanceRing, Eyebrow, HeroCard, Panel, rotateTone } from "@/components/chamba/primitives";
import { CountUp, Stagger, StaggerItem } from "@/components/chamba/motion";
import { CategoryIcon } from "@/components/chamba/job-icons";
import { Scene } from "@/components/chamba/art/scenes";
import { Burst, Doodle } from "@/components/chamba/art/doodles";
import type { CategoryId } from "@/lib/data/types";
import { formatKm, type RadiusKm } from "@/lib/geo";
import { cn } from "@/lib/utils";
import { CANDIDATES, categoryForPuesto } from "../candidates-data";
import { InitialsAvatar, RadiusChips } from "../wait-ring";
import { EmployerGate } from "@/components/empresa/employer-gate";
import { useIsLive } from "@/lib/store";
import { LiveCandidates } from "./live-candidates";

/** Rugged workwear edge: ink outline + hard offset shadow (no blur). */
const RUG =
  "border-2 border-ink shadow-[4px_5px_0_0_var(--ink)] dark:border-black/70 dark:shadow-[4px_5px_0_0_rgb(0_0_0/0.55)]";

const PUESTO_FILTERS: { id: CategoryId | "todos"; label: string }[] = [
  { id: "todos", label: "Todos" },
  { id: "montacargas", label: "Montacargas" },
  { id: "almacen", label: "Almacén" },
  { id: "chofer", label: "Chofer" },
  { id: "produccion", label: "Producción" },
];

/** Demo: mock people near the demo company. Live: who applied to my vacancies (privacy: no one else). */
export function CandidatesList() {
  const live = useIsLive();
  return <EmployerGate shape="cards">{() => (live ? <LiveCandidates /> : <DemoCandidates />)}</EmployerGate>;
}

function DemoCandidates() {
  const [radius, setRadius] = useState<RadiusKm>(5);
  const [puesto, setPuesto] = useState<CategoryId | "todos">("todos");
  const inRadius = CANDIDATES.filter((c) => c.km <= radius);
  const list = inRadius
    .filter((c) => puesto === "todos" || categoryForPuesto(c.puesto) === puesto)
    .toSorted((a, b) => a.km - b.km);
  const applied = inRadius.filter((c) => c.applied).length;

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 lg:items-start lg:gap-6">
      {/* ------------------------------------------------ Hero: radius control (the one saturated block) */}
      <HeroCard
        tone="uva"
        decor={false}
        eyebrow="Tu radar de talento"
        className={cn("animate-rise overflow-hidden lg:sticky lg:top-6 lg:col-span-5", RUG)}
        title={
          <>
            <CountUp value={inRadius.length} className="inline-block tabular-nums" /> personas a menos de{" "}
            <span className="inline-block -rotate-2 rounded-xl bg-limon px-2 text-ink">{radius} km</span>
          </>
        }
      >
        <span aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-[inherit]">
          <span className="absolute inset-0 bg-dots text-white [mask-image:linear-gradient(to_bottom,black,transparent_70%)]" />
          <Doodle name="rayo" color="var(--block-sol)" className="absolute top-6 right-6 size-10 rotate-12" />
        </span>
        <p className="mt-3 max-w-sm text-[1.02rem] leading-snug text-primary-foreground/80">
          {applied > 0 ? (
            <>
              <strong className="font-bold text-primary-foreground">{applied}</strong> ya se postularon a tus vacantes.
            </>
          ) : (
            "Amplía el radio para encontrar a más gente."
          )}
        </p>
        <RadiusChips value={radius} onChange={setRadius} tone="hero" className="mt-5" />
        <div aria-hidden className="relative -mx-6 mt-5 -mb-6 flex items-end justify-between sm:-mx-7 sm:-mb-7">
          <Scene name="busqueda" className="w-48 translate-x-3 translate-y-3 sm:w-56" />
          <Burst size={92} color="var(--limon)" points={14} className="mr-5 mb-6 rotate-6 text-[0.7rem] leading-none">
            <span className="block text-center">
              <span className="block text-[1.6rem]">
                <CountUp value={applied} />
              </span>
              postulados
            </span>
          </Burst>
        </div>
      </HeroCard>

      <div className="min-w-0 space-y-4 lg:col-span-7">
        {/* ------------------------------------------------ Puesto filter chips */}
        <div
          role="group"
          aria-label="Filtrar por puesto"
          className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pt-1 pb-2 lg:mx-0 lg:flex-wrap lg:px-0"
        >
          {PUESTO_FILTERS.map((f) => {
            const on = f.id === puesto;
            return (
              <button
                key={f.id}
                type="button"
                aria-pressed={on}
                onClick={() => setPuesto(f.id)}
                className={cn(
                  "group press inline-flex h-12 shrink-0 items-center gap-2 rounded-full border-2 border-ink pr-4 pl-1.5 font-display text-[1rem] font-bold whitespace-nowrap transition-[background-color,color,translate,box-shadow] outline-none focus-visible:ring-4 focus-visible:ring-ring/50",
                  on
                    ? "bg-ink text-white shadow-[3px_3px_0_0_var(--limon)] dark:border-white/80"
                    : "bg-card text-foreground shadow-[3px_3px_0_0_var(--ink)] hover:-translate-y-0.5 dark:border-black/70",
                )}
              >
                {f.id === "todos" ? (
                  <span
                    className={cn(
                      "grid size-8 place-items-center rounded-full",
                      on ? "bg-limon text-ink" : "bg-block-sol text-ink",
                    )}
                  >
                    <HugeiconsIcon icon={UserIcon} className="size-4.5" strokeWidth={2.2} />
                  </span>
                ) : (
                  <CategoryIcon category={f.id} size="xs" />
                )}
                {f.label}
              </button>
            );
          })}
        </div>

        {/* ------------------------------------------------ Candidate blocks */}
        {list.length === 0 ? (
          <Panel tone="lila" className={cn("flex flex-col items-center text-center", RUG)}>
            <Scene name="vacio" className="w-52" />
            <h2 className="mt-2 font-display text-[1.4rem] font-extrabold">Nadie todavía en este radio</h2>
            <p className="mt-1 max-w-xs text-muted-foreground">Amplía la distancia o quita el filtro para ver más candidatos.</p>
            <Button
              size="lg"
              className="mt-4"
              onClick={() => {
                setPuesto("todos");
                setRadius(15);
              }}
            >
              Ver a todos
            </Button>
          </Panel>
        ) : (
          <Stagger as="ul" className="space-y-4" aria-label={`${list.length} candidatos a menos de ${radius} km`}>
            {list.map((c, i) => {
              const cat = categoryForPuesto(c.puesto);
              const tone = rotateTone(i);
              return (
                <StaggerItem
                  as="li"
                  key={c.id}
                  className={cn("group lift relative overflow-hidden rounded-panel p-4 sm:p-5", BLOCK_CLASS[tone], RUG)}
                  style={{ rotate: `${i % 2 ? 0.6 : -0.6}deg` }}
                >
                  <div className="flex items-start gap-3.5">
                    <InitialsAvatar name={c.name} size="lg" />
                    <div className="min-w-0 flex-1">
                      <p className="font-display text-[1.25rem] leading-tight font-extrabold tracking-[-0.02em] break-words">
                        {c.name}
                      </p>
                      <p className="mt-0.5 text-[0.95rem] font-medium">{c.puesto}</p>
                    </div>
                    <CategoryIcon
                      category={cat}
                      size="md"
                      className="-mt-1 -mr-1 shrink-0 rotate-6 transition-transform duration-300 group-hover:-rotate-6"
                    />
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="inline-flex h-8 items-center gap-1.5 rounded-full border-2 border-ink bg-white pr-2.5 pl-1 font-display text-[0.9rem] font-bold text-ink [--tile:rgb(22_15_51/0.12)]">
                      <DistanceRing km={c.km} radiusKm={radius} size={22} showLabel={false} />
                      <span className="sr-only">A </span>
                      {formatKm(c.km)}
                    </span>
                    {c.applied ? (
                      <Badge variant="lime" size="md" className="h-8 border-2 border-ink">
                        <HugeiconsIcon icon={Tick02Icon} className="size-4" strokeWidth={2.4} />
                        Se postuló
                      </Badge>
                    ) : null}
                    <span className="inline-flex h-8 items-center rounded-full border-2 border-ink/25 bg-white/50 px-2.5 text-[0.85rem] font-semibold">
                      {c.experience}
                    </span>
                    <span className="inline-flex h-8 items-center rounded-full border-2 border-ink/25 bg-white/50 px-2.5 text-[0.85rem] font-semibold">
                      Col. {c.colonia}
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2 sm:flex sm:justify-end">
                    <Button
                      className="h-12 border-2 border-ink bg-ink px-4 text-white hover:bg-ink/90 dark:border-black/70"
                      onClick={() => toast.success(`Abriendo SMS para ${c.name.split(" ")[0]}…`)}
                    >
                      <HugeiconsIcon icon={Message01Icon} className="size-5 text-limon" strokeWidth={1.8} />
                      SMS
                    </Button>
                    <Button
                      variant="white"
                      className="h-12 border-2 border-ink px-4 bg-white text-ink hover:bg-white/90 dark:bg-white dark:text-ink"
                      onClick={() => toast(`Perfil de ${c.name}`, { description: `${c.puesto} · ${c.experience} de experiencia` })}
                    >
                      Ver perfil
                    </Button>
                  </div>
                </StaggerItem>
              );
            })}
          </Stagger>
        )}

        {/* ------------------------------------------------ Privacy note */}
        <Panel tone="tinta" className={cn("flex items-start gap-3.5", RUG)}>
          <span className="grid size-11 shrink-0 place-items-center rounded-xl border-2 border-white/20 bg-block-sol text-ink">
            <HugeiconsIcon icon={LockIcon} className="size-5" strokeWidth={2.2} />
          </span>
          <div>
            <Eyebrow tone="lime">Privacidad</Eyebrow>
            <p className="mt-1 text-[0.98rem] leading-snug">
              Mostramos la colonia y una distancia aproximada. La dirección exacta de cada persona nunca se comparte.
            </p>
          </div>
        </Panel>
      </div>
    </div>
  );
}

"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import { Location06Icon } from "@hugeicons/core-free-icons";
import { StatusDot } from "@/components/chamba/primitives";
import { CountUp } from "@/components/chamba/motion";
import { RadiusBar } from "@/components/chamba/radius-bar";
import { Radar } from "@/components/chamba/radar";
import { useApp, useJobsByDistance } from "@/lib/store";
import { bandColor, bandFor } from "@/lib/geo";
import { cn } from "@/lib/utils";
import { HARD, HazardStripe, Rivets } from "./decor";

/** The landing hero is the product itself: pick a radius, watch the jobs around you change. */
export function HeroDemo({ className }: { className?: string }) {
  const radiusKm = useApp((s) => s.radiusKm);
  const setRadius = useApp((s) => s.setRadius);
  const colonia = useApp((s) => s.colonia);
  const jobs = useJobsByDistance();
  const inRadius = jobs.filter((j) => j.km <= radiusKm);

  return (
    <section
      aria-labelledby="demo-t"
      className={cn("relative isolate min-w-0 overflow-hidden rounded-panel block-cielo", HARD, className)}
    >
      <HazardStripe className="h-3.5" />
      <span aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-dots opacity-70" />
      <Rivets className="top-3.5" />
      <div className="p-5 pt-4 sm:p-7 sm:pt-5">
        <header className="flex items-center gap-3">
          <h2 id="demo-t" className="font-display text-[1.55rem] leading-tight font-extrabold tracking-[-0.03em]">
            Pruébalo aquí
          </h2>
          <span className="ml-auto inline-flex h-8 items-center gap-2 rounded-full border-2 border-ink bg-white px-3 text-sm font-bold text-ink">
            <StatusDot color="var(--nopal)" pulse />
            En vivo
          </span>
        </header>
        <div className="mt-3 grid items-center gap-4 sm:grid-cols-[1fr_minmax(0,13rem)]">
          <div className="order-2 sm:order-1">
            <p className="flex flex-wrap items-baseline gap-x-3">
              <CountUp
                value={inRadius.length}
                className="font-display text-[4.8rem] leading-[0.85] font-extrabold tracking-[-0.06em] tabular-nums"
              />
              <span className="font-display text-xl font-extrabold uppercase tracking-[0.04em]">vacantes</span>
            </p>
            <p className="mt-3 text-[1.02rem] text-muted-foreground">
              a menos de{" "}
              <span className="inline-flex items-center gap-1.5 rounded-full border-2 border-ink bg-white px-2.5 py-0.5 font-bold text-ink tabular-nums">
                <span aria-hidden className="size-2.5 rounded-full" style={{ background: bandColor(bandFor(radiusKm)) }} />
                {radiusKm} km
              </span>{" "}
              de {colonia}, Saltillo
            </p>
          </div>
          <div className="relative order-1 mx-auto w-full max-w-[15rem] sm:order-2">
            <div className="rounded-full border-[3px] border-ink bg-white p-2">
              <Radar jobs={jobs} radiusKm={radiusKm} compact />
            </div>
          </div>
        </div>
        <div className="mt-5 rounded-tile border-2 border-ink bg-white p-3 text-ink">
          <RadiusBar value={radiusKm} onChange={setRadius} label="Prueba un radio de búsqueda" />
        </div>
        <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <HugeiconsIcon icon={Location06Icon} className="size-4 shrink-0" strokeWidth={1.8} />
          Vacantes de demostración en colonias reales de Saltillo.
        </p>
      </div>
    </section>
  );
}

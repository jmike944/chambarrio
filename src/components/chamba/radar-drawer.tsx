"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowRight01Icon,
  Bus01Icon,
  Cancel01Icon,
  MapsLocation01Icon,
  Store01Icon,
  WalkingIcon,
} from "@hugeicons/core-free-icons";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { BLOCK_CLASS, Eyebrow, type BlockTone } from "@/components/chamba/primitives";
import { CATEGORY_BLOCK, CategoryArt } from "@/components/chamba/job-icons";
import { JobRow } from "@/components/chamba/job-row";
import { useApp } from "@/lib/store";
import { bandColor, bandFor, commuteOptions, distanceKm, formatKm, type RadiusKm } from "@/lib/geo";
import { cn } from "@/lib/utils";
import { stopFor, vacantes, type RadarSpot } from "./radar-spots";

/** Solid block backgrounds (important: the drawer shell paints bg-transparent). Static for Tailwind. */
const BLOCK_BG: Record<BlockTone, string> = {
  lila: "bg-block-lila!",
  chicle: "bg-block-chicle!",
  limon: "bg-block-limon!",
  cielo: "bg-block-cielo!",
  sol: "bg-block-sol!",
  menta: "bg-block-menta!",
  durazno: "bg-block-durazno!",
  mandarina: "bg-block-mandarina!",
  uva: "bg-block-uva!",
  tinta: "bg-block-tinta!",
};

const DESKTOP = "(min-width: 1024px)";
function subscribe(cb: () => void) {
  const m = window.matchMedia(DESKTOP);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
}
/** lg and up: the spot opens as a side sheet beside the dashboard instead of a bottom sheet. */
function useIsDesktop() {
  return useSyncExternalStore(subscribe, () => window.matchMedia(DESKTOP).matches, () => false);
}

const RING = "outline-none focus-visible:ring-3 focus-visible:ring-[color:var(--ink)]/45";

/**
 * Bottom sheet (side sheet on desktop) for one place on the radar: who's hiring there, how far it
 * is and how you'd get there, its vacancies, and the company's other branches.
 */
export function RadarDrawer({
  spot,
  open,
  onOpenChange,
  radiusKm,
  spotsById,
  onSelect,
  onWiden,
  onCloseAutoFocus,
}: {
  spot: RadarSpot | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  radiusKm: number;
  spotsById: Map<string, RadarSpot>;
  onSelect: (branchId: string) => void;
  onWiden: (r: RadiusKm) => void;
  onCloseAutoFocus: (e: Event) => void;
}) {
  const desktop = useIsDesktop();
  const tone: BlockTone = spot ? CATEGORY_BLOCK[spot.category] : "cielo";

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      // Desktop: a non-modal sheet from the left, so the radar (right column) stays visible and live —
      // the selected pin, the aimed beam, and clicking another pin switches the sheet.
      direction={desktop ? "left" : "bottom"}
      modal={!desktop}
    >
      <DrawerContent
        onCloseAutoFocus={onCloseAutoFocus}
        className={cn(
          BLOCK_CLASS[tone],
          BLOCK_BG[tone],
          "overflow-hidden p-0 text-foreground! transition-[background-color] duration-300 before:hidden",
          "border-[2.5px] border-[color:var(--ink)] dark:border-black/70",
          // the vaul grab handle (first child)
          "*:first:mt-3 *:first:bg-[color:var(--ink)]/25",
          desktop
            ? "inset-y-3! left-3! w-[26.5rem]! max-w-[calc(100vw-1.5rem)]! rounded-[2rem] shadow-[6px_6px_0_var(--ink)] dark:shadow-[6px_6px_0_rgb(0_0_0/0.6)]"
            : "max-h-[86dvh]! rounded-t-[2rem] border-b-0",
        )}
      >
        {spot ? (
          <SpotBody
            spot={spot}
            radiusKm={radiusKm}
            spotsById={spotsById}
            onSelect={onSelect}
            onWiden={onWiden}
            desktop={desktop}
          />
        ) : (
          <DrawerTitle className="sr-only">Lugar en el radar</DrawerTitle>
        )}
      </DrawerContent>
    </Drawer>
  );
}

function SpotBody({
  spot,
  radiusKm,
  spotsById,
  onSelect,
  onWiden,
  desktop,
}: {
  spot: RadarSpot;
  radiusKm: number;
  spotsById: Map<string, RadarSpot>;
  onSelect: (branchId: string) => void;
  onWiden: (r: RadiusKm) => void;
  desktop: boolean;
}) {
  const home = useApp((s) => s.home);
  const { company, branch, jobs, km } = spot;
  const band = bandFor(km);
  const commute = commuteOptions(km);
  const walk = commute.find((c) => c.mode === "caminando");
  const bus = commute.find((c) => c.mode === "camion");
  const next = stopFor(km);
  const others = company.locations
    .filter((b) => b.id !== branch.id)
    .map((b) => ({ b, km: distanceKm(home, b.location), spot: spotsById.get(b.id) }))
    .toSorted((a, z) => a.km - z.km);
  const multi = company.locations.length > 1;

  return (
    <div
      key={spot.id}
      className={cn(
        "relative flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] motion-safe:animate-rise sm:px-6",
        desktop ? "pt-6" : "pt-3",
      )}
    >
      <span aria-hidden className="pointer-events-none absolute inset-0 bg-dots text-[color:var(--ink)]/[0.07]" />
      <CategoryArt
        category={spot.category}
        animated
        className={cn(
          "pointer-events-none absolute -right-5 size-[7.25rem] rotate-[8deg] drop-shadow-[3px_4px_0_rgb(22_15_51/0.85)]",
          desktop ? "-right-8 bottom-4 size-[13rem] -rotate-[8deg]! opacity-90" : "top-[4.25rem]",
        )}
      />
      <DrawerClose asChild>
        <Button
          variant="white"
          size="icon-lg"
          aria-label="Cerrar"
          className={cn("absolute right-4 z-10 border-2 border-[color:var(--ink)] bg-white text-ink shadow-[0_3px_0_var(--ink)]", desktop ? "top-4" : "top-2")}
        >
          <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2.2} />
        </Button>
      </DrawerClose>

      <DrawerHeader className={cn("relative gap-1 p-0 text-left! md:gap-1", desktop ? "pr-14" : "pr-24")}>
        <Eyebrow>
          {company.kind}
          {multi ? ` · ${company.locations.length} sucursales` : ""}
        </Eyebrow>
        <DrawerTitle className="font-display text-[1.8rem] leading-[1.02] font-extrabold tracking-[-0.035em] text-foreground">
          {company.name}
        </DrawerTitle>
        <DrawerDescription className="text-[1rem] leading-snug font-semibold text-foreground">
          {branch.name}
          {branch.colonia !== branch.name ? <span className="font-normal text-muted-foreground"> · {branch.colonia}</span> : null}
        </DrawerDescription>
      </DrawerHeader>

      {/* distance + how you'd get there */}
      <div className={cn("relative mt-4 flex flex-wrap items-center gap-2", desktop ? "pr-0" : "pr-24")}>
        <span className="inline-flex h-9 items-center gap-2 rounded-full border-2 border-[color:var(--ink)] bg-white px-3 text-[0.95rem] font-bold text-ink tabular-nums shadow-[0_2px_0_var(--ink)]">
          <span aria-hidden className="size-2.5 rounded-full ring-2 ring-[color:var(--ink)]/15" style={{ background: bandColor(band) }} />
          a {formatKm(km)} de tu casa
        </span>
        {walk ? <Hint icon={WalkingIcon} text={`${walk.minutes} min`} label="caminando" /> : null}
        {bus ? <Hint icon={Bus01Icon} text={`${bus.minutes} min`} label="en camión" /> : null}
      </div>

      {spot.inside ? null : (
        <div className="relative mt-4 rounded-tile border-2 border-dashed border-[color:var(--ink)]/45 bg-white/55 p-4">
          <p className="font-display text-lg leading-tight font-extrabold">Fuera de tu radio de {radiusKm} km</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Queda a {formatKm(km)}. {next ? `Con ${next} km ya entra en tu búsqueda.` : "Está más lejos que el radio máximo."}
          </p>
          {next ? (
            <Button size="lg" className="mt-3 w-full" onClick={() => onWiden(next)}>
              Ampliar mi radio a {next} km
            </Button>
          ) : null}
        </div>
      )}

      <section aria-labelledby="spot-jobs" className="relative mt-5">
        <h3 id="spot-jobs" className="font-display text-[1.2rem] font-extrabold">
          {jobs.length === 1 ? "1 vacante aquí" : `${jobs.length} vacantes aquí`}
        </h3>
        <ul className="mt-1 divide-y-2 divide-dashed divide-[color:var(--ink)]/15">
          {jobs.map((j) => (
            <li key={j.id}>
              <JobRow job={j} km={j.km} radiusKm={radiusKm} meta={j.shift} className="hover:bg-white/55 dark:hover:bg-white/55" />
            </li>
          ))}
        </ul>
      </section>

      {others.length ? (
        <section aria-labelledby="spot-others" className="relative mt-5 rounded-tile border-2 border-[color:var(--ink)]/15 bg-white/50 p-3">
          <h3 id="spot-others" className="px-1 text-[0.78rem] font-bold tracking-[0.12em] uppercase">
            Otras sucursales de {company.name}
          </h3>
          <ul className="mt-1.5 space-y-1">
            {others.map(({ b, km: bk, spot: s }) => {
              const n = s?.jobs.length ?? 0;
              const body = (
                <>
                  <span className="grid size-10 shrink-0 place-items-center rounded-full border-2 border-[color:var(--ink)] bg-white text-ink">
                    <HugeiconsIcon icon={Store01Icon} className="size-5" strokeWidth={2} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{b.name}</span>
                    <span className="block truncate text-sm text-muted-foreground">
                      {n ? vacantes(n) : bk > 15 ? "Fuera del radar" : "Sin vacantes ahorita"}
                      {b.colonia !== b.name ? ` · ${b.colonia}` : ""}
                    </span>
                  </span>
                  <span className="inline-flex shrink-0 items-center gap-1.5 text-sm font-bold tabular-nums">
                    <span aria-hidden className="size-2 rounded-full" style={{ background: bandColor(bandFor(bk)) }} />
                    {formatKm(bk)}
                  </span>
                  {s ? <HugeiconsIcon icon={ArrowRight01Icon} className="size-4 shrink-0" strokeWidth={2.4} /> : null}
                </>
              );
              return (
                <li key={b.id}>
                  {s ? (
                    <button
                      type="button"
                      onClick={() => onSelect(b.id)}
                      aria-label={`Ver ${b.name}: ${n ? vacantes(n) : "sin vacantes"} a ${formatKm(bk)}`}
                      className={cn("press flex min-h-12 w-full items-center gap-3 rounded-xl px-1.5 py-1.5 text-left transition-colors hover:bg-white/70", RING)}
                    >
                      {body}
                    </button>
                  ) : (
                    <div className="flex min-h-12 items-center gap-3 px-1.5 py-1.5 opacity-75">{body}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <Button size="lg" asChild className="relative mt-5 w-full shrink-0">
        <Link href="/mapa">
          <HugeiconsIcon icon={MapsLocation01Icon} strokeWidth={2} />
          Ver en el mapa
        </Link>
      </Button>
    </div>
  );
}

function Hint({ icon, text, label }: { icon: typeof WalkingIcon; text: string; label: string }) {
  return (
    <span className="inline-flex h-9 items-center gap-1.5 rounded-full bg-white/60 px-3 text-[0.9rem] font-semibold tabular-nums">
      <HugeiconsIcon icon={icon} className="size-4" strokeWidth={2.2} aria-hidden />
      {text}
      <span className="font-normal">{label}</span>
    </span>
  );
}

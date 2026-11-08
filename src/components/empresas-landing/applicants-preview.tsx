import { HugeiconsIcon } from "@hugeicons/react";
import { Location06Icon, Store01Icon } from "@hugeicons/core-free-icons";
import { AvatarCircle, randomAvatar } from "@/components/avatar";
import { HARD, HazardStripe, Rivets } from "@/components/landing/decor";
import { bandColor, bandFor, formatKm } from "@/lib/geo";
import { cn } from "@/lib/utils";

/*
 * /empresas hero: what a company sees when people apply — who lives near the branch, ordered by
 * distance. Static, labeled example data (no real people, no live database).
 */

type Sample = { seed: string; colonia: string; km: number; fact: string; deg: number };

const SAMPLE: Sample[] = [
  { seed: "ejemplo-lourdes", colonia: "Lourdes", km: 1.2, fact: "2 años en almacén", deg: 52 },
  { seed: "ejemplo-bellavista", colonia: "Bellavista", km: 2.6, fact: "Disponible ya", deg: 248 },
  { seed: "ejemplo-republica", colonia: "República", km: 4.3, fact: "Maneja montacargas", deg: 300 },
  { seed: "ejemplo-guayulera", colonia: "Guayulera", km: 7.8, fact: "1 año en producción", deg: 128 },
  { seed: "ejemplo-mirasierra", colonia: "Mirasierra", km: 11.5, fact: "Busca turno nocturno", deg: 352 },
];

const RINGS = [15, 10, 5, 2];
/** km → % of the box from its center. Square-root scale keeps the first kilometers readable. */
const r = (km: number) => 10 + Math.sqrt(Math.min(km, 15) / 15) * 36;

function RingRadar({ className }: { className?: string }) {
  return (
    <div className={cn("relative aspect-square w-full", className)}>
      <div className="absolute inset-0 rounded-full border-[3px] border-ink bg-white" />
      {RINGS.map((km) => (
        <span
          key={km}
          aria-hidden
          className="absolute rounded-full border-2 border-dashed border-ink/25"
          style={{
            inset: `${50 - r(km)}%`,
            background: `color-mix(in oklab, ${bandColor(bandFor(km))} 16%, white)`,
          }}
        />
      ))}
      {RINGS.map((km) => (
        <span
          key={`l${km}`}
          aria-hidden
          className="absolute -translate-x-1/2 rounded-full bg-white px-1.5 text-[0.68rem] leading-4 font-bold text-ink tabular-nums"
          style={{ left: "50%", top: `${50 + r(km) - 4}%` }}
        >
          {km} km
        </span>
      ))}
      <span className="absolute top-1/2 left-1/2 grid size-11 -translate-1/2 place-items-center rounded-full border-[2.5px] border-ink bg-block-sol text-ink shadow-[2px_2px_0_0_var(--ink)]">
        <HugeiconsIcon icon={Store01Icon} className="size-5.5" strokeWidth={2} />
      </span>
      {SAMPLE.map((a) => {
        const rad = (a.deg * Math.PI) / 180;
        return (
          <span
            key={a.seed}
            aria-hidden
            className="absolute -translate-1/2 rounded-full border-[2.5px] border-ink shadow-[2px_2px_0_0_var(--ink)]"
            style={{ left: `${50 + r(a.km) * Math.sin(rad)}%`, top: `${50 - r(a.km) * Math.cos(rad)}%` }}
          >
            <AvatarCircle config={randomAvatar(a.seed)} size={34} className="block" />
          </span>
        );
      })}
    </div>
  );
}

export function ApplicantsPreview({ className }: { className?: string }) {
  const near = SAMPLE.filter((a) => a.km <= 5).length;
  return (
    <section
      aria-labelledby="preview-t"
      className={cn("relative isolate flex min-w-0 flex-col overflow-hidden rounded-panel block-cielo", HARD, className)}
    >
      <HazardStripe className="h-3.5" />
      <span aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-dots opacity-70" />
      <Rivets className="top-3.5" />
      <div className="flex flex-1 flex-col p-5 pt-4 sm:p-7 sm:pt-5">
        <header className="flex items-center gap-3">
          <h2 id="preview-t" className="font-display text-[1.55rem] leading-tight font-extrabold tracking-[-0.03em]">
            ¿Quién vive cerca?
          </h2>
          <span className="ml-auto inline-flex h-8 shrink-0 items-center rounded-full border-2 border-ink bg-white px-3 text-sm font-bold text-ink">
            Ejemplo
          </span>
        </header>
        <p className="mt-1 text-[0.98rem] font-semibold text-muted-foreground">Ayudante general · Sucursal Centro</p>
        <div className="mt-4 grid flex-1 grid-cols-1 items-center gap-5 sm:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] lg:grid-cols-1 lg:content-center">
          <RingRadar className="mx-auto max-w-[15rem] lg:max-w-[16rem]" />
          <div className="min-w-0">
            <p className="flex flex-wrap items-baseline gap-x-2">
              <span className="font-display text-[2.6rem] leading-none font-extrabold tracking-[-0.05em] tabular-nums">{SAMPLE.length}</span>
              <span className="font-display text-lg font-extrabold uppercase">postulantes</span>
              <span className="text-[0.95rem] text-muted-foreground">· {near} a menos de 5 km</span>
            </p>
            <ul className="mt-3 grid grid-cols-1 gap-2">
              {SAMPLE.slice(0, 3).map((a) => (
                <li key={a.seed} className="flex min-w-0 items-center gap-3 rounded-tile border-2 border-ink bg-white px-3 py-2 text-ink">
                  <AvatarCircle config={randomAvatar(a.seed)} size={36} className="border-2 border-ink" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[0.95rem] font-bold">Vive en {a.colonia}</span>
                    <span className="block truncate text-[0.85rem] text-ink/70">{a.fact}</span>
                  </span>
                  <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border-2 border-ink px-2 py-0.5 text-[0.85rem] font-bold tabular-nums">
                    <span aria-hidden className="size-2.5 rounded-full" style={{ background: bandColor(bandFor(a.km)) }} />
                    {formatKm(a.km)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <HugeiconsIcon icon={Location06Icon} className="size-4 shrink-0" strokeWidth={1.8} />
          Ejemplo: colonias reales, personas ficticias.
        </p>
      </div>
    </section>
  );
}

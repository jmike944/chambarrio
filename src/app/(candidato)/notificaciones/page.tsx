import type { Metadata } from "next";
import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowRight01Icon,
  Calendar03Icon,
  Notification01Icon,
  Settings02Icon,
  ViewIcon,
} from "@hugeicons/core-free-icons";
import { PageHeader } from "@/components/chamba/page-header";
import { BLOCK_CLASS, HeroCard, type BlockTone } from "@/components/chamba/primitives";
import { Sticker } from "@/components/chamba/motion";
import { CategoryArt, CategoryIcon } from "@/components/chamba/job-icons";
import { Scene } from "@/components/chamba/art/scenes";
import { Doodle } from "@/components/chamba/art/doodles";
import type { CategoryId } from "@/lib/data/types";
import { formatMinutesAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import { HARD, HARD_SM, HazardTape, Stamp, STENCIL } from "../postulaciones/rugged";

export const metadata: Metadata = { title: "Avisos" };

type CSSVars = React.CSSProperties & Record<`--${string}`, string | number>;

type Item = {
  href: string;
  title: string;
  body: string;
  minutesAgo: number;
  tone: BlockTone;
  kind: "vacante" | "entrevista" | "vista";
  /** Job category when the notice is about a vacancy (cartoon icon). */
  category?: CategoryId;
  tag: string;
};

/** Adjacent cards never share a tone; no pink. */
const ITEMS: Item[] = [
  { href: "/vacantes/barista-alameda", kind: "vacante", category: "restaurante", tone: "sol", tag: "Vacante nueva", title: "Nueva vacante a 1.4 km", body: "Barista en Café La Alameda · $1,950/sem", minutesAgo: 3 },
  { href: "/postulaciones", kind: "entrevista", category: "caja", tone: "limon", tag: "Entrevista", title: "Te invitaron a entrevista", body: "Farmacias Bienestar te espera el jueves a las 10:00", minutesAgo: 90 },
  { href: "/postulaciones", kind: "vista", category: "seguridad", tone: "cielo", tag: "Te vieron", title: "Seguridad Centinela vio tu postulación", body: "Ten tu teléfono a la mano: pueden llamarte hoy", minutesAgo: 300 },
  { href: "/vacantes/repartidor-desierto", kind: "vacante", category: "chofer", tone: "durazno", tag: "Buen sueldo", title: "Vacante con buen sueldo a 3.2 km", body: "Repartidor en moto · $3,100/sem · gasolina pagada", minutesAgo: 1440 },
];

const KIND_ICON = { entrevista: Calendar03Icon, vista: ViewIcon } as const;
const isNew = (n: Item) => n.minutesAgo < 120;

export default function NotificacionesPage() {
  const fresh = ITEMS.filter(isNew).length;
  return (
    <>
      <PageHeader title="Avisos" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start lg:gap-7">
        {/* Hero — the one saturated block on this screen */}
        <div className="lg:sticky lg:top-6 lg:col-span-5 lg:col-start-8 lg:row-start-1">
          <HeroCard
            tone="mandarina"
            eyebrow="Tu radar de chamba"
            title={<>¡Chamba a la vista!</>}
            className={cn("animate-rise overflow-visible", HARD, "shadow-[6px_6px_0_0_var(--ink)]!")}
            sticker={
              <Sticker variant="ink" rotate={10} dot>
                <strong>{fresh}</strong>nuevos
              </Sticker>
            }
          >
            <span aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-[inherit]">
              <span className="absolute inset-0 bg-dots text-ink opacity-[0.12]" />
              <HazardTape className="absolute inset-x-0 bottom-0 h-3 border-b-0" />
            </span>
            <div className="mt-3 flex items-end gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-[1rem] leading-snug text-muted-foreground">
                  Vacantes nuevas, entrevistas y quién vio tu postulación. Todo aquí y por WhatsApp.
                </p>
                <div className="mt-4 flex items-center gap-2">
                  <span className="grid size-12 shrink-0 origin-top animate-ring place-items-center rounded-full border-2 border-ink bg-white text-ink">
                    <HugeiconsIcon icon={Notification01Icon} className="size-6" strokeWidth={2.2} />
                  </span>
                  <p className="text-[0.9rem] leading-tight font-semibold">
                    <span className={cn("block text-[1.6rem] leading-none", STENCIL)}>{ITEMS.length}</span>
                    avisos esta semana
                  </p>
                </div>
              </div>
              <Scene name="whatsapp" className="-mr-3 -mb-3 w-36 shrink-0 sm:w-40" />
            </div>
            <Link
              href="/perfil"
              className="press lift mt-5 mb-2 flex h-12 w-full items-center justify-center gap-2 rounded-full border-2 border-ink bg-ink text-[1rem] font-semibold text-white outline-none focus-visible:ring-3 focus-visible:ring-white"
            >
              <HugeiconsIcon icon={Settings02Icon} className="size-5" strokeWidth={2} />
              Elegir qué avisos recibo
            </Link>
          </HeroCard>
        </div>

        {/* Feed */}
        <section aria-labelledby="recientes" className="min-w-0 lg:col-span-7 lg:row-start-1">
          <h2 id="recientes" className="mb-4 flex items-center gap-2.5 px-1 font-display text-[1.45rem] font-extrabold tracking-[-0.03em]">
            Recientes
            <span className="grid h-7 min-w-7 -rotate-6 place-items-center rounded-md border-2 border-ink bg-[#FFD23F] px-2 font-sans text-[0.85rem] font-bold text-ink tabular-nums">
              {ITEMS.length}
            </span>
          </h2>
          <ul className="space-y-4">
            {ITEMS.map((n, i) => (
              <li key={n.title} className="animate-rise" style={{ "--i": Math.min(i + 1, 8), "--rise": "22px" } as CSSVars}>
                <Link
                  href={n.href}
                  className={cn(
                    "group lift press relative isolate flex items-start gap-3.5 overflow-hidden rounded-panel p-4 pr-5 outline-none focus-visible:ring-3 focus-visible:ring-ring/60 sm:p-5",
                    BLOCK_CLASS[n.tone],
                    HARD,
                  )}
                >
                  {n.category ? (
                    <CategoryArt
                      category={n.category}
                      className="pointer-events-none absolute -right-4 -bottom-5 -z-10 size-24 rotate-[-14deg] opacity-30 transition-transform duration-300 group-hover:rotate-0"
                    />
                  ) : null}
                  <span className="relative shrink-0">
                    {n.kind === "vacante" && n.category ? (
                      <CategoryIcon category={n.category} size="md" className={HARD_SM} />
                    ) : (
                      <span className={cn("grid size-12 place-items-center rounded-tile bg-ink text-white group-hover:animate-wiggle", HARD_SM)}>
                        <HugeiconsIcon icon={KIND_ICON[n.kind as keyof typeof KIND_ICON]} className="size-6" strokeWidth={2} />
                      </span>
                    )}
                    {isNew(n) ? (
                      <span aria-hidden className="absolute -top-1 -right-1 size-3.5 animate-beat rounded-full border-2 border-ink bg-chile" />
                    ) : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-[0.72rem] font-semibold tracking-[0.14em] text-muted-foreground uppercase">{n.tag}</span>
                      {isNew(n) ? <Stamp className="-rotate-3">Nuevo</Stamp> : null}
                    </span>
                    <span className="mt-1 block font-display text-[1.2rem] leading-tight font-bold tracking-[-0.02em]">{n.title}</span>
                    <span className="mt-1 block text-[0.95rem] leading-snug text-muted-foreground">{n.body}</span>
                    <span className="mt-3 flex items-center justify-between gap-2 text-[0.85rem] font-medium">
                      <span className="text-muted-foreground">{formatMinutesAgo(n.minutesAgo)}</span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-ink px-3 py-1.5 text-white transition-transform group-hover:translate-x-1">
                        Ver
                        <HugeiconsIcon icon={ArrowRight01Icon} className="size-4" strokeWidth={2.2} />
                      </span>
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>

          <div
            className={cn("relative isolate mt-6 overflow-hidden rounded-panel p-5 animate-rise", BLOCK_CLASS.lila, HARD)}
            style={{ "--i": 6 } as CSSVars}
          >
            <Doodle name="rayo" color="#FFD23F" className="absolute top-3 right-4 -z-10 size-8 rotate-12" />
            <Doodle name="zigzag" color="#FF6B2C" className="absolute right-14 bottom-3 -z-10 size-6 -rotate-6" />
            <p className="text-[0.72rem] font-semibold tracking-[0.14em] text-muted-foreground uppercase">Eso es todo por ahora</p>
            <p className="mt-1 font-display text-[1.3rem] leading-tight font-extrabold tracking-[-0.03em]">
              ¡Al día! Te avisamos cuando salga algo cerca.
            </p>
          </div>
        </section>
      </div>
    </>
  );
}

"use client";

import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import { CheckmarkBadge01Icon, ComingSoon01Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { BLOCK_CLASS, Eyebrow, type BlockTone } from "@/components/chamba/primitives";
import { Sticker, useConfetti } from "@/components/chamba/motion";
import { CategoryIcon } from "@/components/chamba/job-icons";
import { Scene, type SceneName } from "@/components/chamba/art/scenes";
import { Doodle, HazardTape, Marquee } from "@/components/chamba/art/doodles";
import type { CategoryId } from "@/lib/data/types";
import { cn } from "@/lib/utils";
import { useEmployerPlan, usePaymentsEnabled } from "@/lib/store";

/** Rugged workwear edge: ink outline + hard offset shadow (no blur). */
const RUG =
  "border-2 border-ink shadow-[5px_6px_0_0_var(--ink)] dark:border-black/70 dark:shadow-[5px_6px_0_0_rgb(0_0_0/0.55)]";

const PLANS: {
  id: string;
  name: string;
  price: string;
  unit: string;
  who: string;
  features: string[];
  tone: BlockTone;
  scene: SceneName;
  icons: CategoryId[];
  popular?: boolean;
}[] = [
  {
    id: "por-vacante",
    name: "Por vacante",
    price: "Gratis",
    unit: "para publicar",
    who: "Para negocios que contratan de vez en cuando.",
    features: [
      "Publica vacantes sin costo",
      "Ve cuántos se postulan y a qué distancia viven",
      "Desbloquea nombres y WhatsApp por $500 al mes por vacante",
    ],
    tone: "sol",
    scene: "negocio",
    icons: ["caja", "restaurante"],
  },
  {
    id: "pyme",
    name: "Pyme",
    price: "$1,500",
    unit: "MXN al mes",
    who: "Para negocios que contratan seguido.",
    features: ["Hasta 5 vacantes con postulaciones desbloqueadas", "Contacto directo por WhatsApp", "Factura CFDI"],
    tone: "mandarina",
    scene: "reparto",
    icons: ["chofer", "almacen"],
    popular: true,
  },
  {
    id: "industrial",
    name: "Industrial",
    price: "desde $6,500",
    unit: "MXN al mes",
    who: "Para plantas y centros con rotación constante.",
    features: [
      "Postulaciones desbloqueadas en todas tus vacantes",
      "Varias plantas o sucursales",
      "Reportes de distancia y permanencia",
      "Asesor dedicado",
    ],
    tone: "cielo",
    scene: "equipo",
    icons: ["montacargas", "construccion"],
  },
];

export function PlanCards() {
  const currentPlan = useEmployerPlan();
  const payments = usePaymentsEnabled();
  const fire = useConfetti();
  const plans = PLANS.map((p) => ({ ...p, current: p.id === currentPlan }));
  return (
    <div className="space-y-6">
      {payments ? null : (
        <section
          id="planes-pronto"
          aria-label="Pagos próximamente"
          className={cn("relative flex items-start gap-3.5 overflow-hidden rounded-panel p-5 sm:items-center sm:p-6", BLOCK_CLASS.lila, RUG)}
        >
          <span className="grid size-12 shrink-0 -rotate-6 place-items-center rounded-[0.9rem] border-2 border-ink bg-limon text-ink">
            <HugeiconsIcon icon={ComingSoon01Icon} className="size-6" strokeWidth={2} />
          </span>
          <div className="min-w-0">
            <Eyebrow>Próximamente</Eyebrow>
            <p className="mt-1 font-display text-[1.25rem] leading-tight font-extrabold tracking-[-0.02em]">
              Los pagos en línea llegan muy pronto
            </p>
            <p className="mt-1 text-[0.95rem] leading-snug text-muted-foreground">
              Por ahora publicas gratis y recibes postulaciones. Cuando activemos los pagos podrás elegir tu plan aquí mismo.
            </p>
          </div>
        </section>
      )}
      <div className="grid gap-6 lg:grid-cols-3 lg:items-stretch lg:gap-6 lg:pt-4">
        {plans.map((p, i) => {
          const hot = p.tone === "mandarina";
          return (
            <section
              key={p.id}
              aria-label={`Plan ${p.name}`}
              className={cn(
                "group lift relative flex animate-rise flex-col rounded-panel p-5 sm:p-6",
                BLOCK_CLASS[p.tone],
                RUG,
                p.popular && "lg:-mt-4",
                p.current && "outline-4 outline-offset-4 outline-uva-ink",
              )}
              style={{ "--i": i } as React.CSSProperties}
            >
              {p.popular ? (
                <div className="absolute -top-6 -right-2 z-10 sm:-right-3">
                  <Sticker variant="ink" rotate={12} dot>
                    <strong>Top</strong>el más popular
                  </Sticker>
                </div>
              ) : null}

              {/* art strip bleeding off the top edge */}
              <div
                aria-hidden
                className={cn(
                  "relative -mx-5 -mt-5 mb-4 overflow-hidden rounded-t-[26px] border-b-2 border-ink sm:-mx-6 sm:-mt-6",
                  hot ? "bg-[#ffd27a]" : "bg-white/45 dark:bg-white/30",
                  p.popular && "animate-shine",
                )}
              >
                <Scene name={p.scene} className="mx-auto h-36 w-auto max-w-full" />
                <span className="absolute bottom-2 left-3 flex gap-1.5">
                  {p.icons.map((c) => (
                    <CategoryIcon key={c} category={c} size="sm" className="group-hover:animate-wiggle" />
                  ))}
                </span>
              </div>

              <div className="flex items-center gap-2.5">
                <h2 className="font-display text-[1.5rem] leading-none font-extrabold tracking-[-0.03em]">{p.name}</h2>
                {p.current ? (
                  <span className="ml-auto inline-flex h-7 items-center gap-1 rounded-full border-2 border-ink bg-ink px-2.5 text-[0.8rem] font-bold text-limon">
                    <HugeiconsIcon icon={CheckmarkBadge01Icon} className="size-4" strokeWidth={2.2} />
                    Tu plan
                  </span>
                ) : null}
              </div>
              <p className="mt-4 font-display text-[2.9rem] leading-none font-extrabold tracking-[-0.045em] tabular-nums">
                {p.price}
              </p>
              <p className="mt-1.5 font-semibold text-muted-foreground uppercase">{p.unit}</p>
              <p className="mt-4 text-[1rem] font-medium">{p.who}</p>
              <ul className="mt-4 space-y-2.5 text-[0.97rem]">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5">
                    <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-md border-2 border-ink bg-white text-ink">
                      <HugeiconsIcon icon={Tick02Icon} className="size-3.5" strokeWidth={3} />
                    </span>
                    {f}
                  </li>
                ))}
              </ul>
              <Button
                disabled={p.current || !payments}
                aria-describedby={!payments && !p.current ? "planes-pronto" : undefined}
                className={cn(
                  "mt-auto h-14 w-full border-2 border-ink text-[1.05rem] font-bold",
                  p.current
                    ? "bg-white/50 text-ink disabled:opacity-100"
                    : !payments
                      ? "bg-white/60 text-ink disabled:opacity-100"
                    : "bg-ink text-white shadow-[3px_4px_0_0_rgb(255_255_255/0.6)] hover:bg-ink/90 dark:border-black/70",
                )}
                style={{ marginTop: "1.75rem" }}
                onClick={(e) => {
                  fire({ origin: e.currentTarget });
                  toast.success("¡Ándale! Te contactaremos para activar tu plan");
                }}
              >
                {p.current ? "Plan actual" : payments ? `Elegir ${p.name}` : "Próximamente"}
              </Button>
            </section>
          );
        })}
      </div>

      {/* ------------------------------------------------ Promise band */}
      <section
        aria-labelledby="sin-costo"
        className={cn("relative overflow-hidden rounded-panel lg:grid lg:grid-cols-[1fr_auto] lg:items-center", BLOCK_CLASS.limon, RUG)}
      >
        <div className="relative p-5 sm:p-6">
          <Doodle name="rayo" color="var(--block-mandarina)" className="absolute top-5 right-5 size-9 rotate-12 lg:hidden" />
          <Eyebrow>Así de claro</Eyebrow>
          <h2 id="sin-costo" className="mt-1.5 font-display text-[1.6rem] leading-tight font-extrabold tracking-[-0.03em]">
            Los candidatos nunca pagan.
          </h2>
          <p className="mt-2 max-w-xl text-[0.98rem] leading-relaxed text-muted-foreground">
            Chambarrio conecta; cada empresa entrevista, contrata y cumple sus obligaciones laborales. Precios
            preliminares en pesos mexicanos, más IVA.
          </p>
        </div>
        <Scene name="ahorro" className="mx-auto w-60 px-4 pb-2 lg:w-72 lg:pr-6" />
        <HazardTape className="h-8 text-[0.95rem] lg:col-span-2">Candidatos gratis, siempre</HazardTape>
      </section>

      <div aria-hidden className="-mx-4 overflow-hidden lg:mx-0 lg:rounded-full">
        <Marquee
          className="bg-ink font-display text-lg font-extrabold text-limon uppercase dark:bg-block-sol dark:text-ink"
          items={["Contrata cerca", "Llegan a tiempo", "Duran más", "Factura CFDI"]}
          separator={<Doodle name="estrella" color="var(--block-sol)" className="size-5" />}
        />
      </div>
    </div>
  );
}

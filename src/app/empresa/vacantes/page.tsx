import type { Metadata } from "next";
import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { PlusSignIcon } from "@hugeicons/core-free-icons";
import { PageHeader } from "@/components/chamba/page-header";
import { HeroCard } from "@/components/chamba/primitives";
import { Scene } from "@/components/chamba/art/scenes";
import { Doodle, Marquee } from "@/components/chamba/art/doodles";
import { HARD, HARD_SM, OUTLINE } from "@/components/empresa/workwear";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { VacancyList } from "./vacancy-list";

export const metadata: Metadata = { title: "Tus vacantes" };

const TICKER = ["Publicar es gratis", "Gente a 5 km de tu centro", "Contacto directo por WhatsApp", "Sin contratos forzosos"];

export default function EmpresaVacantesPage() {
  return (
    <>
      <PageHeader title="Vacantes" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start lg:gap-7">
        <div className="min-w-0 space-y-5 lg:sticky lg:top-8 lg:col-span-5">
          {/* The ONE saturated block: publish CTA with the crew scene bleeding off the bottom */}
          <HeroCard
            tone="uva"
            decor={false}
            eyebrow="¿Te falta gente?"
            title={<span className="block pr-10">Publica gratis y llega a tu colonia</span>}
            className={cn("animate-rise overflow-hidden pb-0 sm:pb-0", OUTLINE, HARD)}
          >
            <Doodle name="estrella" color="#FFC93C" className="absolute top-5 right-5 size-9 rotate-12" />
            <Doodle name="rayo" color="#DDF78A" animated={false} className="absolute top-[42%] right-4 size-7 -rotate-12" />
            <p className="mt-3 max-w-[30ch] text-[1.02rem] leading-relaxed text-primary-foreground/85">
              Pagas $500 al mes solo por las vacantes cuyas postulaciones quieras ver.
            </p>
            <Button
              asChild
              variant="lime"
              size="xl"
              className={cn("mt-5 w-full border-2 border-ink sm:w-auto", HARD_SM)}
            >
              <Link href="/empresa/vacantes/nueva">
                <HugeiconsIcon icon={PlusSignIcon} className="size-5" strokeWidth={2.4} />
                Publicar vacante
              </Link>
            </Button>
            <div className="-mx-6 mt-4 sm:-mx-7">
              <Scene name="equipo" className="w-full translate-y-2" />
            </div>
          </HeroCard>

          <div
            className={cn(
              "animate-rise block-sol -mx-1 -rotate-[1.5deg] overflow-hidden rounded-tile font-display text-[0.95rem] font-extrabold tracking-[-0.01em] uppercase",
              OUTLINE,
              HARD_SM,
            )}
            style={{ "--i": 1 } as React.CSSProperties}
          >
            <Marquee
              items={TICKER}
              speed={30}
              gap="1rem"
              className="py-2.5"
              separator={<Doodle name="estrella" color="#ff6b2c" animated={false} className="size-5" />}
            />
          </div>
        </div>

        <div className="min-w-0 lg:col-span-7">
          <VacancyList />
        </div>
      </div>
    </>
  );
}

// Shell renders children client-side only, so skip dev instant-navigation validation.
export const instant = false;

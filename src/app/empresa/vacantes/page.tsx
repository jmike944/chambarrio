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

const TICKER = ["Publicar es gratis", "Gente a 5 km de tu centro", "Contacto directo por llamada o SMS", "Sin contratos forzosos"];

export default function EmpresaVacantesPage() {
  return (
    <>
      <PageHeader title="Vacantes" />
      {/* Desktop: both columns end on the same line. "Así de fácil" grows when the list is longer,
          the "Publicar otra vacante" box when it's shorter. */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-7">
        <div className="min-w-0 space-y-5 lg:col-span-5 lg:flex lg:flex-col lg:gap-5 lg:space-y-0">
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

          <HowItWorks className="hidden lg:flex lg:flex-1" />
        </div>

        <div className="min-w-0 lg:col-span-7 lg:flex lg:flex-col">
          <VacancyList />
        </div>
      </div>
    </>
  );
}

const STEPS = [
  { title: "Publica gratis", body: "Puesto, sueldo y turno. Queda lista en un par de minutos." },
  { title: "Te llega gente de tu zona", body: "Ves su experiencia, sus turnos y a cuántos kilómetros vive." },
  { title: "Desbloquea y llama", body: "$500 al mes por vacante: nombre, teléfono, foto y CV de cada persona." },
];

/** Desktop filler with a job: how the vacancy goes from published to hired (stretches to the list). */
function HowItWorks({ className }: { className?: string }) {
  return (
    <section
      aria-labelledby="asi-de-facil"
      className={cn("block-menta relative isolate min-w-0 flex-col overflow-hidden rounded-panel p-6", OUTLINE, HARD, className)}
    >
      <h2 id="asi-de-facil" className="font-display text-[1.35rem] leading-tight font-extrabold tracking-[-0.025em]">
        Así de fácil
      </h2>
      <ol className="mt-4 space-y-3">
        {STEPS.map((s, i) => (
          <li key={s.title} className="flex items-start gap-3 rounded-tile border-2 border-ink bg-white/70 p-3.5 text-ink">
            <span className="grid size-9 shrink-0 place-items-center rounded-full border-2 border-ink bg-limon font-display text-[1.05rem] font-extrabold">
              {i + 1}
            </span>
            <span className="min-w-0">
              <span className="block font-display text-[1.08rem] leading-tight font-extrabold">{s.title}</span>
              <span className="mt-0.5 block text-[0.92rem] leading-snug text-ink/75">{s.body}</span>
            </span>
          </li>
        ))}
      </ol>
      {/* Pinned to the bottom, so a taller column only adds room above the art. */}
      <Scene name="radar" className="mx-auto mt-auto w-full max-w-[9.5rem] pt-4" />
    </section>
  );
}

// Shell renders children client-side only, so skip dev instant-navigation validation.
export const instant = false;

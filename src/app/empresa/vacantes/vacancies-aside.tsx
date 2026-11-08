"use client";

import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowRight01Icon, PlusSignIcon } from "@hugeicons/core-free-icons";
import { HeroCard } from "@/components/chamba/primitives";
import { Scene } from "@/components/chamba/art/scenes";
import { Doodle, Marquee } from "@/components/chamba/art/doodles";
import { HARD, HARD_SM, OUTLINE } from "@/components/empresa/workwear";
import { MyScopeChip } from "@/components/team/team-kit";
import { Button } from "@/components/ui/button";
import { useCan } from "@/lib/team";
import { cn } from "@/lib/utils";

/*
 * The left column of /empresa/vacantes. Who publishes (dueño, admin; or an owner still registering the
 * business) gets the publish hero and how it works; a reclutador gets their applicants as the next step
 * and how they work them, never a "Publicar" they can't use.
 */

const TICKER = ["Publicar es gratis", "Gente a 5 km de tu centro", "Contacto directo por llamada o SMS", "Sin contratos forzosos"];
const TICKER_TEAM = ["Gente a 5 km de tu centro", "Contacto directo por llamada o SMS", "Entrevistas en un toque", "Notas para tu equipo"];

const STEPS = [
  { title: "Publica gratis", body: "Puesto, sueldo y turno. Queda lista en un par de minutos." },
  { title: "Te llega gente de tu zona", body: "Ves su experiencia, sus turnos y a cuántos kilómetros vive." },
  { title: "Desbloquea y llama", body: "$500 al mes por vacante: nombre, teléfono, foto y CV de cada persona." },
];
const STEPS_TEAM = [
  { title: "Revisa a quien se postula", body: "Su experiencia, sus turnos y a cuántos kilómetros vive." },
  { title: "Agenda la entrevista", body: "La persona ve el día, la hora y el lugar en su postulación." },
  { title: "Contrata y deja notas", body: "Tu equipo ve tus notas y quién hizo cada paso." },
];

export function VacanciesAside() {
  const can = useCan();
  // No membership yet = an owner registering the business: the usual publish flow.
  const publisher = can.createVacancy || !can.role;
  return (
    <div className="min-w-0 space-y-5 lg:col-span-5 lg:flex lg:flex-col lg:gap-5 lg:space-y-0">
      {/* The ONE saturated block: the next step, with the crew scene bleeding off the bottom */}
      {publisher ? (
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
            {can.managePlan || !can.role
              ? "Pagas $500 al mes solo por las vacantes cuyas postulaciones quieras ver."
              : "Le aparece a la gente que vive cerca de tu sucursal y te llegan sus postulaciones."}
          </p>
          <Button asChild variant="lime" size="xl" className={cn("mt-5 w-full border-2 border-ink sm:w-auto", HARD_SM)}>
            <Link href="/empresa/vacantes/nueva">
              <HugeiconsIcon icon={PlusSignIcon} className="size-5" strokeWidth={2.4} />
              Publicar vacante
            </Link>
          </Button>
          <div className="-mx-6 mt-4 sm:-mx-7">
            <Scene name="equipo" className="w-full translate-y-2" />
          </div>
        </HeroCard>
      ) : (
        <HeroCard
          tone="uva"
          decor={false}
          eyebrow="Tus vacantes"
          title={<span className="block pr-10">Quien se postula te está esperando</span>}
          className={cn("animate-rise overflow-hidden pb-0 sm:pb-0", OUTLINE, HARD)}
        >
          <Doodle name="estrella" color="#FFC93C" className="absolute top-5 right-5 size-9 rotate-12" />
          <p className="mt-3 max-w-[32ch] text-[1.02rem] leading-relaxed text-primary-foreground/85">
            Revisa perfiles, agenda entrevistas y contrata. Las vacantes las publica el dueño o un administrador.
          </p>
          <MyScopeChip className="mt-3" />
          <Button asChild variant="lime" size="xl" className={cn("mt-5 flex w-full border-2 border-ink sm:inline-flex sm:w-auto", HARD_SM)}>
            <Link href="/empresa/candidatos">
              Ver candidatos
              <HugeiconsIcon icon={ArrowRight01Icon} className="size-5" strokeWidth={2.4} />
            </Link>
          </Button>
          <div className="-mx-6 mt-4 sm:-mx-7">
            <Scene name="equipo" className="w-full translate-y-2" />
          </div>
        </HeroCard>
      )}

      <div
        className={cn(
          "animate-rise block-sol -mx-1 -rotate-[1.5deg] overflow-hidden rounded-tile font-display text-[0.95rem] font-extrabold tracking-[-0.01em] uppercase",
          OUTLINE,
          HARD_SM,
        )}
        style={{ "--i": 1 } as React.CSSProperties}
      >
        <Marquee
          items={publisher ? TICKER : TICKER_TEAM}
          speed={30}
          gap="1rem"
          className="py-2.5"
          separator={<Doodle name="estrella" color="#ff6b2c" animated={false} className="size-5" />}
        />
      </div>

      <HowItWorks steps={publisher ? STEPS : STEPS_TEAM} className="hidden lg:flex lg:flex-1" />
    </div>
  );
}

/** Desktop filler with a job: how the vacancy goes from published to hired (stretches to the list). */
function HowItWorks({ steps, className }: { steps: typeof STEPS; className?: string }) {
  return (
    <section
      aria-labelledby="asi-de-facil"
      className={cn("block-menta relative isolate min-w-0 flex-col overflow-hidden rounded-panel p-6", OUTLINE, HARD, className)}
    >
      <h2 id="asi-de-facil" className="font-display text-[1.35rem] leading-tight font-extrabold tracking-[-0.025em]">
        Así de fácil
      </h2>
      <ol className="mt-4 space-y-3">
        {steps.map((s, i) => (
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

import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft02Icon } from "@hugeicons/core-free-icons";
import { ChambarrioLogo } from "@/components/brand/chambarrio-logo";
import { Reveal } from "@/components/chamba/motion";
import { Doodle } from "@/components/chamba/art/doodles";
import { BLOCK_CLASS, type BlockTone } from "@/components/chamba/primitives";
import { ThemeToggle } from "@/components/theme";
import { cn } from "@/lib/utils";
import { HARD, HARD_SM, HazardStripe, Rivets, Tape, chunky } from "./decor";

export type LegalSection = { title: string; body: string[] };

/** Number chips rotate through rugged pastels so neighbours never match. */
const CHIP_TONES: BlockTone[] = ["sol", "cielo", "limon", "durazno", "menta"];

export function LegalPage({
  title,
  intro,
  sections,
  tone = "sol",
}: {
  title: string;
  intro: string;
  sections: LegalSection[];
  /** Header block color. */
  tone?: BlockTone;
}) {
  return (
    <div className="min-h-dvh overflow-x-clip [--hard:var(--ink)] dark:[--hard:#2c2464]">
      <header className="mx-auto flex max-w-3xl items-center gap-3 px-4 pt-[max(1.25rem,env(safe-area-inset-top))] pb-4 sm:px-6">
        <Link href="/" aria-label="Chambarrio, inicio" className="group rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
          <ChambarrioLogo iconClassName="size-9 shrink-0 group-hover:animate-wiggle" />
        </Link>
        <ThemeToggle className="ml-auto size-11" />
      </header>
      <main className="mx-auto max-w-3xl px-4 pt-4 pb-20 sm:px-6">
        <Reveal y={20} className={cn("relative isolate overflow-hidden rounded-panel", BLOCK_CLASS[tone], HARD)}>
          <HazardStripe className="h-3.5" />
          <span aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-dots opacity-60" />
          <Rivets className="top-3.5" />
          <span aria-hidden className="pointer-events-none absolute top-16 right-4 -z-10 rotate-12 sm:top-14 sm:right-10">
            <Doodle name="rayo" color="var(--block-mandarina)" className="size-14 sm:size-20" />
          </span>
          <div className="px-6 pt-6 pb-7 sm:px-9 sm:pt-8 sm:pb-9">
            <Tape className="-rotate-2">Borrador para revisión legal</Tape>
            <h1 className="mt-5 max-w-[85%] font-display text-[2.5rem] leading-[0.98] font-extrabold tracking-[-0.045em] sm:text-[3.3rem]">
              {title}
            </h1>
            <p className="mt-4 max-w-[36rem] text-[1.06rem] leading-relaxed font-medium text-muted-foreground sm:text-lg">{intro}</p>
          </div>
        </Reveal>

        <div className="mt-12 space-y-10">
          {sections.map((s, i) => (
            <Reveal as="section" index={Math.min(i + 1, 6)} key={s.title} aria-labelledby={`s-${i}`}>
              <h2 id={`s-${i}`} className="flex items-center gap-3 font-display text-[1.35rem] leading-tight font-extrabold tracking-[-0.02em]">
                <span
                  aria-hidden
                  className={cn(
                    "grid size-10 shrink-0 place-items-center rounded-full font-display text-base font-extrabold tabular-nums",
                    BLOCK_CLASS[CHIP_TONES[i % CHIP_TONES.length]],
                    HARD_SM,
                    i % 2 ? "rotate-6" : "-rotate-6",
                  )}
                >
                  {i + 1}
                </span>
                <span className="sr-only">{i + 1}. </span>
                {s.title}
              </h2>
              <div className="mt-3 space-y-3 border-l-[3px] border-dashed border-border pl-5 text-[1.02rem] leading-[1.7] text-muted-foreground sm:ml-5 sm:pl-8">
                {s.body.map((p) => (
                  <p key={p}>{p}</p>
                ))}
              </div>
            </Reveal>
          ))}
        </div>

        <div className={cn("mt-14 flex flex-col gap-4 rounded-panel bg-card p-5 text-card-foreground sm:flex-row sm:items-center sm:p-6", HARD_SM)}>
          <p className="text-[0.98rem] text-muted-foreground">
            ¿Dudas? Escríbenos a <span className="font-semibold text-foreground">hola@chambarrio.com</span>. Última actualización: noviembre de 2026.
          </p>
          <Link href="/" className={cn(chunky("ink", "md"), "group shrink-0 sm:ml-auto")}>
            <HugeiconsIcon icon={ArrowLeft02Icon} className="size-4 transition-transform group-hover:-translate-x-1" strokeWidth={2.4} />
            Volver al inicio
          </Link>
        </div>
      </main>
    </div>
  );
}

"use client";

import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowRight01Icon, UserMultiple02Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/chamba/primitives";
import { Scene } from "@/components/chamba/art/scenes";
import { HARD, HARD_SM, INK_BUTTON, OUTLINE, WHITE_BUTTON } from "@/components/empresa/workwear";
import { ROLE_META, useCan } from "@/lib/team";
import { cn } from "@/lib/utils";

/**
 * A screen (or action) this member's role doesn't include: says who does it and where to go instead.
 * Never a dead button: one way forward, plus "Ver mi equipo" to see who can help.
 */
export function NotForRole({
  title,
  body,
  back,
  className,
}: {
  title: string;
  body: string;
  back: { href: string; label: string };
  className?: string;
}) {
  const can = useCan();
  return (
    <section
      aria-labelledby="no-es-tu-rol"
      className={cn("block-lila relative isolate overflow-hidden rounded-panel p-6 sm:p-8", OUTLINE, HARD, className)}
    >
      <span aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-dots opacity-50" />
      <div className="grid items-center gap-6 sm:grid-cols-[1fr_auto]">
        <div className="min-w-0">
          <Eyebrow>{can.role ? `Tu rol: ${ROLE_META[can.role].long}` : "Tu equipo"}</Eyebrow>
          <h2 id="no-es-tu-rol" className="mt-1.5 font-display text-[1.9rem] leading-[1.02] font-extrabold tracking-[-0.04em]">
            {title}
          </h2>
          <p className="mt-2 max-w-md text-[1.02rem] leading-snug text-muted-foreground">{body}</p>
          <div className="mt-5 flex flex-wrap gap-2.5">
            <Button asChild size="xl" className={cn(INK_BUTTON, HARD_SM)}>
              <Link href={back.href}>
                {back.label}
                <HugeiconsIcon icon={ArrowRight01Icon} className="size-5" strokeWidth={2.2} />
              </Link>
            </Button>
            <Button asChild size="xl" className={cn(WHITE_BUTTON, HARD_SM)}>
              <Link href="/empresa/equipo">
                <HugeiconsIcon icon={UserMultiple02Icon} className="size-5" strokeWidth={2} />
                Ver mi equipo
              </Link>
            </Button>
          </div>
        </div>
        <Scene name="equipo" className="mx-auto w-52 sm:w-60" />
      </div>
    </section>
  );
}

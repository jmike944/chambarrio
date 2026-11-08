"use client";

import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon, ArrowRight01Icon, InformationCircleIcon, Store01Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { Panel, PanelHeader } from "@/components/chamba/primitives";
import type { Branch } from "@/lib/data/types";
import { useCan } from "@/lib/team";
import { cn } from "@/lib/utils";
import { BranchMapArt, coloniaText, placeText, useBranchSummaries } from "./sucursales/branch-kit";

/*
 * Pieces both dashboards (demo and live) share, aware of the member's role: who manages branches gets
 * the links to /empresa/sucursales; a reclutador sees their branches without dead ends.
 */

type CSSVars = React.CSSProperties & Record<`--${string}`, string | number>;

/** Rugged workwear edge: ink outline + hard offset shadow (no blur). */
export const RUG = "border-2 border-ink shadow-[4px_5px_0_0_var(--ink)] dark:border-black/70 dark:shadow-[4px_5px_0_0_rgb(0_0_0/0.55)]";

/**
 * The hero's place chip: "3 sucursales en Saltillo" → /empresa/sucursales for who manages them; for a
 * branch-limited reclutador "Solo: CEDIS Santa Mónica" (not a link: that page isn't theirs).
 */
export function HeroPlaceChip({ locations }: { locations: Branch[] }) {
  const can = useCan();
  const text = can.allBranches ? placeText(locations) : `Solo: ${locations.map((b) => b.name).join(", ") || "ninguna sucursal"}`;
  const cls =
    "mt-3 inline-flex min-h-11 max-w-full items-center gap-2 self-start rounded-full border-2 border-ink bg-white/85 py-1 pr-3 pl-1.5 text-[0.92rem] font-bold text-ink";
  const icon = (
    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-ink text-limon">
      <HugeiconsIcon icon={Store01Icon} className="size-4.5" strokeWidth={2} />
    </span>
  );
  if (!can.manageBranches) {
    return (
      <span className={cls} title={can.allBranches ? undefined : "Ves las vacantes y postulantes de tus sucursales"}>
        {icon}
        <span className="min-w-0 truncate">{text}</span>
      </span>
    );
  }
  return (
    <Link
      href="/empresa/sucursales"
      className={cn(cls, "press outline-none hover:bg-white focus-visible:ring-4 focus-visible:ring-white/70")}
    >
      {icon}
      <span className="min-w-0 truncate">{text}</span>
      <HugeiconsIcon icon={ArrowRight01Icon} className="size-4 shrink-0" strokeWidth={2.4} />
    </Link>
  );
}

/** "+ Publicar" for who can publish (dueño, admin); nothing for a reclutador. */
export function PublishButton() {
  const can = useCan();
  if (!can.createVacancy) return null;
  return (
    <Button asChild size="lg" className="h-11">
      <Link href="/empresa/vacantes/nueva">
        <HugeiconsIcon icon={Add01Icon} strokeWidth={2.2} />
        Publicar
      </Link>
    </Button>
  );
}

/**
 * "Tus sucursales" (lila): each branch with its vacancies and applicants. Who manages branches gets
 * "Administrar" and, with a single branch, "¿Tienes otra planta?"; everyone else gets the branches they
 * work (linking to their vacancies) and a note on who adds branches.
 */
export function BranchesPanel({ className }: { className?: string }) {
  const can = useCan();
  const branches = useBranchSummaries();
  const multi = branches.length > 1;
  const manage = can.manageBranches;
  return (
    <Panel tone="lila" className={cn("min-w-0 overflow-hidden", RUG, className)}>
      <PanelHeader
        icon={Store01Icon}
        title={multi ? "Tus sucursales" : "Tu sucursal"}
        count={branches.length}
        action={
          manage ? (
            <Button
              asChild
              variant="white"
              size="lg"
              className="h-11 border-2 border-ink bg-white text-ink hover:bg-white/90 dark:bg-white dark:text-ink"
            >
              <Link href="/empresa/sucursales" aria-label="Administrar sucursales">
                <span className="hidden sm:inline">Administrar</span>
                <span className="sm:hidden">Ver</span>
                <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2.2} />
              </Link>
            </Button>
          ) : undefined
        }
      />
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {branches.map(({ branch, index, jobs: bj, applicants }) => (
          <li key={branch.id} className="min-w-0 animate-rise" style={{ "--i": Math.min(index + 2, 8) } as CSSVars}>
            <Link
              href={manage ? "/empresa/sucursales" : "/empresa/vacantes"}
              className="group press lift flex items-center gap-3 rounded-tile border-2 border-ink bg-white/75 p-2.5 pr-3.5 text-ink outline-none hover:bg-white focus-visible:ring-4 focus-visible:ring-ring/60 dark:bg-white/85"
            >
              <BranchMapArt seed={branch.id} principal={index === 0} className="w-16 shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-display text-[1.1rem] leading-tight font-extrabold tracking-[-0.02em]">
                  {branch.name}
                </span>
                <span className="block truncate text-[0.85rem] text-ink/65">
                  {index === 0 && manage ? "Principal · " : ""}
                  {coloniaText(branch, false)}
                </span>
                <span className="mt-1.5 flex flex-wrap gap-1.5 text-[0.8rem] font-bold">
                  <span className="rounded-full bg-ink px-2 py-0.5 text-white tabular-nums">
                    {bj.length} vacante{bj.length === 1 ? "" : "s"}
                  </span>
                  <span className="rounded-full border-2 border-ink px-2 py-px tabular-nums">
                    {applicants} postulante{applicants === 1 ? "" : "s"}
                  </span>
                </span>
              </span>
            </Link>
          </li>
        ))}
        {multi ? null : manage ? (
          <li className="min-w-0">
            <Link
              href="/empresa/sucursales"
              className="group press flex min-h-[5.25rem] items-center gap-3 rounded-tile border-2 border-dashed border-ink/60 px-3.5 py-2.5 outline-none hover:bg-white/40 focus-visible:ring-4 focus-visible:ring-ring/60"
            >
              <span className="grid size-11 shrink-0 place-items-center rounded-full border-2 border-ink bg-limon text-ink transition-transform duration-300 group-hover:rotate-90">
                <HugeiconsIcon icon={Add01Icon} className="size-5" strokeWidth={2.4} />
              </span>
              <span className="min-w-0">
                <span className="block font-display text-[1.05rem] leading-tight font-extrabold">¿Tienes otra planta o bodega?</span>
                <span className="block text-[0.85rem] text-muted-foreground">Agrégala y contrata cerca de cada una.</span>
              </span>
            </Link>
          </li>
        ) : (
          <li className="min-w-0">
            <Link
              href="/empresa/equipo"
              className="group press flex min-h-[5.25rem] items-center gap-3 rounded-tile border-2 border-dashed border-ink/60 px-3.5 py-2.5 outline-none hover:bg-white/40 focus-visible:ring-4 focus-visible:ring-ring/60"
            >
              <span className="grid size-11 shrink-0 place-items-center rounded-full border-2 border-ink bg-white text-ink">
                <HugeiconsIcon icon={InformationCircleIcon} className="size-5" strokeWidth={2.2} />
              </span>
              <span className="min-w-0">
                <span className="block font-display text-[1.05rem] leading-tight font-extrabold">
                  {can.allBranches ? "Las sucursales las agrega el dueño" : "Ves solo tu sucursal"}
                </span>
                <span className="block text-[0.85rem] text-muted-foreground">
                  {can.allBranches ? "O alguien de tu equipo con rol de administrador." : "Si necesitas otra, pídesela al dueño."}
                </span>
              </span>
            </Link>
          </li>
        )}
      </ul>
    </Panel>
  );
}

"use client";

import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowRight01Icon, Invoice01Icon, UserMultiple02Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { Panel, PanelHeader } from "@/components/chamba/primitives";
import { INK_BUTTON, HARD_SM } from "@/components/empresa/workwear";
import { ROLE_META, useCan, useTeam, type TeamPlan } from "@/lib/team";
import { cn } from "@/lib/utils";
import { MeChip, MemberAvatar, ROLE_SELF, RoleChip, ScopeChip } from "./team-kit";

const PLAN_NAME: Record<TeamPlan, string> = { "por-vacante": "Por vacante", pyme: "Pyme", industrial: "Industrial" };

/**
 * Takes the "Plan y uso" slot on the dashboard for members who don't manage the plan (admin,
 * reclutador): who's on the team, my role and branches, and the plan read-only. Same block size, so
 * the dashboard's columns still end together.
 */
export function TeamSummaryCard({ className }: { className?: string }) {
  const can = useCan();
  const team = useTeam();
  const me = team.me;
  const role = me?.role ?? can.role;
  const shown = team.members.slice(0, 4);
  return (
    <Panel tone="durazno" aria-labelledby="tu-equipo-panel" className={cn("flex min-w-0 flex-col overflow-hidden", className)}>
      <PanelHeader icon={UserMultiple02Icon} title={<span id="tu-equipo-panel">Tu equipo</span>} count={team.members.length || undefined} />
      {role ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 font-display text-[1.45rem] leading-tight font-extrabold tracking-[-0.03em]">Eres {ROLE_META[role].long}</span>
          {me ? <ScopeChip role={me.role} branchIds={me.branchIds} /> : null}
        </div>
      ) : null}
      {role ? <p className="mt-2 text-[0.95rem] leading-snug text-muted-foreground">{ROLE_SELF[role]}</p> : null}

      {shown.length ? (
        <ul className="mt-4 grid gap-2 rounded-tile border-2 border-ink bg-white/55 p-3 text-ink dark:bg-white/40">
          {shown.map((m) => (
            <li key={m.userId} className="flex min-w-0 items-center gap-2.5">
              <MemberAvatar userId={m.userId} isMe={m.isMe} name={m.name} size={36} className="shadow-none" />
              <span className="min-w-0 flex-1 truncate font-semibold">{m.name || m.email || "Sin nombre"}</span>
              {m.isMe ? <MeChip /> : null}
              <RoleChip role={m.role} />
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-auto pt-5">
        <p className="mb-3 flex items-center gap-2 text-[0.9rem] leading-snug">
          <HugeiconsIcon icon={Invoice01Icon} className="size-4.5 shrink-0" strokeWidth={2} />
          <span>
            Plan <strong className="font-bold">{PLAN_NAME[team.plan]}</strong> · lo maneja el dueño
          </span>
        </p>
        <Button asChild size="lg" className={cn(INK_BUTTON, HARD_SM)}>
          <Link href="/empresa/equipo">
            Ver mi equipo
            <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2.2} />
          </Link>
        </Button>
      </div>
    </Panel>
  );
}

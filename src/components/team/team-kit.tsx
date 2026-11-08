"use client";

import { useMemo } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Store01Icon } from "@hugeicons/core-free-icons";
import { AvatarCircle } from "@/components/avatar";
import { Scene, type SceneName } from "@/components/chamba/art/scenes";
import { randomAvatar } from "@/components/avatar/config";
import { useAllEmployerLocations, useEmployerLocations, useIsLive, useMyAvatar } from "@/lib/store";
import { DEMO_OWNER_ID, ROLE_META, useCan, type TeamRole } from "@/lib/team";
import { cn } from "@/lib/utils";

/*
 * Small pieces of "Tu equipo" shared by the team page and the role-aware company screens: member
 * avatars, role chips, branch-scope chips and the plain-Spanish copy for each role.
 */

/** What each role can't do, in plain Spanish (ROLE_META.description says what they can). */
export const ROLE_LIMITS: Record<TeamRole, string> = {
  dueno: "Puede haber más de un dueño.",
  admin: "No ve el plan ni los pagos, y no invita gente.",
  reclutador: "No publica vacantes ni ve el plan.",
};

/** What I do in my role, said to me (dashboards, Tu equipo). */
export const ROLE_SELF: Record<TeamRole, string> = {
  dueno: "Manejas todo: el plan, el equipo, los datos del negocio, las vacantes y los postulantes.",
  admin: "Manejas los datos del negocio, las vacantes, las sucursales y los postulantes.",
  reclutador: "Revisas a quien se postula, agendas entrevistas, contratas y dejas notas para tu equipo.",
};

/** Role chip colors: dueño ink + lime, admin violet, reclutador white. Ink outline on every surface. */
const ROLE_CHIP: Record<TeamRole, string> = {
  dueno: "bg-ink text-limon",
  admin: "bg-primary text-primary-foreground",
  reclutador: "bg-white text-ink",
};

export function RoleChip({ role, long, className }: { role: TeamRole; long?: boolean; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-7 shrink-0 items-center rounded-md border-2 border-ink px-2 text-[0.72rem] font-extrabold tracking-[0.1em] uppercase",
        ROLE_CHIP[role],
        className,
      )}
    >
      {long ? ROLE_META[role].long : ROLE_META[role].label}
    </span>
  );
}

/** "Tú" sticker next to my own name. */
export function MeChip({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 shrink-0 -rotate-3 items-center rounded-full border-2 border-ink bg-limon px-2 font-display text-[0.78rem] font-extrabold text-ink",
        className,
      )}
    >
      Tú
    </span>
  );
}

/** Branch names for a scope (labels: every branch of the business, mine or not). */
export function useBranchNames(): (ids: readonly string[] | null | undefined) => string[] {
  const all = useAllEmployerLocations();
  return useMemo(() => {
    const byId = new Map(all.map((b) => [b.id, b.name]));
    return (ids) => (ids ?? []).flatMap((id) => (byId.has(id) ? [byId.get(id)!] : []));
  }, [all]);
}

/** "Todas las sucursales" / "Solo: CEDIS Santa Mónica" / "Sin sucursal asignada". */
export function scopeLabel(role: TeamRole, branchIds: readonly string[] | null, names: string[]): string {
  if (role !== "reclutador" || branchIds === null) return "Todas las sucursales";
  if (names.length === 0) return "Sin sucursal asignada";
  return `Solo: ${names.join(", ")}`;
}

/** A member's branch scope as a chip. */
export function ScopeChip({
  role,
  branchIds,
  className,
}: {
  role: TeamRole;
  branchIds: readonly string[] | null;
  className?: string;
}) {
  const namesOf = useBranchNames();
  const label = scopeLabel(role, branchIds, namesOf(branchIds));
  const limited = role === "reclutador" && branchIds !== null;
  return (
    <span
      className={cn(
        "inline-flex min-h-7 max-w-full items-center gap-1.5 rounded-full border-2 px-2.5 py-0.5 text-[0.82rem] leading-tight font-bold",
        limited ? "border-ink bg-white text-ink" : "border-ink/30 bg-white/45 dark:bg-white/30",
        className,
      )}
    >
      <HugeiconsIcon icon={Store01Icon} className="size-3.5 shrink-0" strokeWidth={2.4} />
      <span className="min-w-0 break-words">{label}</span>
    </span>
  );
}

/**
 * For a branch-limited reclutador: "Solo: CEDIS Santa Mónica", on dashboards and lists, so a short list
 * never reads as "the business has nothing else". Nothing for everyone else.
 */
export function MyScopeChip({ className, tone = "light" }: { className?: string; tone?: "light" | "ink" }) {
  const can = useCan();
  const mine = useEmployerLocations();
  if (can.status !== "ready" || can.allBranches || can.role !== "reclutador") return null;
  const label = mine.length ? `Solo: ${mine.map((b) => b.name).join(", ")}` : "Sin sucursal asignada";
  return (
    <span
      title="Ves las vacantes y postulantes de tus sucursales"
      className={cn(
        "inline-flex min-h-9 max-w-full items-center gap-2 rounded-full border-2 border-ink py-1 pr-3 pl-1.5 text-[0.88rem] leading-tight font-bold",
        tone === "ink" ? "bg-ink text-white" : "bg-white text-ink",
        className,
      )}
    >
      <span className={cn("grid size-6 shrink-0 place-items-center rounded-full", tone === "ink" ? "bg-limon text-ink" : "bg-ink text-limon")}>
        <HugeiconsIcon icon={Store01Icon} className="size-3.5" strokeWidth={2.4} />
      </span>
      <span className="min-w-0 break-words">{label}</span>
    </span>
  );
}

/**
 * A member's face: the person using the app gets their own avatar ("Crea tu avatar"); everyone else a
 * stable look seeded by their id, so they're recognizable from screen to screen.
 */
export function MemberAvatar({
  userId,
  isMe,
  name,
  size = 56,
  className,
}: {
  userId: string;
  isMe: boolean;
  name?: string;
  size?: number;
  className?: string;
}) {
  const live = useIsLive();
  const mine = useMyAvatar();
  // Demo "Ver como": the person at the keyboard is still the demo user (the dueño), whoever is "me".
  const own = live ? isMe : userId === DEMO_OWNER_ID;
  const look = useMemo(() => (own ? mine : randomAvatar(userId || name || "equipo")), [own, mine, userId, name]);
  return (
    <span
      aria-hidden
      className={cn("relative inline-grid shrink-0 rounded-full border-2 border-ink shadow-[2px_3px_0_0_var(--ink)] dark:shadow-[2px_3px_0_0_rgb(0_0_0/0.6)]", className)}
    >
      <AvatarCircle config={look} size={size} />
    </span>
  );
}

/**
 * Fills the room a stretched card gets (desktop columns that end on the same line) with a scene, and
 * takes no room otherwise: the art only shows once the gap is at least 6rem tall.
 */
export function StretchArt({ name, className }: { name: SceneName; className?: string }) {
  return (
    <div aria-hidden className={cn("relative min-h-0 flex-1 [container-type:size]", className)}>
      <Scene name={name} className="absolute inset-0 hidden h-full w-full [@container(min-height:6rem)]:block" />
    </div>
  );
}

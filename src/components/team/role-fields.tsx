"use client";

import { useId } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Store01Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import type { Branch } from "@/lib/data/types";
import { ROLE_META, type TeamRole } from "@/lib/team";
import { cn } from "@/lib/utils";
import { ROLE_LIMITS } from "./team-kit";

/*
 * The fields shared by "Invitar" and "Cambiar permisos": a role picker that explains each role in plain
 * Spanish, and the branch picker a reclutador gets (every branch, or only some).
 */

/** Least to most: the usual pick (reclutador) first. */
const PICK_ORDER: TeamRole[] = ["reclutador", "admin", "dueno"];

const CARD =
  "group relative flex cursor-pointer items-start gap-3 rounded-tile border-2 border-ink/25 bg-tile p-3.5 outline-none transition-colors " +
  "hover:border-ink/60 has-[:checked]:border-ink has-[:checked]:bg-limon has-[:checked]:text-ink has-[:checked]:shadow-[3px_3px_0_0_var(--ink)] " +
  "has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-ring/60 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-55 dark:has-[:checked]:shadow-[3px_3px_0_0_rgb(0_0_0/0.7)]";

const MUTED = "text-muted-foreground group-has-[:checked]:text-ink/75";

export function RolePicker({
  value,
  onChange,
  disabled,
  legend = "¿Qué puede hacer?",
}: {
  value: TeamRole;
  onChange: (role: TeamRole) => void;
  /** Roles that can't be picked here, with the reason (e.g. raising your own role). */
  disabled?: Partial<Record<TeamRole, string>>;
  legend?: string;
}) {
  const name = useId();
  return (
    <fieldset>
      <legend className="mb-2 text-[0.95rem] font-bold">{legend}</legend>
      <div className="grid gap-2.5">
        {PICK_ORDER.map((r) => {
          const off = disabled?.[r];
          return (
            <label key={r} className={CARD}>
              <input
                type="radio"
                name={name}
                value={r}
                checked={value === r}
                disabled={!!off}
                onChange={() => onChange(r)}
                className="peer sr-only"
              />
              <span
                aria-hidden
                className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border-2 border-current bg-card group-has-[:checked]:border-ink group-has-[:checked]:bg-ink group-has-[:checked]:text-limon"
              >
                <HugeiconsIcon icon={Tick02Icon} className="size-3.5 opacity-0 group-has-[:checked]:opacity-100" strokeWidth={3} />
              </span>
              <span className="min-w-0">
                <span className="block font-display text-[1.1rem] leading-tight font-extrabold tracking-[-0.015em]">{ROLE_META[r].long}</span>
                <span className="mt-0.5 block text-[0.9rem] leading-snug">{ROLE_META[r].description}</span>
                <span className={cn("mt-0.5 block text-[0.85rem] leading-snug", MUTED)}>{off ?? ROLE_LIMITS[r]}</span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/**
 * Which branches a reclutador works: every one (null), or only some. Hidden by the caller when the
 * business has a single branch (that's "every branch" anyway).
 */
export function BranchPicker({
  value,
  onChange,
  branches,
  errorId,
  invalid,
}: {
  value: string[] | null;
  onChange: (ids: string[] | null) => void;
  branches: Branch[];
  errorId?: string;
  invalid?: boolean;
}) {
  const all = value === null;
  const box =
    "grid size-6 shrink-0 place-items-center rounded-[0.3rem] border-2 border-current bg-card group-has-[:checked]:border-ink group-has-[:checked]:bg-ink group-has-[:checked]:text-limon";
  return (
    <fieldset aria-describedby={invalid ? errorId : undefined}>
      <legend className="mb-2 text-[0.95rem] font-bold">¿De qué sucursales?</legend>
      <div className="grid gap-2">
        <label className={cn(CARD, "items-center py-3")}>
          <input
            type="checkbox"
            checked={all}
            onChange={(e) => onChange(e.target.checked ? null : [])}
            className="peer sr-only"
          />
          <span aria-hidden className={box}>
            <HugeiconsIcon icon={Tick02Icon} className="size-3.5 opacity-0 group-has-[:checked]:opacity-100" strokeWidth={3} />
          </span>
          <span className="min-w-0">
            <span className="block font-bold">Todas las sucursales</span>
            <span className={cn("block text-[0.85rem] leading-snug", MUTED)}>También las que agregues después.</span>
          </span>
        </label>
        {all ? null : (
          <div role="group" aria-label="Sucursales" className="grid gap-2 sm:grid-cols-2">
            {branches.map((b) => {
              const on = value.includes(b.id);
              return (
                <label key={b.id} className={cn(CARD, "items-center py-3")}>
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={(e) => onChange(e.target.checked ? [...value, b.id] : value.filter((id) => id !== b.id))}
                    className="peer sr-only"
                  />
                  <span aria-hidden className={box}>
                    <HugeiconsIcon icon={Tick02Icon} className="size-3.5 opacity-0 group-has-[:checked]:opacity-100" strokeWidth={3} />
                  </span>
                  <HugeiconsIcon icon={Store01Icon} className="size-4.5 shrink-0" strokeWidth={2.2} />
                  <span className="min-w-0 font-semibold break-words">{b.name}</span>
                </label>
              );
            })}
          </div>
        )}
      </div>
    </fieldset>
  );
}

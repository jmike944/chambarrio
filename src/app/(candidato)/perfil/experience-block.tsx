"use client";

import { useId, useMemo, useRef, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon, Briefcase01Icon, Delete02Icon, PencilEdit02Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { CategoryIcon } from "@/components/chamba/job-icons";
import { FIELD as WW_FIELD, HARD_SM as WW_HARD_SM, INK_BUTTON } from "@/components/empresa/workwear";
import type { BlockTone } from "@/components/chamba/primitives";
import { CATEGORIES } from "@/lib/data/categories";
import type { CategoryId } from "@/lib/data/types";
import { useApp, type StoredExperience } from "@/lib/store";
import {
  experienceRange,
  formatDuration,
  MONTH_LABELS,
  parseMonth,
  PROFILE_LIMITS,
  sortExperiencesByRecency,
  STRENGTH_WEIGHTS,
  totalExperienceMonths,
  validateExperience,
  type WorkExperience,
} from "@/lib/profile-strength";
import { cn } from "@/lib/utils";
import { Block, Counter, INK_BTN, markEdited, PointsBadge, type CSSVars } from "./ui";

/** "Experiencia": the work history (list + add/edit drawer + delete with confirm). */
export function ExperienceBlock({ tone, index }: { tone: BlockTone; index: number }) {
  const list = useApp((s) => s.workExperiences);
  const sorted = useMemo(() => sortExperiencesByRecency(list), [list]);
  const [editing, setEditing] = useState<StoredExperience | "new" | null>(null);
  const [open, setOpen] = useState(false);
  /** Bumped on every open so the drawer starts from a fresh draft. */
  const [session, setSession] = useState(0);
  const full = list.length >= PROFILE_LIMITS.experiencesMax;
  const months = totalExperienceMonths(list);
  const jobs = list.length === 1 ? "1 trabajo" : `${list.length} trabajos`;

  function openWith(e: StoredExperience | "new") {
    setEditing(e);
    setSession((n) => n + 1);
    setOpen(true);
  }

  return (
    <Block
      id="experiencia"
      tone={tone}
      index={index}
      icon={Briefcase01Icon}
      title="Experiencia"
      why="Las empresas buscan experiencia primero. Aunque sea un trabajo, súmalo."
      badge={<PointsBadge parts={[[STRENGTH_WEIGHTS.experience, list.length > 0]]} />}
    >
      {list.length ? (
        <>
          <p className="mb-3 text-[0.88rem] font-semibold">
            {jobs}
            {months ? ` · ${formatDuration(months)} en total` : ""}
          </p>
          <ul className="space-y-2.5">
            {sorted.map((e, i) => (
              <li key={e.id} className="animate-rise" style={{ "--i": Math.min(i, 8) } as CSSVars}>
                <button
                  type="button"
                  onClick={() => openWith(e)}
                  disabled={e.id.startsWith("tmp-")}
                  aria-label={`Editar o borrar: ${e.title}${e.company ? ` en ${e.company}` : ""}`}
                  className={cn(
                    "press group flex w-full items-start gap-3 rounded-tile border-2 border-ink bg-white p-3 text-left text-ink outline-none focus-visible:ring-3 focus-visible:ring-ink/50",
                    e.id.startsWith("tmp-") && "opacity-70",
                  )}
                >
                  {e.category ? (
                    <CategoryIcon category={e.category} size="sm" className="shrink-0" />
                  ) : (
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-ink/8">
                      <HugeiconsIcon icon={Briefcase01Icon} className="size-5" strokeWidth={2} />
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="text-[1rem] leading-tight font-bold break-words">{e.title}</span>
                      {e.isCurrent ? (
                        <span className="inline-flex h-6 items-center rounded-md bg-ink px-2 text-[0.68rem] font-bold tracking-[0.1em] text-limon uppercase">
                          Actual
                        </span>
                      ) : null}
                    </span>
                    {e.company ? <span className="mt-0.5 block text-[0.9rem] leading-snug">{e.company}</span> : null}
                    {experienceRange(e) ? (
                      <span className="mt-0.5 block text-[0.82rem] font-semibold text-ink/65 tabular-nums">{experienceRange(e)}</span>
                    ) : null}
                    {e.description ? <span className="mt-1 line-clamp-2 block text-[0.85rem] leading-snug text-ink/70">{e.description}</span> : null}
                  </span>
                  <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-full bg-ink/8 transition-colors group-hover:bg-ink/15">
                    <HugeiconsIcon icon={PencilEdit02Icon} className="size-4" strokeWidth={2.2} />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <div className="rounded-tile border-2 border-dashed border-ink/35 bg-white/40 p-4 text-center">
          <p className="font-display text-[1.1rem] font-extrabold">Aún no agregas dónde has trabajado</p>
          <p className="mt-1 text-[0.9rem] text-muted-foreground">
            Un trabajo de medio tiempo o en el negocio familiar también cuenta. Suma +{STRENGTH_WEIGHTS.experience}%.
          </p>
        </div>
      )}

      <button type="button" onClick={() => openWith("new")} disabled={full} className={cn(INK_BTN, "mt-4 w-full")}>
        <HugeiconsIcon icon={Add01Icon} className="size-5 text-limon" strokeWidth={2.6} />
        {list.length ? "Agregar otra experiencia" : "Agregar experiencia"}
      </button>
      <p className="mt-2 text-center text-[0.8rem] text-muted-foreground tabular-nums">
        {full ? `Llegaste al máximo de ${PROFILE_LIMITS.experiencesMax}. Borra una para agregar otra.` : `${list.length} de ${PROFILE_LIMITS.experiencesMax}`}
      </p>

      <ExperienceDrawer
        key={session}
        open={open}
        onOpenChange={setOpen}
        entry={editing === "new" ? null : editing}
      />
    </Block>
  );
}

// ------------------------------------------------------------------ drawer

type Draft = {
  title: string;
  company: string;
  category: CategoryId | null;
  startM: string;
  startY: string;
  endM: string;
  endY: string;
  isCurrent: boolean;
  description: string;
};

function toDraft(e: StoredExperience | null): Draft {
  const a = parseMonth(e?.startMonth);
  const b = parseMonth(e?.endMonth);
  return {
    title: e?.title ?? "",
    company: e?.company ?? "",
    category: e?.category ?? null,
    startM: a ? String(a.m) : "",
    startY: a ? String(a.y) : "",
    endM: b ? String(b.m) : "",
    endY: b ? String(b.y) : "",
    isCurrent: e?.isCurrent ?? false,
    description: e?.description ?? "",
  };
}

const ym = (y: string, m: string) => (y && m ? `${y}-${m.padStart(2, "0")}` : null);

function fromDraft(d: Draft): WorkExperience {
  return {
    title: d.title,
    company: d.company || null,
    category: d.category,
    startMonth: ym(d.startY, d.startM),
    endMonth: d.isCurrent ? null : ym(d.endY, d.endM),
    isCurrent: d.isCurrent,
    description: d.description || null,
  };
}

function draftProblem(d: Draft): string | null {
  if ((d.startM && !d.startY) || (!d.startM && d.startY)) return "Completa el mes y el año de inicio, o déjalos vacíos.";
  if (!d.isCurrent && ((d.endM && !d.endY) || (!d.endM && d.endY))) return "Completa el mes y el año en que terminaste, o déjalos vacíos.";
  return validateExperience(fromDraft(d));
}

function ExperienceDrawer({
  open,
  onOpenChange,
  entry,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  entry: StoredExperience | null;
}) {
  const addExperience = useApp((s) => s.addExperience);
  const updateExperience = useApp((s) => s.updateExperience);
  const removeExperience = useApp((s) => s.removeExperience);
  const [d, setD] = useState<Draft>(() => toDraft(entry));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const errorId = useId();
  const editing = !!entry;

  const patch = (p: Partial<Draft>) => {
    setError(null);
    setD((x) => ({ ...x, ...p }));
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    const problem = draftProblem(d);
    if (problem) {
      setError(problem);
      if (d.title.trim().length < 2) titleRef.current?.focus();
      return;
    }
    setSaving(true);
    markEdited();
    const value = fromDraft(d);
    const r = entry ? await updateExperience(entry.id, value) : await addExperience(value);
    setSaving(false);
    // The store already toasted a server error (and rolled back); keep the drawer open to retry.
    if (!r.error) onOpenChange(false);
  }

  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="mx-auto max-w-xl data-[vaul-drawer-direction=bottom]:max-h-[92dvh]!">
          <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col">
            <DrawerHeader className="px-4 pt-3 pb-2 text-left! sm:px-6">
              <div className="flex items-center gap-3">
                <span className="grid size-12 shrink-0 -rotate-6 place-items-center rounded-[0.9rem] border-2 border-ink bg-limon text-ink">
                  <HugeiconsIcon icon={Briefcase01Icon} className="size-6" strokeWidth={2} />
                </span>
                <div className="min-w-0">
                  <DrawerTitle className="font-display text-[1.6rem] leading-tight font-extrabold tracking-[-0.03em]">
                    {editing ? "Editar experiencia" : "Agregar experiencia"}
                  </DrawerTitle>
                  <DrawerDescription className="text-[0.95rem]">Solo el puesto es obligatorio. Lo demás ayuda.</DrawerDescription>
                </div>
              </div>
            </DrawerHeader>

            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-4 pt-3 pb-4 sm:px-6">
              <div className="space-y-2">
                <div className="flex items-end justify-between">
                  <Label htmlFor="exp-title" className="text-[0.95rem] font-bold">
                    Puesto
                  </Label>
                  <Counter value={d.title.length} max={PROFILE_LIMITS.experienceTitleMax} />
                </div>
                <Input
                  ref={titleRef}
                  id="exp-title"
                  required
                  autoComplete="organization-title"
                  maxLength={PROFILE_LIMITS.experienceTitleMax}
                  placeholder="Ej. Cajera, Montacarguista, Ayudante general"
                  value={d.title}
                  aria-invalid={!!error && d.title.trim().length < 2 ? true : undefined}
                  aria-describedby={error ? errorId : undefined}
                  onChange={(e) => patch({ title: e.target.value })}
                  className={cn(WW_FIELD, "font-semibold")}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="exp-company" className="text-[0.95rem] font-bold">
                  Empresa o negocio <span className="font-normal text-muted-foreground">(opcional)</span>
                </Label>
                <Input
                  id="exp-company"
                  autoComplete="organization"
                  maxLength={PROFILE_LIMITS.experienceCompanyMax}
                  placeholder="Ej. Minisúper La Esquina"
                  value={d.company}
                  onChange={(e) => patch({ company: e.target.value })}
                  className={WW_FIELD}
                />
              </div>

              <fieldset>
                <legend className="mb-2 text-[0.95rem] font-bold">
                  Tipo de chamba <span className="font-normal text-muted-foreground">(opcional)</span>
                </legend>
                <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6">
                  {CATEGORIES.map((c) => {
                    const on = d.category === c.id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        aria-pressed={on}
                        onClick={() => patch({ category: on ? null : c.id })}
                        className={cn(
                          "press inline-flex h-12 shrink-0 items-center gap-2 rounded-full py-1 pr-4 pl-1.5 text-[0.9rem] font-semibold whitespace-nowrap outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                          on ? "border-2 border-ink bg-ink text-white" : "border-2 border-border bg-card text-foreground hover:bg-tile",
                        )}
                      >
                        <CategoryIcon category={c.id} size="xs" />
                        {c.label}
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              <MonthYear legend="Desde" month={d.startM} year={d.startY} onChange={(m, y) => patch({ startM: m, startY: y })} />

              <button
                type="button"
                role="switch"
                aria-checked={d.isCurrent}
                onClick={() => patch({ isCurrent: !d.isCurrent })}
                className={cn(
                  "press flex min-h-12 w-full items-center gap-3 rounded-tile border-2 px-3 py-2 text-left text-[0.95rem] font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  d.isCurrent ? "border-ink bg-limon text-ink" : "border-border bg-card text-foreground",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "grid size-7 shrink-0 place-items-center rounded-lg border-2",
                    d.isCurrent ? "border-ink bg-ink text-limon" : "border-current/40",
                  )}
                >
                  {d.isCurrent ? <HugeiconsIcon icon={Tick02Icon} className="size-4" strokeWidth={3} /> : null}
                </span>
                Trabajo aquí actualmente
              </button>

              {d.isCurrent ? null : (
                <MonthYear legend="Hasta" month={d.endM} year={d.endY} onChange={(m, y) => patch({ endM: m, endY: y })} />
              )}

              <div className="space-y-2">
                <div className="flex items-end justify-between">
                  <Label htmlFor="exp-desc" className="text-[0.95rem] font-bold">
                    ¿Qué hacías? <span className="font-normal text-muted-foreground">(opcional)</span>
                  </Label>
                  <Counter value={d.description.length} max={PROFILE_LIMITS.experienceDescriptionMax} />
                </div>
                <Textarea
                  id="exp-desc"
                  rows={3}
                  maxLength={PROFILE_LIMITS.experienceDescriptionMax}
                  placeholder="Ej. Cobro en caja, corte del día, acomodo de mercancía."
                  value={d.description}
                  onChange={(e) => patch({ description: e.target.value })}
                  className={cn(WW_FIELD, "h-auto min-h-24 py-3 leading-relaxed")}
                />
              </div>

              {error ? (
                <p id={errorId} role="alert" className="rounded-tile border-2 border-ink bg-block-sol p-3 text-[0.92rem] font-semibold text-ink">
                  {error}
                </p>
              ) : null}
            </div>

            <div className="flex gap-2 border-t-2 border-dashed border-border px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
              {editing ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="xl"
                  onClick={() => setConfirm(true)}
                  className="shrink-0 px-4 text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  <HugeiconsIcon icon={Delete02Icon} className="size-5" strokeWidth={2.2} />
                  Borrar
                </Button>
              ) : null}
              <Button
                type="submit"
                size="xl"
                aria-disabled={saving || undefined}
                className={cn("min-w-0 flex-1 text-[1.05rem] font-bold", INK_BUTTON, WW_HARD_SM, saving && "opacity-80")}
              >
                <HugeiconsIcon icon={Tick02Icon} className="size-5 text-limon" strokeWidth={2.6} />
                {saving ? "Guardando…" : editing ? "Guardar cambios" : "Agregar"}
              </Button>
            </div>
          </form>
        </DrawerContent>
      </Drawer>

      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Borrar esta experiencia?</AlertDialogTitle>
            <AlertDialogDescription>
              «{entry?.title}
              {entry?.company ? ` en ${entry.company}` : ""}» desaparecerá de tu perfil. Puedes volver a agregarla cuando quieras.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (!entry) return;
                markEdited();
                onOpenChange(false);
                void removeExperience(entry.id);
              }}
            >
              Sí, borrar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

const SELECT =
  "h-12 w-full appearance-none rounded-tile border-2 border-ink bg-white bg-[length:1rem] bg-[right_0.8rem_center] bg-no-repeat pr-9 pl-3.5 text-base font-semibold text-ink shadow-[3px_3px_0_0_var(--ink)] outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 dark:shadow-[3px_3px_0_0_rgb(0_0_0/0.55)]";
const CHEVRON =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23160F33' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")";

/** Month + year as two native selects (wheel pickers on phones, works everywhere). */
function MonthYear({ legend, month, year, onChange }: { legend: string; month: string; year: string; onChange: (m: string, y: string) => void }) {
  const id = useId();
  const now = new Date().getFullYear();
  const years = useMemo(() => Array.from({ length: 51 }, (_, i) => String(now - i)), [now]);
  return (
    <fieldset>
      <legend className="mb-2 text-[0.95rem] font-bold">
        {legend} <span className="font-normal text-muted-foreground">(mes y año)</span>
      </legend>
      <div className="grid grid-cols-[1.4fr_1fr] gap-2">
        <label htmlFor={`${id}-m`} className="sr-only">
          {legend}: mes
        </label>
        <select
          id={`${id}-m`}
          value={month}
          onChange={(e) => onChange(e.target.value, year)}
          className={SELECT}
          style={{ backgroundImage: CHEVRON }}
        >
          <option value="">Mes</option>
          {MONTH_LABELS.map((m, i) => (
            <option key={m} value={String(i + 1)}>
              {m}
            </option>
          ))}
        </select>
        <label htmlFor={`${id}-y`} className="sr-only">
          {legend}: año
        </label>
        <select
          id={`${id}-y`}
          value={year}
          onChange={(e) => onChange(month, e.target.value)}
          className={SELECT}
          style={{ backgroundImage: CHEVRON }}
        >
          <option value="">Año</option>
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>
    </fieldset>
  );
}

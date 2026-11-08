"use client";

import { useLayoutEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Add01Icon,
  ArrowRight01Icon,
  Briefcase01Icon,
  Delete02Icon,
  Location01Icon,
  PencilEdit02Icon,
  PlusSignIcon,
  UserMultipleIcon,
} from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
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
import { BLOCK_CLASS, HeroCard, SectionLabel } from "@/components/chamba/primitives";
import { CountUp, Sticker, useConfetti } from "@/components/chamba/motion";
import { CategoryIcon } from "@/components/chamba/job-icons";
import { Scene } from "@/components/chamba/art/scenes";
import { Doodle } from "@/components/chamba/art/doodles";
import { HARD, HARD_SM, INK_BUTTON, OUTLINE, WHITE_BUTTON, WORK_CONFETTI } from "@/components/empresa/workwear";
import { EmployerGate } from "@/components/empresa/employer-gate";
import type { Branch } from "@/lib/data/types";
import { updateJob } from "@/lib/live/backend";
import { useApp, useEmployerLocations, useIsLive } from "@/lib/store";
import { useCan } from "@/lib/team";
import { NotForRole } from "@/components/team/not-for-role";
import { cn } from "@/lib/utils";
import { BranchDrawer, type BranchDraft } from "./branch-drawer";
import { BranchMapArt, CityPins, branchTone, coloniaText, useBranchSummaries } from "./branch-kit";

type CSSVars = React.CSSProperties & Record<`--${string}`, string | number>;

type DrawerState = { key: number; branch?: Branch } | null;

export function BranchManager() {
  return <EmployerGate shape="cards">{() => <BranchManagerGate />}</EmployerGate>;
}

/** Adding, editing and removing branches is for the dueño and admins; anyone else gets who does it. */
function BranchManagerGate() {
  const can = useCan();
  const mine = useEmployerLocations();
  if (can.role && !can.manageBranches) {
    const where = can.allBranches ? "todas las sucursales" : mine.map((b) => b.name).join(", ") || "tus sucursales";
    return (
      <NotForRole
        title="Las sucursales las maneja el dueño"
        body={`Tú ves las vacantes y postulantes de ${where}. Para agregar o cambiar una sucursal, pídeselo al dueño o a un administrador.`}
        back={{ href: "/empresa/vacantes", label: "Ver mis vacantes" }}
      />
    );
  }
  return <BranchManagerBody />;
}

function BranchManagerBody() {
  const summaries = useBranchSummaries();
  const live = useIsLive();
  const addLocation = useApp((s) => s.addLocation);
  const addLocationAsync = useApp((s) => s.addLocationAsync);
  const updateLocation = useApp((s) => s.updateLocation);
  const removeLocation = useApp((s) => s.removeLocation);
  const fire = useConfetti();
  const [drawer, setDrawer] = useState<DrawerState>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [deleting, setDeleting] = useState<Branch | null>(null);
  // Kept while the dialog animates out (after removal the branch and its summary are gone).
  const [deleteOpen, setDeleteOpen] = useState(false);
  // Live: the drawer / dialog stay open until the server agrees.
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);

  // Pages stay mounted after navigating away; don't come back to an open sheet or dialog.
  useLayoutEffect(
    () => () => {
      setDrawerOpen(false);
      setDeleteOpen(false);
    },
    [],
  );

  const locations = summaries.map((s) => s.branch);
  const count = locations.length;
  const totalJobs = summaries.reduce((n, s) => n + s.jobs.length, 0);
  const totalApplicants = summaries.reduce((n, s) => n + s.applicants, 0);

  function openNew() {
    setDrawer((d) => ({ key: (d?.key ?? 0) + 1 }));
    setDrawerOpen(true);
  }
  function openEdit(branch: Branch) {
    setDrawer((d) => ({ key: (d?.key ?? 0) + 1, branch }));
    setDrawerOpen(true);
  }

  async function save({ name, place }: BranchDraft, button: HTMLButtonElement | null) {
    if (live) {
      if (saving) return;
      setSaving(true);
      const patch = { name, colonia: place.colonia, location: place.location };
      // Store actions roll back and toast the error themselves.
      const r = drawer?.branch ? await updateLocation(drawer.branch.id, patch) : await addLocationAsync(patch);
      setSaving(false);
      if (r.error) return;
      if (drawer?.branch) toast.success(`Guardamos los cambios de ${name}.`);
      else {
        fire({ origin: button ?? undefined, colors: WORK_CONFETTI, count: 48 });
        toast.success(`¡${name} ya está en el mapa! Sus vacantes llegarán a la gente de ${place.source === "gps" ? "esa zona" : place.colonia}.`);
      }
      setDrawerOpen(false);
      return;
    }
    if (drawer?.branch) {
      updateLocation(drawer.branch.id, { name, colonia: place.colonia, location: place.location });
      toast.success(`Guardamos los cambios de ${name}.`);
    } else {
      addLocation({ name, colonia: place.colonia, location: place.location });
      fire({ origin: button ?? undefined, colors: WORK_CONFETTI, count: 48 });
      toast.success(`¡${name} ya está en el mapa! Sus vacantes llegarán a la gente de ${place.source === "gps" ? "esa zona" : place.colonia}.`);
    }
    setDrawerOpen(false);
  }

  // Frozen when the dialog opens so its copy doesn't change while it closes.
  const [deleteNote, setDeleteNote] = useState("");

  function heirOf(branch: Branch) {
    // A branch still being created has no server id yet; its vacancies can't move there.
    return locations.find((l) => l.id !== branch.id && !l.id.startsWith("tmp-"));
  }

  function askDelete(branch: Branch) {
    const summary = summaries.find((s) => s.branch.id === branch.id);
    const n = summary?.jobs.length ?? 0;
    const heir = heirOf(branch);
    setDeleting(branch);
    if (live) {
      // Live: every vacancy (closed ones too) must move before the branch can go.
      const all = summary?.allJobs.length ?? 0;
      setDeleteNote(
        all
          ? `Tiene ${all} ${all === 1 ? "vacante registrada" : "vacantes registradas"}${all > n ? " (contando las cerradas)" : ""}. ${all === 1 ? "La pasaremos" : "Las pasaremos"} a ${heir?.name ?? "tu sucursal principal"} y sus postulantes se conservan.`
          : "No tiene vacantes. Puedes volver a agregarla cuando quieras.",
      );
      setDeleteOpen(true);
      return;
    }
    setDeleteNote(
      n
        ? `Tiene ${n} ${n === 1 ? "vacante activa" : "vacantes activas"}. ${n === 1 ? "Pasará" : "Pasarán"} a ${heir?.name ?? "tu sucursal principal"} y sus postulantes se conservan.`
        : "No tiene vacantes activas. Puedes volver a agregarla cuando quieras.",
    );
    setDeleteOpen(true);
  }

  async function confirmDelete(e: React.MouseEvent) {
    if (!deleting || !deleteOpen) return;
    if (live) {
      e.preventDefault();
      if (removing) return;
      const branch = deleting;
      const moving = summaries.find((s) => s.branch.id === branch.id)?.allJobs ?? [];
      const heir = heirOf(branch);
      setRemoving(true);
      if (moving.length) {
        if (!heir) {
          setRemoving(false);
          toast.error("Primero agrega otra sucursal para pasarle sus vacantes.");
          return;
        }
        for (const j of moving) {
          const r = await updateJob(j.id, { branchId: heir.id });
          if (r.error) {
            setRemoving(false);
            toast.error(r.error);
            return;
          }
        }
      }
      const r = await removeLocation(branch.id);
      setRemoving(false);
      if (r.error) return; // already toasted, and the branch is back
      toast(`Quitamos ${branch.name} de tus sucursales.`);
      setDeleteOpen(false);
      return;
    }
    removeLocation(deleting.id);
    toast(`Quitamos ${deleting.name} de tus sucursales.`);
    setDeleteOpen(false);
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start lg:gap-7">
      {/* ------------------------------------------------ Hero: the network on a map (the one saturated block) */}
      <div className="min-w-0 space-y-5 lg:sticky lg:top-8 lg:col-span-5">
        <HeroCard
          tone="uva"
          decor={false}
          eyebrow="Tu red en Saltillo"
          title={count > 1 ? `${count} sucursales en Saltillo` : "Una sucursal, por ahora"}
          className={cn("animate-rise overflow-hidden", OUTLINE, HARD)}
        >
          <p className="mt-2 text-[1.02rem] leading-snug text-primary-foreground/85">
            <strong className="font-bold text-limon tabular-nums">{totalJobs}</strong> vacantes ·{" "}
            <strong className="font-bold text-limon tabular-nums">{totalApplicants}</strong> postulantes. Cada vacante llega a quien vive
            cerca de su sucursal.
          </p>
          <div className="relative -mx-2 mt-4 rounded-tile border-2 border-white/15 bg-white/[0.07] px-2 pt-3 text-primary-foreground">
            <CityPins locations={locations} className="w-full" />
          </div>
          <Button
            variant="lime"
            size="xl"
            onClick={openNew}
            className={cn("mt-5 w-full border-2 border-ink sm:w-auto", HARD_SM)}
          >
            <HugeiconsIcon icon={PlusSignIcon} className="size-5" strokeWidth={2.4} />
            Agregar sucursal
          </Button>
        </HeroCard>

        {count <= 1 ? (
          <section
            className={cn("animate-rise block-sol relative overflow-hidden rounded-panel p-5 pr-32 sm:p-6 sm:pr-40", OUTLINE, HARD)}
            style={{ "--i": 1 } as CSSVars}
          >
            <h2 className="font-display text-[1.35rem] leading-tight font-extrabold tracking-[-0.03em]">
              ¿Tienes otra planta, bodega o tienda?
            </h2>
            <p className="mt-1.5 text-[0.95rem] leading-snug text-muted-foreground">
              Agrégala y cada vacante llegará a la gente que vive cerca de ese lugar, no del otro lado de la ciudad.
            </p>
            <Button size="lg" onClick={openNew} className={cn("mt-4", INK_BUTTON, HARD_SM)}>
              <HugeiconsIcon icon={Add01Icon} strokeWidth={2.4} />
              Agregar otra
            </Button>
            <Scene name="negocio" className="pointer-events-none absolute -right-4 -bottom-3 w-36 sm:w-40" />
          </section>
        ) : null}
      </div>

      {/* ------------------------------------------------ Branch cards */}
      <section aria-labelledby="tus-sucursales" className="min-w-0 lg:col-span-7">
        <SectionLabel title={<span id="tus-sucursales">Tus sucursales</span>} count={count} className="mb-4" />
        <ul className="grid grid-cols-1 gap-5">
          {summaries.map(({ branch, index, jobs, applicants }) => {
            const principal = index === 0;
            const tone = branchTone(index);
            return (
              <li
                key={branch.id}
                className="animate-rise relative min-w-0"
                style={{ "--i": Math.min(index + 2, 8), "--rise": "24px" } as CSSVars}
              >
                <article
                  aria-labelledby={`suc-${branch.id}`}
                  className={cn("group relative isolate rounded-panel p-5 sm:p-6", BLOCK_CLASS[tone], OUTLINE, HARD)}
                >
                  <span aria-hidden className="pointer-events-none absolute inset-0 -z-10 rounded-[inherit] bg-dots opacity-50" />
                  {principal ? (
                    <Sticker variant="ink" size="sm" rotate={12} className="absolute -top-5 -right-2 z-10 text-[0.72rem]">
                      Principal
                    </Sticker>
                  ) : null}

                  <div className="flex items-start gap-4">
                    <div className="min-w-0 flex-1">
                      <span className="inline-flex h-7 items-center gap-1.5 rounded-md border-2 border-ink bg-white px-2 text-[0.72rem] font-extrabold tracking-[0.1em] text-ink uppercase">
                        <span className="grid size-4.5 place-items-center rounded-full bg-ink text-[0.65rem] text-white tabular-nums">
                          {index + 1}
                        </span>
                        {principal ? "Matriz" : "Sucursal"}
                      </span>
                      <h3
                        id={`suc-${branch.id}`}
                        className="mt-2.5 font-display text-[1.55rem] leading-[1.05] font-extrabold tracking-[-0.03em] break-words sm:text-[1.8rem]"
                      >
                        {branch.name}
                      </h3>
                      <p className="mt-1 flex items-start gap-1.5 text-[0.95rem] leading-snug text-muted-foreground">
                        <HugeiconsIcon icon={Location01Icon} className="mt-0.5 size-4.5 shrink-0" strokeWidth={2} />
                        <span className="min-w-0">{coloniaText(branch)}</span>
                      </p>
                    </div>
                    <BranchMapArt seed={branch.id} principal={principal} className="w-26 shrink-0 rotate-3 sm:w-32" />
                  </div>

                  <dl className="mt-4 grid grid-cols-2 gap-2.5">
                    {[
                      { k: "Vacantes", v: jobs.length, icon: Briefcase01Icon },
                      { k: "Postulantes", v: applicants, icon: UserMultipleIcon },
                    ].map((s) => (
                      <div key={s.k} className="flex flex-col rounded-tile border-2 border-ink bg-white p-3 text-ink">
                        <dt className="order-2 mt-1 text-[0.8rem] font-semibold text-ink/65">{s.k}</dt>
                        <dd className="order-1 flex items-center gap-2 font-display text-[1.6rem] leading-none font-extrabold tracking-[-0.04em] tabular-nums">
                          <HugeiconsIcon icon={s.icon} className="size-5 shrink-0 text-ink/70" strokeWidth={2} />
                          <CountUp value={s.v} />
                        </dd>
                      </div>
                    ))}
                  </dl>

                  {jobs.length ? (
                    <ul aria-label={`Vacantes en ${branch.name}`} className="mt-3 flex flex-wrap gap-2">
                      {jobs.slice(0, 3).map((j) => (
                        <li key={j.id}>
                          <Link
                            href={`/empresa/vacantes/${j.id}`}
                            className="press inline-flex min-h-11 items-center gap-2 rounded-full border-2 border-ink bg-white/70 py-1 pr-3.5 pl-1.5 text-[0.9rem] font-semibold text-ink outline-none hover:bg-white focus-visible:ring-4 focus-visible:ring-ring/60"
                          >
                            <CategoryIcon category={j.category} size="xs" />
                            {j.title}
                          </Link>
                        </li>
                      ))}
                      {jobs.length > 3 ? (
                        <li className="inline-flex min-h-11 items-center px-1 text-[0.9rem] font-semibold">+{jobs.length - 3} más</li>
                      ) : null}
                    </ul>
                  ) : (
                    <p className="mt-3 rounded-tile border-2 border-dashed border-ink/35 px-3.5 py-2.5 text-[0.92rem] leading-snug">
                      Sin vacantes todavía.{" "}
                      <Link
                        href="/empresa/vacantes/nueva"
                        className="rounded font-bold underline decoration-2 underline-offset-4 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                      >
                        Publica la primera
                      </Link>
                    </p>
                  )}

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <Button size="lg" onClick={() => openEdit(branch)} className={cn("h-11", WHITE_BUTTON)}>
                      <HugeiconsIcon icon={PencilEdit02Icon} strokeWidth={2} />
                      Editar
                    </Button>
                    <Button
                      size="lg"
                      disabled={count <= 1}
                      onClick={() => askDelete(branch)}
                      aria-describedby={count <= 1 ? "suc-ultima" : undefined}
                      className={cn("h-11", WHITE_BUTTON, "disabled:opacity-50")}
                    >
                      <HugeiconsIcon icon={Delete02Icon} className="text-destructive" strokeWidth={2} />
                      Eliminar
                    </Button>
                  </div>
                  {count <= 1 ? (
                    <p id="suc-ultima" className="mt-2 text-[0.85rem] text-muted-foreground">
                      Necesitas al menos una sucursal: puedes editarla, pero no eliminarla.
                    </p>
                  ) : null}
                </article>
              </li>
            );
          })}

          <li className="animate-rise relative" style={{ "--i": Math.min(count + 2, 8) } as CSSVars}>
            <button
              type="button"
              onClick={openNew}
              className="group press lift flex min-h-20 w-full items-center gap-4 rounded-panel border-2 border-dashed border-ink/60 bg-card px-5 py-4 text-left outline-none focus-visible:ring-4 focus-visible:ring-ring/60 dark:border-white/40"
            >
              <span className="grid size-12 shrink-0 place-items-center rounded-full border-2 border-ink bg-limon text-ink transition-transform duration-300 group-hover:rotate-90">
                <HugeiconsIcon icon={PlusSignIcon} className="size-6" strokeWidth={2.4} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-display text-[1.2rem] leading-tight font-extrabold tracking-[-0.02em]">
                  Agregar otra sucursal
                </span>
                <span className="block text-[0.92rem] text-muted-foreground">Planta, bodega o tienda · en 1 minuto</span>
              </span>
              <HugeiconsIcon icon={ArrowRight01Icon} className="size-5 shrink-0" strokeWidth={2} />
            </button>
          </li>
        </ul>
        <p className="mt-5 flex items-center gap-2 text-sm text-muted-foreground">
          <Doodle name="rayo" color="#FF6B2C" animated={false} className="size-5 shrink-0" />
          Al publicar una vacante eliges en qué sucursal es.
        </p>
      </section>

      {drawer ? (
        <BranchDrawer
          key={drawer.key}
          open={drawerOpen}
          onOpenChange={(o) => (saving && !o ? undefined : setDrawerOpen(o))}
          branch={drawer.branch}
          onSave={save}
          saving={saving}
        />
      ) : null}

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar {deleting?.name}?</AlertDialogTitle>
            <AlertDialogDescription>{deleteNote}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removing}>Cancelar</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={confirmDelete} aria-disabled={removing || undefined}>
              {removing ? "Eliminando…" : "Eliminar sucursal"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

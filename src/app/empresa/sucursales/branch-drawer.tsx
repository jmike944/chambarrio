"use client";

import { useRef, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Store01Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { FIELD, HARD_SM, INK_BUTTON } from "@/components/empresa/workwear";
import { LocationPicker, type Place } from "@/components/onboarding/location-picker";
import type { Branch } from "@/lib/data/types";
import { cn } from "@/lib/utils";
import { GPS_COLONIA } from "./branch-kit";

export type BranchDraft = { name: string; place: Place };

/** "Sucursal Lourdes" — default name when the employer leaves it blank. */
export function defaultBranchName(place: Place | null) {
  if (!place) return "";
  return place.source === "gps" ? "Nueva sucursal" : `Sucursal ${place.colonia}`;
}

/**
 * Bottom sheet to add or edit a sucursal: a name + the onboarding LocationPicker.
 * Mount it with a `key` per open so its fields start fresh.
 */
export function BranchDrawer({
  open,
  onOpenChange,
  branch,
  onSave,
  saving = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Editing this branch; omitted = new branch. */
  branch?: Branch;
  onSave: (draft: BranchDraft, button: HTMLButtonElement | null) => void | Promise<void>;
  /** Live: waiting for the server; the button shows progress and ignores taps. */
  saving?: boolean;
}) {
  const [name, setName] = useState(branch?.name ?? "");
  const [place, setPlace] = useState<Place | null>(
    branch ? { colonia: branch.colonia, location: branch.location, source: branch.colonia === GPS_COLONIA ? "gps" : "colonia" } : null,
  );
  const saveRef = useRef<HTMLButtonElement>(null);
  const editing = !!branch;
  const suggested = defaultBranchName(place);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!place || saving) return;
    void onSave({ name: name.trim() || suggested, place }, saveRef.current);
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="mx-auto max-w-xl data-[vaul-drawer-direction=bottom]:max-h-[92dvh]!">
        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <DrawerHeader className="px-4 pt-3 pb-2 text-left! sm:px-6">
            <div className="flex items-center gap-3">
              <span className="grid size-12 shrink-0 -rotate-6 place-items-center rounded-[0.9rem] border-2 border-ink bg-limon text-ink">
                <HugeiconsIcon icon={Store01Icon} className="size-6" strokeWidth={2} />
              </span>
              <div className="min-w-0">
                <DrawerTitle className="font-display text-[1.6rem] leading-tight font-extrabold tracking-[-0.03em]">
                  {editing ? "Editar sucursal" : "Nueva sucursal"}
                </DrawerTitle>
                <DrawerDescription className="text-[0.95rem]">
                  {editing ? "Cambia el nombre o dónde está." : "Planta, bodega, tienda… cada una recibe candidatos de su colonia."}
                </DrawerDescription>
              </div>
            </div>
          </DrawerHeader>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-3 pb-4 sm:px-6">
            <Label htmlFor="branch-name" className="mb-2 text-[0.95rem] font-bold">
              Nombre de la sucursal
            </Label>
            <Input
              id="branch-name"
              autoComplete="off"
              placeholder={suggested || "Ej. Bodega Bellavista"}
              value={name}
              maxLength={40}
              onChange={(e) => setName(e.target.value)}
              className={cn(FIELD, "font-semibold")}
            />
            <p className="mt-2 text-[0.85rem] text-muted-foreground">Así la verán los candidatos en cada vacante.</p>
            <div className="mt-6">
              <LocationPicker
                value={place}
                onPick={setPlace}
                privacyNote="Los candidatos ven la colonia de cada sucursal y la distancia, nunca la dirección exacta."
              />
            </div>
          </div>

          <div className="border-t-2 border-dashed border-border px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
            <Button
              ref={saveRef}
              type="submit"
              size="xl"
              disabled={!place}
              aria-disabled={saving || undefined}
              className={cn("w-full text-[1.05rem] font-bold", INK_BUTTON, HARD_SM, saving && "opacity-80")}
            >
              <HugeiconsIcon icon={Tick02Icon} className="size-5" strokeWidth={2.6} />
              {saving ? "Guardando…" : editing ? "Guardar cambios" : place ? `Agregar ${name.trim() || suggested}` : "Elige dónde está"}
            </Button>
          </div>
        </form>
      </DrawerContent>
    </Drawer>
  );
}

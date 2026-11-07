"use client";

import { useState } from "react";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import { Gps01Icon, LockIcon, Location01Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import { COLONIAS } from "@/lib/data/jobs";
import type { LatLng } from "@/lib/geo";
import { cn } from "@/lib/utils";
import { FlowLabel, Slab, SlabShadow, focusRing, slabFace, type CSSVars } from "./flow";

export type Place = {
  colonia: string;
  location: LatLng;
  source: "colonia" | "gps";
};

export function LocationPicker({
  value,
  onPick,
  privacyNote = "Las empresas solo ven tu colonia y la distancia. Nunca tu dirección.",
}: {
  value: Place | null;
  onPick: (p: Place) => void;
  privacyNote?: string;
}) {
  const [locating, setLocating] = useState(false);

  function useGps() {
    if (!("geolocation" in navigator)) {
      toast.error("Tu teléfono no permite compartir la ubicación. Elige tu colonia de la lista.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setLocating(false);
        onPick({
          colonia: "Mi ubicación",
          location: { lat: p.coords.latitude, lng: p.coords.longitude },
          source: "gps",
        });
      },
      () => {
        setLocating(false);
        toast.error("No pudimos obtener tu ubicación. Elige tu colonia de la lista.");
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  }

  const gpsPicked = value?.source === "gps";

  return (
    <div>
      {/* GPS: the big "one tap" option */}
      <div className="relative animate-rise rounded-[1.6rem]" style={{ "--i": 1 } as CSSVars}>
        <SlabShadow on={gpsPicked} />
        <button
          type="button"
          onClick={useGps}
          disabled={locating}
          aria-pressed={gpsPicked}
          className={cn(
            "group block-cielo flex min-h-20 w-full items-center gap-4 rounded-[1.6rem] px-4 text-left disabled:opacity-80",
            slabFace(gpsPicked),
            focusRing,
          )}
        >
          <span className="relative grid size-13 shrink-0 place-items-center rounded-full border-[2.5px] border-ink bg-white text-ink">
            <span
              aria-hidden
              className={cn(
                "absolute inset-0 rounded-full border-[2.5px] border-ink/40",
                (locating || !gpsPicked) && "animate-live-pulse",
              )}
            />
            <HugeiconsIcon
              icon={Gps01Icon}
              className="size-7 transition-[rotate] duration-500 group-hover:rotate-90"
              strokeWidth={2}
            />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-display text-[1.3rem] leading-tight font-extrabold tracking-[-0.02em]">
              {locating ? "Buscando tu ubicación…" : gpsPicked ? "Ubicación detectada" : "Usar mi ubicación"}
            </span>
            <span className="block text-[0.9rem] font-medium text-muted-foreground">El GPS de tu cel, en un toque</span>
          </span>
          {gpsPicked ? (
            <span className="grid size-8 animate-pop-in place-items-center rounded-full bg-ink text-limon">
              <HugeiconsIcon icon={Tick02Icon} className="size-4.5" strokeWidth={3.2} />
            </span>
          ) : null}
        </button>
      </div>

      <FlowLabel id="colonia-label" className="mt-8">
        O elige tu colonia
      </FlowLabel>
      <Slab tone="sol" index={2} className="p-2.5">
        <ul aria-labelledby="colonia-label" className="grid gap-2 sm:grid-cols-2">
          {COLONIAS.map((c) => {
            const on = value?.source === "colonia" && value.colonia === c.name;
            return (
              <li key={c.name}>
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() =>
                    onPick({
                      colonia: c.name,
                      location: c.location,
                      source: "colonia",
                    })
                  }
                  className={cn(
                    "press group flex h-14 w-full items-center gap-3 rounded-[1rem] border-[2.5px] px-4 text-left text-[1.05rem] font-bold transition-[scale,background-color,border-color,color]",
                    on
                      ? "border-ink bg-primary text-primary-foreground"
                      : "border-transparent bg-white/75 text-ink hover:border-ink hover:bg-white",
                    focusRing,
                  )}
                >
                  <HugeiconsIcon
                    icon={Location01Icon}
                    className={cn(
                      "size-5 shrink-0 transition-[translate] group-hover:-translate-y-0.5",
                      on ? "text-limon" : "text-ink/60",
                    )}
                    strokeWidth={2.2}
                  />
                  <span className="flex-1">{c.name}</span>
                  {on ? (
                    <HugeiconsIcon icon={Tick02Icon} className="size-5 animate-pop-in text-limon" strokeWidth={3} />
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      </Slab>

      <Slab tone="menta" index={3} className="mt-5 flex items-start gap-3 p-4 text-[0.95rem] leading-snug font-medium">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg border-2 border-ink bg-white text-ink">
          <HugeiconsIcon icon={LockIcon} className="size-5" strokeWidth={2.2} />
        </span>
        <span className="pt-1">{privacyNote}</span>
      </Slab>
    </div>
  );
}

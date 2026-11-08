"use client";

import Link from "next/link";
import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Location06Icon, RefreshIcon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/chamba/primitives";
import { useCatalog } from "@/lib/data/catalog";
import { RADIUS_STOPS, type RadiusKm } from "@/lib/geo";
import { useApp, useIsLive } from "@/lib/store";
import { cn } from "@/lib/utils";
import { MyMascot, MyScene } from "@/components/chamba/art/my-mascot";

/*
 * Shared loading / error / empty states for the job-seeker screens (inicio, vacantes, mapa,
 * postulaciones). Demo is always "ready", so these only ever show in live mode (or while a
 * live-capable build hydrates).
 */

/** Hard ink edge used by the seeker screens' plates. */
const EDGE =
  "border-[2.5px] border-[color:var(--ink)] shadow-[0_5px_0_var(--ink)] dark:border-black/70 dark:shadow-[0_5px_0_rgb(0_0_0/0.6)]";

/** The next radius stop above the current one (null at 15 km). */
export function nextRadiusStop(r: number): RadiusKm | null {
  return RADIUS_STOPS.find((s) => s > r) ?? null;
}

/** A pulsing block on top of a colored surface (ink tint so it reads on any pastel and in dark mode). */
/** A span (block by default) so it can sit inside headings and paragraphs without breaking hydration. */
export function InkSkeleton({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      aria-hidden
      data-slot="skeleton"
      className={cn("block animate-pulse rounded-xl bg-[color:var(--ink)]/12 dark:bg-white/12", className)}
      {...props}
    />
  );
}

/** Screen-reader announcement for a loading region. */
export function LoadingNote({ children = "Buscando vacantes cerca de ti…" }: { children?: React.ReactNode }) {
  return (
    <p role="status" className="sr-only">
      {children}
    </p>
  );
}

/** Card-shaped placeholders (same footprint as the job cards, so nothing jumps when data lands). */
export function JobCardSkeletons({ count = 4, className, tall = false }: { count?: number; className?: string; tall?: boolean }) {
  return (
    <ul aria-hidden className={cn("grid grid-cols-1 gap-3.5", className)}>
      {Array.from({ length: count }, (_, i) => (
        <li
          key={i}
          className={cn("relative overflow-hidden rounded-panel bg-card p-5", EDGE, tall ? "h-[13.5rem]" : "h-[8.5rem]")}
          style={{ opacity: 1 - i * 0.14 }}
        >
          <InkSkeleton className="h-6 w-24 rounded-md" />
          <InkSkeleton className="mt-3 h-7 w-3/5" />
          <InkSkeleton className="mt-2 h-4 w-2/5" />
          {tall ? <InkSkeleton className="mt-5 h-8 w-32" /> : null}
          <InkSkeleton className="absolute top-4 right-4 size-20 rounded-full sm:size-24" />
        </li>
      ))}
    </ul>
  );
}

/** Compact list-row placeholders (JobRow footprint). */
export function RowSkeletons({ count = 4, className }: { count?: number; className?: string }) {
  return (
    <ul aria-hidden className={cn("space-y-1", className)}>
      {Array.from({ length: count }, (_, i) => (
        <li key={i} className="flex items-center gap-3.5 py-2.5" style={{ opacity: 1 - i * 0.15 }}>
          <InkSkeleton className="size-12 shrink-0 rounded-2xl" />
          <span className="min-w-0 flex-1 space-y-2">
            <InkSkeleton className="h-4 w-3/5" />
            <InkSkeleton className="h-3.5 w-2/5" />
          </span>
          <InkSkeleton className="size-11 shrink-0 rounded-full" />
        </li>
      ))}
    </ul>
  );
}

/** Friendly "couldn't load" panel with a retry that calls the catalog's reload(). */
export function CatalogErrorPanel({
  error,
  onRetry,
  className,
  title = "No pudimos cargar las vacantes",
}: {
  error?: string;
  onRetry?: () => Promise<void> | void;
  className?: string;
  title?: string;
}) {
  const catalog = useCatalog();
  const [busy, setBusy] = useState(false);
  async function retry() {
    setBusy(true);
    try {
      await (onRetry ?? catalog.reload)();
    } finally {
      setBusy(false);
    }
  }
  return (
    <Panel tone="durazno" role="alert" className={cn("animate-pop-in overflow-hidden text-center", EDGE, className)}>
      <MyMascot mood="piensa" prop="casco" size={120} className="mx-auto w-28" />
      <h3 className="mt-2 font-display text-[1.5rem] leading-tight font-extrabold tracking-[-0.03em]">{title}</h3>
      <p className="mx-auto mt-1.5 max-w-sm text-muted-foreground">
        {error ?? catalog.error ?? "Revisa tu conexión a internet e inténtalo otra vez en un momento."}
      </p>
      <Button size="lg" className="mt-5" onClick={retry} disabled={busy}>
        <HugeiconsIcon icon={RefreshIcon} strokeWidth={2.2} className={cn(busy && "motion-safe:animate-spin")} />
        {busy ? "Reintentando…" : "Reintentar"}
      </Button>
    </Panel>
  );
}

/** Small note when a background refresh failed but older data is still on screen. */
export function StaleNote({ className }: { className?: string }) {
  const { status, error, refreshing, reload } = useCatalog();
  if (status !== "ready" || !error || refreshing) return null;
  return (
    <p role="status" className={cn("flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground", className)}>
      No pudimos actualizar las vacantes.
      <button type="button" onClick={() => void reload()} className="min-h-11 font-semibold text-foreground underline underline-offset-4">
        Reintentar
      </button>
    </p>
  );
}

/**
 * Live: nothing within the radius yet. Worker mascot + friendly copy + "widen" button.
 * (Demo keeps each screen's original empty state.)
 */
export function LiveEmptyNearby({
  radiusKm,
  onWiden,
  className,
  compact = false,
}: {
  radiusKm: number;
  onWiden?: (r: RadiusKm) => void;
  className?: string;
  compact?: boolean;
}) {
  const setRadius = useApp((s) => s.setRadius);
  const next = nextRadiusStop(radiusKm);
  const widen = onWiden ?? ((r: RadiusKm) => void setRadius(r));
  return (
    <Panel tone="menta" className={cn("animate-pop-in overflow-hidden text-center", EDGE, className)}>
      <MyMascot mood="piensa" prop="casco" size={compact ? 96 : 132} className={cn("mx-auto", compact ? "w-24" : "w-32")} />
      <h3 className="mt-2 font-display text-[1.45rem] leading-tight font-extrabold tracking-[-0.03em]">
        Todavía no hay vacantes a {radiusKm} km
      </h3>
      <p className="mx-auto mt-1.5 max-w-sm text-muted-foreground">
        {next ? "Amplía tu radio o vuelve pronto." : "Vuelve pronto: cada día se publican vacantes nuevas."}
      </p>
      {next ? (
        <Button size="lg" className="mt-5" onClick={() => widen(next)}>
          Buscar a {next} km
        </Button>
      ) : null}
    </Panel>
  );
}

/** Live users who never picked a colonia: distances are from Saltillo centro until they do. */
export function PickHomeBanner({ className }: { className?: string }) {
  const live = useIsLive();
  const hasHome = useApp((s) => s.hasHome);
  if (!live || hasHome) return null;
  return (
    <Panel tone="sol" className={cn("flex items-center gap-3 p-4 sm:p-4", EDGE, className)}>
      <span className="grid size-11 shrink-0 place-items-center rounded-full border-2 border-[color:var(--ink)] bg-white text-ink">
        <HugeiconsIcon icon={Location06Icon} className="size-5" strokeWidth={2.2} />
      </span>
      <p className="min-w-0 flex-1 text-[0.95rem] leading-snug">
        <strong className="font-bold">Elige tu colonia</strong> para ver las distancias desde tu casa. Por ahora medimos desde el centro.
      </p>
      <Button size="lg" variant="white" asChild className="shrink-0 border-2 border-[color:var(--ink)] px-4">
        <Link href="/perfil">Elegir</Link>
      </Button>
    </Panel>
  );
}

/** Generic "this vacancy is gone" block used by the detail page. */
export function GoneScene({ className }: { className?: string }) {
  return <MyScene name="vacio" className={cn("mx-auto w-full max-w-[16rem]", className)} />;
}

"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowRight01Icon, RefreshIcon, Store01Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Eyebrow } from "@/components/chamba/primitives";
import { Scene } from "@/components/chamba/art/scenes";
import { MyScene } from "@/components/chamba/art/my-mascot";
import { HARD, HARD_SM, INK_BUTTON, OUTLINE } from "@/components/empresa/workwear";
import { useMyCompany, type MyCompany } from "@/lib/data/catalog";
import { loadSession } from "@/lib/live/backend";
import { useIsLive } from "@/lib/store";
import { useMyMembership } from "@/lib/team";
import { cn } from "@/lib/utils";

/*
 * Shared loading / error / "no business yet" states for every employer screen, plus the team ones:
 * "you were removed from this team" and "a reclutador with no branch left". In demo the company and
 * the membership are always ready (synchronously after hydration), so demo screens render as before.
 */

export type SkeletonShape = "dashboard" | "list" | "detail" | "form" | "cards";

const SK = "rounded-panel border-2 border-ink/10 dark:border-white/10";

/** Neutral skeleton shaped like the screen that is loading. */
export function EmployerSkeleton({ shape = "list", className }: { shape?: SkeletonShape; className?: string }) {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className={cn("grid grid-cols-1 gap-5 lg:grid-cols-12 lg:gap-6", className)}>
      <span className="sr-only">Cargando tu negocio…</span>
      {shape === "dashboard" ? (
        <>
          <Skeleton className={cn("h-80 lg:col-span-7", SK)} />
          <Skeleton className={cn("h-80 lg:col-span-5", SK)} />
          <div className="grid grid-cols-2 gap-3 lg:col-span-12 lg:grid-cols-4 lg:gap-5">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className={cn("h-32", SK)} />
            ))}
          </div>
          <Skeleton className={cn("h-48 lg:col-span-12", SK)} />
        </>
      ) : shape === "detail" ? (
        <>
          <Skeleton className="h-11 w-36 rounded-full lg:col-span-12" />
          <Skeleton className={cn("h-72 lg:col-span-7", SK)} />
          <Skeleton className={cn("h-72 lg:col-span-5", SK)} />
          <div className="grid gap-4 sm:grid-cols-2 lg:col-span-12 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className={cn("h-36", SK)} />
            ))}
          </div>
        </>
      ) : shape === "form" ? (
        <>
          <div className="space-y-6 lg:col-span-7">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className={cn("h-64", SK)} />
            ))}
          </div>
          <div className="space-y-6 lg:col-span-5">
            <Skeleton className={cn("h-96", SK)} />
            <Skeleton className={cn("h-48", SK)} />
          </div>
        </>
      ) : shape === "cards" ? (
        <>
          <Skeleton className={cn("h-80 lg:col-span-5", SK)} />
          <div className="space-y-5 lg:col-span-7">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className={cn("h-52", SK)} />
            ))}
          </div>
        </>
      ) : (
        <div className="space-y-4 lg:col-span-12">
          <div className="grid grid-cols-3 gap-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className={cn("h-28 rounded-tile", SK)} />
            ))}
          </div>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className={cn("h-44", SK)} />
          ))}
        </div>
      )}
    </div>
  );
}

/** Friendly error panel with a retry button. */
export function EmployerError({ message, onRetry, className }: { message?: string; onRetry?: () => void; className?: string }) {
  return (
    <section
      role="alert"
      className={cn("block-durazno relative isolate overflow-hidden rounded-panel p-6 sm:p-7", OUTLINE, HARD, className)}
    >
      <span aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-dots opacity-50" />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <MyScene name="vacio" className="mx-auto w-40 shrink-0 sm:mx-0" />
        <div className="min-w-0">
          <Eyebrow>Algo falló</Eyebrow>
          <h2 className="mt-1.5 font-display text-[1.5rem] leading-tight font-extrabold tracking-[-0.03em]">
            No pudimos cargar tu información
          </h2>
          <p className="mt-1.5 text-[0.98rem] leading-snug text-muted-foreground">
            {message || "Revisa tu conexión e inténtalo de nuevo."}
          </p>
          {onRetry ? (
            <Button size="lg" onClick={onRetry} className={cn("mt-4", INK_BUTTON, HARD_SM)}>
              <HugeiconsIcon icon={RefreshIcon} strokeWidth={2.2} />
              Reintentar
            </Button>
          ) : null}
        </div>
      </div>
    </section>
  );
}

/** Live empresa account without a saved business yet. */
export function RegisterBusinessPrompt({ className }: { className?: string }) {
  return (
    <section
      aria-labelledby="registra-negocio"
      className={cn("block-sol relative isolate overflow-hidden rounded-panel p-6 sm:p-8", OUTLINE, HARD, className)}
    >
      <span aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-dots opacity-50" />
      <div className="grid items-center gap-6 sm:grid-cols-[1fr_auto]">
        <div className="min-w-0">
          <Eyebrow>Un paso más</Eyebrow>
          <h2 id="registra-negocio" className="mt-1.5 font-display text-[1.9rem] leading-[1.02] font-extrabold tracking-[-0.04em]">
            Registra tu negocio
          </h2>
          <p className="mt-2 max-w-md text-[1.02rem] leading-snug text-muted-foreground">
            Dinos cómo se llama y dónde está tu sucursal. Después publicas vacantes gratis y te llegan postulaciones de gente
            que vive cerca.
          </p>
          <Button asChild size="xl" className={cn("mt-5", INK_BUTTON, HARD_SM)}>
            <Link href="/bienvenida/empresa">
              <HugeiconsIcon icon={Store01Icon} className="size-5" strokeWidth={2.2} />
              Registrar mi negocio
              <HugeiconsIcon icon={ArrowRight01Icon} className="size-5" strokeWidth={2.2} />
            </Link>
          </Button>
        </div>
        <Scene name="negocio" className="mx-auto w-52 sm:w-60" />
      </div>
    </section>
  );
}

/** Live: the store still has the business, but my membership is gone (the dueño removed me). */
export function RemovedFromTeam({ companyName, className }: { companyName: string; className?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <section
      aria-labelledby="fuera-del-equipo"
      className={cn("block-cielo relative isolate overflow-hidden rounded-panel p-6 sm:p-8", OUTLINE, HARD, className)}
    >
      <span aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-dots opacity-50" />
      <div className="grid items-center gap-6 sm:grid-cols-[1fr_auto]">
        <div className="min-w-0">
          <Eyebrow>Tu equipo</Eyebrow>
          <h2 id="fuera-del-equipo" className="mt-1.5 font-display text-[1.9rem] leading-[1.02] font-extrabold tracking-[-0.04em]">
            Ya no formas parte del equipo de {companyName}
          </h2>
          <p className="mt-2 max-w-md text-[1.02rem] leading-snug text-muted-foreground">
            Ya no puedes ver sus vacantes ni sus postulantes. Si fue un error, pide al dueño que te vuelva a invitar.
          </p>
          <Button
            size="xl"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await loadSession();
              setBusy(false);
              router.replace("/empresa");
            }}
            className={cn("mt-5", INK_BUTTON, HARD_SM)}
          >
            {busy ? "Un momento…" : "Entendido"}
          </Button>
        </div>
        <Scene name="equipo" className="mx-auto w-52 sm:w-60" />
      </div>
    </section>
  );
}

/** A branch-limited reclutador whose branches were all deleted: there's nothing for them to see. */
export function NoBranchesPrompt({ className }: { className?: string }) {
  return (
    <section
      aria-labelledby="sin-sucursal"
      className={cn("block-lila relative isolate overflow-hidden rounded-panel p-6 sm:p-8", OUTLINE, HARD, className)}
    >
      <span aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-dots opacity-50" />
      <div className="grid items-center gap-6 sm:grid-cols-[1fr_auto]">
        <div className="min-w-0">
          <Eyebrow>Sin sucursal</Eyebrow>
          <h2 id="sin-sucursal" className="mt-1.5 font-display text-[1.9rem] leading-[1.02] font-extrabold tracking-[-0.04em]">
            Pide al dueño que te asigne una sucursal
          </h2>
          <p className="mt-2 max-w-md text-[1.02rem] leading-snug text-muted-foreground">
            Ves las vacantes y postulantes de tus sucursales, y ahora no tienes ninguna asignada.
          </p>
          <Button asChild size="xl" className={cn("mt-5", INK_BUTTON, HARD_SM)}>
            <Link href="/empresa/equipo">
              Ver mi equipo
              <HugeiconsIcon icon={ArrowRight01Icon} className="size-5" strokeWidth={2.2} />
            </Link>
          </Button>
        </div>
        <Scene name="equipo" className="mx-auto w-52 sm:w-60" />
      </div>
    </section>
  );
}

/**
 * Renders children only when the employer's company and my place in it are ready. Loading → skeleton,
 * error → retry, live account without a business → "Registra tu negocio", removed from the team →
 * "Ya no formas parte…", a reclutador with no branch → "Pide al dueño…" (unless `allowEmptyScope`,
 * for screens that still make sense then, like Tu equipo).
 */
export function EmployerGate({
  shape,
  allowEmptyScope,
  children,
}: {
  shape?: SkeletonShape;
  allowEmptyScope?: boolean;
  children: (my: MyCompany & { company: NonNullable<MyCompany["company"]> }) => React.ReactNode;
}) {
  const my = useMyCompany();
  const team = useMyMembership();
  const live = useIsLive();
  if (my.status === "loading" || team.status === "loading") return <EmployerSkeleton shape={shape} />;
  if (my.status === "error" && !my.company) return <EmployerError message={my.error} onRetry={() => void my.reload()} />;
  if (!my.company) return <RegisterBusinessPrompt />;
  if (live && team.status === "error") return <EmployerError message={team.error} onRetry={team.reload} />;
  if (live && team.teamsEnabled && !team.membership) return <RemovedFromTeam companyName={my.company.name} />;
  if (my.status === "error") return <EmployerError message={my.error} onRetry={() => void my.reload()} />;
  if (!allowEmptyScope && team.branchIds?.length === 0 && team.role === "reclutador") return <NoBranchesPrompt />;
  return <>{children({ ...my, company: my.company })}</>;
}

"use client";

/*
 * Where "Instalar" shows up:
 *  - InstallBar: a sticky bar at the bottom of both landings, on phones (the front-and-center one).
 *  - InstallCard: a card at the top of the job-seeker home and the company panel.
 *  - InstallButton: a plain button (the landing's closing section).
 *  - StandaloneLanding: the installed app opened on a landing (iPhone may keep the page it was added
 *    from) goes to the app instead.
 * All hide inside the installed app; the bar and the card can be put away for a few days.
 */
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { Cancel01Icon, Download04Icon, QrCodeIcon, SmartPhone01Icon } from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";
import { IN_APP_NAME, canEscape } from "@/lib/install/platform";
import { hideFor, isStandalone, rememberSide, useHidden, useInstallState, type InstallState, type Side } from "@/lib/install/client";
import { useInstallAction } from "./install-sheet";

/** What the button and the line under the title say, for this device. */
function pitch(state: InstallState): { label: string; line: string } | null {
  switch (state.kind) {
    case "prompt":
      return { label: "Instalar", line: "Gratis · 2 toques · sin Play Store" };
    case "android":
      return { label: "Instalar", line: "Gratis · sin Play Store · casi no ocupa espacio" };
    case "ios":
      return { label: "Instalar", line: "Gratis · queda en tu inicio en un minuto" };
    case "inapp":
      // Apps that block every hand-off (TikTok, X…): the button only shows how.
      return {
        label: canEscape(state.platform) ? "Abrir" : "Ver cómo",
        line: `Estás en ${IN_APP_NAME[state.platform.inApp ?? "webview"]}: ábrela en tu navegador`,
      };
    default:
      return null;
  }
}

export function InstallBar({ side }: { side: Side }) {
  const state = useInstallState();
  const hidden = useHidden("bar");
  const install = useInstallAction(side);
  // Visiting this landing = this side: the installed app opens on it (/app).
  useEffect(() => rememberSide(side), [side]);
  const p = pitch(state);
  if (hidden || !p) return null;
  return (
    <>
      {/* Room at the end of the page, so the bar never covers the footer. */}
      <div aria-hidden className="h-24 lg:hidden" />
      <aside
        aria-label="Instalar Chambarrio"
        className="fixed inset-x-0 bottom-0 z-40 animate-rise px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] [--rise:110%] lg:hidden"
      >
        <div className="relative mx-auto flex max-w-md items-center gap-2.5 rounded-[1.4rem] border-[2.5px] border-ink bg-limon py-2 pr-2 pl-2.5 text-ink shadow-[4px_4px_0_0_var(--ink)] dark:border-black/70 dark:shadow-[4px_4px_0_0_rgb(0_0_0/0.6)]">
          {/* eslint-disable-next-line @next/next/no-img-element -- the app icon as it'll look on the phone */}
          <img src="/icons/icon-192.png" alt="" width={44} height={44} className="size-11 shrink-0 rounded-xl border-2 border-ink" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-[1.02rem] leading-tight font-extrabold tracking-[-0.01em]">Instala Chambarrio</p>
            <p className="line-clamp-2 text-[0.8rem] leading-snug font-medium text-ink/75">{p.line}</p>
          </div>
          <button
            type="button"
            onClick={install}
            className="press inline-flex h-11 shrink-0 items-center rounded-full bg-ink px-4.5 font-display text-[0.98rem] font-extrabold text-limon outline-none focus-visible:ring-3 focus-visible:ring-ink/40"
          >
            {p.label}
          </button>
          {/* A small badge on the corner, so the copy keeps its room on a 360 px phone. */}
          <button
            type="button"
            aria-label="Ahora no"
            onClick={() => hideFor("bar", 3)}
            className="absolute -top-3 -right-2 grid size-8 place-items-center rounded-full border-2 border-ink bg-white text-ink outline-none hover:bg-block-sol focus-visible:ring-3 focus-visible:ring-ink/40"
          >
            <HugeiconsIcon icon={Cancel01Icon} className="size-4" strokeWidth={2.6} />
          </button>
        </div>
      </aside>
    </>
  );
}

/** In the app (home / panel): install on this phone; on a computer, a QR code to open it on the phone. */
export function InstallCard({ side, className }: { side: Side; className?: string }) {
  const state = useInstallState();
  const hidden = useHidden("card");
  const install = useInstallAction(side);
  if (hidden || state.kind === "unknown" || state.kind === "installed") return null;
  const desktop = state.kind === "desktop";
  const inapp = state.kind === "inapp";
  const title = desktop ? "Lleva Chambarrio en tu teléfono" : "Ten Chambarrio a un toque";
  const label = desktop ? "Ver el código" : inapp ? (canEscape(state.platform) ? "Abrir en mi navegador" : "Ver cómo abrirla") : "Instalar";
  const body = desktop
    ? "Escanea un código con tu celular y queda como app en tu pantalla de inicio."
    : inapp
      ? `Estás dentro de ${IN_APP_NAME[state.platform.inApp ?? "webview"]}. Ábrela en tu navegador para instalarla.`
      : side === "empresa"
        ? "Instálala y abre tu panel desde la pantalla de inicio, sin buscar el enlace."
        : "Instálala y abre tus vacantes desde la pantalla de inicio, sin buscar el enlace.";
  return (
    <section
      aria-label="Instalar Chambarrio"
      className={cn(
        "relative mb-6 flex items-center gap-3.5 rounded-[1.5rem] border-[2.5px] border-ink bg-limon p-4 text-ink shadow-[4px_4px_0_0_var(--ink)] sm:gap-4 sm:p-5 dark:border-black/70 dark:shadow-[4px_4px_0_0_rgb(0_0_0/0.6)]",
        className,
      )}
    >
      <span className="grid size-12 shrink-0 -rotate-6 place-items-center rounded-[0.9rem] border-2 border-ink bg-white text-ink">
        <HugeiconsIcon icon={desktop ? QrCodeIcon : SmartPhone01Icon} className="size-6" strokeWidth={2} />
      </span>
      <div className="min-w-0 flex-1 pr-6 sm:pr-0">
        <p className="font-display text-[1.12rem] leading-tight font-extrabold tracking-[-0.02em] text-balance">{title}</p>
        <p className="mt-0.5 text-[0.92rem] leading-snug font-medium text-ink/75">{body}</p>
        <button
          type="button"
          onClick={install}
          className="press mt-3 inline-flex h-11 items-center gap-1.5 rounded-full bg-ink px-4 font-display text-[0.98rem] font-extrabold text-limon outline-none focus-visible:ring-3 focus-visible:ring-ink/40 sm:hidden"
        >
          <HugeiconsIcon icon={Download04Icon} className="size-4.5" strokeWidth={2.4} />
          {label}
        </button>
      </div>
      <button
        type="button"
        onClick={install}
        className="press hidden h-12 shrink-0 items-center gap-1.5 rounded-full bg-ink px-5 font-display text-[1rem] font-extrabold text-limon outline-none focus-visible:ring-3 focus-visible:ring-ink/40 sm:inline-flex"
      >
        <HugeiconsIcon icon={desktop ? QrCodeIcon : Download04Icon} className="size-5" strokeWidth={2.4} />
        {label}
      </button>
      <button
        type="button"
        aria-label="Ahora no"
        onClick={() => hideFor("card", 14)}
        className="absolute top-2.5 right-2.5 grid size-9 place-items-center rounded-full text-ink/60 outline-none hover:bg-ink/10 hover:text-ink focus-visible:ring-3 focus-visible:ring-ink/40 sm:static sm:-mr-1"
      >
        <HugeiconsIcon icon={Cancel01Icon} className="size-4.5" strokeWidth={2.4} />
      </button>
    </section>
  );
}

/** A plain "Instalar en mi teléfono" button; hidden once installed. */
export function InstallButton({ side, className, children }: { side: Side; className?: string; children?: React.ReactNode }) {
  const state = useInstallState();
  const install = useInstallAction(side);
  if (state.kind === "installed") return null;
  return (
    <button type="button" onClick={install} className={className}>
      {children ?? (
        <>
          <HugeiconsIcon icon={Download04Icon} className="size-5 transition-transform group-hover:translate-y-0.5" strokeWidth={2.2} />
          Instalar en mi teléfono
        </>
      )}
    </button>
  );
}

/**
 * The installed app opened on a landing or /instalar (iPhone can keep the page it was added from as
 * its start page): go to the app instead, once per launch, so "Salir" back to the landing still works.
 */
export function StandaloneLanding() {
  const router = useRouter();
  useEffect(() => {
    if (!isStandalone()) return;
    try {
      if (window.sessionStorage.getItem("chamba-app-abierta")) return;
      window.sessionStorage.setItem("chamba-app-abierta", "1");
    } catch {
      return;
    }
    router.replace("/app");
  }, [router]);
  return null;
}

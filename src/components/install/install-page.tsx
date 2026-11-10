"use client";

/*
 * /instalar: the shareable "how to install" page (QR codes, posters, WhatsApp, and where a phone lands
 * after leaving Facebook's or Instagram's browser). On a phone: the steps for that phone, or Chrome's
 * one-tap install. On a computer: a QR code to open it on the phone, plus both phones' steps.
 * ?lado=empresa: from the company side (the app then opens on the panel). ?desde=app: just left an
 * in-app browser.
 */
import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { CheckmarkCircle02Icon, WhatsappIcon } from "@hugeicons/core-free-icons";
import { ChambarrioLogo } from "@/components/brand/chambarrio-logo";
import { ThemeToggle } from "@/components/theme";
import { HARD, HARD_SM, HazardStripe, Tape, chunky } from "@/components/landing/decor";
import { cn } from "@/lib/utils";
import { rememberSide, useInstallState, type InstallState, type Side } from "@/lib/install/client";
import { AndroidGuide, InstallGuide, IosGuide } from "./install-guide";
import { StandaloneLanding } from "./install-promos";
import { OtherPhoneToggle } from "./install-sheet";

function subscribeNothing() {
  return () => {};
}
function useParam(name: string): string | null {
  return useSyncExternalStore(subscribeNothing, () => new URLSearchParams(window.location.search).get(name), () => null);
}

const PERKS = ["Gratis", "Sin tienda de apps", "Casi no ocupa espacio"];

export function InstallPageView({ qr, urls }: { qr: Record<Side, React.ReactNode>; urls: Record<Side, string> }) {
  const state = useInstallState();
  const side: Side = useParam("lado") === "empresa" ? "empresa" : "candidato";
  const escaped = useParam("desde") === "app";
  // A hand-off from an in-app browser came back here (Android intent fallback): no more "Abrir" button.
  const failed = useParam("iab") === "fallo";
  useEffect(() => {
    if (side === "empresa") rememberSide("empresa");
  }, [side]);

  return (
    <div className="min-h-dvh overflow-x-clip [--hard:var(--ink)] dark:[--hard:#2c2464]">
      <StandaloneLanding />
      <header className="mx-auto flex max-w-3xl items-center gap-3 px-4 pt-[max(1.25rem,env(safe-area-inset-top))] pb-4 sm:px-6">
        <Link
          href={side === "empresa" ? "/empresas" : "/"}
          aria-label="Chambarrio, inicio"
          className="group rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <ChambarrioLogo iconClassName="size-9 shrink-0 group-hover:animate-wiggle" />
        </Link>
        <ThemeToggle className="ml-auto size-11" />
      </header>

      <main className="mx-auto max-w-3xl px-4 pt-2 pb-20 sm:px-6">
        <section className={cn("relative isolate overflow-hidden rounded-panel block-limon", HARD)}>
          <HazardStripe className="h-3.5" />
          <span aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-dots opacity-50" />
          <div className="px-5 pt-6 pb-7 sm:px-9 sm:pt-8 sm:pb-9">
            <Tape className="-rotate-2">{side === "empresa" ? "Tu panel de empresa" : "Vacantes cerca de tu casa"}</Tape>
            <h1 className="mt-5 font-display text-[2.4rem] leading-[0.98] font-extrabold tracking-[-0.045em] text-balance sm:text-[3.3rem]">
              Chambarrio en tu teléfono
            </h1>
            <p className="mt-4 max-w-[36rem] text-[1.06rem] leading-relaxed font-medium sm:text-lg">
              Se abre como cualquier app, desde tu pantalla de inicio. Sin buscar el enlace cada vez.
            </p>
            <ul className="mt-5 flex flex-wrap gap-2">
              {PERKS.map((t) => (
                <li key={t} className="inline-flex items-center gap-1.5 rounded-full bg-ink px-3 py-1.5 text-[0.9rem] font-bold text-limon">
                  <HugeiconsIcon icon={CheckmarkCircle02Icon} className="size-4" strokeWidth={2.4} />
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <div className="mt-8">
          {state.kind === "desktop" ? (
            <DesktopView qr={qr[side]} url={urls[side]} side={side} />
          ) : (
            <PhoneView state={state} side={side} escaped={escaped} failed={failed} />
          )}
        </div>
      </main>
    </div>
  );
}

function PhoneView({ state, side, escaped, failed }: { state: InstallState; side: Side; escaped: boolean; failed: boolean }) {
  const [other, setOther] = useState(false);
  const os = state.kind === "ios" || state.kind === "android" || state.kind === "inapp" ? state.platform.os : null;
  const otherOs = os === "ios" ? "android" : "ios";
  if (state.kind === "unknown") return <div className="min-h-[24rem]" />;
  if (state.kind === "installed") {
    return (
      <section className={cn("rounded-panel bg-card p-6 sm:p-8", HARD_SM)}>
        <h2 className="font-display text-[1.5rem] leading-tight font-extrabold tracking-[-0.02em]">Ya la tienes instalada</h2>
        <p className="mt-2 text-[1rem] font-medium text-muted-foreground">Ábrela desde el ícono de Chambarrio en tu pantalla de inicio.</p>
        <Link href="/app" className={cn(chunky("ink"), "mt-5")}>
          Abrir Chambarrio
        </Link>
      </section>
    );
  }
  return (
    <section aria-labelledby="pasos" className={cn("rounded-panel bg-card p-5 sm:p-8", HARD_SM)}>
      {escaped && state.kind !== "inapp" ? (
        <p className="mb-4 rounded-2xl bg-block-menta px-4 py-3 text-[0.98rem] font-bold text-ink">¡Ya estás en tu navegador! Ahora sí:</p>
      ) : null}
      <h2 id="pasos" className="font-display text-[1.5rem] leading-tight font-extrabold tracking-[-0.02em]">
        {other
          ? otherOs === "ios"
            ? "Así se agrega en iPhone"
            : "Así se instala en Android"
          : state.kind === "prompt"
            ? "Instálala en dos toques"
            : state.kind === "inapp"
              ? "Primero, ábrela en tu navegador"
              : state.kind === "ios"
                ? "Así la agregas a tu iPhone"
                : "Así la instalas"}
      </h2>
      <div className="mt-5">
        {other ? (
          otherOs === "ios" ? (
            <IosGuide steps="safari27" anyVersion side={side} />
          ) : (
            <AndroidGuide browser="chrome" side={side} />
          )
        ) : (
          <InstallGuide state={state} side={side} failed={failed} />
        )}
      </div>
      {os ? <OtherPhoneToggle other={other} otherOs={otherOs} onToggle={() => setOther((v) => !v)} className="mt-5" /> : null}
    </section>
  );
}

function DesktopView({ qr, url, side }: { qr: React.ReactNode; url: string; side: Side }) {
  const [tab, setTab] = useState<"android" | "ios">("android");
  const link = url.replace(/^https?:\/\//, "");
  const wa = `https://wa.me/?text=${encodeURIComponent(`Instala Chambarrio en tu teléfono: ${url}`)}`;
  // One column (no side-by-side cards to keep level): the code, then the steps for the phone.
  return (
    <div className="space-y-6">
      <section aria-labelledby="qr-t" className={cn("flex flex-col items-center gap-6 rounded-panel bg-card p-6 sm:flex-row sm:p-8", HARD_SM)}>
        <div className="w-full max-w-[14rem] shrink-0 rounded-2xl border-[2.5px] border-ink bg-white p-2">{qr}</div>
        <div className="min-w-0">
          <h2 id="qr-t" className="font-display text-[1.6rem] leading-tight font-extrabold tracking-[-0.02em]">
            Escanéalo con tu teléfono
          </h2>
          <p className="mt-2 text-[1rem] leading-relaxed font-medium text-muted-foreground">
            Abre la cámara y apunta al código: se abre esta página en tu teléfono, con los pasos para tenerla como app.
          </p>
          <a href={wa} target="_blank" rel="noopener noreferrer" className={cn(chunky("lime", "md"), "mt-5")}>
            <HugeiconsIcon icon={WhatsappIcon} className="size-5" strokeWidth={2} />
            Mándamelo por WhatsApp
          </a>
          <p className="mt-3 text-[0.92rem] font-medium text-muted-foreground">
            O escribe <strong className="font-bold break-all text-foreground">{link}</strong> en tu teléfono.
          </p>
        </div>
      </section>
      <section aria-labelledby="pasos-t" className={cn("rounded-panel bg-card p-6 sm:p-8", HARD_SM)}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="pasos-t" className="font-display text-[1.4rem] leading-tight font-extrabold tracking-[-0.02em]">
            Luego, en tu teléfono
          </h2>
          <div role="group" aria-label="Tu teléfono" className="inline-flex rounded-full border-[2.5px] border-ink bg-white p-1">
            {(
              [
                ["android", "Android"],
                ["ios", "iPhone"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                aria-pressed={tab === id}
                onClick={() => setTab(id)}
                className={cn(
                  "h-9 rounded-full px-4 font-display text-[0.95rem] font-extrabold text-ink outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  tab === id ? "bg-ink text-limon" : "hover:bg-ink/10",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-5">{tab === "ios" ? <IosGuide steps="safari27" anyVersion side={side} /> : <AndroidGuide browser="chrome" side={side} />}</div>
        <p className="mt-4 text-[0.92rem] font-medium text-muted-foreground">
          {tab === "android"
            ? "Si abres la página en Chrome, casi siempre aparece un botón «Instalar»: es todavía más rápido."
            : "Usa Safari. Si abriste el enlace dentro de Facebook o Instagram, primero ábrelo en Safari."}
        </p>
      </section>
    </div>
  );
}

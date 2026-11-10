"use client";

/*
 * The install sheet (one, mounted in Providers) and useInstallAction(), what every "Instalar" button
 * runs:
 *  - Chrome on Android with its prompt ready → Chrome's own dialog right away (two taps in all).
 *  - inside Facebook / Instagram / … → straight to the real browser (it lands on /instalar), with the
 *    sheet's manual steps in case that doesn't happen.
 *  - iPhone, or Android without the prompt → the sheet with this phone's steps.
 *  - a computer → /instalar (QR code to open it on the phone).
 */
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import { Cancel01Icon } from "@hugeicons/core-free-icons";
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { useConfetti } from "@/components/chamba/motion";
import { cn } from "@/lib/utils";
import {
  closeInstallSheet,
  installPageUrl,
  isStandalone,
  openInstallSheet,
  promptInstall,
  readPlatform,
  rememberSide,
  tryEscape,
  useInstallSheet,
  useInstallState,
  type InstallState,
  type Side,
} from "@/lib/install/client";
import { AndroidGuide, InstallGuide, IosGuide } from "./install-guide";

/**
 * What every "Instalar" button runs. `returnFocus`: where focus goes when the sheet closes, when the
 * button that opened it won't be there (an account-menu item).
 */
export function useInstallAction(side: Side) {
  const router = useRouter();
  const fire = useConfetti();
  return useCallback(
    (e?: React.MouseEvent<HTMLElement> | null, returnFocus: HTMLElement | null = null) => {
      // Where to burst from, read now: the button may be gone once it's installed.
      const r = e?.currentTarget?.getBoundingClientRect();
      rememberSide(side);
      if (isStandalone()) return;
      const p = readPlatform();
      if (p.os === "desktop") {
        const url = installPageUrl(side);
        router.push(url.pathname + url.search);
        return;
      }
      if (!p.inApp && p.os !== "ios" && window.__chambaBIP) {
        // Synchronously, inside the tap: Chrome's prompt() needs the gesture.
        void promptInstall().then((res) => {
          if (res === "accepted") {
            fire(r ? { x: r.left + r.width / 2, y: r.top + r.height / 2, count: 48 } : { count: 48 });
            toast.success("¡Listo! Busca Chambarrio en tu pantalla de inicio.");
          } else if (res === "unavailable") openInstallSheet(side, returnFocus);
        });
        return;
      }
      // In-app browser: try the hand-off right away; the sheet's manual steps cover it not working.
      if (p.inApp) tryEscape(p, side);
      openInstallSheet(side, returnFocus);
    },
    [side, router, fire],
  );
}

const TITLE: Record<InstallState["kind"], string> = {
  unknown: "Instala Chambarrio",
  installed: "Ya la tienes",
  prompt: "Instala Chambarrio",
  inapp: "Primero, ábrela en tu navegador",
  ios: "Así la agregas a tu iPhone",
  android: "Así la instalas",
  desktop: "Instala Chambarrio",
};

/** The "¿Tienes iPhone / Android?" switch, here and on /instalar. */
export function OtherPhoneToggle({ other, otherOs, onToggle, className }: { other: boolean; otherOs: "ios" | "android"; onToggle: () => void; className?: string }) {
  return (
    <button
      type="button"
      aria-pressed={other}
      onClick={onToggle}
      className={cn(
        "inline-flex min-h-11 items-center self-start rounded text-[0.95rem] font-bold underline decoration-2 underline-offset-4 outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        className,
      )}
    >
      {other ? "Volver a mis pasos" : otherOs === "ios" ? "¿Tienes iPhone? Ver sus pasos" : "¿Tienes Android? Ver sus pasos"}
    </button>
  );
}

export function InstallSheetHost() {
  const open = useInstallSheet((s) => s.open);
  const side = useInstallSheet((s) => s.side);
  const returnFocus = useInstallSheet((s) => s.returnFocus);
  const state = useInstallState();
  // "¿Otro teléfono?": the other platform's steps (detection can be wrong, or it's for someone else).
  const [other, setOther] = useState(false);
  const os = state.kind === "ios" || state.kind === "android" || state.kind === "inapp" ? state.platform.os : null;
  const otherOs = os === "ios" ? "android" : "ios";

  // Mounted on every page: inside the installed app, mark this launch as started, so a later visit to a
  // landing (sign-out, "Salir de la demo") stays there instead of bouncing to /app (StandaloneLanding).
  useEffect(() => {
    if (!isStandalone()) return;
    try {
      window.sessionStorage.setItem("chamba-app-abierta", "1");
    } catch {
      /* private mode */
    }
  }, []);

  return (
    <Drawer
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          closeInstallSheet();
          setOther(false);
        }
      }}
    >
      <DrawerContent
        onCloseAutoFocus={(e) => {
          if (returnFocus?.isConnected) {
            e.preventDefault();
            returnFocus.focus();
          }
        }}
        className={cn(
          "block-limon bg-block-limon! overflow-hidden p-0 text-foreground! before:hidden",
          "border-[2.5px] border-[color:var(--ink)] dark:border-black/70",
          "*:first:mt-3 *:first:bg-[color:var(--ink)]/25",
          "max-h-[90dvh]! rounded-t-[2rem] border-b-0 sm:mx-auto sm:max-w-lg",
        )}
      >
        <DrawerClose asChild>
          <Button
            variant="white"
            size="icon-lg"
            aria-label="Cerrar"
            className="absolute top-[1.625rem] right-4 z-10 border-2 border-[color:var(--ink)] bg-white text-ink shadow-[0_3px_0_var(--ink)]"
          >
            <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2.2} />
          </Button>
        </DrawerClose>
        <div className="relative flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <DrawerHeader className="flex-row items-center gap-3 p-0 pr-16 text-left!">
            {/* eslint-disable-next-line @next/next/no-img-element -- the app icon as it'll look on the phone */}
            <img src="/icons/icon-192.png" alt="" width={48} height={48} className="size-12 shrink-0 rounded-[0.9rem] border-2 border-ink" />
            <span className="min-w-0">
              <DrawerTitle className="font-display text-[1.35rem] leading-tight font-extrabold tracking-[-0.02em] text-ink">
                {other ? (otherOs === "ios" ? "Así se agrega en iPhone" : "Así se instala en Android") : TITLE[state.kind]}
              </DrawerTitle>
              <DrawerDescription className={cn("mt-0.5 text-[0.9rem] leading-snug font-medium text-ink/70", state.kind === "installed" && "sr-only")}>
                Gratis y sin tienda de apps. Se abre como app, desde tu pantalla de inicio.
              </DrawerDescription>
            </span>
          </DrawerHeader>
          <div className="mt-5">
            {other ? (
              otherOs === "ios" ? (
                <IosGuide steps="safari27" anyVersion side={side} />
              ) : (
                <AndroidGuide browser="chrome" side={side} />
              )
            ) : (
              <InstallGuide state={state} side={side} />
            )}
          </div>
          {os ? <OtherPhoneToggle other={other} otherOs={otherOs} onToggle={() => setOther((v) => !v)} className="mt-4 text-ink" /> : null}
        </div>
      </DrawerContent>
    </Drawer>
  );
}

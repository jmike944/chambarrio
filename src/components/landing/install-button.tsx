"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import { Download04Icon } from "@hugeicons/core-free-icons";
import { useConfetti } from "@/components/chamba/motion";
import { cn } from "@/lib/utils";
import { chunky } from "./decor";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

const STANDALONE = "(display-mode: standalone)";
function subscribeDisplay(cb: () => void) {
  const mq = matchMedia(STANDALONE);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

/** Uses the browser's install prompt when available; otherwise explains how to add to home screen. */
export function InstallButton({ className }: { className?: string }) {
  const [evt, setEvt] = useState<InstallEvent | null>(null);
  const standalone = useSyncExternalStore(subscribeDisplay, () => matchMedia(STANDALONE).matches, () => false);
  const [justInstalled, setInstalled] = useState(false);
  const installed = standalone || justInstalled;
  const fire = useConfetti();

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvt(e as InstallEvent);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) return null;

  async function install(e: React.MouseEvent<HTMLButtonElement>) {
    const origin = e.currentTarget;
    if (evt) {
      await evt.prompt();
      const { outcome } = await evt.userChoice;
      if (outcome === "accepted") {
        fire({ origin, count: 48 });
        toast.success("¡Ya quedó! Busca Chamb-a lado en tu pantalla de inicio.");
      }
      setEvt(null);
      return;
    }
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
    toast.info(
      ios
        ? "En Safari toca Compartir y luego “Agregar a inicio”."
        : "Abre el menú de tu navegador y toca “Instalar app” o “Agregar a pantalla de inicio”.",
    );
  }

  return (
    <button type="button" onClick={install} className={cn(chunky("white"), "group", className)}>
      <HugeiconsIcon icon={Download04Icon} className="size-5 transition-transform group-hover:translate-y-0.5" strokeWidth={2.2} />
      Instalar en mi teléfono
    </button>
  );
}

"use client";

import { useEffect } from "react";
import { useOffline } from "next/offline";
import { MotionConfig } from "motion/react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { useStoreHydration } from "@/lib/store";
import { LiveSession } from "@/lib/live/session";
import { InstallSheetHost } from "@/components/install/install-sheet";
// Side effect: a new demo (or account) starts with a clean demo pipeline on every page.
import "@/lib/pipeline/demo-reset";

function OfflineBanner() {
  const offline = useOffline();
  if (!offline) return null;
  return (
    <div
      role="status"
      className="fixed inset-x-0 top-0 z-50 animate-rise bg-limon px-4 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] text-center text-sm font-medium text-ink [--rise:-100%]"
    >
      Sin conexión. Puedes seguir viendo las vacantes guardadas; lo demás se actualiza al volver la señal.
    </div>
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  useStoreHydration();
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {});
    }
  }, []);
  return (
    // reducedMotion="user": motion components drop transform/layout animations (keep opacity)
    // when the OS asks for reduced motion. CSS animations are handled in globals.css.
    <MotionConfig reducedMotion="user">
      <TooltipProvider>
        <OfflineBanner />
        <LiveSession />
        {children}
        <InstallSheetHost />
        <Toaster position="top-center" />
      </TooltipProvider>
    </MotionConfig>
  );
}

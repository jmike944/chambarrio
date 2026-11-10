"use client";

/*
 * /app: where the installed app starts (manifest start_url). Sends each person to their side:
 * signed in → their home (or onboarding if unfinished); signed out → sign-in for the side they came
 * from (the "chamba-lado" cookie, which iOS copies into the Home Screen app), job seekers by default.
 *
 * It must never hold the app: a saved, finished account (or the demo) goes at once, from what's saved
 * on the phone; offline too. Only without one does it wait (a session iOS copied in from Safari, or a
 * profile still loading), and never longer than WAIT_MS in all. The page's own guards fix anything stale.
 */
import { useEffect, useRef } from "react";
import { ChambarrioLogo } from "@/components/brand/chambarrio-logo";
import { useApp, useHydrated } from "@/lib/store";
import { useSessionLoaded, useSessionReady } from "@/lib/live/session";
import { readSide } from "@/lib/install/client";

const WAIT_MS = 3000;

function destination(): string {
  const s = useApp.getState();
  const empresa = s.role === "empresa";
  if (!s.signedIn) return readSide() === "empresa" ? "/entrar/empresa" : "/entrar";
  if (s.mode === "live" && !s.onboarded) return empresa ? "/bienvenida/empresa" : "/bienvenida";
  return empresa ? "/empresa" : "/inicio";
}

export function AppLauncher() {
  const hydrated = useHydrated();
  const ready = useSessionReady();
  const loaded = useSessionLoaded();
  const done = useRef(false);
  const startedAt = useRef<number | null>(null);

  useEffect(() => {
    try {
      window.sessionStorage.setItem("chamba-app-abierta", "1");
    } catch {
      /* private mode */
    }
  }, []);

  useEffect(() => {
    if (!hydrated || done.current) return;
    const go = () => {
      if (done.current) return;
      done.current = true;
      // A full load, not a client-side route: offline, the service worker serves the cached page.
      window.location.replace(destination());
    };
    const s = useApp.getState();
    if ((s.signedIn && (s.mode === "demo" || s.onboarded)) || !navigator.onLine) {
      go();
      return;
    }
    if (ready && !(s.signedIn && s.mode === "live" && !loaded)) {
      go();
      return;
    }
    startedAt.current ??= Date.now();
    const t = window.setTimeout(go, Math.max(0, startedAt.current + WAIT_MS - Date.now()));
    return () => window.clearTimeout(t);
  }, [hydrated, ready, loaded]);

  return (
    <main className="grid min-h-dvh place-items-center px-6">
      <div className="flex flex-col items-center gap-4">
        <ChambarrioLogo iconClassName="size-12 shrink-0 animate-wiggle" />
        <p role="status" className="text-[0.98rem] font-semibold text-muted-foreground">
          Abriendo Chambarrio…
        </p>
      </div>
    </main>
  );
}

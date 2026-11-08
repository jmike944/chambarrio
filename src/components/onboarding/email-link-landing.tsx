"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ChambarrioPulse } from "@/components/brand/chambarrio-logo";
import { useSessionLoaded } from "@/lib/live/session";
import { useApp, useHydrated } from "@/lib/store";
import { isInvitePath, readNextParam } from "./next-path";

/** How long to wait for Supabase to report the session before offering a way out. */
const GIVE_UP_MS = 12_000;

/** "Ir a Entrar" keeps a team invite, so signing in with a code still lands on it (client only). */
function entrarHref(): string {
  const next = readNextParam();
  return isInvitePath(next) ? `/entrar?next=${encodeURIComponent(next)}` : "/entrar";
}

/**
 * Landing after a sign-in link from the email. The server already exchanged the token for a session
 * cookie, but this browser may still have the DEMO saved — and the app deliberately ignores auth while
 * in the demo. A sign-in link is an explicit "use my real account", so leave the demo first; the live
 * session sync then picks up the cookie, loads the profile, and we route: unfinished onboarding → its
 * flow, otherwise home (or a safe ?next=).
 */
export function EmailLinkLanding() {
  const router = useRouter();
  const hydrated = useHydrated();
  const mode = useApp((s) => s.mode);
  const live = useApp((s) => s.mode === "live" && s.signedIn);
  const loaded = useSessionLoaded();
  const [stuck, setStuck] = useState(false);

  // 1. Leave the demo (wipes its sample data) so the real session can take over.
  useEffect(() => {
    if (hydrated && mode === "demo") useApp.getState().exitDemo();
  }, [hydrated, mode]);

  // 2. Once the real profile is loaded, go where this person belongs.
  useEffect(() => {
    if (!live || !loaded) return;
    const s = useApp.getState();
    const empresa = s.role === "empresa";
    // Same-site ?next= (already validated by /auth/confirm, re-checked here).
    const next = readNextParam();
    // A team invite (/unirse?t=…): back to it, onboarded or not (joining replaces business onboarding).
    if (isInvitePath(next)) {
      router.replace(next);
      return;
    }
    if (!s.onboarded) {
      router.replace(empresa ? "/bienvenida/empresa" : "/bienvenida");
      return;
    }
    router.replace(next ?? (empresa ? "/empresa" : "/inicio"));
  }, [live, loaded, router]);

  // 3. No session showed up (link opened elsewhere, cookies blocked…): offer a way forward.
  useEffect(() => {
    const t = setTimeout(() => setStuck(true), GIVE_UP_MS);
    return () => clearTimeout(t);
  }, []);

  return (
    <main className="block-uva grid min-h-dvh place-items-center px-6 text-center">
      <div className="max-w-sm">
        <ChambarrioPulse className="mx-auto size-28" />
        <h1 className="mt-6 font-display text-[2rem] leading-tight font-extrabold tracking-[-0.03em]" aria-live="polite">
          {stuck ? "No pudimos abrir tu sesión aquí" : "Entrando a tu cuenta…"}
        </h1>
        <p className="mt-3 text-[1.05rem] text-muted-foreground">
          {stuck
            ? "Pide un código nuevo desde esta misma app o navegador y escríbelo para entrar."
            : "Un momento, estamos cargando tus vacantes cerca."}
        </p>
        {stuck ? (
          <Link
            href={entrarHref()}
            className="press mt-8 inline-flex h-14 items-center justify-center rounded-full bg-limon px-8 font-bold text-ink outline-none focus-visible:ring-4 focus-visible:ring-white/50"
          >
            Ir a Entrar
          </Link>
        ) : null}
      </div>
    </main>
  );
}

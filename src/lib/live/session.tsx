"use client";

import { useEffect } from "react";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase/client";
import { adoptLiveUser, flushProfileWrites, isLiveAvailable, useApp, useHydrated, wipeLiveState } from "@/lib/store";
import * as api from "./api";
import { useLiveAuth, type LiveUser } from "./auth-state";
import { loadSession } from "./backend";

export type { LiveUser };

/** Re-load the session on a repeated SIGNED_IN (tab refocus) at most this often. */
const RELOAD_AFTER_MS = 5 * 60_000;
let lastLoad = { userId: "", at: 0 };

function toLiveUser(session: Session): LiveUser {
  const u = session.user;
  return { id: u.id, email: u.email ?? null, phone: u.phone ? `+${u.phone.replace(/^\+/, "")}` : null };
}

function onAuth(event: AuthChangeEvent, session: Session | null) {
  const mode = useApp.getState().mode;
  if (mode === "demo") return; // the demo never mixes with a real account

  const user = session?.user;
  if (!user) {
    useLiveAuth.setState({ user: null, hasPassword: undefined, resolved: true, sessionLoaded: false });
    // Session gone (signed out here or elsewhere, or expired): no account data may stay behind.
    // Exception: offline, Supabase can't refresh an expired token and reports INITIAL_SESSION with no
    // session while still keeping it. Keep the account on screen (the PWA promises offline viewing);
    // writes fail with a friendly error, and the next online load re-checks.
    const offline = typeof navigator !== "undefined" && navigator.onLine === false;
    if (mode === "live" && (event === "SIGNED_OUT" || (event === "INITIAL_SESSION" && !offline))) wipeLiveState();
    return;
  }

  const signIn = event === "INITIAL_SESSION" || event === "SIGNED_IN";
  // Adopt first: switching accounts resets the store, which also clears useLiveAuth.
  const fresh = signIn && adoptLiveUser({ id: user.id, email: user.email }) === "new";
  useLiveAuth.setState({
    user: toLiveUser(session),
    hasPassword: user.user_metadata?.has_password === true ? true : undefined,
    resolved: true,
    ...(fresh ? { sessionLoaded: false } : {}),
  });

  if (signIn) {
    const now = Date.now();
    const due = event === "INITIAL_SESSION" || fresh || lastLoad.userId !== user.id || now - lastLoad.at > RELOAD_AFTER_MS;
    if (due) {
      lastLoad = { userId: user.id, at: now };
      // Never await Supabase inside this callback (it runs under the auth lock): defer.
      setTimeout(() => void loadSession(), 0);
    }
  } else if (event === "USER_UPDATED" && mode === "live" && user.email) {
    useApp.setState({ email: user.email });
  }
}

/**
 * Keeps the store in sync with Supabase Auth. Mounted once in <Providers/>. Does nothing in a
 * demo-only build or while the user is in the demo (it doesn't even create the Supabase client).
 */
export function LiveSession() {
  const hydrated = useHydrated();
  const demo = useApp((s) => s.mode === "demo");

  useEffect(() => {
    if (!hydrated || demo || !isLiveAvailable) return;
    const sb = getSupabase();
    if (!sb) return;
    const { data } = sb.auth.onAuthStateChange(onAuth);
    // Debounced profile edits: send them before the tab goes to the background / closes.
    const flush = () => {
      if (document.visibilityState === "hidden") void flushProfileWrites();
    };
    document.addEventListener("visibilitychange", flush);
    return () => {
      data.subscription.unsubscribe();
      document.removeEventListener("visibilitychange", flush);
    };
  }, [hydrated, demo]);

  return null;
}

/**
 * The Supabase user (live mode only). `loading` is true until we know whether there's a session,
 * so guards should wait for it before redirecting to /entrar.
 */
export function useLiveUser(): { user: LiveUser | null; hasPassword?: boolean; loading: boolean } {
  const hydrated = useHydrated();
  const mode = useApp((s) => s.mode);
  const user = useLiveAuth((s) => s.user);
  const hasPassword = useLiveAuth((s) => s.hasPassword);
  const resolved = useLiveAuth((s) => s.resolved);
  const loading = isLiveAvailable && (!hydrated || (mode !== "demo" && !resolved));
  return { user: mode === "live" ? user : null, hasPassword: mode === "live" ? hasPassword : undefined, loading };
}

/**
 * True once it's safe to decide "signed in or not": the store hydrated and (live-capable builds)
 * Supabase reported the initial session. Use it in route guards instead of useHydrated().
 */
export function useSessionReady(): boolean {
  const hydrated = useHydrated();
  const { loading } = useLiveUser();
  return hydrated && !loading;
}

/** Live: the profile/company finished loading from Supabase at least once this visit. */
export function useSessionLoaded(): boolean {
  return useLiveAuth((s) => s.sessionLoaded);
}

/**
 * Signs out of Supabase (this device) AND wipes the store back to a visitor. Works from the demo
 * too (just wipes). Follow it with a full reload, e.g. window.location.href = "/entrar".
 */
export async function signOutEverywhere(): Promise<void> {
  const wasLive = useApp.getState().mode === "live";
  if (wasLive) await flushProfileWrites().catch(() => undefined);
  wipeLiveState();
  useLiveAuth.setState({ user: null, hasPassword: undefined, sessionLoaded: false, sessionError: undefined });
  if (wasLive || (isLiveAvailable && useLiveAuth.getState().resolved)) await api.signOutLocal();
}

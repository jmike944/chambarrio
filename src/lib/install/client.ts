"use client";

/*
 * Install state on this device and the actions behind every "Instalar" button (landing bar, app card,
 * account menu, /instalar). One shared sheet (components/install/install-sheet) shows the steps when
 * the browser can't install with one tap.
 */
import { useEffect, useSyncExternalStore } from "react";
import { create } from "zustand";
import { INSTALL_EVENT } from "./script";
import { detectPlatform, escapeUrl, type Platform } from "./platform";
import { SAMPLE_AGENTS } from "./sample-agents";

export type Side = "candidato" | "empresa";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

declare global {
  interface Window {
    __chambaBIP?: InstallPromptEvent | null;
    __chambaInstalled?: boolean;
    TelegramWebview?: unknown;
    TelegramWebviewProxy?: unknown;
  }
  interface Navigator {
    standalone?: boolean;
    getInstalledRelatedApps?: () => Promise<unknown[]>;
  }
}

const noop = () => () => {};
function subscribeInstall(cb: () => void) {
  window.addEventListener(INSTALL_EVENT, cb);
  return () => window.removeEventListener(INSTALL_EVENT, cb);
}

// ------------------------------------------------------------------ platform

let platformCache: Platform | null = null;
export function readPlatform(): Platform {
  if (!platformCache) {
    const dev = devAgent();
    platformCache = detectPlatform(dev?.ua ?? navigator.userAgent, {
      maxTouchPoints: dev?.touch ?? navigator.maxTouchPoints,
      telegram: !!(window.TelegramWebview || window.TelegramWebviewProxy),
    });
  }
  return platformCache;
}
/** Dev builds only: ?plataforma=ios27 (keys in ./sample-agents) previews another phone's install path. */
function devAgent(): { ua: string; touch?: number } | null {
  if (process.env.NODE_ENV === "production") return null;
  const key = new URLSearchParams(window.location.search).get("plataforma");
  return key ? (SAMPLE_AGENTS[key] ?? null) : null;
}
/** null on the server and during hydration. */
export function usePlatform(): Platform | null {
  return useSyncExternalStore(noop, readPlatform, () => null);
}

// ------------------------------------------------------------------ installed?

// Only "standalone" (the manifest's display): a browser in full screen is not the installed app.
const MODES = ["(display-mode: standalone)"];
function subscribeDisplay(cb: () => void) {
  const mqs = MODES.map((q) => matchMedia(q));
  mqs.forEach((m) => m.addEventListener("change", cb));
  return () => mqs.forEach((m) => m.removeEventListener("change", cb));
}
/** Running as the installed app (iOS also reports navigator.standalone). */
export function isStandalone(): boolean {
  return navigator.standalone === true || MODES.some((q) => matchMedia(q).matches);
}
export function useStandalone(): boolean {
  return useSyncExternalStore(subscribeDisplay, isStandalone, () => false);
}

/** Chrome on Android can tell a tab that its own WebAPK is installed (manifest related_applications). */
const useRelated = create<{ installed: boolean }>(() => ({ installed: false }));
let relatedChecked = false;
function checkRelated() {
  if (relatedChecked) return;
  relatedChecked = true;
  const get = navigator.getInstalledRelatedApps;
  if (typeof get !== "function") return;
  get
    .call(navigator)
    .then((apps) => useRelated.setState({ installed: apps.length > 0 }))
    .catch(() => {});
}

function usePromptEvent(): InstallPromptEvent | null {
  return useSyncExternalStore(subscribeInstall, () => window.__chambaBIP ?? null, () => null);
}
function useJustInstalled(): boolean {
  return useSyncExternalStore(subscribeInstall, () => window.__chambaInstalled === true, () => false);
}

// ------------------------------------------------------------------ state

export type InstallState =
  /** Server render / before hydration: render nothing install-specific yet. */
  | { kind: "unknown" }
  /** Running as the app, or just installed / already installed (Chrome). */
  | { kind: "installed" }
  /** Chrome (or another Chromium) can install now: one tap opens its dialog. */
  | { kind: "prompt"; platform: Platform }
  /** Inside Facebook, Instagram…: open the page in a real browser first. */
  | { kind: "inapp"; platform: Platform }
  /** iPhone / iPad: Share → Agregar a Inicio. */
  | { kind: "ios"; platform: Platform }
  /** Android without a ready prompt: from the browser's menu. */
  | { kind: "android"; platform: Platform }
  /** A computer: go to the phone (QR on /instalar). */
  | { kind: "desktop"; platform: Platform };

export function useInstallState(): InstallState {
  const platform = usePlatform();
  const standalone = useStandalone();
  const evt = usePromptEvent();
  const justInstalled = useJustInstalled();
  const related = useRelated((s) => s.installed);
  useEffect(checkRelated, []);
  if (!platform) return { kind: "unknown" };
  // A computer always gets the QR path: the app installed on the computer isn't the one on the phone.
  if (platform.os === "desktop") return { kind: "desktop", platform };
  if (standalone || justInstalled || related) return { kind: "installed" };
  if (platform.inApp) return { kind: "inapp", platform };
  if (platform.os === "ios") return { kind: "ios", platform };
  if (evt) return { kind: "prompt", platform };
  return { kind: "android", platform };
}

// ------------------------------------------------------------------ actions

/**
 * Opens Chrome's install dialog. Must run synchronously inside the tap handler (prompt() needs the
 * user's gesture). Resolves "accepted" / "dismissed", or "unavailable" when there is no prompt.
 */
export function promptInstall(): Promise<"accepted" | "dismissed" | "unavailable"> {
  const evt = window.__chambaBIP;
  if (!evt) return Promise.resolve("unavailable");
  // The event stays until Chrome's dialog is answered, so nothing behind it flips to the manual steps.
  const settle = (outcome: "accepted" | "dismissed" | "unavailable") => {
    if (window.__chambaBIP === evt) window.__chambaBIP = null;
    // Accepted: installed as far as this page is concerned (appinstalled can take a few seconds).
    if (outcome === "accepted") window.__chambaInstalled = true;
    window.dispatchEvent(new Event(INSTALL_EVENT));
    return outcome;
  };
  try {
    return evt
      .prompt()
      .then(() => evt.userChoice)
      .then((c) => settle(c.outcome === "accepted" ? "accepted" : "dismissed"))
      .catch(() => settle("unavailable"));
  } catch {
    return Promise.resolve(settle("unavailable"));
  }
}

/** The shared install sheet (mounted once, in Providers). */
/** `returnFocus`: where focus goes when it closes, if what opened it is gone (an account-menu item). */
type SheetState = { open: boolean; side: Side; returnFocus: HTMLElement | null };
export const useInstallSheet = create<SheetState>(() => ({ open: false, side: "candidato", returnFocus: null }));
export function openInstallSheet(side: Side, returnFocus: HTMLElement | null = null) {
  useInstallSheet.setState({ open: true, side, returnFocus });
}
export function closeInstallSheet() {
  useInstallSheet.setState({ open: false });
}

/** Where a phone should land after leaving an in-app browser, or a computer's QR points to. */
export function installPageUrl(side: Side, origin = window.location.origin): URL {
  const url = new URL("/instalar", origin);
  if (side === "empresa") url.searchParams.set("lado", "empresa");
  return url;
}

/**
 * Leaves an in-app browser for the real one (only from a tap). Returns false when this app blocks
 * every escape. Whether it worked can't be known from here (a confirm dialog, a silent no-op), so
 * callers show the manual steps alongside.
 */
export function tryEscape(platform: Platform, side: Side): boolean {
  const target = installPageUrl(side);
  target.searchParams.set("desde", "app");
  const esc = escapeUrl(platform, target);
  if (!esc) return false;
  if (esc.kind === "open") window.open(esc.url, "_blank");
  else window.location.href = esc.url;
  return true;
}

// ------------------------------------------------------------------ remembered side

/**
 * Which side this visitor is on (the landing they came from), so the installed app opens on it
 * (/app). A cookie, not localStorage: iOS copies cookies into a Home Screen app (17.2+), nothing else.
 */
const SIDE_COOKIE = "chamba-lado";
export function rememberSide(side: Side) {
  try {
    const secure = window.location.protocol === "https:" ? "; secure" : "";
    document.cookie = `${SIDE_COOKIE}=${side}; path=/; max-age=31536000; samesite=lax${secure}`;
  } catch {
    /* cookies blocked: the app just opens on the job-seeker side */
  }
}
export function readSide(): Side | null {
  try {
    const m = new RegExp(`(?:^|;\\s*)${SIDE_COOKIE}=(candidato|empresa)`).exec(document.cookie);
    return m ? (m[1] as Side) : null;
  } catch {
    return null;
  }
}

// ------------------------------------------------------------------ "not now"

const HIDE_KEY = "chamba-instalar-oculto";
const HIDE_EVENT = "chamba:install-hide";
type Spot = "bar" | "card";
function readHidden(): Record<string, number> {
  try {
    return JSON.parse(window.localStorage.getItem(HIDE_KEY) ?? "{}") as Record<string, number>;
  } catch {
    return {};
  }
}
/** Hides a promo for `days` (the account menu item and /instalar stay). */
export function hideFor(spot: Spot, days: number) {
  try {
    const all = readHidden();
    all[spot] = Date.now() + days * 24 * 60 * 60 * 1000;
    window.localStorage.setItem(HIDE_KEY, JSON.stringify(all));
  } catch {
    /* private mode: hidden for this page view only */
  }
  hiddenNow.add(spot);
  window.dispatchEvent(new Event(HIDE_EVENT));
}
const hiddenNow = new Set<Spot>();
function subscribeHidden(cb: () => void) {
  window.addEventListener(HIDE_EVENT, cb);
  return () => window.removeEventListener(HIDE_EVENT, cb);
}
/** true on the server (nothing flashes in before we know). */
export function useHidden(spot: Spot): boolean {
  return useSyncExternalStore(
    subscribeHidden,
    () => hiddenNow.has(spot) || (readHidden()[spot] ?? 0) > Date.now(),
    () => true,
  );
}

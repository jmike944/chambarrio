"use client";

import { useSyncExternalStore } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Moon02Icon, Sun03Icon } from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";

export type ThemePref = "light" | "dark" | "system";
const KEY = "chamba-theme";
/** Browser chrome colors (meta theme-color) — match --background in each theme. */
export const THEME_COLOR = { light: "#f4f2ff", dark: "#0f0b26" } as const;

/** Inline, pre-paint theme script (rendered from the root layout's <head>). */
export const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem("${KEY}")||"system";var d=t==="dark"||(t==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);var r=document.documentElement;r.classList.toggle("dark",d);r.style.colorScheme=d?"dark":"light";}catch(e){}})()`;

const listeners = new Set<() => void>();
function emit() {
  listeners.forEach((l) => l());
}

function apply(pref: ThemePref) {
  const dark =
    pref === "dark" || (pref === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  const root = document.documentElement;
  root.classList.toggle("dark", dark);
  root.style.colorScheme = dark ? "dark" : "light";
  document
    .querySelectorAll('meta[name="theme-color"]')
    .forEach((m) => m.setAttribute("content", dark ? THEME_COLOR.dark : THEME_COLOR.light));
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const mq = matchMedia("(prefers-color-scheme: dark)");
  const onChange = () => {
    if (getPref() === "system") apply("system");
    cb();
  };
  mq.addEventListener("change", onChange);
  return () => {
    listeners.delete(cb);
    mq.removeEventListener("change", onChange);
  };
}

function getPref(): ThemePref {
  try {
    return (localStorage.getItem(KEY) as ThemePref) || "system";
  } catch {
    return "system";
  }
}

export function setTheme(pref: ThemePref) {
  try {
    localStorage.setItem(KEY, pref);
  } catch {}
  apply(pref);
  emit();
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, getPref, () => "system" as ThemePref);
  const resolvedTheme = useSyncExternalStore(
    subscribe,
    () => (document.documentElement.classList.contains("dark") ? "dark" : "light"),
    () => "dark" as "dark" | "light",
  );
  return { theme, resolvedTheme, setTheme };
}

export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme } = useTheme();
  const next = resolvedTheme === "dark" ? "light" : "dark";
  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      aria-label={next === "dark" ? "Usar tema oscuro" : "Usar tema claro"}
      className={cn(
        "press grid size-12 place-items-center rounded-full border border-border bg-card text-foreground shadow-card hover:bg-tile focus-visible:ring-3 focus-visible:ring-ring/50 outline-none",
        className,
      )}
    >
      <HugeiconsIcon
        key={resolvedTheme}
        icon={resolvedTheme === "dark" ? Sun03Icon : Moon02Icon}
        className="size-5 animate-pop-in"
        strokeWidth={1.8}
      />
    </button>
  );
}

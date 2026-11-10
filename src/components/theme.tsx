"use client";

import { useSyncExternalStore } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ContrastIcon, Moon02Icon, Sun03Icon } from "@hugeicons/core-free-icons";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

/** "system" (the default, nothing saved) follows the phone or computer's own light/dark setting. */
export type ThemePref = "light" | "dark" | "system";
/*
 * A new key: choices saved under the old one ("chamba-theme", from the light/dark-only toggle) are
 * dropped, so everyone starts on Sistema once; what they pick from here on is kept.
 */
const KEY = "chamba-tema";
const OLD_KEY = "chamba-theme";

/** The three choices, in the order they're offered (Sistema first: it's the default). */
export const THEME_OPTIONS = [
  { value: "system", label: "Sistema", icon: ContrastIcon },
  { value: "light", label: "Claro", icon: Sun03Icon },
  { value: "dark", label: "Oscuro", icon: Moon02Icon },
] as const satisfies readonly { value: ThemePref; label: string; icon: typeof ContrastIcon }[];
const OPTION = Object.fromEntries(THEME_OPTIONS.map((o) => [o.value, o])) as Record<ThemePref, (typeof THEME_OPTIONS)[number]>;
const isPref = (v: unknown): v is ThemePref => v === "light" || v === "dark" || v === "system";
/** Browser chrome colors (meta theme-color) — match --background in each theme. */
export const THEME_COLOR = { light: "#f4f2ff", dark: "#0f0b26" } as const;

/** Inline, pre-paint theme script (rendered from the root layout's <head>). */
export const THEME_SCRIPT = `(function(){try{localStorage.removeItem("${OLD_KEY}");var t=localStorage.getItem("${KEY}")||"system";var d=t==="dark"||(t==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);var r=document.documentElement;r.classList.toggle("dark",d);r.style.colorScheme=d?"dark":"light";}catch(e){}})()`;

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
    const v = localStorage.getItem(KEY);
    return isPref(v) ? v : "system";
  } catch {
    return "system";
  }
}

export function setTheme(pref: ThemePref) {
  try {
    // "system" is the default: nothing saved, so it keeps following the device.
    if (pref === "system") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, pref);
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

/**
 * The round theme button (landing and page headers): opens Sistema / Claro / Oscuro. Its icon is the
 * current choice (the half circle = following the device).
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme } = useTheme();
  const current = OPTION[theme];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Tema: ${current.label}`}
        className={cn(
          "press grid size-12 place-items-center rounded-full border border-border bg-card text-foreground shadow-card hover:bg-tile focus-visible:ring-3 focus-visible:ring-ring/50 outline-none data-[state=open]:ring-3 data-[state=open]:ring-primary/40",
          className,
        )}
      >
        <HugeiconsIcon key={theme} icon={current.icon} className="size-5 animate-pop-in" strokeWidth={1.8} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-48 rounded-3xl border border-border p-2 shadow-pop">
        <DropdownMenuLabel>Tema</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={theme} onValueChange={(v) => isPref(v) && setTheme(v)}>
          {THEME_OPTIONS.map((o) => (
            <DropdownMenuRadioItem key={o.value} value={o.value} className="h-11 text-[0.95rem]">
              <HugeiconsIcon icon={o.icon} className="size-5" strokeWidth={1.6} />
              {o.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Sistema · Claro · Oscuro as one row of buttons, one tap each (the app's side rail). */
export function ThemePicker({ className }: { className?: string }) {
  const { theme } = useTheme();
  return (
    <div role="group" aria-label="Tema" className={cn("flex items-center gap-1", className)}>
      {THEME_OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={theme === o.value}
          aria-label={o.label}
          title={o.label}
          onClick={() => setTheme(o.value)}
          className={cn(
            "press grid size-10 place-items-center rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
            theme === o.value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-tile hover:text-foreground",
          )}
        >
          <HugeiconsIcon icon={o.icon} className="size-5" strokeWidth={1.8} />
        </button>
      ))}
    </div>
  );
}

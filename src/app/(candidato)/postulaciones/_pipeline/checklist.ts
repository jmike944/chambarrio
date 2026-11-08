"use client";

/*
 * Ticked items of the "Qué llevar" / "Tu primer día" checklists, per application, on this device only
 * (a convenience: never synced, safe to lose). Shared by every copy of a checklist on the page so the
 * mobile and desktop slots stay in step. Cleared when the demo resets / the account changes.
 */
import { useCallback, useSyncExternalStore } from "react";
import { onLive } from "@/lib/live/events";

const KEY = "chambarrio-checklists";
const EMPTY: readonly string[] = [];
let cache: Record<string, string[]> | null = null;
const subs = new Set<() => void>();

function read(): Record<string, string[]> {
  if (cache) return cache;
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    cache = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, string[]>) : {};
  } catch {
    cache = {};
  }
  return cache;
}

function write(next: Record<string, string[]>) {
  cache = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // private mode / storage blocked: keep it in memory for this visit
  }
  for (const f of subs) f();
}

function subscribe(cb: () => void) {
  subs.add(cb);
  return () => {
    subs.delete(cb);
  };
}

if (typeof window !== "undefined") {
  onLive("reset", () => write({}));
}

/** [ticked items, toggle(item)] for one checklist (`id` = application id + list name). */
export function useChecklist(id: string): [readonly string[], (item: string) => void] {
  const checked = useSyncExternalStore(
    subscribe,
    () => read()[id] ?? EMPTY,
    () => EMPTY,
  );
  const toggle = useCallback(
    (item: string) => {
      const all = read();
      const cur = all[id] ?? [];
      write({ ...all, [id]: cur.includes(item) ? cur.filter((x) => x !== item) : [...cur, item] });
    },
    [id],
  );
  return [checked, toggle];
}

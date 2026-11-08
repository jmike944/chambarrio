"use client";

import { useCallback, useSyncExternalStore } from "react";

/*
 * A ticking "now" for relative times ("hace 5 min", "en 2 h"). One shared timer per interval.
 * Returns 0 during SSR / hydration (pipeline data only renders after the store hydrates anyway);
 * treat 0 as "don't show relative times yet".
 */

type Clock = { now: number; subs: Set<() => void>; timer: ReturnType<typeof setInterval> | null };
const clocks = new Map<number, Clock>();

function clockFor(ms: number): Clock {
  let c = clocks.get(ms);
  if (!c) {
    c = { now: Date.now(), subs: new Set(), timer: null };
    clocks.set(ms, c);
  }
  return c;
}

function subscribeClock(ms: number, cb: () => void): () => void {
  const c = clockFor(ms);
  c.subs.add(cb);
  if (!c.timer) {
    c.now = Date.now();
    c.timer = setInterval(() => {
      c.now = Date.now();
      for (const f of c.subs) f();
    }, ms);
  }
  return () => {
    c.subs.delete(cb);
    if (c.subs.size === 0 && c.timer) {
      clearInterval(c.timer);
      c.timer = null;
    }
  };
}

const readClock = (ms: number) => clockFor(ms).now;
const serverNow = () => 0;

export function useNow(intervalMs = 60_000): number {
  const ms = Math.max(1000, intervalMs);
  const subscribe = useCallback((cb: () => void) => subscribeClock(ms, cb), [ms]);
  const read = useCallback(() => readClock(ms), [ms]);
  return useSyncExternalStore(subscribe, read, serverNow);
}

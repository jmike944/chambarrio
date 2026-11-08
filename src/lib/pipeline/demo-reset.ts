"use client";

/*
 * Wipes the persisted demo pipeline whenever the user changes (enterDemo / exitDemo / sign-out
 * emit "reset"), also on pages that never load ./demo-store — "Demo: busco chamba" / "Demo: tengo un
 * negocio" are pressed on /entrar and the landing, which don't. Without this, a fresh demo kept the
 * previous demo's hires, declines and notes. Loaded once by the root providers, so it stays tiny
 * (no store, no seed). When ./demo-store is loaded, its own listener also resets the in-memory state.
 */
import { onLive } from "@/lib/live/events";

/** localStorage key of the demo pipeline store (./demo-store). */
export const DEMO_PIPELINE_KEY = "chamba-pipeline-demo";

if (typeof window !== "undefined") {
  onLive("reset", () => {
    try {
      localStorage.removeItem(DEMO_PIPELINE_KEY);
    } catch {
      // Storage blocked (private mode): nothing persisted to wipe.
    }
  });
}

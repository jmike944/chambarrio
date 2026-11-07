"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { JOBS } from "@/lib/data/jobs";
import type { Application, ApplicationStatus, CategoryId, CompanySize, Experience, Job } from "@/lib/data/types";
import { bearing, distanceKm, type LatLng, type RadiusKm } from "@/lib/geo";

export type Role = "candidato" | "empresa";
export type PlanId = "por-vacante" | "pyme" | "industrial";

export type Business = {
  name: string;
  kind: string;
  size: CompanySize;
  colonia: string;
  location: LatLng;
  phone: string;
  plan: PlanId;
};

type State = {
  /** Demo session flag. Starts true so the seeded demo opens straight into the app. */
  signedIn: boolean;
  onboarded: boolean;
  role: Role;
  phone: string;
  interests: CategoryId[];
  experience: Experience;
  business: Business | null;
  name: string;
  colonia: string;
  home: LatLng;
  locationSource: "colonia" | "gps";
  approximate: boolean;
  radiusKm: RadiusKm;
  saved: string[];
  applications: Application[];
  /** Vacancies whose applicants the business paid to see (per-vacancy plan only). */
  unlockedJobIds: string[];
  setRadius: (r: RadiusKm) => void;
  setHome: (home: LatLng, colonia: string, source: "colonia" | "gps") => void;
  toggleSaved: (jobId: string) => void;
  apply: (jobId: string) => void;
  setName: (name: string) => void;
  setPhone: (phone: string) => void;
  setRole: (role: Role) => void;
  setInterests: (interests: CategoryId[]) => void;
  setExperience: (experience: Experience) => void;
  setBusiness: (business: Business | null) => void;
  completeOnboarding: (role: Role) => void;
  signIn: (role: Role) => void;
  /** Ends the session but keeps the profile, standing in for data a server would hold. */
  signOut: () => void;
  unlockJob: (jobId: string) => void;
};

export const useApp = create<State>()(
  persist(
    (set) => ({
      signedIn: true,
      onboarded: false,
      role: "candidato",
      phone: "",
      interests: ["caja", "almacen", "seguridad"],
      experience: "6 meses",
      business: null,
      name: "Mariana",
      colonia: "Lourdes",
      home: { lat: 25.4322, lng: -100.9935 },
      locationSource: "colonia",
      approximate: true,
      radiusKm: 5,
      saved: ["soldador-arteaga"],
      // Demo: one vacancy already unlocked so both states are visible side by side.
      unlockedJobIds: ["montacarguista-zapaliname"],
      applications: [
        { jobId: "auxiliar-farmacia", status: "entrevista", minutesAgo: 1500 },
        { jobId: "guardia-centinela", status: "vista", minutesAgo: 300 },
        { jobId: "cajera-mirasierra", status: "enviada", minutesAgo: 45 },
      ],
      setRadius: (radiusKm) => set({ radiusKm }),
      setHome: (home, colonia, locationSource) => set({ home, colonia, locationSource }),
      toggleSaved: (id) =>
        set((s) => ({ saved: s.saved.includes(id) ? s.saved.filter((x) => x !== id) : [...s.saved, id] })),
      apply: (jobId) =>
        set((s) =>
          s.applications.some((a) => a.jobId === jobId)
            ? s
            : { applications: [{ jobId, status: "enviada" as ApplicationStatus, minutesAgo: 0 }, ...s.applications] },
        ),
      setName: (name) => set({ name }),
      setPhone: (phone) => set({ phone }),
      setRole: (role) => set({ role }),
      setInterests: (interests) => set({ interests }),
      setExperience: (experience) => set({ experience }),
      setBusiness: (business) => set({ business }),
      completeOnboarding: (role) => set({ onboarded: true, role, signedIn: true }),
      signIn: (role) => set({ role, signedIn: true }),
      signOut: () => set({ signedIn: false }),
      unlockJob: (jobId) =>
        set((s) => (s.unlockedJobIds.includes(jobId) ? s : { unlockedJobIds: [...s.unlockedJobIds, jobId] })),
    }),
    {
      name: "chamba-a-lado",
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      version: 1,
      // v0 → v1: the per-hire plan was replaced by per-vacancy-per-month billing.
      migrate: (persisted, version) => {
        const s = persisted as { business?: { plan?: string } | null };
        if (version < 1 && s.business?.plan === "por-contratacion") s.business = { ...s.business, plan: "por-vacante" };
        return s as unknown as State;
      },
    },
  ),
);

/** Rehydrate persisted state after mount so SSR and first client render match. */
export function useStoreHydration() {
  useEffect(() => {
    void useApp.persist.rehydrate();
  }, []);
}

export function useHydrated() {
  return useSyncExternalStore(
    (cb) => useApp.persist.onFinishHydration(cb),
    () => useApp.persist.hasHydrated(),
    () => false,
  );
}

/** Price to unlock one vacancy's applicants for a month, in MXN. */
export const UNLOCK_PRICE = 500;
/** The demo business (no registered business yet) is on the free per-vacancy plan. */
export const DEMO_PLAN: PlanId = "por-vacante";

export function useEmployerPlan(): PlanId {
  return useApp((s) => s.business?.plan ?? DEMO_PLAN);
}

/** Subscriptions include applicants; on the per-vacancy plan each vacancy is unlocked separately. */
export function useIsUnlocked(): (jobId: string) => boolean {
  const plan = useEmployerPlan();
  const ids = useApp((s) => s.unlockedJobIds);
  return (jobId) => plan !== "por-vacante" || ids.includes(jobId);
}

export type JobWithDistance = Job & { km: number; bearing: number };

/** All jobs with distance from the user's home, nearest first. */
export function useJobsByDistance(): JobWithDistance[] {
  const home = useApp((s) => s.home);
  return useMemo(
    () => JOBS.map((j) => ({ ...j, km: distanceKm(home, j.location), bearing: bearing(home, j.location) })).toSorted((a, b) => a.km - b.km),
    [home],
  );
}

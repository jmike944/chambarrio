"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { toast } from "sonner";
import { AVATAR_PRESETS, randomAvatar, sanitizeAvatar, type AvatarConfig } from "@/components/avatar/config";
import { COMPANY_BY_ID, DEMO_COMPANY_ID } from "@/lib/data/jobs";
import type { Application, ApplicationStatus, Branch, CategoryId, CompanySize, Experience } from "@/lib/data/types";
import { SALTILLO_CENTER, type LatLng, type RadiusKm } from "@/lib/geo";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import * as api from "@/lib/live/api";
import type { LiveCompany, LiveSessionData, WriteResult } from "@/lib/live/api";
import { emitLive } from "@/lib/live/events";
import {
  EMPTY_PROFILE_EXTRAS,
  PROFILE_LIMITS,
  validateExperience,
  type CandidateProfileExtras,
  type WorkExperience,
} from "@/lib/profile-strength";

/*
 * The signed-in user, in one of two modes:
 *  - "demo": the curated mock showcase (enterDemo). Everything stays local; never calls Supabase.
 *  - "live": a real Supabase account. Actions update local state optimistically, write through to
 *    Supabase and roll back + toast.error if the server says no.
 *  - null: a visitor (landing, onboarding before the account exists). Actions are local drafts.
 * Vacancies/companies/branches are NOT here: they live in the catalog (@/lib/data/catalog).
 */

export { DEMO_COMPANY_ID };
// Rebased on the catalog (demo mock or live Supabase); same return shape as before.
export { useJobsByDistance, type JobWithDistance } from "@/lib/data/catalog";
export type { WriteResult } from "@/lib/live/api";

export type Role = "candidato" | "empresa";

/** A row of the candidate's work history. `id`: server id (live), "tmp-…" while saving, "exp-…" in demo. */
export type StoredExperience = WorkExperience & { id: string };
/** The optional profile fields edited through `updateProfile` (photo / CV go through @/lib/live/profile-files). */
export type ProfileExtrasPatch = Partial<Omit<CandidateProfileExtras, "avatarPath" | "cvPath">>;
export type PlanId = "por-vacante" | "pyme" | "industrial";
export type AppMode = "demo" | "live";

/** Live mode exists only when Supabase is configured; otherwise the app is demo-only. */
export const isLiveAvailable = isSupabaseConfigured;

export type Business = {
  /** Live: the company's server id. Absent in demo and for a live draft that isn't saved yet. */
  id?: string;
  name: string;
  kind: string;
  size: CompanySize;
  /** Sucursales / plantas. At least one; the first is the main site. Live: server ids. */
  locations: Branch[];
  phone: string;
  /** Live: set by the server (payments backend), never by the client. */
  plan: PlanId;
  verified?: boolean;
  about?: string;
  employees?: string;
};

type UserData = {
  mode: AppMode | null;
  /** Live: the Supabase user id this data belongs to. */
  userId: string | null;
  email: string;
  signedIn: boolean;
  /** Live: profile.onboarded. A live user with onboarded=false still has to finish onboarding. */
  onboarded: boolean;
  role: Role;
  phone: string;
  interests: CategoryId[];
  experience: Experience;
  business: Business | null;
  name: string;
  colonia: string;
  home: LatLng;
  /** false until the user picks a colonia / GPS (home is then Saltillo centro). */
  hasHome: boolean;
  locationSource: "colonia" | "gps";
  approximate: boolean;
  radiusKm: RadiusKm;
  saved: string[];
  applications: Application[];
  /** Vacancies whose applicants the business unlocked (demo: paid in the fake flow; live: job_unlocks). */
  unlockedJobIds: string[];
  /** Email: the daily digest of new vacancies nearby (live: profiles.email_alerts). */
  emailAlerts: boolean;
  /**
   * Email: application updates (candidate: seen / interview / hired; business owner: someone
   * applied). Live: profiles.email_updates, one flag for both roles.
   */
  emailUpdates: boolean;
  /** Candidate work history (live: public.work_experiences), in the order it was added. */
  workExperiences: StoredExperience[];
  /** Live: public.profile_strength as of the last load (the editor computes its own live value). */
  serverStrength: number | null;
  /** The CV's original file name, remembered on this device (the server only keeps the path). */
  cvFileName: string | null;
  /** Demo only: a small data-URL thumbnail of the "uploaded" photo (never sent anywhere). */
  demoAvatarUrl: string | null;
  /**
   * "Crea tu avatar": the illustrated avatar (live: profiles.avatar_config). null = never built; read it
   * through useMyAvatar(), which falls back to a deterministic look. Non-identifying: companies see it
   * before they unlock an application (the photo stays locked).
   */
  avatarConfig: AvatarConfig | null;
  /** The user saved their own avatar at least once (the demo's preset doesn't count; live: avatar_config is set). */
  avatarSaved: boolean;
  /**
   * The avatar is only on this device: a visitor's draft, or live while the database can't store it yet
   * (migration 20261108000000_avatar_config.sql pending). Uploaded on the next session load that can.
   */
  avatarLocalOnly: boolean;
} & CandidateProfileExtras;

type Actions = {
  /** Replaces the user with the curated demo (Mariana in Lourdes / Logística Zapalinamé) and signs in. */
  enterDemo: (role: Role) => void;
  /** Wipes everything back to a signed-out visitor (mode null). */
  exitDemo: () => void;
  // Write-through actions: local immediately; in live mode also saved to Supabase. On a server
  // error they roll back and toast.error themselves; await the result only to know when it landed.
  setRadius: (r: RadiusKm) => Promise<WriteResult>;
  setHome: (home: LatLng, colonia: string, source: "colonia" | "gps") => Promise<WriteResult>;
  toggleSaved: (jobId: string) => Promise<WriteResult>;
  apply: (jobId: string) => Promise<WriteResult>;
  /**
   * The candidate withdraws an application (status → cerrada). `expected`: the status they saw;
   * live, nothing changes if the server has another one by now (a stale tab).
   */
  withdraw: (jobId: string, expected?: ApplicationStatus) => Promise<WriteResult>;
  setName: (name: string) => Promise<WriteResult>;
  setPhone: (phone: string) => Promise<WriteResult>;
  setRole: (role: Role) => Promise<WriteResult>;
  setInterests: (interests: CategoryId[]) => Promise<WriteResult>;
  setExperience: (experience: Experience) => Promise<WriteResult>;
  /** Email preferences. Demo: local only (the demo never sends email). */
  setEmailAlerts: (on: boolean) => Promise<WriteResult>;
  setEmailUpdates: (on: boolean) => Promise<WriteResult>;
  /**
   * The optional richer profile (headline, about, skills, availability, expected pay…). Any subset of
   * fields; live: debounced and batched with the other profile writes, rolled back + toasted on error.
   */
  updateProfile: (patch: ProfileExtrasPatch) => Promise<WriteResult>;
  /** Work history. Live: insert/update/delete on work_experiences (optimistic, rollback + toast). */
  addExperience: (experience: WorkExperience) => Promise<WriteResult & { id?: string }>;
  updateExperience: (id: string, patch: Partial<WorkExperience>) => Promise<WriteResult>;
  removeExperience: (id: string) => Promise<WriteResult>;
  /**
   * Saves the illustrated avatar (sanitized). Live: written to profiles.avatar_config (optimistic, rollback +
   * toast on error). If the database doesn't have the column yet it stays on this device instead
   * (avatarLocalOnly) and resolves without error.
   */
  setAvatarConfig: (config: AvatarConfig | null) => Promise<WriteResult>;
  /** Live: creates the company + branches the first time, afterwards updates name/kind/size/phone only. */
  setBusiness: (business: Business | null) => Promise<WriteResult>;
  completeOnboarding: (role: Role) => Promise<WriteResult>;
  /** Legacy fake sign-in: enters the demo (mode null) or resumes it (signed-out demo). */
  signIn: (role: Role) => void;
  /** Demo: ends the session but keeps the demo profile. Live: signs out of Supabase and wipes. */
  signOut: () => void;
  /** Demo only (fake payment). A no-op in live mode: payments aren't available yet. */
  unlockJob: (jobId: string) => void;
  /** Branch management. Demo: the demo company is adopted first. Live: returns a temporary id at once. */
  addLocation: (branch: Omit<Branch, "id">) => string;
  /** Like addLocation but resolves with the server id (live) once saved. */
  addLocationAsync: (branch: Omit<Branch, "id">) => Promise<WriteResult & { id?: string }>;
  updateLocation: (id: string, patch: Partial<Omit<Branch, "id">>) => Promise<WriteResult>;
  /** Ignored for the last remaining location (live: returns an error). */
  removeLocation: (id: string) => Promise<WriteResult>;
};

type State = UserData & Actions;

/** A signed-out visitor. Home defaults to Saltillo centro until they pick one. */
const BLANK: UserData = {
  mode: null,
  userId: null,
  email: "",
  signedIn: false,
  onboarded: false,
  role: "candidato",
  phone: "",
  interests: [],
  experience: "Sin experiencia",
  business: null,
  name: "",
  colonia: "Centro",
  home: SALTILLO_CENTER,
  hasHome: false,
  locationSource: "colonia",
  approximate: true,
  radiusKm: 5,
  saved: [],
  applications: [],
  unlockedJobIds: [],
  emailAlerts: true,
  emailUpdates: true,
  ...EMPTY_PROFILE_EXTRAS,
  workExperiences: [],
  serverStrength: null,
  cvFileName: null,
  demoAvatarUrl: null,
  avatarConfig: null,
  avatarSaved: false,
  avatarLocalOnly: false,
};

/**
 * Mariana's partly-filled profile (demo): headline, "sobre mí" and 3 skills/licenses, but no work
 * history, phone, availability, schooling, photo or CV yet → 55 %, so the meter and the tips have
 * something to show ("+15 % · Agrega dónde has trabajado").
 */
const DEMO_EXTRAS: CandidateProfileExtras = {
  ...EMPTY_PROFILE_EXTRAS,
  headline: "Cajera con experiencia en minisúper",
  about:
    "Trabajé medio año de cajera en un minisúper de mi colonia: cobro, corte de caja y acomodo de mercancía. Busco algo cerca de Lourdes, de preferencia en turno matutino.",
  skills: ["Manejo de caja", "Atención al cliente"],
  certifications: ["Manejo higiénico de alimentos"],
};

/** The curated demo user (what the app shipped with as its defaults). */
function demoSeed(role: Role): UserData {
  return {
    ...BLANK,
    mode: "demo",
    signedIn: true,
    onboarded: true,
    role,
    interests: ["caja", "almacen", "seguridad"],
    experience: "6 meses",
    // The demo employer runs as DEMO_COMPANY_ID (see useEmployerLocations); no business of its own.
    business: null,
    name: "Mariana",
    colonia: "Lourdes",
    home: { lat: 25.4322, lng: -100.9935 },
    hasHome: true,
    saved: ["soldador-arteaga"],
    // One vacancy already unlocked so both states are visible side by side.
    unlockedJobIds: ["montacarguista-zapaliname"],
    applications: [
      { jobId: "auxiliar-farmacia", status: "entrevista", minutesAgo: 1500 },
      { jobId: "guardia-centinela", status: "vista", minutesAgo: 300 },
      { jobId: "cajera-mirasierra", status: "enviada", minutesAgo: 45 },
    ],
    ...DEMO_EXTRAS,
    // A look that fits her (cashier). Not "saved" yet, so her first save in the builder celebrates.
    avatarConfig: AVATAR_PRESETS.caja.config,
  };
}

const DONE: Promise<WriteResult> = Promise.resolve({});

export const useApp = create<State>()(
  persist(
    (set, get) => ({
      ...BLANK,

      enterDemo: (role) => {
        const wasLive = get().mode === "live";
        resetLiveWork();
        set(demoSeed(role));
        emitLive("reset");
        // Leaving a live account for the demo: drop the session so the two never mix.
        if (wasLive) void api.signOutLocal();
      },
      exitDemo: () => wipe(),

      setRadius: (radiusKm) => writeProfile("radiusKm", radiusKm),
      setName: (name) => writeProfile("name", name),
      setPhone: (phone) => writeProfile("phone", phone),
      setRole: (role) => writeProfile("role", role),
      setInterests: (interests) => writeProfile("interests", interests),
      setExperience: (experience) => writeProfile("experience", experience),
      setEmailAlerts: (on) => writeProfile("emailAlerts", on),
      setEmailUpdates: (on) => writeProfile("emailUpdates", on),
      updateProfile: (patch) => writeProfileMany(cleanExtrasPatch(patch)),

      setAvatarConfig: (input) => {
        const config = input ? sanitizeAvatar(input) : null;
        const prev = pick(get(), ["avatarConfig", "avatarSaved", "avatarLocalOnly"]);
        const mode = get().mode;
        // A visitor's avatar is a draft on this device (pushed when their account loads).
        set({ avatarConfig: config, avatarSaved: config !== null, avatarLocalOnly: mode === null && config !== null });
        if (mode !== "live") return DONE;
        return pushAvatar(config, prev);
      },

      addExperience: async (input) => {
        const entry = normalizeExperience(input);
        const invalid = validateExperience(entry);
        if (invalid) return fail(invalid);
        if (get().workExperiences.length >= PROFILE_LIMITS.experiencesMax) return fail(api.MSG.experienceLimit);
        if (!isLive()) {
          const id = `exp-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
          set((s) => ({ workExperiences: [...s.workExperiences, { ...entry, id }] }));
          return { id };
        }
        return createExperience(entry);
      },

      updateExperience: async (id, patch) => {
        const before = get().workExperiences.find((e) => e.id === id);
        if (!before) return {};
        const next = normalizeExperience({ ...before, ...patch });
        const invalid = validateExperience(next);
        if (invalid) return fail(invalid);
        patchExperience(id, next);
        if (!isLive()) return {};
        const serverId = await resolveExperienceId(id);
        if (!serverId) return { error: api.MSG.save };
        return sync(
          () => trackWrite(api.updateExperience(serverId, next)),
          () => patchExperience(serverId, stripId(before)),
        );
      },

      removeExperience: async (id) => {
        const list = get().workExperiences;
        const index = list.findIndex((e) => e.id === id);
        if (index < 0) return {};
        const removed = list[index];
        set((s) => ({ workExperiences: s.workExperiences.filter((e) => e.id !== id) }));
        if (!isLive()) return {};
        const serverId = await resolveExperienceId(id);
        if (!serverId) return {}; // never reached the server
        return sync(
          () => trackWrite(api.deleteExperience(serverId)),
          () =>
            set((s) =>
              s.workExperiences.some((e) => e.id === serverId)
                ? {}
                : { workExperiences: [...s.workExperiences.slice(0, index), { ...removed, id: serverId }, ...s.workExperiences.slice(index)] },
            ),
        );
      },

      setHome: (home, colonia, locationSource) => {
        const prev = pick(get(), ["home", "colonia", "locationSource", "hasHome"]);
        set({ home, colonia, locationSource, hasHome: true });
        if (!isLive()) return DONE;
        return sync(
          () => api.setHome(home, colonia, locationSource),
          () => {
            if (get().home === home) set(prev);
          },
        );
      },

      toggleSaved: (id) => {
        const on = !get().saved.includes(id);
        set((s) => ({ saved: on ? [...s.saved, id] : s.saved.filter((x) => x !== id) }));
        if (!isLive()) return DONE;
        return sync(
          () => api.toggleSaved(id, on),
          () =>
            set((s) => {
              const has = s.saved.includes(id);
              if (on && has) return { saved: s.saved.filter((x) => x !== id) };
              if (!on && !has) return { saved: [...s.saved, id] };
              return {};
            }),
        );
      },

      apply: (jobId) => {
        if (get().applications.some((a) => a.jobId === jobId)) return DONE;
        set((s) => ({ applications: [{ jobId, status: "enviada" as ApplicationStatus, minutesAgo: 0 }, ...s.applications] }));
        if (!isLive()) return DONE;
        return sync(
          () => api.apply(jobId),
          () => set((s) => ({ applications: s.applications.filter((a) => a.jobId !== jobId) })),
        );
      },

      withdraw: (jobId, expected) => {
        const prev = get().applications.find((a) => a.jobId === jobId);
        if (!prev || prev.status === "cerrada") return DONE;
        const patchStatus = (status: ApplicationStatus) =>
          set((s) => ({ applications: s.applications.map((a) => (a.jobId === jobId ? { ...a, status } : a)) }));
        patchStatus("cerrada");
        if (!isLive()) return DONE;
        return sync(
          () => api.withdraw(jobId, expected),
          () => patchStatus(prev.status),
        );
      },

      setBusiness: (business) => {
        const prev = get().business;
        if (!isLive() || !business) {
          set({ business });
          return DONE;
        }
        if (prev?.id) {
          const companyId = prev.id;
          const next: Business = { ...prev, name: business.name, kind: business.kind, size: business.size, phone: business.phone };
          set({ business: next });
          return sync(
            () => api.updateCompany(companyId, { name: next.name, kind: next.kind, size: next.size, phone: next.phone }),
            () => {
              if (get().business === next) set({ business: prev });
            },
          );
        }
        // First time: keep the draft locally (without id) and create the company + branches.
        set({ business: { ...business, id: undefined, plan: "por-vacante" } });
        return ensureBusiness();
      },

      completeOnboarding: (role) => {
        const s = get();
        if (s.mode === "demo" || (s.mode === null && !isLiveAvailable)) {
          // Demo-only build: onboarding finishes into the demo with the visitor's own answers.
          set({ onboarded: true, role, signedIn: true, mode: "demo" });
          return DONE;
        }
        if (s.mode === null) {
          // Live build, no account yet: keep it as a draft. It's pushed when they sign in.
          set({ onboarded: true, role });
          return DONE;
        }
        set({ onboarded: true, role, signedIn: true });
        return pushOnboarding(role);
      },

      signIn: (role) => {
        const s = get();
        if (s.mode === null) get().enterDemo(role);
        else if (s.mode === "demo") set({ role, signedIn: true });
        // Live sessions come from Supabase Auth; here we only switch the role.
        else void get().setRole(role);
      },

      signOut: () => {
        if (get().mode === "live") {
          wipe();
          void api.signOutLocal();
        } else set({ signedIn: false });
      },

      unlockJob: (jobId) => {
        if (isLive()) return; // payments: Próximamente
        set((s) => (s.unlockedJobIds.includes(jobId) ? s : { unlockedJobIds: [...s.unlockedJobIds, jobId] }));
      },

      addLocation: (branch) => {
        if (!isLive()) {
          const id = `suc-${Date.now().toString(36)}`;
          set((s) => {
            const b = s.business ?? demoBusiness();
            return { business: { ...b, locations: [...b.locations, { ...branch, id }] } };
          });
          return id;
        }
        const companyId = get().business?.id;
        if (!companyId) {
          toast.error(api.MSG.noCompany);
          return "";
        }
        const tmp = `tmp-${Date.now().toString(36)}`;
        void createLocation(companyId, tmp, branch);
        return tmp;
      },

      addLocationAsync: async (branch) => {
        if (!isLive()) return { id: get().addLocation(branch) };
        const companyId = get().business?.id;
        if (!companyId) {
          toast.error(api.MSG.noCompany);
          return { error: api.MSG.noCompany };
        }
        return createLocation(companyId, `tmp-${Date.now().toString(36)}`, branch);
      },

      updateLocation: async (id, patch) => {
        if (!isLive()) {
          set((s) => {
            const b = s.business ?? demoBusiness();
            return { business: { ...b, locations: b.locations.map((l) => (l.id === id ? { ...l, ...patch } : l)) } };
          });
          return {};
        }
        const before = get().business?.locations.find((l) => l.id === id);
        if (!before) return {};
        patchLocation(id, patch);
        const serverId = await resolveBranchId(id);
        if (!serverId) return { error: api.MSG.save };
        return sync(
          async () => {
            const r = await api.updateBranch(serverId, patch);
            if (!r.error) emitLive("catalog", "myCompany");
            return r;
          },
          () => patchLocation(serverId, { name: before.name, colonia: before.colonia, location: before.location }),
        );
      },

      removeLocation: async (id) => {
        if (!isLive()) {
          set((s) => {
            const b = s.business ?? demoBusiness();
            if (b.locations.length <= 1) return s;
            return { business: { ...b, locations: b.locations.filter((l) => l.id !== id) } };
          });
          return {};
        }
        const b = get().business;
        const index = b?.locations.findIndex((l) => l.id === id) ?? -1;
        if (!b?.id || index < 0) return {};
        if (b.locations.length <= 1) {
          toast.error(api.MSG.lastBranch);
          return { error: api.MSG.lastBranch };
        }
        const removed = b.locations[index];
        setLocations((ls) => ls.filter((l) => l.id !== id));
        const serverId = await resolveBranchId(id);
        if (!serverId) return { error: api.MSG.save };
        return sync(
          async () => {
            const r = await api.removeBranch(serverId);
            if (!r.error) emitLive("catalog", "myCompany");
            return r;
          },
          () =>
            setLocations((ls) =>
              ls.some((l) => l.id === serverId) ? ls : [...ls.slice(0, index), { ...removed, id: serverId }, ...ls.slice(index)],
            ),
        );
      },
    }),
    {
      name: "chamba-a-lado",
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      version: 6,
      migrate: (persisted, version) => {
        const s = persisted as Record<string, unknown> & { business?: (Record<string, unknown> & { plan?: string }) | null };
        // v0 → v1: the per-hire plan was replaced by per-vacancy-per-month billing.
        if (version < 1 && s.business?.plan === "por-contratacion") s.business = { ...s.business, plan: "por-vacante" };
        // v1 → v2: a business had one colonia/location; now it has a list of locations.
        if (version < 2 && s.business && !Array.isArray(s.business.locations)) {
          const { colonia, location, ...rest } = s.business as { colonia?: string; location?: LatLng };
          s.business = {
            ...rest,
            locations: colonia && location ? [{ id: "suc-principal", name: "Principal", colonia, location }] : [],
          };
        }
        // v2 → v3: modes. Everything persisted before is the demo (keep it, keep them signed in).
        if (version < 3) Object.assign(s, { mode: "demo", userId: null, email: "", hasHome: true });
        // v3 → v4: email preferences (on by default, like the server columns).
        if (version < 4) {
          if (typeof s.emailAlerts !== "boolean") s.emailAlerts = true;
          if (typeof s.emailUpdates !== "boolean") s.emailUpdates = true;
        }
        // v4 → v5: the optional richer profile. Empty defaults; the curated demo (Mariana) gets her
        // partly-filled profile so the strength meter has something to show.
        if (version < 5) {
          const seed = s.mode === "demo" && s.name === "Mariana" ? DEMO_EXTRAS : EMPTY_PROFILE_EXTRAS;
          for (const [k, v] of Object.entries(seed)) if (s[k] === undefined) s[k] = v;
          if (!Array.isArray(s.workExperiences)) s.workExperiences = [];
          for (const k of ["serverStrength", "cvFileName", "demoAvatarUrl"]) if (s[k] === undefined) s[k] = null;
        }
        // v5 → v6: "Crea tu avatar". Nobody has saved one yet; the curated demo gets a look that fits Mariana.
        if (version < 6) {
          s.avatarConfig =
            s.avatarConfig != null
              ? sanitizeAvatar(s.avatarConfig)
              : s.mode === "demo" && s.name === "Mariana"
                ? AVATAR_PRESETS.caja.config
                : null;
          if (typeof s.avatarSaved !== "boolean") s.avatarSaved = false;
          if (typeof s.avatarLocalOnly !== "boolean") s.avatarLocalOnly = false;
        }
        return s as unknown as State;
      },
    },
  ),
);

// ------------------------------------------------------------------ write-through machinery

const get = () => useApp.getState();
const set = (patch: Partial<UserData> | ((s: State) => Partial<UserData>)) => useApp.setState(patch);
const isLive = () => get().mode === "live";

function pick<K extends keyof UserData>(s: UserData, keys: K[]): Pick<UserData, K> {
  return Object.fromEntries(keys.map((k) => [k, s[k]])) as Pick<UserData, K>;
}

/** Bumped whenever the user changes, so late server replies can't touch the next user's state. */
let generation = 0;

/** Runs a live write; on error (if still the same user) undoes the optimistic change and toasts. */
async function sync(run: () => Promise<WriteResult>, undo: () => void): Promise<WriteResult> {
  const gen = generation;
  const r = await run();
  if (r.error && gen === generation && isLive()) {
    undo();
    toast.error(r.error);
  }
  return r;
}

// Profile fields are debounced and batched (the name field writes on every keystroke).
type ExtraKey = keyof ProfileExtrasPatch;
type ProfileKey = "name" | "phone" | "role" | "interests" | "experience" | "radiusKm" | "emailAlerts" | "emailUpdates" | ExtraKey;
type ProfileValues = Pick<UserData, ProfileKey>;
/** The optional richer-profile fields (debounced like the rest; photo/CV paths are written by profile-files). */
const EXTRA_KEYS: ExtraKey[] = [
  "headline",
  "about",
  "education",
  "skills",
  "certifications",
  "languages",
  "shifts",
  "availableFrom",
  "transport",
  "expectedPay",
  "expectedPeriod",
];
const PROFILE_KEYS: ProfileKey[] = ["name", "phone", "role", "interests", "experience", "radiusKm", "emailAlerts", "emailUpdates", ...EXTRA_KEYS];
/** What onboarding asks for. Email preferences aren't part of it, so it never overwrites them. */
const ONBOARDING_KEYS = ["name", "phone", "role", "interests", "experience", "radiusKm"] as const satisfies ProfileKey[];
/** Server-owned until the user changes them here (an unsubscribe link may have turned them off). */
const EMAIL_KEYS = ["emailAlerts", "emailUpdates"] as const satisfies ProfileKey[];
const PROFILE_DEBOUNCE_MS = 600;

/** Last values the server confirmed (rollback target). */
let confirmed: Partial<ProfileValues> = {};
let pendingProfile: Partial<ProfileValues> = {};
let profileWaiters: ((r: WriteResult) => void)[] = [];
let profileTimer: ReturnType<typeof setTimeout> | null = null;
let profileFlight: Promise<WriteResult> | null = null;

const same = (a: unknown, b: unknown) => a === b || JSON.stringify(a) === JSON.stringify(b);

function toProfilePatch(v: Partial<ProfileValues>): api.ProfilePatch {
  const p: api.ProfilePatch = {};
  if (v.name !== undefined) p.name = v.name.trim();
  if (v.phone !== undefined) p.phone = v.phone || null;
  if (v.role !== undefined) p.role = v.role;
  if (v.interests !== undefined) p.interests = v.interests;
  if (v.experience !== undefined) p.experience = v.experience;
  if (v.radiusKm !== undefined) p.radius_km = v.radiusKm;
  if (v.emailAlerts !== undefined) p.email_alerts = v.emailAlerts;
  if (v.emailUpdates !== undefined) p.email_updates = v.emailUpdates;
  const text = (t: string | null, max: number) => (t ?? "").trim().slice(0, max) || null;
  const list = (l: readonly string[], max: number) => [...new Set(l.map((x) => x.trim()).filter(Boolean))].slice(0, max);
  if (v.headline !== undefined) p.headline = text(v.headline, PROFILE_LIMITS.headlineMax);
  if (v.about !== undefined) p.about = text(v.about, PROFILE_LIMITS.aboutMax);
  if (v.education !== undefined) p.education = v.education;
  if (v.skills !== undefined) p.skills = list(v.skills, PROFILE_LIMITS.skillsMax);
  if (v.certifications !== undefined) p.certifications = list(v.certifications, PROFILE_LIMITS.certificationsMax);
  if (v.languages !== undefined) p.languages = list(v.languages, PROFILE_LIMITS.languagesMax);
  if (v.shifts !== undefined) p.shifts = [...new Set(v.shifts)];
  if (v.availableFrom !== undefined) p.available_from = v.availableFrom;
  if (v.transport !== undefined) p.transport = [...new Set(v.transport)];
  if (v.expectedPay !== undefined) {
    const pay = v.expectedPay === null ? null : Math.round(v.expectedPay);
    p.expected_pay = pay !== null && pay >= PROFILE_LIMITS.expectedPayMin && pay <= PROFILE_LIMITS.expectedPayMax ? pay : null;
  }
  if (v.expectedPeriod !== undefined) p.expected_period = v.expectedPeriod;
  return p;
}

function writeProfile<K extends ProfileKey>(key: K, value: ProfileValues[K]): Promise<WriteResult> {
  return writeProfileMany({ [key]: value } as Partial<ProfileValues>);
}

/** Sets several profile fields at once (one debounced write in live). */
function writeProfileMany(patch: Partial<ProfileValues>): Promise<WriteResult> {
  const keys = Object.keys(patch) as ProfileKey[];
  if (!keys.length) return DONE;
  const live = isLive();
  if (live) for (const k of keys) if (!(k in confirmed)) confirmed = { ...confirmed, [k]: get()[k] };
  set(patch as Partial<UserData>);
  if (!live) return DONE;
  pendingProfile = { ...pendingProfile, ...patch };
  if (profileTimer) clearTimeout(profileTimer);
  profileTimer = setTimeout(() => void flushProfileWrites(), PROFILE_DEBOUNCE_MS);
  return new Promise((resolve) => profileWaiters.push(resolve));
}

/** Keeps only editable keys with sane values (lists capped, pay a whole number). */
function cleanExtrasPatch(patch: ProfileExtrasPatch): Partial<ProfileValues> {
  const out: Partial<ProfileValues> = {};
  for (const k of EXTRA_KEYS) if (patch[k] !== undefined) Object.assign(out, { [k]: patch[k] });
  if (out.skills) out.skills = out.skills.slice(0, PROFILE_LIMITS.skillsMax);
  if (out.certifications) out.certifications = out.certifications.slice(0, PROFILE_LIMITS.certificationsMax);
  if (out.languages) out.languages = out.languages.slice(0, PROFILE_LIMITS.languagesMax);
  if (out.headline != null) out.headline = out.headline.slice(0, PROFILE_LIMITS.headlineMax);
  if (out.about != null) out.about = out.about.slice(0, PROFILE_LIMITS.aboutMax);
  if (out.expectedPay != null) out.expectedPay = Number.isFinite(out.expectedPay) ? Math.round(out.expectedPay) : null;
  return out;
}

/** A store action's validation failure: toast (like server errors) and return it. */
function fail(error: string): WriteResult {
  toast.error(error);
  return { error };
}

/** Sends any debounced profile edits now (also called when the page is hidden). */
export async function flushProfileWrites(): Promise<WriteResult> {
  if (profileTimer) {
    clearTimeout(profileTimer);
    profileTimer = null;
  }
  if (profileFlight) await profileFlight;
  const batch = pendingProfile;
  const waiters = profileWaiters;
  pendingProfile = {};
  profileWaiters = [];
  if (!Object.keys(batch).length || !isLive()) {
    for (const w of waiters) w({});
    return {};
  }
  const gen = generation;
  const flight = (async (): Promise<WriteResult> => {
    const r = await api.saveProfile(toProfilePatch(batch));
    if (gen !== generation) return r;
    if (r.error) {
      const s = get() as unknown as Record<string, unknown>;
      const undo: Record<string, unknown> = {};
      for (const k of Object.keys(batch) as ProfileKey[]) {
        // Only undo fields the user hasn't changed again since.
        if (k in confirmed && same(s[k], batch[k]) && !(k in pendingProfile)) undo[k] = confirmed[k];
      }
      if (isLive()) {
        set(undo as Partial<UserData>);
        toast.error(r.error);
      }
    } else confirmed = { ...confirmed, ...batch };
    return r;
  })();
  profileFlight = flight;
  const r = await flight;
  if (profileFlight === flight) profileFlight = null;
  for (const w of waiters) w(r);
  return r;
}

let creatingBusiness: Promise<WriteResult> | null = null;
let onboardingFlight: Promise<WriteResult> | null = null;

function toBusiness(c: LiveCompany): Business {
  return {
    id: c.id,
    name: c.name,
    kind: c.kind,
    size: c.size,
    locations: c.branches,
    phone: c.phone ?? "",
    plan: c.plan,
    verified: c.verified,
    about: c.about,
    employees: c.employees,
  };
}

/** Creates the live company from the local draft once (concurrent callers share the request). */
function ensureBusiness(): Promise<WriteResult> {
  if (creatingBusiness) return creatingBusiness;
  const draft = get().business;
  if (!draft || draft.id || !isLive()) return DONE;
  const gen = generation;
  creatingBusiness = (async (): Promise<WriteResult> => {
    const r = await api.createBusiness({
      name: draft.name,
      kind: draft.kind,
      size: draft.size,
      phone: draft.phone,
      about: draft.about,
      employees: draft.employees,
      locations: draft.locations.map(({ name, colonia, location }) => ({ name, colonia, location })),
    });
    if (gen !== generation) return r.error !== undefined ? { error: r.error } : {};
    if (r.error !== undefined) {
      // Keep the draft (no id) so what they typed isn't lost; setBusiness/completeOnboarding retries.
      toast.error(r.error);
      return { error: r.error };
    }
    set({ business: toBusiness(r.data) });
    emitLive("catalog", "myCompany");
    return {};
  })().finally(() => {
    creatingBusiness = null;
  });
  return creatingBusiness;
}

/** Pushes the whole onboarding (home, business, profile) and marks the profile onboarded. */
function pushOnboarding(role: Role): Promise<WriteResult> {
  if (onboardingFlight) return onboardingFlight;
  const gen = generation;
  const fail = (error: string): WriteResult => {
    if (gen === generation) toast.error(error);
    return { error };
  };
  onboardingFlight = (async (): Promise<WriteResult> => {
    await flushProfileWrites();
    let s = get();
    if (s.hasHome) {
      const h = await api.setHome(s.home, s.colonia, s.locationSource);
      if (h.error) return fail(h.error);
    }
    if (role === "empresa" && s.business && !s.business.id) {
      const b = await ensureBusiness(); // toasts its own error
      if (b.error) return b;
    }
    s = get();
    const values = pick(s, [...ONBOARDING_KEYS]);
    const p = await api.saveProfile({ ...toProfilePatch({ ...values, role }), onboarded: true });
    if (p.error) return fail(p.error);
    if (gen === generation) confirmed = { ...confirmed, ...values, role };
    return {};
  })().finally(() => {
    onboardingFlight = null;
  });
  return onboardingFlight;
}

// Branch ids: live branches get a temporary id until add_branch answers.
const pendingBranchIds = new Map<string, Promise<string | null>>();

function setLocations(fn: (ls: Branch[]) => Branch[]) {
  set((s) => (s.business ? { business: { ...s.business, locations: fn(s.business.locations) } } : {}));
}

function patchLocation(id: string, patch: Partial<Omit<Branch, "id">>) {
  setLocations((ls) => ls.map((l) => (l.id === id ? { ...l, ...patch } : l)));
}

async function resolveBranchId(id: string): Promise<string | null> {
  return pendingBranchIds.get(id) ?? id;
}

async function createLocation(companyId: string, tmp: string, branch: Omit<Branch, "id">): Promise<WriteResult & { id?: string }> {
  const gen = generation;
  setLocations((ls) => [...ls, { ...branch, id: tmp }]);
  const request = api.addBranch(companyId, branch);
  pendingBranchIds.set(
    tmp,
    request.then((r) => r.data ?? null),
  );
  const r = await request;
  pendingBranchIds.delete(tmp);
  if (gen !== generation) return r.error !== undefined ? { error: r.error } : { id: r.data };
  if (r.error !== undefined) {
    setLocations((ls) => ls.filter((l) => l.id !== tmp));
    if (isLive()) toast.error(r.error);
    return { error: r.error };
  }
  const id = r.data;
  // Keep any edits made while saving; just swap in the real id.
  setLocations((ls) => ls.map((l) => (l.id === tmp ? { ...l, id } : l)));
  emitLive("catalog", "myCompany");
  return { id };
}

// Work history: live rows get a temporary id until the insert answers.
const pendingExperienceIds = new Map<string, Promise<string | null>>();
/** Writes that loadSession should wait for (work history, photo/CV path changes). */
const inFlight = new Set<Promise<unknown>>();

/** Registers a write so waitForPendingWrites() (and so loadSession) waits for it. */
export function trackWrite<T>(p: Promise<T>): Promise<T> {
  inFlight.add(p);
  void p.finally(() => inFlight.delete(p)).catch(() => undefined);
  return p;
}

// Avatar: one explicit save at a time (not debounced like the text fields).
/** Avatar saves still waiting for the server (a session load then keeps the local value). */
let avatarWrites = 0;

/** Writes the avatar to profiles.avatar_config. `prev`: what to restore if the server refuses it. */
async function pushAvatar(config: AvatarConfig | null, prev?: Pick<UserData, "avatarConfig" | "avatarSaved" | "avatarLocalOnly">): Promise<WriteResult> {
  const gen = generation;
  avatarWrites++;
  let r: api.AvatarWriteResult;
  try {
    r = await trackWrite(api.saveAvatarConfig(config));
  } finally {
    if (gen === generation) avatarWrites = Math.max(0, avatarWrites - 1);
  }
  if (gen !== generation || !isLive()) return r.error ? { error: r.error } : {};
  if (r.missingColumn) {
    // Fail soft: the database can't store it yet. Keep it here; the builder says so quietly.
    if (!get().avatarLocalOnly) set({ avatarLocalOnly: true });
    return {};
  }
  if (r.error) {
    // Undo only if the user hasn't picked another avatar since.
    if (prev && same(get().avatarConfig, config)) set(prev);
    toast.error(r.error);
    return { error: r.error };
  }
  if (get().avatarLocalOnly && same(get().avatarConfig, config)) set({ avatarLocalOnly: false });
  return {};
}

function normalizeExperience(e: WorkExperience): WorkExperience {
  return {
    title: e.title.trim(),
    company: e.company?.trim() || null,
    category: e.category ?? null,
    startMonth: e.startMonth || null,
    endMonth: e.isCurrent ? null : e.endMonth || null,
    isCurrent: !!e.isCurrent,
    description: e.description?.trim() || null,
  };
}

function stripId(e: StoredExperience): WorkExperience {
  return normalizeExperience(e);
}

function patchExperience(id: string, values: WorkExperience) {
  set((s) => ({ workExperiences: s.workExperiences.map((e) => (e.id === id ? { ...values, id } : e)) }));
}

async function resolveExperienceId(id: string): Promise<string | null> {
  return pendingExperienceIds.get(id) ?? id;
}

async function createExperience(entry: WorkExperience): Promise<WriteResult & { id?: string }> {
  const gen = generation;
  const tmp = `tmp-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
  const sort = get().workExperiences.length;
  set((s) => ({ workExperiences: [...s.workExperiences, { ...entry, id: tmp }] }));
  const request = trackWrite(api.insertExperience(entry, sort));
  pendingExperienceIds.set(
    tmp,
    request.then((r) => r.data ?? null),
  );
  const r = await request;
  pendingExperienceIds.delete(tmp);
  if (gen !== generation) return r.error !== undefined ? { error: r.error } : { id: r.data };
  if (r.error !== undefined) {
    set((s) => ({ workExperiences: s.workExperiences.filter((e) => e.id !== tmp) }));
    if (isLive()) toast.error(r.error);
    return { error: r.error };
  }
  const id = r.data;
  // Keep edits made while saving (updateExperience waits for this id); just swap it in.
  set((s) => ({ workExperiences: s.workExperiences.map((e) => (e.id === tmp ? { ...e, id } : e)) }));
  return { id };
}

/** Drops queued writes and in-flight bookkeeping (the user is changing). */
function resetLiveWork() {
  generation++;
  if (profileTimer) clearTimeout(profileTimer);
  profileTimer = null;
  for (const w of profileWaiters) w({});
  profileWaiters = [];
  pendingProfile = {};
  confirmed = {};
  pendingBranchIds.clear();
  pendingExperienceIds.clear();
  avatarWrites = 0;
}

/** Back to a signed-out visitor, with no trace of the previous user (demo or live). */
function wipe() {
  resetLiveWork();
  set({ ...BLANK });
  emitLive("reset");
}

// ------------------------------------------------------------------ live session plumbing
// Used by @/lib/live (LiveSession / loadSession). Screens don't call these.

/** Adopts a Supabase user. Returns "same" if this user's data is already loaded locally. */
export function adoptLiveUser(user: { id: string; email?: string | null }): "same" | "new" {
  const s = get();
  if (s.mode === "live" && s.userId === user.id) {
    if (!s.signedIn || (user.email && user.email !== s.email)) set({ signedIn: true, email: user.email ?? s.email });
    return "same";
  }
  // Another account (or the demo) was here: start clean. A visitor's onboarding draft is kept.
  if (s.mode !== null) wipe();
  set({ mode: "live", signedIn: true, userId: user.id, email: user.email ?? "" });
  return "new";
}

/** Signs out of live state locally (the Supabase session is handled by the caller). */
export function wipeLiveState() {
  wipe();
}

/** Resolves once queued and in-flight writes (profile, business, onboarding) have settled. */
export async function waitForPendingWrites(): Promise<void> {
  await flushProfileWrites();
  await Promise.allSettled([creatingBusiness, onboardingFlight, ...inFlight].filter(Boolean));
}

/** Applies what the server holds for the signed-in user. Pending local edits win over it. */
export function applyLiveSnapshot(d: LiveSessionData) {
  const s = get();
  if (s.mode !== "live") return;
  const p = d.profile;
  const pending = new Set(Object.keys(pendingProfile));
  const server: ProfileValues = {
    name: p.name,
    phone: p.phone ?? "",
    role: p.role,
    interests: p.interests,
    experience: p.experience,
    radiusKm: p.radiusKm,
    emailAlerts: p.emailAlerts,
    emailUpdates: p.emailUpdates,
    headline: p.extras.headline,
    about: p.extras.about,
    education: p.extras.education,
    skills: p.extras.skills,
    certifications: p.extras.certifications,
    languages: p.extras.languages,
    shifts: p.extras.shifts,
    availableFrom: p.extras.availableFrom,
    transport: p.extras.transport,
    expectedPay: p.extras.expectedPay,
    expectedPeriod: p.extras.expectedPeriod,
  };
  const patch: Partial<UserData> = {
    signedIn: true,
    email: p.email || s.email,
    applications: d.applications,
    saved: d.saved,
    unlockedJobIds: d.unlockedJobIds,
    serverStrength: p.strength,
  };
  // The optional profile isn't part of onboarding: the server holds it in both branches below,
  // except fields with an edit still queued here. Photo/CV paths and the work history likewise,
  // unless a write to them is still in flight.
  for (const k of EXTRA_KEYS) if (!pending.has(k)) Object.assign(patch, { [k]: server[k] });
  if (inFlight.size === 0) {
    patch.avatarPath = p.extras.avatarPath;
    patch.cvPath = p.extras.cvPath;
    // The file name is only remembered for the CV uploaded from this device.
    if (p.extras.cvPath !== s.cvPath) patch.cvFileName = null;
    if (d.experiences) patch.workExperiences = d.experiences;
  }
  const home = p.home ? { home: p.home, colonia: p.colonia ?? "", locationSource: p.locationSource, hasHome: true } : null;
  if (p.onboarded) {
    patch.onboarded = true;
    for (const k of PROFILE_KEYS) if (!pending.has(k)) Object.assign(patch, { [k]: server[k] });
    Object.assign(patch, home ?? { hasHome: false, home: SALTILLO_CENTER, colonia: BLANK.colonia });
    patch.business = d.company ? toBusiness(d.company) : null;
  } else {
    // Still onboarding: keep what they typed here; the server only knows the role picked at sign-up.
    if (!s.onboarded && !pending.has("role")) patch.role = p.role;
    for (const k of EMAIL_KEYS) if (!pending.has(k)) patch[k] = server[k];
    if (home && !s.hasHome) Object.assign(patch, home);
    if (d.company) patch.business = toBusiness(d.company);
  }
  // Avatar: the server's copy, unless a save is still on its way. While the database can't store it
  // (migration pending) the device copy stays; a copy saved only here is uploaded once it can.
  let uploadAvatar: AvatarConfig | null = null;
  if (!p.avatarStored) patch.avatarLocalOnly = true;
  else if (avatarWrites === 0) {
    if (p.avatar === null && s.avatarLocalOnly && s.avatarSaved && s.avatarConfig) uploadAvatar = s.avatarConfig;
    else Object.assign(patch, { avatarConfig: p.avatar, avatarSaved: p.avatar !== null, avatarLocalOnly: false });
  }
  confirmed = server;
  set(patch);
  if (uploadAvatar) void pushAvatar(uploadAvatar);
}

// ------------------------------------------------------------------ hooks & helpers

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

/**
 * The signed-in user's illustrated avatar, ready for <Avatar config=…/> / <AvatarCircle/>: what they saved in
 * "Crea tu avatar", else a deterministic look seeded by their user id (live) or name. Stable reference.
 */
export function useMyAvatar(): AvatarConfig {
  const saved = useApp((s) => s.avatarConfig);
  const seed = useApp((s) => s.userId || s.name.trim() || "chambarrio");
  return useMemo(() => (saved ? sanitizeAvatar(saved) : randomAvatar(seed)), [saved, seed]);
}

/** "demo" | "live" | null (visitor). */
export function useMode(): AppMode | null {
  return useApp((s) => s.mode);
}

export function useIsLive(): boolean {
  return useApp((s) => s.mode === "live");
}

/** Paid unlocks / plans work only in the demo for now; live shows "Próximamente". */
export function usePaymentsEnabled(): boolean {
  return useApp((s) => s.mode !== "live");
}

/** Price to unlock one vacancy's applicants for a month, in MXN. */
export const UNLOCK_PRICE = 500;
/** The demo business (no registered business yet) is on the free per-vacancy plan. */
export const DEMO_PLAN: PlanId = "por-vacante";

/** The seeded demo company as an editable Business (used the first time a demo employer edits branches). */
function demoBusiness(): Business {
  const c = COMPANY_BY_ID[DEMO_COMPANY_ID];
  return { name: c.name, kind: c.kind, size: c.size, locations: c.locations, phone: "", plan: DEMO_PLAN };
}

const NO_BRANCHES: Branch[] = [];

/** The employer's locations: their own business, or (demo only) the demo company's branches. */
export function useEmployerLocations(): Branch[] {
  // Visitors in a live-capable build (and the first render before hydration) never get the mock branches.
  return useApp(
    (s) =>
      s.business?.locations ??
      (s.mode === "demo" || (s.mode === null && !isLiveAvailable) ? COMPANY_BY_ID[DEMO_COMPANY_ID].locations : NO_BRANCHES),
  );
}

export function useEmployerPlan(): PlanId {
  return useApp((s) => s.business?.plan ?? DEMO_PLAN);
}

/** Subscriptions include applicants; on the per-vacancy plan each vacancy is unlocked separately. */
export function useIsUnlocked(): (jobId: string) => boolean {
  const plan = useEmployerPlan();
  const ids = useApp((s) => s.unlockedJobIds);
  return (jobId) => plan !== "por-vacante" || ids.includes(jobId);
}

"use client";

import { useEffect, useMemo } from "react";
import { create } from "zustand";
import { getSupabase } from "@/lib/supabase/client";
import type { Json } from "@/lib/supabase/database.types";
import { APPLICANTS, demoProfile, type AvatarArt, type DemoPersonKey } from "@/lib/data/applicants";
import type { ApplicationStatus, CategoryId, Experience, PayPeriod, Shift } from "@/lib/data/types";
import { useMyCompany, type CatalogStatus } from "@/lib/data/catalog";
import { useApp } from "@/lib/store";
import {
  EDUCATION_LEVELS,
  SHIFTS,
  START_AVAILABILITIES,
  TRANSPORTS,
  strengthOf,
  type CandidateProfileExtras,
  type EducationLevel,
  type StartAvailability,
  type Transport,
  type WorkExperience,
} from "@/lib/profile-strength";
import { useApplicants, type ApplicantView } from "./applicants";
import { friendlyError, MSG, type WriteResult } from "./backend";
import { onLive } from "./events";

/*
 * Richer applicant cards for the company, both modes, one shape (ApplicantProfile):
 *  - live: useApplicants() (job_applicants: status, unlocks, optimistic status changes) enriched with
 *    job_applicants_detail(p_job_id) (strength, profile, work history, contact only while unlocked) and
 *    1 h signed URLs for the photo / CV from the private "avatars" / "cvs" buckets. If the detail RPC
 *    fails, the cards fall back to the plain rows (strength null).
 *  - demo: the mock applicants + DEMO_PROFILES. Never touches Supabase.
 */

export type ApplicantDetails = Omit<CandidateProfileExtras, "avatarPath" | "cvPath">;

export type ApplicantProfile = {
  /** Application id (demo radar: the candidate id). */
  id: string;
  jobId: string | null;
  /** null for people who didn't apply (demo talent radar). */
  status: ApplicationStatus | null;
  colonia: string;
  km: number | null;
  minutesAgo: number;
  /** Contact (name, phone, photo, CV) is visible. */
  unlocked: boolean;
  experience: Experience;
  interests: CategoryId[];
  /** 0–100; null when only the basic row could be loaded. */
  strength: number | null;
  details: ApplicantDetails;
  /** Most recent first. */
  experiences: WorkExperience[];
  hasPhoto: boolean;
  hasCv: boolean;
  /** Only while unlocked. */
  name: string | null;
  phone: string | null;
  /** Live: signed URL of the photo (unlocked only). */
  photoUrl: string | null;
  /** Demo: illustrated stand-in for the photo. */
  photoArt: AvatarArt | null;
  /** Live: storage path of the CV (unlocked only), to re-sign a stale link. */
  cvPath: string | null;
  /** Live: signed URL of the CV, valid ~1 h from `signedAt`. */
  cvUrl: string | null;
  signedAt: number | null;
  demo: boolean;
};

export const EMPTY_DETAILS: ApplicantDetails = {
  headline: null,
  about: null,
  education: null,
  skills: [],
  certifications: [],
  languages: [],
  shifts: [],
  availableFrom: null,
  transport: [],
  expectedPay: null,
  expectedPeriod: null,
};

// ------------------------------------------------------------------ demo

type DemoBase = {
  id: string;
  jobId: string | null;
  status: ApplicationStatus | null;
  name: string;
  colonia: string;
  km: number;
  experience: Experience;
  minutesAgo: number;
  unlocked: boolean;
};

/** Builds a demo card from a mock row + its person's profile (pure, no Supabase). */
export function demoApplicantProfile(base: DemoBase, person: DemoPersonKey): ApplicantProfile {
  const p = demoProfile(person);
  const details: ApplicantDetails = {
    ...EMPTY_DETAILS,
    headline: p.headline ?? null,
    about: p.about ?? null,
    education: p.education ?? null,
    skills: p.skills ?? [],
    certifications: p.certifications ?? [],
    languages: p.languages ?? [],
    shifts: p.shifts ?? [],
    availableFrom: p.availableFrom ?? null,
    transport: p.transport ?? [],
    expectedPay: p.expectedPay ?? null,
    expectedPeriod: p.expectedPeriod ?? null,
  };
  const experiences = sortExperiences(p.experiences ?? []);
  const strength = strengthOf({
    ...details,
    name: base.name,
    phone: p.phone,
    hasHome: true,
    interests: p.interests,
    experiences,
    hasPhoto: !!p.photo,
    hasCv: !!p.cv,
  });
  return {
    id: base.id,
    jobId: base.jobId,
    status: base.status,
    colonia: base.colonia,
    km: base.km,
    minutesAgo: base.minutesAgo,
    unlocked: base.unlocked,
    experience: base.experience,
    interests: p.interests,
    strength,
    details,
    experiences,
    hasPhoto: !!p.photo,
    hasCv: !!p.cv,
    name: base.unlocked ? base.name : null,
    phone: base.unlocked ? p.phone : null,
    photoUrl: null,
    photoArt: base.unlocked ? (p.photo ?? null) : null,
    cvPath: null,
    cvUrl: null,
    signedAt: null,
    demo: true,
  };
}

const APPLICANT_BY_ID = Object.fromEntries(APPLICANTS.map((a) => [a.id, a]));

// ------------------------------------------------------------------ live parsing

type DetailRow = {
  id: string;
  strength: number;
  unlocked: boolean;
  details: ApplicantDetails;
  experiences: WorkExperience[];
  hasPhoto: boolean;
  hasCv: boolean;
  name: string | null;
  phone: string | null;
  avatarPath: string | null;
  cvPath: string | null;
  photoUrl: string | null;
  cvUrl: string | null;
};

type Obj = Record<string, Json | undefined>;
const isObj = (v: Json | undefined): v is Obj => !!v && typeof v === "object" && !Array.isArray(v);
const str = (v: Json | undefined): string | null => (typeof v === "string" && v.trim() ? v : null);
const num = (v: Json | undefined): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const strs = (v: Json | undefined): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && !!x.trim()) : []);
function oneOf<T extends string>(v: Json | undefined, allowed: readonly T[]): T | null {
  return typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : null;
}
function manyOf<T extends string>(v: Json | undefined, allowed: readonly T[]): T[] {
  return strs(v).filter((x): x is T => (allowed as readonly string[]).includes(x));
}
const PERIODS: readonly PayPeriod[] = ["semana", "quincena", "mes", "dia"];

function parseDetails(v: Json): ApplicantDetails {
  if (!isObj(v)) return EMPTY_DETAILS;
  return {
    headline: str(v.headline),
    about: str(v.about),
    education: oneOf<EducationLevel>(v.education, EDUCATION_LEVELS),
    skills: strs(v.skills),
    certifications: strs(v.certifications),
    languages: strs(v.languages),
    shifts: manyOf<Shift>(v.shifts, SHIFTS),
    availableFrom: oneOf<StartAvailability>(v.available_from, START_AVAILABILITIES),
    transport: manyOf<Transport>(v.transport, TRANSPORTS),
    expectedPay: num(v.expected_pay),
    expectedPeriod: oneOf<PayPeriod>(v.expected_period, PERIODS),
  };
}

function parseExperiences(v: Json): WorkExperience[] {
  if (!Array.isArray(v)) return [];
  return v.filter(isObj).flatMap((e): WorkExperience[] => {
    const title = str(e.title);
    if (!title) return [];
    return [
      {
        title,
        company: str(e.company),
        category: str(e.category) as CategoryId | null,
        startMonth: str(e.start_month),
        endMonth: str(e.end_month),
        isCurrent: e.is_current === true,
        description: str(e.description),
      },
    ];
  });
}

/** Current job first, then by end month (most recent first). */
function sortExperiences(list: WorkExperience[]): WorkExperience[] {
  const key = (e: WorkExperience) => (e.isCurrent ? "9999" : (e.endMonth ?? e.startMonth ?? ""));
  return list.toSorted((a, b) => key(b).localeCompare(key(a)));
}

/** Signs many paths of one bucket at once; a failure just leaves the URLs null. */
async function signAll(bucket: "avatars" | "cvs", paths: string[]): Promise<Record<string, string>> {
  const sb = getSupabase();
  if (!sb || paths.length === 0) return {};
  try {
    const { data, error } = await sb.storage.from(bucket).createSignedUrls(paths, SIGNED_TTL_S);
    if (error || !data) return {};
    return Object.fromEntries(data.flatMap((d) => (d.path && d.signedUrl ? [[d.path, d.signedUrl]] : [])));
  } catch {
    return {};
  }
}

const SIGNED_TTL_S = 3600;
/** Re-sign links older than this before opening them. */
const SIGNED_FRESH_MS = 50 * 60 * 1000;

type DetailResult = { data: DetailRow[]; signedAt: number; error?: undefined } | { data?: undefined; signedAt?: undefined; error: string };

async function fetchDetails(jobId: string): Promise<DetailResult> {
  const sb = getSupabase();
  if (!sb) return { error: MSG.unavailable };
  try {
    const { data, error } = await sb.rpc("job_applicants_detail", { p_job_id: jobId });
    if (error) return { error: friendlyError(error, MSG.load) };
    const rows = (data ?? []).map((r): DetailRow => {
      const p = isObj(r.profile) ? r.profile : {};
      const c = r.unlocked && isObj(r.contact) ? r.contact : null;
      return {
        id: r.application_id,
        strength: Math.max(0, Math.min(100, Math.round(r.strength ?? 0))),
        unlocked: r.unlocked,
        details: parseDetails(r.profile),
        experiences: sortExperiences(parseExperiences(r.experiences)),
        hasPhoto: p.has_photo === true,
        hasCv: p.has_cv === true,
        name: c ? str(c.name) : null,
        phone: c ? str(c.phone) : null,
        avatarPath: c ? str(c.avatar_path) : null,
        cvPath: c ? str(c.cv_path) : null,
        photoUrl: null,
        cvUrl: null,
      };
    });
    const signedAt = Date.now();
    const [avatars, cvs] = await Promise.all([
      signAll("avatars", rows.flatMap((r) => (r.avatarPath ? [r.avatarPath] : []))),
      signAll("cvs", rows.flatMap((r) => (r.cvPath ? [r.cvPath] : []))),
    ]);
    for (const r of rows) {
      r.photoUrl = r.avatarPath ? (avatars[r.avatarPath] ?? null) : null;
      r.cvUrl = r.cvPath ? (cvs[r.cvPath] ?? null) : null;
    }
    return { data: rows, signedAt };
  } catch (e) {
    return { error: friendlyError(e as { message?: string }, MSG.load) };
  }
}

// ------------------------------------------------------------------ live cache (per vacancy)

type DetailEntry = { status: "loading" | "ready" | "error"; byId: Record<string, DetailRow>; signedAt: number; error?: string };

const useDetailCache = create<{ entries: Record<string, DetailEntry> }>()(() => ({ entries: {} }));
const flights = new Map<string, Promise<void>>();
let seq = 0;

async function loadDetail(jobId: string, force = false): Promise<void> {
  const existing = useDetailCache.getState().entries[jobId];
  if (!force && existing && existing.status !== "error") return;
  if (flights.has(jobId)) return flights.get(jobId);
  const mySeq = seq;
  const put = (e: DetailEntry) => {
    if (mySeq === seq) useDetailCache.setState((s) => ({ entries: { ...s.entries, [jobId]: e } }));
  };
  if (!existing || existing.status === "error") put({ status: "loading", byId: {}, signedAt: 0 });
  const p = (async () => {
    const r = await fetchDetails(jobId);
    if (r.error !== undefined) {
      put(existing?.status === "ready" ? { ...existing, error: r.error } : { status: "error", byId: {}, signedAt: 0, error: r.error });
      return;
    }
    put({ status: "ready", byId: Object.fromEntries(r.data.map((d) => [d.id, d])), signedAt: r.signedAt });
  })();
  flights.set(jobId, p);
  try {
    await p;
  } finally {
    flights.delete(jobId);
  }
}

onLive("reset", () => {
  seq++;
  flights.clear();
  useDetailCache.setState({ entries: {} }, true);
});
onLive("applicants", () => {
  for (const id of Object.keys(useDetailCache.getState().entries)) void loadDetail(id, true);
});

/**
 * Opens a candidate's CV in a new tab. Uses the pre-signed link while fresh; otherwise opens the tab
 * right away (so popup blockers allow it) and points it at a newly signed URL. Returns an error string.
 */
export async function openApplicantCv(a: Pick<ApplicantProfile, "cvPath" | "cvUrl" | "signedAt">): Promise<WriteResult> {
  if (a.cvUrl && a.signedAt && Date.now() - a.signedAt < SIGNED_FRESH_MS) {
    window.open(a.cvUrl, "_blank", "noopener,noreferrer");
    return {};
  }
  if (!a.cvPath) return { error: "Este CV no está disponible." };
  const tab = window.open("about:blank", "_blank");
  if (tab) tab.opener = null;
  const signed = await signAll("cvs", [a.cvPath]);
  const url = signed[a.cvPath];
  if (!url) {
    tab?.close();
    return { error: "No pudimos abrir el CV. Intenta de nuevo." };
  }
  if (tab) tab.location.href = url;
  else window.open(url, "_blank", "noopener,noreferrer");
  return {};
}

// ------------------------------------------------------------------ hook

export type ApplicantProfilesResult = {
  status: CatalogStatus;
  error?: string;
  /** The detailed profiles failed to load; cards show the basic rows. */
  detailError?: string;
  /** Newest first (same order as useApplicants). */
  applicants: ApplicantProfile[];
  reload: () => void;
  setStatus: (applicationId: string, status: ApplicationStatus) => Promise<WriteResult>;
};

function fallbackProfile(a: ApplicantView): ApplicantProfile {
  return {
    id: a.id,
    jobId: a.jobId,
    status: a.status,
    colonia: a.colonia,
    km: a.km,
    minutesAgo: a.minutesAgo,
    // Server truth: an unlocked applicant who never typed a name still shows phone / photo / CV.
    unlocked: a.unlocked,
    experience: a.experience,
    interests: a.interests,
    strength: null,
    details: EMPTY_DETAILS,
    experiences: [],
    hasPhoto: false,
    hasCv: false,
    name: a.unlocked ? a.name : null,
    phone: a.unlocked ? a.phone : null,
    photoUrl: null,
    photoArt: null,
    cvPath: null,
    cvUrl: null,
    signedAt: null,
    demo: false,
  };
}

/**
 * Applicants of one of my vacancies (or all of them, no jobId) with their richer profile.
 * Status changes go through `setStatus` (optimistic, toasts on error), exactly like useApplicants.
 */
export function useApplicantProfiles(jobId?: string): ApplicantProfilesResult {
  const live = useApp((s) => s.mode === "live");
  const base = useApplicants(jobId);
  const my = useMyCompany();
  const jobIds = useMemo(() => (jobId ? [jobId] : my.jobs.map((j) => j.id)), [jobId, my.jobs]);
  const key = jobIds.join(",");
  const entries = useDetailCache((s) => s.entries);
  const ready = live && (jobId ? true : my.status === "ready");

  useEffect(() => {
    if (!ready || !key) return;
    for (const id of key.split(",")) void loadDetail(id);
  }, [ready, key]);

  return useMemo((): ApplicantProfilesResult => {
    if (!live) {
      return {
        status: base.status,
        error: base.error,
        applicants: base.applicants.map((a) => {
          const mock = APPLICANT_BY_ID[a.id];
          if (!mock) return { ...fallbackProfile(a), demo: true };
          return demoApplicantProfile(
            { ...mock, status: a.status, unlocked: a.unlocked, jobId: a.jobId, km: a.km ?? mock.km },
            mock.person,
          );
        }),
        reload: base.reload,
        setStatus: base.setStatus,
      };
    }
    const mine = jobIds.map((id) => entries[id]);
    const detailLoading = mine.some((e) => !e || e.status === "loading");
    const detailError = mine.find((e) => e?.status === "error" || e?.error)?.error;
    const status: CatalogStatus = base.status !== "ready" ? base.status : detailLoading && jobIds.length > 0 ? "loading" : "ready";
    const applicants = base.applicants.map((a): ApplicantProfile => {
      const entry = entries[a.jobId];
      const d = entry?.byId[a.id];
      if (!d) return fallbackProfile(a);
      const unlocked = d.unlocked;
      return {
        ...fallbackProfile(a),
        unlocked,
        strength: d.strength,
        details: d.details,
        experiences: d.experiences,
        hasPhoto: d.hasPhoto,
        hasCv: d.hasCv,
        name: unlocked ? (d.name ?? a.name) : null,
        phone: unlocked ? (d.phone ?? a.phone) : null,
        photoUrl: unlocked ? d.photoUrl : null,
        cvPath: unlocked ? d.cvPath : null,
        cvUrl: unlocked ? d.cvUrl : null,
        signedAt: entry.signedAt || null,
      };
    });
    return {
      status,
      error: base.error,
      detailError,
      applicants,
      reload: () => {
        base.reload();
        for (const id of jobIds) void loadDetail(id, true);
      },
      setStatus: base.setStatus,
    };
  }, [live, base, jobIds, entries]);
}

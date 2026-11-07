"use client";

import { useEffect, useMemo } from "react";
import { create } from "zustand";
import { toast } from "sonner";
import { APPLICANTS, applicantsFor } from "@/lib/data/applicants";
import type { ApplicationStatus } from "@/lib/data/types";
import { useMyCompany, type CatalogStatus } from "@/lib/data/catalog";
import { useApp, useIsUnlocked } from "@/lib/store";
import * as api from "./api";
import type { LiveApplicant, WriteResult } from "./api";
import { emitLive, onLive } from "./events";

/**
 * Applicants as the company sees them, in both modes, one shape:
 *  - live: job_applicants() → colonia + rounded km always; name/phone are null until unlocked.
 *  - demo: the mock applicants; name is always present, gate it on `unlocked` like live.
 */
export type ApplicantView = LiveApplicant;

type Entry = { status: "loading" | "ready" | "error"; list: ApplicantView[]; error?: string };
type CacheState = { entries: Record<string, Entry>; demoStatus: Record<string, ApplicationStatus> };

const useApplicantCache = create<CacheState>()(() => ({ entries: {}, demoStatus: {} }));
const flights = new Map<string, Promise<void>>();
let cacheSeq = 0;

async function load(key: string, jobIds: string[], force = false) {
  const existing = useApplicantCache.getState().entries[key];
  if (!force && existing && existing.status !== "error") return;
  if (!force && flights.has(key)) return flights.get(key);
  const seq = cacheSeq;
  const put = (e: Entry) => {
    if (seq === cacheSeq) useApplicantCache.setState((s) => ({ entries: { ...s.entries, [key]: e } }));
  };
  if (!existing || existing.status === "error") put({ status: "loading", list: [] });
  const p = (async () => {
    const results = await Promise.all(jobIds.map((id) => api.listApplicants(id)));
    const failed = results.find((r) => r.error !== undefined);
    if (failed?.error) {
      put(existing?.status === "ready" ? { ...existing, error: failed.error } : { status: "error", list: [], error: failed.error });
      return;
    }
    const list = results.flatMap((r) => r.data ?? []).toSorted((a, b) => a.minutesAgo - b.minutesAgo);
    put({ status: "ready", list });
  })();
  flights.set(key, p);
  try {
    await p;
  } finally {
    flights.delete(key);
  }
}

onLive("reset", () => {
  cacheSeq++;
  flights.clear();
  useApplicantCache.setState({ entries: {}, demoStatus: {} }, true);
});
onLive("applicants", () => {
  // Refetch whatever is cached (screens showing it stay on the old list until it lands).
  for (const key of Object.keys(useApplicantCache.getState().entries)) void load(key, key.split(","), true);
});

/** Moves an application along (company only). Optimistic in the cached lists; toasts on error. */
async function setStatusLive(applicationId: string, status: ApplicationStatus): Promise<WriteResult> {
  const before = useApplicantCache.getState().entries;
  const patch = (st: ApplicationStatus) =>
    useApplicantCache.setState((s) => ({
      entries: Object.fromEntries(
        Object.entries(s.entries).map(([k, e]) => [k, { ...e, list: e.list.map((a) => (a.id === applicationId ? { ...a, status: st } : a)) }]),
      ),
    }));
  const prev = Object.values(before)
    .flatMap((e) => e.list)
    .find((a) => a.id === applicationId)?.status;
  patch(status);
  const r = await api.setApplicationStatus(applicationId, status);
  if (r.error) {
    if (prev) patch(prev);
    toast.error(r.error);
  } else emitLive("myCompany");
  return r;
}

export type ApplicantsResult = {
  status: CatalogStatus;
  error?: string;
  /** Newest first. */
  applicants: ApplicantView[];
  reload: () => void;
  setStatus: (applicationId: string, status: ApplicationStatus) => Promise<WriteResult>;
};

/**
 * Applicants to one of my vacancies, or (no jobId) to all of them. Live data is cached per key and
 * refetched after status changes; demo data is the mock list.
 */
export function useApplicants(jobId?: string): ApplicantsResult {
  const live = useApp((s) => s.mode === "live");
  const isUnlocked = useIsUnlocked();
  const my = useMyCompany();
  const demoStatus = useApplicantCache((s) => s.demoStatus);

  const jobIds = useMemo(() => (jobId ? [jobId] : my.jobs.map((j) => j.id)), [jobId, my.jobs]);
  const key = jobIds.join(",");
  const entry = useApplicantCache((s) => s.entries[key]);
  const ready = live && (jobId ? true : my.status === "ready");

  useEffect(() => {
    if (ready && key) void load(key, key.split(","));
  }, [ready, key]);

  return useMemo((): ApplicantsResult => {
    if (!live) {
      const list = (jobId ? applicantsFor(jobId) : APPLICANTS.toSorted((a, b) => a.minutesAgo - b.minutesAgo)).map(
        (a): ApplicantView => ({
          id: a.id,
          jobId: a.jobId,
          status: demoStatus[a.id] ?? "enviada",
          colonia: a.colonia,
          km: a.km,
          experience: a.experience,
          interests: [],
          minutesAgo: a.minutesAgo,
          unlocked: isUnlocked(a.jobId),
          name: a.name,
          phone: null,
        }),
      );
      return {
        status: "ready",
        applicants: list,
        reload: () => {},
        setStatus: async (id, status) => {
          useApplicantCache.setState((s) => ({ demoStatus: { ...s.demoStatus, [id]: status } }));
          return {};
        },
      };
    }
    if (!key) {
      // No vacancies yet (or still loading them).
      return { status: my.status, error: my.error, applicants: [], reload: () => void my.reload(), setStatus: setStatusLive };
    }
    return {
      status: entry?.status ?? "loading",
      error: entry?.error,
      applicants: entry?.list ?? [],
      reload: () => void load(key, key.split(","), true),
      setStatus: setStatusLive,
    };
  }, [live, jobId, demoStatus, isUnlocked, key, entry, my]);
}

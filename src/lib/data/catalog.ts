"use client";

import { useEffect, useMemo } from "react";
import { create } from "zustand";
import { BRANCH_BY_ID, COMPANIES, COMPANY_BY_ID, DEMO_COMPANY_ID, JOBS, JOB_BY_ID, companyLabelOf } from "@/lib/data/jobs";
import { applicantsFor } from "@/lib/data/applicants";
import type { Branch, Company, Job } from "@/lib/data/types";
import { bearing, distanceKm, type LatLng } from "@/lib/geo";
import { inScope, isLiveAvailable, scopeOf, useApp, useHydrated, useStoredMembership, type AppMode } from "@/lib/store";
import * as api from "@/lib/live/api";
import type { JobStatus, MyJob } from "@/lib/live/api";
import { useLiveAuth } from "@/lib/live/auth-state";
import { onLive } from "@/lib/live/events";

/*
 * One catalog of vacancies / companies / branches for every screen.
 *  - demo → the bundled mock data, synchronously "ready" (never calls Supabase).
 *  - live → Supabase: jobs_near(home, 50 km) + all companies + branches_view, cached in memory.
 *  - visitor (mode null) → live when Supabase is configured, else the mock.
 * Before the persisted store hydrates we don't know the mode, so a live-capable build reports
 * "loading" (and fetches nothing) until it does.
 */

export type CatalogStatus = "loading" | "ready" | "error";
export type CatalogSource = "demo" | "live";
export type { MyJob, JobStatus };

export type JobWithDistance = Job & { km: number; bearing: number };

type Snapshot = {
  jobs: Job[];
  companies: Company[];
  companyById: Record<string, Company>;
  jobById: Record<string, Job>;
  branchById: Record<string, Branch>;
  byBranch: Record<string, Job[]>;
};

export type Catalog = Snapshot & {
  source: CatalogSource;
  status: CatalogStatus;
  /** Spanish message when status is "error" (or a background refresh failed). */
  error?: string;
  /** A refetch is running in the background; the data shown is the previous one. */
  refreshing: boolean;
  /** Open vacancies at one branch. */
  jobsAtBranch: (branchId: string) => Job[];
  /** "Empresa · Sucursal" when the company has more than one branch, else the company name. */
  companyLabel: (job: Pick<Job, "companyId" | "branchId">) => string;
  /** Refetch (live); a no-op in demo. */
  reload: () => Promise<void>;
};

function buildSnapshot(jobs: Job[], companies: Company[]): Snapshot {
  const companyById: Record<string, Company> = {};
  const branchById: Record<string, Branch> = {};
  const jobById: Record<string, Job> = {};
  const byBranch: Record<string, Job[]> = {};
  for (const c of companies) {
    companyById[c.id] = c;
    for (const b of c.locations) branchById[b.id] = b;
  }
  for (const j of jobs) {
    jobById[j.id] = j;
    (byBranch[j.branchId] ??= []).push(j);
  }
  return { jobs, companies, companyById, jobById, branchById, byBranch };
}

const DEMO_SNAPSHOT: Snapshot = {
  ...buildSnapshot(JOBS, COMPANIES),
  // The exact maps the demo screens always used.
  companyById: COMPANY_BY_ID,
  jobById: JOB_BY_ID,
  branchById: BRANCH_BY_ID,
};
const EMPTY_SNAPSHOT: Snapshot = buildSnapshot([], []);
const NO_JOBS: Job[] = [];

// ------------------------------------------------------------------ live cache (not persisted)

type LiveCatalogState = {
  status: "idle" | "loading" | "ready" | "error";
  error?: string;
  refreshing: boolean;
  /** Where the current data was fetched from (the user's home). */
  point: LatLng | null;
  snap: Snapshot | null;
  /** Vacancies fetched one by one (outside the 50 km list), by id; null = not found. */
  extra: Record<string, Job | null>;
  /** Why fetching one of those failed (cleared by reload(), which retries). */
  extraError: Record<string, string>;
};

const LIVE_INITIAL: LiveCatalogState = { status: "idle", refreshing: false, point: null, snap: null, extra: {}, extraError: {} };
const useLiveCatalog = create<LiveCatalogState>()(() => LIVE_INITIAL);

let catalogSeq = 0;
let catalogFlight: { key: string; promise: Promise<void> } | null = null;
const pointKey = (p: LatLng) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`;

async function loadLiveCatalog(point: LatLng, force = false): Promise<void> {
  const key = pointKey(point);
  const st = useLiveCatalog.getState();
  if (!force && st.point && pointKey(st.point) === key && (st.status === "ready" || st.status === "loading")) return;
  if (!force && catalogFlight?.key === key) return catalogFlight.promise;
  const seq = ++catalogSeq;
  useLiveCatalog.setState((s) => ({
    ...(s.snap ? { refreshing: true } : { status: "loading" as const, refreshing: false }),
    point,
    error: undefined,
    // A forced reload (Reintentar) also retries single vacancies that failed to load.
    ...(force ? { extraError: {} } : {}),
  }));
  const promise = (async () => {
    const r = await api.fetchCatalog(point);
    if (seq !== catalogSeq) return;
    if (r.error !== undefined) {
      // A failed background refresh keeps the data on screen.
      useLiveCatalog.setState((s) => (s.snap ? { refreshing: false, error: r.error } : { status: "error", refreshing: false, error: r.error }));
    } else {
      useLiveCatalog.setState({ status: "ready", refreshing: false, error: undefined, snap: buildSnapshot(r.data.jobs, r.data.companies) });
    }
  })();
  catalogFlight = { key, promise };
  try {
    await promise;
  } finally {
    if (catalogFlight?.promise === promise) catalogFlight = null;
  }
}

/** Bumped on "reset" (user changed): replies to requests started before it are dropped. */
let resetSeq = 0;
const extraFlights = new Set<string>();
/** Ids asked for during the current render commit; fetched together right after it. */
const extraQueue = new Set<string>();
let extraFlushScheduled = false;

/**
 * Fetches a vacancy outside the nearby list. Every list row calls useJob(), so the ids asked for in
 * one commit are coalesced into ONE request (`in (...)`); a lone id (a vacancy page) uses fetchJob,
 * which also brings its applicant count.
 */
function loadExtraJob(id: string) {
  if (extraFlights.has(id) || id in useLiveCatalog.getState().extra) return;
  extraFlights.add(id);
  extraQueue.add(id);
  if (extraFlushScheduled) return;
  extraFlushScheduled = true;
  setTimeout(() => void flushExtraJobs(), 0);
}

async function flushExtraJobs() {
  extraFlushScheduled = false;
  const ids = [...extraQueue];
  extraQueue.clear();
  if (ids.length === 0) return;
  const seq = resetSeq;
  const r: { data: Record<string, Job | null>; error?: undefined } | { error: string; data?: undefined } =
    ids.length === 1
      ? await api.fetchJob(ids[0]).then((x) => (x.error !== undefined ? { error: x.error } : { data: { [ids[0]]: x.data } }))
      : await api.fetchJobsByIds(ids);
  for (const id of ids) extraFlights.delete(id);
  if (seq !== resetSeq) return;
  // Leave them unknown (not "not found"); useJob reports the error and reload() retries.
  if (r.error !== undefined) {
    const error = r.error;
    useLiveCatalog.setState((s) => ({ extraError: { ...s.extraError, ...Object.fromEntries(ids.map((id) => [id, error])) } }));
  } else useLiveCatalog.setState((s) => ({ extra: { ...s.extra, ...r.data } }));
}

// ------------------------------------------------------------------ source

/** Which data a mode reads: demo → mock, live → Supabase, visitor → live if configured. */
export function catalogSourceFor(mode: AppMode | null): CatalogSource {
  if (mode === "live") return "live";
  if (mode === "demo") return "demo";
  return isLiveAvailable ? "live" : "demo";
}

/** null while the persisted store hasn't hydrated in a live-capable build (mode still unknown). */
function useSource(): CatalogSource | null {
  const hydrated = useHydrated();
  const mode = useApp((s) => s.mode);
  if (!hydrated) return isLiveAvailable ? null : "demo";
  return catalogSourceFor(mode);
}

export function useCatalogSource(): CatalogSource | null {
  return useSource();
}

function bindCatalog(
  snap: Snapshot,
  rest: Pick<Catalog, "source" | "status" | "error" | "refreshing" | "reload">,
): Catalog {
  return {
    ...snap,
    ...rest,
    jobsAtBranch: (branchId) => snap.byBranch[branchId] ?? NO_JOBS,
    companyLabel: (job) => companyLabelOf(snap.companyById[job.companyId], snap.branchById[job.branchId]),
  };
}

const reloadNothing = async () => {};
const DEMO_CATALOG = bindCatalog(DEMO_SNAPSHOT, { source: "demo", status: "ready", refreshing: false, reload: reloadNothing });
const PENDING_CATALOG = bindCatalog(EMPTY_SNAPSHOT, { source: "live", status: "loading", refreshing: false, reload: reloadNothing });

/** The user's home, as the catalog fetch point. */
function useHomePoint(): LatLng {
  const lat = useApp((s) => s.home.lat);
  const lng = useApp((s) => s.home.lng);
  return useMemo(() => ({ lat, lng }), [lat, lng]);
}

/**
 * The catalog for the current mode. Live: fetched around the user's home (or Saltillo centro) on
 * first use, refetched when home changes or reload() is called.
 */
export function useCatalog(): Catalog {
  const source = useSource();
  const point = useHomePoint();
  const live = useLiveCatalog();
  // After a "reset" (sign-out, account switch, demo ↔ live) the cache is back to idle even when the
  // source and home didn't change: fetch again instead of showing "loading" forever.
  const idle = live.status === "idle";

  useEffect(() => {
    if (source === "live") void loadLiveCatalog(point);
  }, [source, point, idle]);

  return useMemo(() => {
    if (source === "demo") return DEMO_CATALOG;
    if (source === null) return PENDING_CATALOG;
    const status: CatalogStatus = live.snap ? "ready" : live.status === "error" ? "error" : "loading";
    return bindCatalog(live.snap ?? EMPTY_SNAPSHOT, {
      source: "live",
      status,
      error: live.error,
      refreshing: live.refreshing,
      reload: () => loadLiveCatalog(useLiveCatalog.getState().point ?? point, true),
    });
  }, [source, live, point]);
}

/**
 * The active catalog outside React (pure helpers like layoutSpots). It doesn't subscribe: call it
 * from a component that already uses useCatalog()/useJobsByDistance() so it re-renders on change.
 */
export function getCatalog(): Catalog {
  const mode = useApp.getState().mode;
  if (!useApp.persist.hasHydrated()) return isLiveAvailable ? PENDING_CATALOG : DEMO_CATALOG;
  if (catalogSourceFor(mode) === "demo") return DEMO_CATALOG;
  const live = useLiveCatalog.getState();
  return bindCatalog(live.snap ?? EMPTY_SNAPSHOT, {
    source: "live",
    status: live.snap ? "ready" : live.status === "error" ? "error" : "loading",
    error: live.error,
    refreshing: live.refreshing,
    reload: () => (live.point ? loadLiveCatalog(live.point, true) : reloadNothing()),
  });
}

/** All vacancies with distance and bearing from the user's home, nearest first. */
export function useJobsByDistance(): JobWithDistance[] {
  const { jobs } = useCatalog();
  const home = useApp((s) => s.home);
  return useMemo(
    () => jobs.map((j) => ({ ...j, km: distanceKm(home, j.location), bearing: bearing(home, j.location) })).toSorted((a, b) => a.km - b.km),
    [jobs, home],
  );
}

/**
 * The bundled demo vacancies around the user's home, whatever the mode. Only for showcases that are
 * labeled as demo (the landing's "Pruébalo aquí" radar): real screens use useJobsByDistance().
 */
export function useDemoJobsByDistance(): JobWithDistance[] {
  const home = useApp((s) => s.home);
  return useMemo(
    () => DEMO_CATALOG.jobs.map((j) => ({ ...j, km: distanceKm(home, j.location), bearing: bearing(home, j.location) })).toSorted((a, b) => a.km - b.km),
    [home],
  );
}

/**
 * One vacancy, with its company and branch. Live: if it isn't in the 50 km list (an old link, a
 * saved vacancy far away) it's fetched by id. status "ready" + job undefined = not found / closed.
 */
export function useJob(id: string | null | undefined) {
  const catalog = useCatalog();
  const extra = useLiveCatalog((s) => (id ? s.extra[id] : undefined));
  const extraError = useLiveCatalog((s) => (id ? s.extraError[id] : undefined));
  const inList = id ? catalog.jobById[id] : undefined;
  const needsFetch = catalog.source === "live" && catalog.status === "ready" && !!id && !inList && extra === undefined;
  const failed = needsFetch && extraError !== undefined;

  useEffect(() => {
    if (needsFetch && id && !failed) void loadExtraJob(id);
  }, [needsFetch, id, failed]);

  const job = inList ?? extra ?? undefined;
  const status: CatalogStatus =
    catalog.status !== "ready" ? catalog.status : failed ? "error" : needsFetch ? "loading" : "ready";
  return {
    status,
    error: failed ? extraError : catalog.error,
    job,
    company: job ? catalog.companyById[job.companyId] : undefined,
    branch: job ? catalog.branchById[job.branchId] : undefined,
    label: job ? catalog.companyLabel(job) : "",
  };
}

const NO_IDS: string[] = [];

/**
 * Several vacancies by id (e.g. the ones I applied to, for /notificaciones): the nearby list plus
 * the ones fetched by id (one request for all the missing ones). Unknown / not visible ids are left out.
 */
export function useJobsById(ids: string[] = NO_IDS): Record<string, Job> {
  const catalog = useCatalog();
  const extra = useLiveCatalog((s) => s.extra);
  const key = ids.toSorted().join(",");
  const live = catalog.source === "live" && catalog.status === "ready";

  useEffect(() => {
    if (!live || !key) return;
    const st = useLiveCatalog.getState();
    for (const id of key.split(",")) {
      if (!catalog.jobById[id] && !(id in st.extra) && !(id in st.extraError)) loadExtraJob(id);
    }
  }, [live, key, catalog.jobById]);

  return useMemo(() => {
    const out: Record<string, Job> = {};
    for (const id of key ? key.split(",") : NO_IDS) {
      const j = catalog.jobById[id] ?? extra[id];
      if (j) out[id] = j;
    }
    return out;
  }, [key, catalog.jobById, extra]);
}

export function useCompany(id: string | null | undefined) {
  const catalog = useCatalog();
  return { status: catalog.status, error: catalog.error, company: id ? catalog.companyById[id] : undefined };
}

export function useBranch(id: string | null | undefined) {
  const catalog = useCatalog();
  const branch = id ? catalog.branchById[id] : undefined;
  const company = branch ? catalog.companies.find((c) => c.locations.some((l) => l.id === branch.id)) : undefined;
  return { status: catalog.status, error: catalog.error, branch, company };
}

export function useJobsAtBranch(id: string | null | undefined) {
  const catalog = useCatalog();
  return { status: catalog.status, error: catalog.error, jobs: id ? catalog.jobsAtBranch(id) : NO_JOBS };
}

// ------------------------------------------------------------------ the employer's own company

type MyJobsState = { status: "idle" | "loading" | "ready" | "error"; companyId: string | null; jobs: MyJob[]; error?: string; refreshing: boolean };
const MY_INITIAL: MyJobsState = { status: "idle", companyId: null, jobs: [], refreshing: false };
const useMyJobs = create<MyJobsState>()(() => MY_INITIAL);

let myJobsSeq = 0;
async function loadMyJobs(companyId: string, force = false) {
  const st = useMyJobs.getState();
  if (!force && st.companyId === companyId && st.status !== "idle" && st.status !== "error") return;
  const seq = ++myJobsSeq;
  useMyJobs.setState((s) =>
    s.companyId === companyId && s.status === "ready" ? { refreshing: true } : { status: "loading", companyId, jobs: [], error: undefined, refreshing: false },
  );
  const r = await api.fetchMyJobs(companyId);
  if (seq !== myJobsSeq) return;
  if (r.error !== undefined) useMyJobs.setState((s) => (s.status === "ready" ? { refreshing: false, error: r.error } : { status: "error", error: r.error, refreshing: false }));
  else useMyJobs.setState({ status: "ready", companyId, jobs: r.data, error: undefined, refreshing: false });
}

// The demo company's own counts come from its mock applicants (the same rows every list shows), not
// from the public "N personas se postularon" number of the mock vacancy.
const DEMO_MY_JOBS: MyJob[] = JOBS.filter((j) => j.companyId === DEMO_COMPANY_ID).map((j) => ({
  ...j,
  applicants: applicantsFor(j.id).length,
  status: "abierta" as const,
}));
const NO_MY_JOBS: MyJob[] = [];

export type MyCompany = {
  status: CatalogStatus;
  error?: string;
  refreshing: boolean;
  /** Null in live until the business is registered (show the "registra tu negocio" state). */
  company: Company | null;
  /** The branches I work: all of them, or a branch-limited reclutador's (pickers, filters). */
  branches: Branch[];
  /** Every branch of the company, whatever my scope (= company.locations). */
  allBranches: Branch[];
  /**
   * The vacancies I work. Live: every status (abierta/pausada/cerrada), newest first. Demo: the demo
   * company's vacancies. A branch-limited reclutador only gets their branches' (the open vacancies of
   * every branch are public, so the jobs query returns them too: they're filtered out here).
   */
  jobs: MyJob[];
  reload: () => Promise<void>;
};

/**
 * The employer's own company, branches and vacancies (all statuses), limited to my branch scope
 * (team accounts). Demo: the demo company (with any branch edits the demo user made). Live: from the
 * session + the jobs table.
 */
export function useMyCompany(): MyCompany {
  const source = useSource();
  const mode = useApp((s) => s.mode);
  const business = useApp((s) => s.business);
  const sessionLoaded = useLiveAuth((s) => s.sessionLoaded);
  const my = useMyJobs();
  const live = mode === "live";
  const companyId = live ? (business?.id ?? null) : null;
  const membership = useStoredMembership();
  const scope = scopeOf(membership);

  useEffect(() => {
    if (companyId) void loadMyJobs(companyId);
  }, [companyId]);

  return useMemo((): MyCompany => {
    const scoped = (branches: Branch[]) => (scope === null ? branches : branches.filter((b) => scope.includes(b.id)));
    if (!live) {
      if (source === null)
        return { status: "loading", refreshing: false, company: null, branches: [], allBranches: [], jobs: NO_MY_JOBS, reload: reloadNothing };
      // A visitor in a live-capable build has no company, and must never get the mock one.
      if (source === "live")
        return { status: "ready", refreshing: false, company: null, branches: [], allBranches: [], jobs: NO_MY_JOBS, reload: reloadNothing };
      const base = COMPANY_BY_ID[DEMO_COMPANY_ID];
      const company: Company = business
        ? { ...base, name: business.name, kind: business.kind, size: business.size, locations: business.locations }
        : base;
      return {
        status: "ready",
        refreshing: false,
        company,
        branches: scoped(company.locations),
        allBranches: company.locations,
        jobs: inScope(membership, DEMO_MY_JOBS),
        reload: reloadNothing,
      };
    }
    if (!business?.id) {
      return {
        status: sessionLoaded ? "ready" : "loading",
        refreshing: false,
        company: null,
        branches: business?.locations ?? [],
        allBranches: business?.locations ?? [],
        jobs: NO_MY_JOBS,
        reload: reloadNothing,
      };
    }
    const company: Company = {
      id: business.id,
      name: business.name,
      kind: business.kind,
      size: business.size,
      verified: business.verified ?? false,
      locations: business.locations,
      about: business.about ?? "",
      employees: business.employees ?? "",
    };
    const fresh = my.companyId === business.id;
    const status: CatalogStatus = fresh && my.status === "ready" ? "ready" : fresh && my.status === "error" ? "error" : "loading";
    return {
      status,
      error: fresh ? my.error : undefined,
      refreshing: fresh && my.refreshing,
      company,
      branches: scoped(business.locations),
      allBranches: business.locations,
      jobs: fresh ? inScope(membership, my.jobs) : NO_MY_JOBS,
      reload: () => loadMyJobs(business.id!, true),
    };
  }, [live, source, business, sessionLoaded, my, membership, scope]);
}

// ------------------------------------------------------------------ invalidation

// Module-level subscriptions only touch this module's own stores (safe with the store↔catalog cycle).
onLive("reset", () => {
  resetSeq++;
  catalogSeq++;
  myJobsSeq++;
  catalogFlight = null;
  useLiveCatalog.setState(LIVE_INITIAL, true);
  useMyJobs.setState(MY_INITIAL, true);
});
onLive("catalog", () => {
  const { point } = useLiveCatalog.getState();
  useLiveCatalog.setState({ extra: {}, extraError: {} });
  if (point) void loadLiveCatalog(point, true);
});
onLive("myCompany", () => {
  const { companyId } = useMyJobs.getState();
  if (companyId) void loadMyJobs(companyId, true);
});

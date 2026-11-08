"use client";

/*
 * "Tu equipo" for screens. Both modes, one shape:
 *  - live: my membership comes with the session (store `membership`, from my_membership()) and is
 *    re-checked here when stale (60 s), after every team write and on "myCompany"; the other team RPCs
 *    (team_members, team_invites, team_people, invite_member…) are cached in memory per company.
 *  - demo: ./demo (the demo company's local team; never calls Supabase).
 *
 * Actions (inviteMember, revokeInvite, updateMember, removeMember, leaveTeam) never throw; they resolve
 * { error?, code? } and have already toasted the error. acceptInvite / previewInvite don't toast: the
 * /unirse page shows their states inline.
 */
import { useEffect, useMemo } from "react";
import { create } from "zustand";
import { toast } from "sonner";
import { COMPANY_BY_ID, DEMO_COMPANY_ID } from "@/lib/data/jobs";
import { useMyCompany } from "@/lib/data/catalog";
import { useLiveAuth } from "@/lib/live/auth-state";
import { loadSession } from "@/lib/live/backend";
import { emitLive, onLive } from "@/lib/live/events";
import {
  applyMembership,
  getStoredMembership,
  lastMembershipSync,
  useApp,
  useHydrated,
  useOwnApplicationIds,
  useStoredMembership,
} from "@/lib/store";
import * as api from "./api";
import * as demo from "./demo";
import { canSeeBranch, isValidEmail, normalizeScope, permissionsFor, teamUsage, type TeamPermissions } from "./permissions";
import type {
  AcceptedInvite,
  InviteCreated,
  InviteInput,
  InvitePreview,
  LoadStatus,
  MemberChange,
  Membership,
  TeamInvite,
  TeamMember,
  TeamPerson,
  TeamPlan,
  TeamErrorCode,
  TeamResult,
  TeamRole,
  TeamWriteResult,
} from "./types";

const STALE_MS = 60_000;

// ------------------------------------------------------------------ live caches

/** The re-check of my membership (the value itself lives in the store: `membership`). */
type MembershipEntry = { userId: string; status: LoadStatus; error?: string; fetchedAt: number };
type TeamEntry = { status: LoadStatus; members: TeamMember[]; invites: TeamInvite[]; error?: string; fetchedAt: number; refreshing: boolean };
type PeopleEntry = { status: LoadStatus; people: TeamPerson[]; error?: string; fetchedAt: number };

type Cache = {
  membership: MembershipEntry | null;
  teams: Record<string, TeamEntry>;
  people: Record<string, PeopleEntry>;
};

const useTeamCache = create<Cache>()(() => ({ membership: null, teams: {}, people: {} }));
const cache = () => useTeamCache.getState();

/*
 * One flight per key; a forced load starts a new one and the older answer is dropped (per-key token),
 * so a refetch after a write always wins. "reset" bumps every token by clearing the map.
 */
const tokens = new Map<string, number>();
const flights = new Map<string, Promise<void>>();

function run(key: string, force: boolean, fetchAndPut: (isCurrent: () => boolean) => Promise<void>): Promise<void> {
  const inFlight = flights.get(key);
  if (inFlight && !force) return inFlight;
  const token = (tokens.get(key) ?? 0) + 1;
  tokens.set(key, token);
  const p = fetchAndPut(() => tokens.get(key) === token).finally(() => {
    if (flights.get(key) === p) flights.delete(key);
  });
  flights.set(key, p);
  return p;
}

function loadMembership(userId: string, force = false): Promise<void> {
  const e = cache().membership;
  const fetchedAt = Math.max(e?.userId === userId && e.status === "ready" ? e.fetchedAt : 0, lastMembershipSync());
  // The session load brings the membership too: no second request right after it.
  if (!force && Date.now() - fetchedAt < STALE_MS) return Promise.resolve();
  if (!e || e.userId !== userId) useTeamCache.setState({ membership: { userId, status: "loading", fetchedAt: 0 } });
  return run(`m:${userId}`, force, async (isCurrent) => {
    const r = await api.fetchMyMembership();
    if (!isCurrent()) return;
    const cur = cache().membership;
    if (r.error !== undefined) {
      useTeamCache.setState({
        membership: cur?.userId === userId && cur.status === "ready" ? { ...cur, error: r.error } : { userId, status: "error", error: r.error, fetchedAt: 0 },
      });
      return;
    }
    applyMembership(userId, r.data.membership, r.data.teamsEnabled);
    useTeamCache.setState({ membership: { userId, status: "ready", fetchedAt: Date.now() } });
  });
}

const teamKey = (companyId: string, withInvites: boolean) => `${companyId}:${withInvites ? "i" : "-"}`;

function loadTeam(companyId: string, withInvites: boolean, force = false): Promise<void> {
  const key = teamKey(companyId, withInvites);
  const e = cache().teams[key];
  if (!force && e?.status === "ready" && Date.now() - e.fetchedAt < STALE_MS) return Promise.resolve();
  const put = (v: TeamEntry) => useTeamCache.setState((s) => ({ teams: { ...s.teams, [key]: v } }));
  if (e?.status === "ready") put({ ...e, refreshing: true });
  else if (!e || e.status === "error") put({ status: "loading", members: [], invites: [], fetchedAt: 0, refreshing: false });
  return run(`t:${key}`, force, async (isCurrent) => {
    const r = await api.fetchTeam(companyId, withInvites);
    if (!isCurrent()) return;
    const cur = cache().teams[key];
    if (r.error !== undefined) {
      put(
        cur?.status === "ready"
          ? { ...cur, error: r.error, refreshing: false }
          : { status: "error", members: [], invites: [], error: r.error, fetchedAt: 0, refreshing: false },
      );
      return;
    }
    put({ status: "ready", members: r.data.members, invites: r.data.invites, fetchedAt: Date.now(), refreshing: false });
  });
}

function loadPeople(companyId: string, force = false): Promise<void> {
  const e = cache().people[companyId];
  if (!force && e?.status === "ready" && Date.now() - e.fetchedAt < STALE_MS) return Promise.resolve();
  const put = (v: PeopleEntry) => useTeamCache.setState((s) => ({ people: { ...s.people, [companyId]: v } }));
  if (!e || e.status === "error") put({ status: "loading", people: [], fetchedAt: 0 });
  return run(`p:${companyId}`, force, async (isCurrent) => {
    const r = await api.fetchTeamPeople(companyId);
    if (!isCurrent()) return;
    const cur = cache().people[companyId];
    if (r.error !== undefined) {
      put(cur?.status === "ready" ? { ...cur, error: r.error } : { status: "error", people: [], error: r.error, fetchedAt: 0 });
      return;
    }
    put({ status: "ready", people: r.data, fetchedAt: Date.now() });
  });
}

/** I left this company: drop its cached team (it isn't mine to read any more). */
function forgetCompany(companyId: string) {
  useTeamCache.setState((s) => ({
    teams: Object.fromEntries(Object.entries(s.teams).filter(([k]) => !k.startsWith(`${companyId}:`))),
    people: Object.fromEntries(Object.entries(s.people).filter(([k]) => k !== companyId)),
  }));
}

/** After a team write: refetch what's cached for this company (and my own membership). */
function refreshAfterWrite(companyId: string) {
  const userId = useApp.getState().userId;
  if (userId) void loadMembership(userId, true);
  for (const key of Object.keys(cache().teams)) if (key.startsWith(`${companyId}:`)) void loadTeam(companyId, key.endsWith(":i"), true);
  if (cache().people[companyId]) void loadPeople(companyId, true);
}

if (typeof window !== "undefined") {
  onLive("reset", () => {
    // Bump every key's token: answers still on their way are dropped.
    for (const key of flights.keys()) tokens.set(key, (tokens.get(key) ?? 0) + 1);
    flights.clear();
    useTeamCache.setState({ membership: null, teams: {}, people: {} }, true);
  });
  // The company / its jobs changed (or a session reload): re-check who I am in it.
  onLive("myCompany", () => {
    const userId = useApp.getState().userId;
    if (userId && cache().membership) void loadMembership(userId, true);
  });
}

// ------------------------------------------------------------------ helpers (non-hook)

const isLive = () => useApp.getState().mode === "live";
const isDemoEmployer = () => {
  const s = useApp.getState();
  return s.mode === "demo" && s.role === "empresa";
};

/** The demo company's name, plan and branches, as the demo user edited them (else the seed). */
function demoCompany() {
  const s = useApp.getState();
  const base = COMPANY_BY_ID[DEMO_COMPANY_ID];
  return {
    name: s.business?.name ?? base.name,
    plan: s.business?.plan ?? demo.DEMO_TEAM_PLAN,
    branchIds: (s.business?.locations ?? base.locations).map((b) => b.id),
  };
}

/**
 * The membership the actions act on: the store's (live: from the session, or the owner fallback while
 * the database has no team accounts; demo: the demo team member being viewed).
 */
function currentMembership(): Membership | null {
  return getStoredMembership();
}

function failed<T extends { error?: string }>(r: T): T {
  if (r.error) toast.error(r.error);
  return r;
}

const problem = (code: TeamErrorCode, error: string): { error: string; code: TeamErrorCode } => ({ error, code });
const noCompany = () => problem("not_member", "Primero registra tu negocio o únete a un equipo.");

// ------------------------------------------------------------------ hooks

export type MyMembership = {
  status: LoadStatus;
  error?: string;
  /** null + ready = not in any team (no business yet, or removed from the team). */
  membership: Membership | null;
  role: TeamRole | null;
  companyId: string | null;
  /** null = every branch. */
  branchIds: string[] | null;
  can: TeamPermissions;
  canSeeBranch: (branchId: string | null | undefined) => boolean;
  /** false while the database doesn't have team accounts yet: business owners act as dueño. */
  teamsEnabled: boolean;
  /** Demo only: the member being previewed ("Ver como"), else null. */
  viewingAs: string | null;
  reload: () => void;
};

function shape(status: LoadStatus, membership: Membership | null, extra: Partial<MyMembership> = {}): MyMembership {
  return {
    status,
    membership,
    role: membership?.role ?? null,
    companyId: membership?.companyId ?? null,
    branchIds: membership?.branchIds ?? null,
    can: permissionsFor(membership),
    canSeeBranch: (branchId) => canSeeBranch(membership, branchId),
    teamsEnabled: true,
    viewingAs: null,
    reload: () => {},
    ...extra,
  };
}

/**
 * Who I am in my company: role, branch scope, company id, and what that lets me do.
 * Live: the session's membership (store), known as soon as the session loaded (or from the last visit);
 * re-checked in the background when older than a minute.
 */
export function useMyMembership(): MyMembership {
  const hydrated = useHydrated();
  const mode = useApp((s) => s.mode);
  const userId = useApp((s) => s.userId);
  const teamsEnabled = useApp((s) => s.teamsEnabled);
  const stored = useStoredMembership();
  const viewAs = demo.useDemoTeam((s) => s.viewAs);
  const sessionLoaded = useLiveAuth((s) => s.sessionLoaded);
  const sessionFailed = useLiveAuth((s) => !!s.sessionError);
  const entry = useTeamCache((s) => s.membership);
  const live = mode === "live" && !!userId;

  // The session load brings the membership: re-check it once that's done (or ask alone if it failed).
  useEffect(() => {
    if (live && userId && (sessionLoaded || sessionFailed)) void loadMembership(userId);
  }, [live, userId, sessionLoaded, sessionFailed]);

  return useMemo((): MyMembership => {
    if (!hydrated) return shape("loading", null);
    if (mode === "demo") return shape("ready", stored, { viewingAs: stored ? viewAs : null });
    if (!live || !userId) return shape("ready", null);
    const reload = () => void loadMembership(userId, true);
    const mine = entry?.userId === userId ? entry : undefined;
    // Before the first session load we only know a membership saved on this device.
    const known = sessionLoaded || stored !== null || mine?.status === "ready";
    if (!known) return mine?.status === "error" ? shape("error", null, { error: mine.error, reload }) : shape("loading", null, { reload });
    return shape("ready", stored, { teamsEnabled, error: mine?.error, reload });
  }, [hydrated, mode, live, userId, stored, viewAs, sessionLoaded, entry, teamsEnabled]);
}

export type Can = {
  /** "loading": render skeletons (never flash "no permission"). */
  status: LoadStatus;
  role: TeamRole | null;
  /** Company profile: name, kind, size, phone, about (dueño, admin). */
  editCompany: boolean;
  /** Plan page actions, billing, and paid unlocks ("Desbloquear") (dueño). */
  managePlan: boolean;
  /** Same as managePlan: paying to unlock a vacancy's applicants (dueño). */
  unlockApplicants: boolean;
  /** Invite, cancel invites, change roles / branches, remove people (dueño). */
  manageTeam: boolean;
  /** Add, edit, remove branches (dueño, admin). */
  manageBranches: boolean;
  /** Publish a vacancy (dueño, admin). */
  createVacancy: boolean;
  /** Edit, pause, reopen, close vacancies (dueño, admin). */
  manageVacancies: boolean;
  /** Work applicants of my scope: seen, interview, hire, decline, undo, notes (everyone with a membership). */
  manageApplicants: boolean;
  /** See the team list (everyone with a membership; emails only for the dueño). */
  viewTeam: boolean;
  /** Not branch-limited (dueño, admin, reclutador of every branch). */
  allBranches: boolean;
  /** A branch-limited reclutador's branch ids; null = every branch. */
  branchIds: string[] | null;
  /** Branch-limited with no branch left (all were deleted): "Pide al dueño que te asigne una sucursal." */
  scopeEmpty: boolean;
  /** This branch is in my scope. */
  canSeeBranch: (branchId: string | null | undefined) => boolean;
  /** A vacancy I work: in my scope (by id: one of useMyCompany().jobs; or pass the job / its branchId). */
  viewVacancy: (job: string | { branchId: string } | null | undefined) => boolean;
  /** I'm this application's candidate (I applied to my own company): hide notes and every action. */
  isOwnApplication: (applicationId: string | null | undefined) => boolean;
  /** Notes and actions on this application: in my scope and not my own. */
  workApplication: (app: { id: string; jobId: string } | null | undefined) => boolean;
};

/**
 * What I may do in /empresa, from my membership (both modes; the demo follows "Ver como"). Hide what
 * a flag says no to; the database refuses it anyway.
 */
export function useCan(): Can {
  const my = useMyMembership();
  const company = useMyCompany();
  const ownIds = useOwnApplicationIds();
  return useMemo((): Can => {
    const { can, membership } = my;
    const branchIds = membership?.role === "reclutador" ? membership.branchIds : null;
    const jobIds = new Set(company.jobs.map((j) => j.id));
    const own = new Set(ownIds);
    const viewVacancy: Can["viewVacancy"] = (job) => {
      if (!membership || !job) return false;
      return typeof job === "string" ? jobIds.has(job) : canSeeBranch(membership, job.branchId);
    };
    const isOwnApplication: Can["isOwnApplication"] = (id) => !!id && own.has(id);
    return {
      status: my.status,
      role: my.role,
      editCompany: can.editCompany,
      managePlan: can.managePlan,
      unlockApplicants: can.managePlan,
      manageTeam: can.manageTeam,
      manageBranches: can.manageBranches,
      createVacancy: can.manageJobs,
      manageVacancies: can.manageJobs,
      manageApplicants: can.workApplicants,
      viewTeam: can.viewTeam,
      allBranches: can.allBranches,
      branchIds,
      scopeEmpty: !!branchIds && branchIds.length === 0,
      canSeeBranch: my.canSeeBranch,
      viewVacancy,
      isOwnApplication,
      workApplication: (app) => !!app && can.workApplicants && viewVacancy(app.jobId) && !isOwnApplication(app.id),
    };
  }, [my, company.jobs, ownIds]);
}

export type TeamView = {
  status: LoadStatus;
  error?: string;
  refreshing: boolean;
  /** Dueños first, then admins, then reclutadores; oldest first within a role. */
  members: TeamMember[];
  /** Open invites (pending and expired). Only the dueño gets them; [] for everyone else. */
  invites: TeamInvite[];
  me: TeamMember | null;
  plan: TeamPlan;
  /** used = members + pending (unexpired) invites; limit null = no limit. */
  usage: { used: number; limit: number | null; full: boolean; left: number | null };
  reload: () => void;
};

const EMPTY_TEAM: Omit<TeamView, "status" | "plan" | "usage" | "reload"> = { refreshing: false, members: [], invites: [], me: null };

/** My company's team (any member can see it; only the dueño gets emails and invites). */
export function useTeam(): TeamView {
  const my = useMyMembership();
  const mode = useApp((s) => s.mode);
  const ownerName = useApp((s) => s.name);
  const userId = useApp((s) => s.userId);
  const email = useApp((s) => s.email);
  const demoTeam = demo.useDemoTeam();
  const companyId = my.companyId;
  const withInvites = my.role === "dueno";
  const key = companyId ? teamKey(companyId, withInvites) : "";
  const entry = useTeamCache((s) => (key ? s.teams[key] : undefined));
  const liveTeam = mode === "live" && my.teamsEnabled && !!companyId;

  useEffect(() => {
    if (liveTeam && companyId) void loadTeam(companyId, withInvites);
  }, [liveTeam, companyId, withInvites]);

  return useMemo((): TeamView => {
    const plan: TeamPlan = my.membership?.plan ?? "por-vacante";
    const view = (status: LoadStatus, members: TeamMember[], invites: TeamInvite[], extra: Partial<TeamView> = {}): TeamView => ({
      ...EMPTY_TEAM,
      status,
      members,
      invites,
      me: members.find((m) => m.isMe) ?? null,
      plan,
      usage: teamUsage(members, invites, plan),
      reload: () => {},
      ...extra,
    });
    if (my.status !== "ready") return view(my.status, [], [], { error: my.error, reload: my.reload });
    if (!my.membership) return view("ready", [], []);
    if (mode === "demo") return view("ready", demo.demoMembers(demoTeam, ownerName), demo.demoInvites(demoTeam));
    if (!my.teamsEnabled) {
      // Database without team accounts: just me, the owner.
      const me: TeamMember = { userId: userId ?? "", role: "dueno", branchIds: null, name: ownerName, email: email || null, joinedAt: "", invitedBy: null, isMe: true };
      return view("ready", [me], []);
    }
    const reload = () => void loadTeam(my.membership!.companyId, withInvites, true);
    if (!entry || entry.status === "loading") return view("loading", [], [], { reload });
    if (entry.status === "error") return view("error", [], [], { error: entry.error, reload });
    return view("ready", entry.members, entry.invites, { error: entry.error, refreshing: entry.refreshing, reload });
  }, [my, mode, demoTeam, ownerName, userId, email, entry, withInvites]);
}

export type TeamPeople = {
  status: LoadStatus;
  people: TeamPerson[];
  /** Display name for a notes' author_id / an event's actor_user_id; null when unknown (or no id). */
  nameOf: (userId: string | null | undefined) => string | null;
  isMe: (userId: string | null | undefined) => boolean;
  reload: () => void;
};

/** Names for "who did what" on notes and the timeline (includes people who left the team). */
export function useTeamPeople(): TeamPeople {
  const my = useMyMembership();
  const mode = useApp((s) => s.mode);
  const userId = useApp((s) => s.userId);
  const ownerName = useApp((s) => s.name);
  const demoTeam = demo.useDemoTeam();
  const companyId = my.companyId;
  const entry = useTeamCache((s) => (companyId ? s.people[companyId] : undefined));
  const livePeople = mode === "live" && my.teamsEnabled && !!companyId;

  useEffect(() => {
    if (livePeople && companyId) void loadPeople(companyId);
  }, [livePeople, companyId]);

  return useMemo((): TeamPeople => {
    let status: LoadStatus = "ready";
    let people: TeamPerson[] = [];
    let me: string | null = userId;
    let reload = () => {};
    if (mode === "demo" && my.membership) {
      const members = demo.demoMembers(demoTeam, ownerName);
      people = members.map((m) => ({ userId: m.userId, name: m.name, role: m.role }));
      me = members.find((m) => m.isMe)?.userId ?? null;
    } else if (livePeople && companyId) {
      status = entry?.status ?? "loading";
      people = entry?.people ?? [];
      reload = () => void loadPeople(companyId, true);
    } else if (my.membership && !my.teamsEnabled) {
      people = userId ? [{ userId, name: ownerName, role: "dueno" }] : [];
    }
    const byId = new Map(people.map((p) => [p.userId, p]));
    return {
      status,
      people,
      nameOf: (id) => {
        if (!id) return null;
        const p = byId.get(id);
        if (!p) return null;
        return p.name.trim() || (p.role ? "Alguien del equipo" : "Alguien que ya no está en el equipo");
      },
      isMe: (id) => !!id && id === me,
      reload,
    };
  }, [mode, my.membership, my.teamsEnabled, demoTeam, ownerName, livePeople, companyId, entry, userId]);
}

// ------------------------------------------------------------------ actions

/**
 * Invite someone by email (dueño). Resolves the one-time link to share ({ token, link }); the email
 * goes out on its own. Inviting a pending / expired address again renews it ("Reenviar").
 */
export async function inviteMember(input: InviteInput): Promise<TeamResult<InviteCreated>> {
  if (isDemoEmployer()) {
    const c = demoCompany();
    return failed(demo.demoInvite(input, c.branchIds, c.plan));
  }
  const m = currentMembership();
  if (!m) return failed(noCompany());
  // Instant feedback for typos; the database decides everything else (limit, already a member…).
  if (!isValidEmail(input.email)) return failed(problem("bad_email", "Revisa el correo: parece que tiene un error."));
  const scope = normalizeScope(input.role, input.branchIds);
  if (scope && scope.length === 0) return failed(problem("bad_branches", "Elige al menos una sucursal, o todas."));
  const r = await api.inviteMember(m.companyId, input);
  if (r.error === undefined) refreshAfterWrite(m.companyId);
  return failed(r);
}

/** Cancel an open invite (dueño). Its link stops working; an email not yet sent never goes out. */
export async function revokeInvite(inviteId: string): Promise<TeamWriteResult> {
  if (isDemoEmployer()) return failed(demo.demoRevokeInvite(inviteId));
  const m = currentMembership();
  if (!m) return failed(noCompany());
  const r = await api.revokeInvite(inviteId);
  if (!r.error) refreshAfterWrite(m.companyId);
  return failed(r);
}

/** Change someone's role and branch scope (dueño). Sets both: branchIds null/omitted = every branch. */
export async function updateMember(userId: string, change: MemberChange): Promise<TeamWriteResult> {
  if (isDemoEmployer()) return failed(demo.demoUpdateMember(userId, change, demoCompany().branchIds));
  const m = currentMembership();
  if (!m) return failed(noCompany());
  const r = await api.updateMember(m.companyId, userId, change);
  if (!r.error) {
    refreshAfterWrite(m.companyId);
    // My own role / scope changed: every screen's data (vacancies, applicants) may change with it.
    if (userId === useApp.getState().userId) emitLive("myCompany", "applicants");
  }
  return failed(r);
}

/** Remove someone from the team (dueño). Their access ends at once; their notes and steps stay. */
export async function removeMember(userId: string): Promise<TeamWriteResult> {
  if (isDemoEmployer()) return failed(demo.demoRemoveMember(userId));
  const m = currentMembership();
  if (!m) return failed(noCompany());
  if (userId === useApp.getState().userId) return leaveTeam();
  const r = await api.removeMember(m.companyId, userId);
  if (!r.error) refreshAfterWrite(m.companyId);
  return failed(r);
}

/**
 * Leave my team (anyone but the last dueño). Live: reloads the session afterwards (the business is
 * gone from the store); navigate to /empresa, which then shows "Registra tu negocio".
 */
export async function leaveTeam(): Promise<TeamWriteResult> {
  if (isDemoEmployer()) return failed(demo.demoLeave());
  const m = currentMembership();
  if (!m) return {};
  const r = await api.leaveCompany(m.companyId);
  if (r.error) return failed(r);
  // Business and membership go together (the session), so no screen sees "removed from the team".
  await loadSession();
  forgetCompany(m.companyId);
  emitLive("myCompany", "applicants", "catalog");
  return {};
}

/**
 * Join through an invite link (live, signed in with the invited email). On success the session is
 * reloaded so the store has the company and the account role; then navigate to /empresa.
 * Doesn't toast. Errors carry a code: invite_expired / invite_revoked / invite_used /
 * invite_not_found / wrong_email / other_company / limit / not_signed_in / email_unconfirmed.
 */
export async function acceptInvite(token: string, name?: string | null): Promise<TeamResult<AcceptedInvite>> {
  if (!isLive()) return problem("unavailable", "Las invitaciones funcionan con una cuenta real. Sal del demo y entra con tu correo.");
  const r = await api.acceptInvite(token, name);
  if (r.error !== undefined) return r;
  const userId = useApp.getState().userId;
  if (userId) await loadMembership(userId, true);
  // Right after sign-in <LiveSession/> may still be running a load that began before the accept, and
  // loadSession() joins a load in flight: settle that one, then load again so the store sees the team.
  await loadSession();
  await loadSession();
  emitLive("myCompany", "applicants");
  return r;
}

/** The invite behind a /unirse link (works signed out). null data = no such invite. Doesn't toast. */
export async function previewInvite(token: string): Promise<TeamResult<InvitePreview | null>> {
  if (useApp.getState().mode === "demo") return problem("unavailable", "Las invitaciones funcionan con una cuenta real. Sal del demo para abrir este enlace.");
  return api.previewInvite(token);
}

/**
 * Who made each company-side step (event id → member user id) for these applications; resolve names with
 * useTeamPeople().nameOf. Live only (the demo timeline has no actors): an empty map elsewhere. Doesn't
 * toast. Only for the company side: candidates get nothing back by design.
 */
export async function fetchEventActors(applicationIds: readonly string[]): Promise<TeamResult<Map<number, string>>> {
  // Demo, or a database without team accounts yet (no actors recorded, no RPC to ask).
  if (!isLive() || !useApp.getState().teamsEnabled) return { data: new Map() };
  return api.fetchEventActors(applicationIds);
}

/** Demo only: preview the app as another demo member (null = back to being the dueño). */
export const setDemoViewAs = demo.setDemoViewAs;

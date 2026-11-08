"use client";

/*
 * Demo-mode team: the demo company (Logística Zapalinamé) with the demo user as its dueño and one
 * reclutador limited to CEDIS Santa Mónica (the site with the demo applicants), on the demo's plan
 * (Por vacante: 2 of 2 places used, so "Invitar" shows the plan limit). In memory only (a reload
 * starts over), wiped on "reset" (enterDemo / exitDemo / sign-out). Never touches Supabase. Every
 * action applies the same rules as the database (./permissions), so the demo behaves like live.
 *
 * "Ver como" (setDemoViewAs): preview the app as another demo member — useMyMembership(), useCan(),
 * the employer data hooks and the actions then answer as they would for that person. Dev builds also
 * take ?ver=reclutador / ?ver=dueno on any /empresa URL (components/chamba/app-shell.tsx).
 */
import { create } from "zustand";
import { DEMO_COMPANY_ID } from "@/lib/data/jobs";
import { onLive } from "@/lib/live/events";
import { normalizeEmail, normalizeScope, permissionsFor, validateInvite, validateMemberChange, validateRemoval } from "./permissions";
import {
  INVITE_TTL_DAYS,
  inviteLink,
  type InviteCreated,
  type InviteInput,
  type MemberChange,
  type Membership,
  type TeamInvite,
  type TeamMember,
  type TeamPlan,
  type TeamResult,
  type TeamWriteResult,
} from "./types";

/** The demo business's plan when it has none of its own (= DEMO_PLAN in @/lib/store). */
export const DEMO_TEAM_PLAN: TeamPlan = "por-vacante";
export const DEMO_OWNER_ID = "demo-dueno";
export const DEMO_RECRUITER_ID = "demo-reclutador";
/** CEDIS Santa Mónica, the demo company's main site (its vacancies have the demo applicants). */
export const DEMO_RECRUITER_BRANCH = "logistica-zapaliname-matriz";

const DAY = 24 * 60 * 60 * 1000;
const iso = (msAgo: number) => new Date(Date.now() - msAgo).toISOString();

type DemoMember = Omit<TeamMember, "isMe">;

export type DemoTeamState = {
  members: DemoMember[];
  invites: TeamInvite[];
  /** Demo member id the app is previewed as (null = the demo user, the dueño). */
  viewAs: string | null;
};

function seed(): DemoTeamState {
  return {
    members: [
      // name "" → the hook shows the demo user's own name (the store's), whatever they typed in onboarding.
      { userId: DEMO_OWNER_ID, role: "dueno", branchIds: null, name: "", email: "tu@correo.com", joinedAt: iso(120 * DAY), invitedBy: null },
      {
        userId: DEMO_RECRUITER_ID,
        role: "reclutador",
        branchIds: [DEMO_RECRUITER_BRANCH],
        name: "Lupita Garza",
        email: "lupita.garza@ejemplo.com",
        joinedAt: iso(12 * DAY),
        invitedBy: DEMO_OWNER_ID,
      },
    ],
    invites: [],
    viewAs: null,
  };
}

export const useDemoTeam = create<DemoTeamState>()(() => seed());

if (typeof window !== "undefined") onLive("reset", () => useDemoTeam.setState(seed(), true));

/** The demo member the app is acting as: the dueño, or whoever "Ver como" picked. */
export const meId = (s: DemoTeamState) => s.viewAs ?? DEMO_OWNER_ID;

/** The members as `who` sees them (emails: the dueño sees all; others only their own). */
export function demoMembers(s: DemoTeamState, ownerName: string): TeamMember[] {
  const me = meId(s);
  const myRole = s.members.find((m) => m.userId === me)?.role;
  return s.members.map((m) => ({
    ...m,
    name: m.userId === DEMO_OWNER_ID ? ownerName || m.name || "Tú" : m.name,
    email: myRole === "dueno" || m.userId === me ? m.email : null,
    isMe: m.userId === me,
  }));
}

/** Open invites: only the dueño sees them. */
export function demoInvites(s: DemoTeamState): TeamInvite[] {
  const myRole = s.members.find((m) => m.userId === meId(s))?.role;
  if (myRole !== "dueno") return [];
  const now = Date.now();
  return s.invites.map((i) => ({ ...i, expired: Date.parse(i.expiresAt) <= now }));
}

/** `plan`: the demo business's plan (the store's), so the team limit matches the plan page. */
export function demoMembership(s: DemoTeamState, companyName: string, plan: TeamPlan = DEMO_TEAM_PLAN): Membership | null {
  const m = s.members.find((x) => x.userId === meId(s));
  if (!m) return null;
  return { companyId: DEMO_COMPANY_ID, companyName, plan, role: m.role, branchIds: m.branchIds, joinedAt: m.joinedAt };
}

/** Display name of a demo member ("" for the demo user: callers use the store's name). null = unknown. */
export function demoMemberName(s: DemoTeamState, userId: string, ownerName: string): string | null {
  if (userId === DEMO_OWNER_ID) return ownerName || "Tú";
  return s.members.find((m) => m.userId === userId)?.name ?? null;
}

/** Preview the app as another demo member (null = back to the dueño). */
export function setDemoViewAs(userId: string | null) {
  useDemoTeam.setState((s) => ({ viewAs: userId && s.members.some((m) => m.userId === userId) ? userId : null }));
}

// ------------------------------------------------------------------ actions (same rules as live)

function context(companyBranchIds: readonly string[], plan: TeamPlan = DEMO_TEAM_PLAN) {
  const s = useDemoTeam.getState();
  const members = demoMembers(s, "");
  const me = members.find((m) => m.isMe) ?? null;
  return { s, me, members, invites: demoInvites(s), plan, companyBranchIds };
}

export function demoInvite(input: InviteInput, companyBranchIds: readonly string[], plan: TeamPlan = DEMO_TEAM_PLAN): TeamResult<InviteCreated> {
  const ctx = context(companyBranchIds, plan);
  // The dueño sees every email in the demo, so "already in the team" is checked against all of them.
  const all = ctx.s.members.map((m) => ({ ...m, isMe: m.userId === meId(ctx.s) }));
  const problem = validateInvite(input, { me: ctx.me, members: all, invites: ctx.invites, plan: ctx.plan, companyBranchIds });
  if (problem) return problem;
  const email = normalizeEmail(input.email);
  const token = `demo-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + INVITE_TTL_DAYS * DAY).toISOString();
  const existing = ctx.s.invites.find((i) => normalizeEmail(i.email) === email);
  const invite: TeamInvite = {
    id: existing?.id ?? `demo-invite-${now.getTime().toString(36)}`,
    email,
    role: input.role,
    branchIds: normalizeScope(input.role, input.branchIds),
    createdAt: existing?.createdAt ?? now.toISOString(),
    lastSentAt: now.toISOString(),
    expiresAt,
    invitedBy: meId(ctx.s),
    expired: false,
  };
  useDemoTeam.setState((s) => ({ invites: [invite, ...s.invites.filter((i) => i.id !== invite.id)] }));
  return { data: { id: invite.id, token, link: inviteLink(token), expiresAt, email, emailed: true } };
}

export function demoRevokeInvite(inviteId: string): TeamWriteResult {
  const { me } = context([]);
  if (me?.role !== "dueno") return { error: "Solo el dueño del negocio puede cancelar invitaciones.", code: "not_allowed" };
  useDemoTeam.setState((s) => ({ invites: s.invites.filter((i) => i.id !== inviteId) }));
  return {};
}

export function demoUpdateMember(userId: string, change: MemberChange, companyBranchIds: readonly string[]): TeamWriteResult {
  const ctx = context(companyBranchIds);
  const target = ctx.members.find((m) => m.userId === userId);
  if (!target) return { error: "Esa persona ya no está en tu equipo.", code: "not_member" };
  const problem = validateMemberChange(target, change, { me: ctx.me, members: ctx.members, companyBranchIds });
  if (problem) return problem;
  useDemoTeam.setState((s) => ({
    members: s.members.map((m) => (m.userId === userId ? { ...m, role: change.role, branchIds: normalizeScope(change.role, change.branchIds) } : m)),
  }));
  return {};
}

export function demoRemoveMember(userId: string): TeamWriteResult {
  const ctx = context([]);
  if (ctx.me?.role !== "dueno") return { error: "Solo el dueño del negocio puede quitar personas del equipo.", code: "not_allowed" };
  const target = ctx.members.find((m) => m.userId === userId);
  if (!target) return {};
  const problem = validateRemoval(target, ctx.members);
  if (problem) return problem;
  useDemoTeam.setState((s) => ({
    members: s.members.filter((m) => m.userId !== userId),
    viewAs: s.viewAs === userId ? null : s.viewAs,
  }));
  return {};
}

/** Leaving in the demo: the previewed member leaves (the dueño, alone, can't). */
export function demoLeave(): TeamWriteResult {
  const ctx = context([]);
  if (!ctx.me) return {};
  const problem = validateRemoval(ctx.me, ctx.members);
  if (problem) return problem;
  if (!permissionsFor(ctx.me).leave) return { error: "No puedes salir de este equipo.", code: "not_allowed" };
  useDemoTeam.setState((s) => ({ members: s.members.filter((m) => m.userId !== ctx.me!.userId), viewAs: null }));
  return {};
}

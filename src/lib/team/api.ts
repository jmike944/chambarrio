"use client";

/*
 * Team accounts against Supabase (live mode only; demo never imports this for side effects and never
 * calls it). No store access: every function resolves { data } | { error, code } with a Spanish,
 * user-facing message and never throws. The hooks/actions in ./hooks call these.
 */
import { getSupabase } from "@/lib/supabase/client";
import { friendlyError, MSG } from "@/lib/live/backend";
import { isMissingRpc as missingRpc } from "@/lib/live/api";
import type { Database } from "@/lib/supabase/database.types";
import {
  inviteLink,
  type AcceptedInvite,
  type InviteCreated,
  type InviteInput,
  type InvitePreview,
  type MemberChange,
  type Membership,
  type TeamErrorCode,
  type TeamInvite,
  type TeamMember,
  type TeamPerson,
  type TeamResult,
  type TeamRole,
  type TeamWriteResult,
} from "./types";
import { normalizeEmail, normalizeScope } from "./permissions";

type Fns = Database["public"]["Functions"];
type DbError = { message?: string; code?: string; details?: string | null; hint?: string | null } | null | undefined;

const CODES: readonly TeamErrorCode[] = [
  "not_signed_in",
  "not_allowed",
  "invite_not_found",
  "invite_used",
  "invite_revoked",
  "invite_expired",
  "wrong_email",
  "email_unconfirmed",
  "other_company",
  "limit",
  "last_dueno",
  "already_member",
  "bad_email",
  "bad_role",
  "bad_branches",
  "not_member",
  "too_many_invites",
  "self_role",
];

/** The RPC isn't there (migration 20261108172838 not applied / stale schema cache). */
export const isMissingRpc = (e: DbError) => missingRpc(e);

/**
 * Team errors carry hint "team:<code>" and an already-friendly Spanish message: pass it through.
 * Anything else goes through the shared mapping.
 */
export function teamError(e: DbError, fallback: string = MSG.save): { error: string; code: TeamErrorCode } {
  const hint = e?.hint ?? "";
  if (hint.startsWith("team:")) {
    const code = hint.slice(5) as TeamErrorCode;
    if (CODES.includes(code) && e?.message) return { error: e.message, code };
  }
  if (isMissingRpc(e)) return { error: "Los equipos todavía no están activados. Intenta más tarde.", code: "unavailable" };
  const error = friendlyError(e, fallback);
  return { error, code: error === MSG.denied ? "not_allowed" : "unknown" };
}

const fail = (e: DbError, fallback?: string) => teamError(e, fallback);
const unavailable = () => ({ error: MSG.unavailable, code: "unavailable" as const });

// ------------------------------------------------------------------ mapping

const asRole = (v: unknown): TeamRole => (v === "dueno" || v === "admin" || v === "reclutador" ? v : "reclutador");
const asIds = (v: unknown): string[] | null => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : null);
const asText = (v: unknown): string => (typeof v === "string" ? v : "");

type MemberRow = Fns["team_members"]["Returns"][number];
type InviteRow = Fns["team_invites"]["Returns"][number];

const memberFromRow = (r: MemberRow): TeamMember => ({
  userId: r.user_id,
  role: asRole(r.role),
  branchIds: r.branch_ids ?? null,
  name: r.name ?? "",
  email: r.email ?? null,
  joinedAt: r.joined_at,
  invitedBy: r.invited_by ?? null,
  isMe: !!r.is_me,
});

const inviteFromRow = (r: InviteRow): TeamInvite => ({
  id: r.id,
  email: r.email,
  role: asRole(r.role),
  branchIds: r.branch_ids ?? null,
  createdAt: r.created_at,
  lastSentAt: r.last_sent_at,
  expiresAt: r.expires_at,
  invitedBy: r.invited_by ?? null,
  expired: !!r.expired,
});

// ------------------------------------------------------------------ reads

export type MembershipFetch = {
  membership: Membership | null;
  /** false: the database doesn't have team accounts yet (the caller falls back to "owner = dueño"). */
  teamsEnabled: boolean;
};

/** My company and role (0 or 1 membership). */
export async function fetchMyMembership(): Promise<TeamResult<MembershipFetch>> {
  const sb = getSupabase();
  if (!sb) return unavailable();
  try {
    const { data, error } = await sb.rpc("my_membership");
    if (error) {
      if (isMissingRpc(error)) return { data: { membership: null, teamsEnabled: false } };
      return fail(error, MSG.load);
    }
    const r = data?.[0];
    return {
      data: {
        teamsEnabled: true,
        membership: r
          ? {
              companyId: r.company_id,
              companyName: r.company_name ?? "",
              plan: r.plan,
              role: asRole(r.role),
              branchIds: r.branch_ids ?? null,
              joinedAt: r.joined_at,
            }
          : null,
      },
    };
  } catch (e) {
    return fail(e as DbError, MSG.load);
  }
}

/** The team (any member) and, for the dueño, the open invites. */
/**
 * The team. `withInvites` (the dueño): the open invitations too. Everyone else gets only how many are
 * pending (`pendingInvites`; null when unknown: a database without team_pending_invites, or it failed),
 * so their places counter still counts them.
 */
export async function fetchTeam(
  companyId: string,
  withInvites: boolean,
): Promise<TeamResult<{ members: TeamMember[]; invites: TeamInvite[]; pendingInvites: number | null }>> {
  const sb = getSupabase();
  if (!sb) return unavailable();
  try {
    const [members, invites, pending] = await Promise.all([
      sb.rpc("team_members", { p_company_id: companyId }),
      withInvites ? sb.rpc("team_invites", { p_company_id: companyId }) : Promise.resolve({ data: [] as InviteRow[], error: null }),
      withInvites ? null : sb.rpc("team_pending_invites", { p_company_id: companyId }),
    ]);
    const err = members.error ?? invites.error;
    if (err) return fail(err, MSG.load);
    // The count is extra: if it can't be read, the counter shows the members alone (the page still loads).
    const pendingInvites = pending && !pending.error && typeof pending.data === "number" ? pending.data : null;
    return {
      data: { members: (members.data ?? []).map(memberFromRow), invites: (invites.data ?? []).map(inviteFromRow), pendingInvites },
    };
  } catch (e) {
    return fail(e as DbError, MSG.load);
  }
}

/** Names for notes / timeline steps (members, and people who left but wrote or did something). */
export async function fetchTeamPeople(companyId: string): Promise<TeamResult<TeamPerson[]>> {
  const sb = getSupabase();
  if (!sb) return unavailable();
  try {
    const { data, error } = await sb.rpc("team_people", { p_company_id: companyId });
    if (error) return fail(error, MSG.load);
    return { data: (data ?? []).map((r) => ({ userId: r.user_id, name: r.name ?? "", role: r.role ? asRole(r.role) : null })) };
  } catch (e) {
    return fail(e as DbError, MSG.load);
  }
}

/** What /unirse shows for a token (works signed out). null = no such invite. */
export async function previewInvite(token: string): Promise<TeamResult<InvitePreview | null>> {
  const sb = getSupabase();
  if (!sb) return unavailable();
  if (!token.trim()) return { data: null };
  try {
    const { data, error } = await sb.rpc("invite_preview", { p_token: token.trim() });
    if (error) return fail(error, MSG.load);
    const r = data?.[0];
    if (!r) return { data: null };
    return {
      data: {
        status: r.status,
        companyName: r.company_name ?? "",
        role: asRole(r.role),
        branchNames: r.branch_names ?? null,
        inviterName: r.inviter_name ?? null,
        emailHint: r.email_hint ?? "",
        expiresAt: r.expires_at,
        emailMatches: r.email_matches ?? null,
      },
    };
  } catch (e) {
    return fail(e as DbError, MSG.load);
  }
}

/**
 * Who made each company-side step of these applications (event id → member user id). Team only: the
 * candidate never gets member ids (application_events.actor_user_id isn't selectable by
 * `authenticated`). Up to 200 applications per call; no RPC yet (migration not applied) = no names.
 */
export async function fetchEventActors(applicationIds: readonly string[]): Promise<TeamResult<Map<number, string>>> {
  const sb = getSupabase();
  if (!sb) return unavailable();
  const ids = [...new Set(applicationIds.filter(Boolean))].slice(0, 200);
  if (ids.length === 0) return { data: new Map() };
  try {
    const { data, error } = await sb.rpc("application_event_actors", { p_application_ids: ids });
    if (error) {
      if (isMissingRpc(error)) return { data: new Map() };
      return fail(error, MSG.load);
    }
    return { data: new Map((data ?? []).map((r) => [r.event_id, r.actor_user_id])) };
  } catch (e) {
    return fail(e as DbError, MSG.load);
  }
}

// ------------------------------------------------------------------ writes

export async function inviteMember(companyId: string, input: InviteInput): Promise<TeamResult<InviteCreated>> {
  const sb = getSupabase();
  if (!sb) return unavailable();
  try {
    const { data, error } = await sb.rpc("invite_member", {
      p_company_id: companyId,
      p_email: normalizeEmail(input.email),
      p_role: input.role,
      p_branch_ids: normalizeScope(input.role, input.branchIds),
    });
    if (error) return fail(error);
    const o = (data ?? {}) as Record<string, unknown>;
    const token = asText(o.token);
    if (!token) return { error: MSG.save, code: "unknown" };
    return {
      data: { id: asText(o.id), token, link: inviteLink(token), expiresAt: asText(o.expires_at), email: asText(o.email), emailed: o.emailed !== false },
    };
  } catch (e) {
    return fail(e as DbError);
  }
}

export async function revokeInvite(inviteId: string): Promise<TeamWriteResult> {
  const sb = getSupabase();
  if (!sb) return unavailable();
  try {
    const { error } = await sb.rpc("revoke_invite", { p_invite_id: inviteId });
    return error ? fail(error, "No pudimos cancelar la invitación. Intenta de nuevo.") : {};
  } catch (e) {
    return fail(e as DbError);
  }
}

export async function updateMember(companyId: string, userId: string, change: MemberChange): Promise<TeamWriteResult> {
  const sb = getSupabase();
  if (!sb) return unavailable();
  try {
    const { error } = await sb.rpc("update_member", {
      p_company_id: companyId,
      p_user_id: userId,
      p_role: change.role,
      p_branch_ids: normalizeScope(change.role, change.branchIds),
    });
    return error ? fail(error) : {};
  } catch (e) {
    return fail(e as DbError);
  }
}

export async function removeMember(companyId: string, userId: string): Promise<TeamWriteResult> {
  const sb = getSupabase();
  if (!sb) return unavailable();
  try {
    const { error } = await sb.rpc("remove_member", { p_company_id: companyId, p_user_id: userId });
    return error ? fail(error, "No pudimos quitar a esa persona. Intenta de nuevo.") : {};
  } catch (e) {
    return fail(e as DbError);
  }
}

export async function leaveCompany(companyId: string): Promise<TeamWriteResult> {
  const sb = getSupabase();
  if (!sb) return unavailable();
  try {
    const { error } = await sb.rpc("leave_company", { p_company_id: companyId });
    return error ? fail(error, "No pudimos sacarte del equipo. Intenta de nuevo.") : {};
  } catch (e) {
    return fail(e as DbError);
  }
}

/** Joins through an invite (signed in with the invited email). Idempotent on the server. */
export async function acceptInvite(token: string, name?: string | null): Promise<TeamResult<AcceptedInvite>> {
  const sb = getSupabase();
  if (!sb) return unavailable();
  try {
    const { data, error } = await sb.rpc("accept_invite", { p_token: token.trim(), p_name: name?.trim() || null });
    if (error) return fail(error, "No pudimos aceptar la invitación. Intenta de nuevo.");
    const o = (data ?? {}) as Record<string, unknown>;
    const companyId = asText(o.company_id);
    if (!companyId) return { error: MSG.save, code: "unknown" };
    return {
      data: {
        companyId,
        companyName: asText(o.company_name),
        role: asRole(o.role),
        branchIds: asIds(o.branch_ids),
        profileRole: o.profile_role === "candidato" ? "candidato" : "empresa",
      },
    };
  } catch (e) {
    return fail(e as DbError);
  }
}

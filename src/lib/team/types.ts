/*
 * "Tu equipo" (team accounts): shared types and constants. Pure — safe in server components.
 * Mirrors supabase/migrations/20261108172838_team_accounts.sql; the database enforces every rule,
 * the app mirrors them for instant feedback (see ./permissions).
 */
import type { Database } from "@/lib/supabase/database.types";

/** public.team_role. Ordered reclutador < admin < dueno. */
export type TeamRole = Database["public"]["Enums"]["team_role"];
export type TeamPlan = Database["public"]["Enums"]["plan_id"];

/** Display order (most powerful first). */
export const TEAM_ROLES: readonly TeamRole[] = ["dueno", "admin", "reclutador"];

export const ROLE_RANK: Record<TeamRole, number> = { reclutador: 1, admin: 2, dueno: 3 };

/** Copy for role pickers, chips and the invite email (keep in sync with send-emails/templates.ts). */
export const ROLE_META: Record<TeamRole, { label: string; long: string; description: string }> = {
  dueno: {
    label: "Dueño",
    long: "Dueño",
    description: "Todo: el plan, el equipo, los datos del negocio, vacantes, sucursales y postulantes.",
  },
  admin: {
    label: "Admin",
    long: "Administrador",
    description: "Datos del negocio, vacantes, sucursales, postulantes, entrevistas y notas.",
  },
  reclutador: {
    label: "Reclutador",
    long: "Reclutador",
    description: "Postulantes, entrevistas y notas. Puede ser solo de algunas sucursales.",
  },
};

/** People per plan (active members + pending, unexpired invites). null = no limit. Mirrors team_limit(). */
export const TEAM_LIMITS: Record<TeamPlan, number | null> = { "por-vacante": 2, pyme: 5, industrial: null };

/** null = no limit (industrial). An unknown plan gets the smallest limit, like team_limit(). */
export const teamLimit = (plan: TeamPlan): number | null => (Object.hasOwn(TEAM_LIMITS, plan) ? TEAM_LIMITS[plan] : 2);

export const INVITE_TTL_DAYS = 7;
/** The accept page: /unirse?t=<token>. */
export const INVITE_PATH = "/unirse";
export const SITE_URL = "https://chambarrio.com";

/** The link to share (copy, share sheet, SMS, correo). Uses this site's origin in the browser, chambarrio.com otherwise. */
export function inviteLink(token: string, origin?: string): string {
  const base = origin ?? (typeof window !== "undefined" ? window.location.origin : SITE_URL);
  return `${base}${INVITE_PATH}?t=${encodeURIComponent(token)}`;
}

/** The signed-in person's place in a company. */
export type Membership = {
  companyId: string;
  companyName: string;
  plan: TeamPlan;
  role: TeamRole;
  /** null = every branch. Only a reclutador can be limited ([] = all their branches were deleted: sees nothing). */
  branchIds: string[] | null;
  /** ISO; "" for the legacy owner fallback (database without team accounts yet). */
  joinedAt: string;
};

export type TeamMember = {
  userId: string;
  role: TeamRole;
  branchIds: string[] | null;
  /** profiles.name; may be "" (show the email or "Sin nombre"). */
  name: string;
  /** Only for the dueño (everyone's) and for yourself; null otherwise. */
  email: string | null;
  joinedAt: string;
  invitedBy: string | null;
  isMe: boolean;
};

/** An open invite (pending or expired-but-not-cancelled). Only the dueño sees these. */
export type TeamInvite = {
  id: string;
  email: string;
  role: TeamRole;
  branchIds: string[] | null;
  createdAt: string;
  lastSentAt: string;
  expiresAt: string;
  invitedBy: string | null;
  /** Expired invites don't count toward the plan limit; "Reenviar" (inviteMember again) renews them. */
  expired: boolean;
};

/** A name for "who did what" (notes' author_id, events' actor_user_id). role null = no longer in the team. */
export type TeamPerson = { userId: string; name: string; role: TeamRole | null };

export type InviteInput = {
  email: string;
  role: TeamRole;
  /** Reclutador only: null/omitted = every branch; else at least one of the company's branch ids. */
  branchIds?: string[] | null;
};

/** Sets both (not a patch): branchIds null/omitted = every branch (ignored unless reclutador). */
export type MemberChange = { role: TeamRole; branchIds?: string[] | null };

export type InviteCreated = {
  id: string;
  /** Raw one-time token: shown/shared now, never retrievable again. */
  token: string;
  /** inviteLink(token). */
  link: string;
  expiresAt: string;
  email: string;
  /**
   * false: the invite and its link work, but no email went out (that address already got 3 invitation
   * emails in the last 24 hours, from any business). Say "Comparte el enlace", not "Le mandamos…".
   */
  emailed: boolean;
};

export type AcceptedInvite = {
  companyId: string;
  companyName: string;
  role: TeamRole;
  branchIds: string[] | null;
  /** The account's role after accepting: a fresh account becomes "empresa"; an onboarded candidate keeps "candidato". */
  profileRole: "candidato" | "empresa";
};

export type InviteStatus = "vigente" | "vencida" | "cancelada" | "usada";

export type InvitePreview = {
  status: InviteStatus;
  companyName: string;
  role: TeamRole;
  /** null = every branch (or not a reclutador). */
  branchNames: string[] | null;
  inviterName: string | null;
  /** "ma•••@gmail.com": the address to sign in with. */
  emailHint: string;
  expiresAt: string;
  /** Signed in: does this account's email match? null when signed out. */
  emailMatches: boolean | null;
};

/** Machine-readable reason (the database's `hint` "team:<code>"), for UI branches beyond the message. */
export type TeamErrorCode =
  | "not_signed_in"
  | "not_allowed"
  | "invite_not_found"
  | "invite_used"
  | "invite_revoked"
  | "invite_expired"
  | "wrong_email"
  | "email_unconfirmed"
  | "other_company"
  | "limit"
  | "last_dueno"
  | "already_member"
  | "bad_email"
  | "bad_role"
  | "bad_branches"
  | "not_member"
  | "too_many_invites"
  | "self_role"
  /** Live isn't available / the database doesn't have team accounts yet / demo-only action. */
  | "unavailable"
  | "unknown";

export type TeamResult<T> =
  | { data: T; error?: undefined; code?: undefined }
  | { data?: undefined; error: string; code: TeamErrorCode };

export type TeamWriteResult = { error?: string; code?: TeamErrorCode };

export type LoadStatus = "loading" | "ready" | "error";

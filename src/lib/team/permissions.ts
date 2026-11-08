/*
 * What each role may see and do, as pure functions (server-safe). The database enforces all of this
 * (RLS + the team RPCs); the UI uses these to hide what someone can't do and to validate before
 * sending. Keep in sync with supabase/migrations/20261108172838_team_accounts.sql.
 */
import {
  ROLE_META,
  ROLE_RANK,
  teamLimit,
  type InviteInput,
  type MemberChange,
  type Membership,
  type TeamInvite,
  type TeamMember,
  type TeamErrorCode,
  type TeamPlan,
  type TeamRole,
} from "./types";

/** A rule the change breaks: the same message and code the database would answer. */
export type TeamIssue = { error: string; code: TeamErrorCode };
const issue = (code: TeamErrorCode, error: string): TeamIssue => ({ error, code });

export type TeamPermissions = {
  /** Invite, cancel invites, change roles / branches, remove people (dueño). */
  manageTeam: boolean;
  /** Plan, billing, paid unlocks (dueño). */
  managePlan: boolean;
  /** Company profile: name, kind, size, phone, about (dueño, admin). */
  editCompany: boolean;
  /** Add / edit / remove branches (dueño, admin). */
  manageBranches: boolean;
  /** Publish, edit, pause, reopen, close vacancies (dueño, admin). */
  manageJobs: boolean;
  /** Sees every branch's vacancies and applicants (dueño, admin, reclutador without a branch limit). */
  allBranches: boolean;
  /** Sees applicants and moves them: seen, interview, hire, decline, undo (everyone, within scope). */
  workApplicants: boolean;
  /** Reads and writes the private team notes (everyone, within scope; each deletes only their own). */
  writeNotes: boolean;
  /** Sees the team list (everyone; emails only for the dueño). */
  viewTeam: boolean;
  /** Can leave the team (everyone; the last dueño gets "team:last_dueno"). */
  leave: boolean;
};

export const NO_PERMISSIONS: TeamPermissions = {
  manageTeam: false,
  managePlan: false,
  editCompany: false,
  manageBranches: false,
  manageJobs: false,
  allBranches: false,
  workApplicants: false,
  writeNotes: false,
  viewTeam: false,
  leave: false,
};

export const atLeast = (role: TeamRole | null | undefined, min: TeamRole): boolean =>
  !!role && ROLE_RANK[role] >= ROLE_RANK[min];

type Scope = Pick<Membership, "role" | "branchIds"> | null | undefined;

export function permissionsFor(m: Scope): TeamPermissions {
  if (!m) return NO_PERMISSIONS;
  const dueno = m.role === "dueno";
  const admin = atLeast(m.role, "admin");
  return {
    manageTeam: dueno,
    managePlan: dueno,
    editCompany: admin,
    manageBranches: admin,
    manageJobs: admin,
    allBranches: admin || m.branchIds === null,
    workApplicants: true,
    writeNotes: true,
    viewTeam: true,
    leave: true,
  };
}

/** Mirrors can_see_branch(): dueños and admins see every branch; a reclutador only theirs. */
export function canSeeBranch(m: Scope, branchId: string | null | undefined): boolean {
  if (!m || !branchId) return false;
  if (atLeast(m.role, "admin") || m.branchIds === null) return true;
  return m.branchIds.includes(branchId);
}

/**
 * Keeps what this member may see. Use it on useMyCompany().jobs / branches for a branch-limited
 * reclutador: open vacancies of every branch are public (RLS returns them), so the list must be
 * filtered here; their applicants are blocked by the database anyway.
 */
export function filterByScope<T extends { branchId: string }>(m: Scope, items: readonly T[]): T[] {
  return items.filter((i) => canSeeBranch(m, i.branchId));
}

/** People counted toward the plan: members + pending (unexpired) invites. */
export function teamUsage(
  members: readonly TeamMember[],
  invites: readonly TeamInvite[],
  plan: TeamPlan,
): { used: number; limit: number | null; full: boolean; left: number | null } {
  const used = members.length + invites.filter((i) => !i.expired).length;
  const limit = teamLimit(plan);
  return { used, limit, full: limit !== null && used >= limit, left: limit === null ? null : Math.max(0, limit - used) };
}

export const normalizeEmail = (s: string) => s.trim().toLowerCase();

/**
 * Same rule invite_member applies (plain ascii addr-spec, lowercased, ≤ 254): no display names, quotes,
 * brackets, commas or spaces; a dotted domain.
 */
const EMAIL_RE = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/;
export const isValidEmail = (s: string): boolean => {
  const e = normalizeEmail(s);
  return e.length <= 254 && EMAIL_RE.test(e);
};

/**
 * The nudge under a full team: what the next plan allows ("Pyme permite hasta 5 personas."), or null on
 * Industrial (no limit). Show it with "Mejorar plan" (dueño only: can.managePlan).
 */
export function upgradeHint(plan: TeamPlan): string | null {
  if (plan === "por-vacante") return `Pyme permite hasta ${teamLimit("pyme")} personas.`;
  if (plan === "pyme") return "Industrial no tiene límite de personas.";
  return null;
}

/** The plan-limit message, as the UI should say it. */
export function limitMessage(plan: TeamPlan): string {
  const limit = teamLimit(plan);
  return limit === null
    ? "Tu plan no tiene límite de personas."
    : `Tu plan permite hasta ${limit} personas en tu equipo, contando las invitaciones pendientes.`;
}

type InviteContext = {
  me: Scope;
  members: readonly TeamMember[];
  invites: readonly TeamInvite[];
  plan: TeamPlan;
  /** The company's branch ids (to validate a reclutador's scope). */
  companyBranchIds: readonly string[];
};

/** Client-side mirror of invite_member's checks. null = it can go. */
export function validateInvite(input: InviteInput, ctx: InviteContext): TeamIssue | null {
  if (ctx.me?.role !== "dueno") return issue("not_allowed", "Solo el dueño del negocio puede invitar a su equipo.");
  const email = normalizeEmail(input.email);
  if (!isValidEmail(email)) return issue("bad_email", "Revisa el correo: parece que tiene un error.");
  if (!ROLE_META[input.role]) return issue("bad_role", "Elige qué puede hacer esa persona.");
  if (ctx.members.some((m) => m.email && normalizeEmail(m.email) === email)) return issue("already_member", "Esa persona ya está en tu equipo.");
  const scopeIssue = validateScope(input.role, input.branchIds, ctx.companyBranchIds);
  if (scopeIssue) return scopeIssue;
  // Re-inviting the same address replaces its pending invite (doesn't take another place).
  const others = ctx.invites.filter((i) => normalizeEmail(i.email) !== email);
  if (teamUsage(ctx.members, others, ctx.plan).full) return issue("limit", limitMessage(ctx.plan));
  return null;
}

/** Client-side mirror of update_member's checks. */
export function validateMemberChange(
  target: TeamMember,
  change: MemberChange,
  ctx: { me: Scope; members: readonly TeamMember[]; companyBranchIds: readonly string[] },
): TeamIssue | null {
  if (ctx.me?.role !== "dueno") return issue("not_allowed", "Solo el dueño del negocio puede cambiar los permisos del equipo.");
  if (!ROLE_META[change.role]) return issue("bad_role", "Elige qué puede hacer esa persona.");
  if (target.isMe && ROLE_RANK[change.role] > ROLE_RANK[target.role]) return issue("self_role", "No puedes subir tu propio rol.");
  if (target.role === "dueno" && change.role !== "dueno" && !ctx.members.some((m) => m.role === "dueno" && m.userId !== target.userId))
    return issue("last_dueno", "Tu negocio necesita al menos un dueño. Nombra a otra persona como dueña primero.");
  return validateScope(change.role, change.branchIds, ctx.companyBranchIds);
}

/** Client-side mirror of remove_member / leave_company: the last dueño stays. */
export function validateRemoval(target: TeamMember, members: readonly TeamMember[]): TeamIssue | null {
  if (target.role === "dueno" && !members.some((m) => m.role === "dueno" && m.userId !== target.userId)) {
    return issue(
      "last_dueno",
      target.isMe
        ? "Eres el único dueño. Nombra a otra persona como dueña antes de salir."
        : "Tu negocio necesita al menos un dueño. Nombra a otra persona como dueña primero.",
    );
  }
  return null;
}

/** Normalizes a scope the way the database stores it: null unless a limited reclutador; sorted, distinct. */
export function normalizeScope(role: TeamRole, branchIds: readonly string[] | null | undefined): string[] | null {
  if (role !== "reclutador" || branchIds == null) return null;
  return [...new Set(branchIds.filter(Boolean))].toSorted();
}

function validateScope(
  role: TeamRole,
  branchIds: readonly string[] | null | undefined,
  companyBranchIds: readonly string[],
): TeamIssue | null {
  const ids = normalizeScope(role, branchIds);
  if (ids === null) return null;
  if (ids.length === 0) return issue("bad_branches", "Elige al menos una sucursal, o todas.");
  if (ids.some((id) => !companyBranchIds.includes(id)))
    return issue("bad_branches", "Alguna de esas sucursales ya no es de tu negocio. Vuelve a elegirlas.");
  return null;
}

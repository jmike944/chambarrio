/*
 * "Tu equipo" (team accounts): one import for client components.
 *   import { useMyMembership, useTeam, inviteMember, ROLE_META } from "@/lib/team";
 * Server components: import the pure pieces from "@/lib/team/types" and "@/lib/team/permissions".
 * API reference: team-api.md (handed to the UI agent).
 */
export type {
  AcceptedInvite,
  InviteCreated,
  InviteInput,
  InvitePreview,
  InviteStatus,
  LoadStatus,
  MemberChange,
  Membership,
  TeamErrorCode,
  TeamInvite,
  TeamMember,
  TeamPerson,
  TeamPlan,
  TeamResult,
  TeamRole,
  TeamWriteResult,
} from "./types";
export { INVITE_PATH, INVITE_TTL_DAYS, ROLE_META, ROLE_RANK, TEAM_LIMITS, TEAM_ROLES, inviteLink, teamLimit } from "./types";

export type { TeamIssue, TeamPermissions } from "./permissions";
export {
  NO_PERMISSIONS,
  atLeast,
  canSeeBranch,
  filterByScope,
  isValidEmail,
  limitMessage,
  normalizeEmail,
  permissionsFor,
  teamUsage,
  upgradeHint,
  validateInvite,
  validateMemberChange,
  validateRemoval,
} from "./permissions";

export type { Can, MyMembership, TeamPeople, TeamView } from "./hooks";
export {
  acceptInvite,
  fetchEventActors,
  inviteMember,
  leaveTeam,
  previewInvite,
  removeMember,
  revokeInvite,
  setDemoViewAs,
  updateMember,
  useCan,
  useMyMembership,
  useTeam,
  useTeamPeople,
} from "./hooks";

export { DEMO_OWNER_ID, DEMO_RECRUITER_BRANCH, DEMO_RECRUITER_ID, DEMO_TEAM_PLAN } from "./demo";

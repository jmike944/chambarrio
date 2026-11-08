import { INVITE_PATH } from "@/lib/team/types";

/*
 * `?next=` handoff for sign-in (/entrar, the email-link landing /entrar/listo): a same-site path to
 * return to afterwards, e.g. a team invite "/unirse?t=…". Never log these: an invite path carries its token.
 */

/** A same-origin path + query from a raw `next` value, or null (open-redirect guard). */
export function safeNextPath(raw: string | null | undefined, origin: string): string | null {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return null;
  try {
    const url = new URL(raw, origin);
    return url.origin === origin ? url.pathname + url.search : null;
  } catch {
    return null;
  }
}

/** The page's own `?next=` (client only; null on the server). */
export function readNextParam(): string | null {
  if (typeof window === "undefined") return null;
  return safeNextPath(new URLSearchParams(window.location.search).get("next"), window.location.origin);
}

/** A team invite (/unirse?t=…): joining replaces onboarding, so it's the next stop for any account. */
export const isInvitePath = (path: string | null | undefined): path is string =>
  !!path && (path === INVITE_PATH || path.startsWith(`${INVITE_PATH}?`) || path.startsWith(`${INVITE_PATH}/`));

/** "/unirse?t=…" for this token. */
export const invitePath = (token: string) => `${INVITE_PATH}?t=${encodeURIComponent(token)}`;

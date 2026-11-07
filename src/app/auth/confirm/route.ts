import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";

/**
 * Landing point for links in Supabase auth emails. Handles both shapes:
 *  - `?code=…` (PKCE, what the default "Magic Link" template produces with @supabase/ssr), and
 *  - `?token_hash=…&type=email` (a custom template: {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email).
 * `next` must resolve to a path on this same origin; anything else falls back to /inicio.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const safeNext = sameOriginUrl(url.searchParams.get("next"), url.origin);

  const supabase = await getServerSupabase();
  if (supabase) {
    const { error } = code
      ? await supabase.auth.exchangeCodeForSession(code)
      : tokenHash && type
        ? await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
        : { error: new Error("missing token") };
    if (!error) return NextResponse.redirect(safeNext);
  }
  return NextResponse.redirect(new URL("/entrar?error=enlace", url.origin));
}

/**
 * Open-redirect guard. A prefix check isn't enough: URL parsing turns "/\evil.com" or "/<tab>/evil.com"
 * into "//evil.com", and "/.//evil.com" normalizes to the path "//evil.com". So resolve it once, keep
 * it only if it stays on our origin, and redirect to that resolved URL (never re-resolve the path).
 */
function sameOriginUrl(next: string | null, origin: string): URL {
  const fallback = new URL("/inicio", origin);
  if (!next || !next.startsWith("/")) return fallback;
  try {
    const target = new URL(next, origin);
    return target.origin === origin ? target : fallback;
  } catch {
    return fallback;
  }
}

"use client";

import type { Role } from "@/lib/store";
import { getSupabase } from "./client";

/**
 * Live-mode sign-in. Three ways in, all on Supabase Auth:
 *  - email one-time code (the email template shows {{ .Token }}; the link also works via /auth/confirm)
 *  - SMS one-time code (Twilio, configured in Supabase → Auth → Phone)
 *  - email or phone + password, for people who'd rather not wait for a code every time
 * Every function returns a Spanish, user-facing error message or null.
 */

export type Channel = "email" | "sms";

/** Mexican mobile numbers: 10 digits → E.164 (+52XXXXXXXXXX). Accepts input with spaces/dashes or +52. */
export function toE164MX(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  const local = digits.startsWith("52") && digits.length === 12 ? digits.slice(2) : digits;
  return local.length === 10 ? `+52${local}` : null;
}

function client() {
  const sb = getSupabase();
  if (!sb) throw new Error("Supabase no está configurado");
  return sb;
}

function friendly(message: string | undefined): string {
  if (!message) return "Algo salió mal. Intenta de nuevo.";
  const m = message.toLowerCase();
  if (/failed to fetch|networkerror|network request failed|load failed|fetch failed/.test(m))
    return "Sin conexión. Revisa tu internet e intenta de nuevo.";
  if (m.includes("rate limit") || m.includes("too many")) return "Pediste muchos códigos. Espera un minuto y vuelve a intentar.";
  // "For security purposes, you can only request this after 42 seconds."
  if (m.includes("security purposes")) {
    const secs = m.match(/after (\d+) second/)?.[1];
    return `Espera ${secs ? `${secs} segundos` : "un momento"} antes de pedir otro código.`;
  }
  if (m.includes("expired") || (m.includes("invalid") && (m.includes("otp") || m.includes("token")))) return "El código no es válido o ya venció. Pide uno nuevo.";
  if (m.includes("invalid login credentials")) return "El correo/teléfono o la contraseña no coinciden.";
  if (m.includes("not confirmed")) return "Todavía no confirmas tu cuenta. Entra con un código y listo.";
  if (m.includes("different from the old")) return "Esa ya es tu contraseña. Escribe una nueva.";
  if (m.includes("password") && m.includes("characters")) return "La contraseña debe tener al menos 8 caracteres.";
  if (m.includes("weak") || m.includes("pwned")) return "Esa contraseña es muy fácil de adivinar. Prueba otra.";
  // Twilio not configured yet: "Unsupported phone provider", "Phone logins are disabled", "phone_provider_disabled"…
  if (m.includes("phone") && (m.includes("provider") || m.includes("disabled") || m.includes("unsupported")))
    return "Los mensajes SMS todavía no están activados. Entra con tu correo.";
  if (m.includes("signups not allowed") || m.includes("signup is disabled")) return "Por ahora no estamos aceptando cuentas nuevas.";
  if (m.includes("email") && m.includes("invalid")) return "Revisa tu correo: parece que tiene un error.";
  return "Algo salió mal. Intenta de nuevo.";
}

/**
 * Sends a 6-digit code. New users are created on the fly: sign-up passes the role they picked;
 * sign-in (/entrar) passes none, so an existing account keeps its own and the email link lands on
 * /entrar/listo, which routes by the account's role.
 * `next`: a same-site path the email's link returns to instead (e.g. "/unirse?t=…" for a team invite,
 * so tapping the link instead of typing the code still lands on the same invite).
 */
export async function sendCode(channel: Channel, to: string, role?: Role, next?: string): Promise<string | null> {
  const sb = client();
  const data = role ? { role } : undefined;
  if (channel === "email") {
    const custom = next && next.startsWith("/") && !next.startsWith("//") ? `?next=${encodeURIComponent(next)}` : "";
    const query = custom || (role ? `?next=${role === "empresa" ? "/empresa" : "/inicio"}` : "");
    const { error } = await sb.auth.signInWithOtp({
      email: to.trim().toLowerCase(),
      options: { shouldCreateUser: true, data, emailRedirectTo: `${window.location.origin}/auth/confirm${query}` },
    });
    return error ? friendly(error.message) : null;
  }
  const phone = toE164MX(to);
  if (!phone) return "Escribe tu número de 10 dígitos.";
  const { error } = await sb.auth.signInWithOtp({ phone, options: { shouldCreateUser: true, data, channel: "sms" } });
  return error ? friendly(error.message) : null;
}

export async function verifyCode(channel: Channel, to: string, token: string): Promise<string | null> {
  const sb = client();
  const code = token.replace(/\D/g, "");
  const { error } =
    channel === "email"
      ? await sb.auth.verifyOtp({ email: to.trim().toLowerCase(), token: code, type: "email" })
      : await sb.auth.verifyOtp({ phone: toE164MX(to) ?? to, token: code, type: "sms" });
  return error ? friendly(error.message) : null;
}

/** Password sign-in with whichever identifier the user typed (email if it has an @, else MX phone). */
export async function signInWithPassword(identifier: string, password: string): Promise<string | null> {
  const sb = client();
  const id = identifier.trim();
  const { error } = id.includes("@")
    ? await sb.auth.signInWithPassword({ email: id.toLowerCase(), password })
    : await sb.auth.signInWithPassword({ phone: toE164MX(id) ?? id, password });
  return error ? friendly(error.message) : null;
}

/** Optional: lets a signed-in user add (or change) a password so next time they can skip the code. */
export async function setPassword(password: string): Promise<string | null> {
  if (password.length < 8) return "La contraseña debe tener al menos 8 caracteres.";
  // The flag lets the UI know a password exists (Supabase doesn't expose that): useLiveUser().hasPassword.
  const { error } = await client().auth.updateUser({ password, data: { has_password: true } });
  return error ? friendly(error.message) : null;
}

export async function signOutLive(): Promise<void> {
  await getSupabase()?.auth.signOut();
}

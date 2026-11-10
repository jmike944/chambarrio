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

/**
 * Twilio Verify refused to send. Supabase answers code "sms_send_failed" with "Error sending confirmation OTP
 * to provider: Invalid parameter `To`: +52… More information: https://www.twilio.com/docs/errors/60200",
 * so the Twilio error number says whose problem it is: a number the person can fix, or a block / setup
 * problem where email is the way in (messages that mention "SMS" get the "Usar mi correo" button in CodeAuth).
 */
function smsSendFailed(m: string): string {
  const twilio = Number(m.match(/errors\/(\d+)/)?.[1]);
  if (twilio === 60205 || m.includes("landline")) return "Ese número es fijo. Escribe un número de celular.";
  if (twilio === 60200 || twilio === 21211 || twilio === 21614) return "Revisa tu número: no parece un celular válido.";
  if (twilio === 60203 || twilio === 60212 || twilio === 20429)
    return "Pediste muchos códigos a este número. Espera 10 minutos y vuelve a intentar.";
  return "No pudimos mandarte el SMS. Intenta en un rato o entra con tu correo.";
}

function friendly(error: { message?: string; code?: string } | null | undefined): string {
  const message = error?.message;
  if (!message) return "Algo salió mal. Intenta de nuevo.";
  const m = message.toLowerCase();
  // First: the Twilio text inside can say "invalid", "phone", "provider"… and fool the checks below.
  if (error?.code === "sms_send_failed" || /error sending \w+ otp to provider/.test(m)) return smsSendFailed(m);
  if (/failed to fetch|networkerror|network request failed|load failed|fetch failed/.test(m))
    return "Sin conexión. Revisa tu internet e intenta de nuevo.";
  if (m.includes("rate limit") || m.includes("too many")) return "Pediste muchos códigos. Espera un minuto y vuelve a intentar.";
  // "For security purposes, you can only request this after 42 seconds."
  if (m.includes("security purposes")) {
    const secs = m.match(/after (\d+) second/)?.[1];
    return `Espera ${secs ? `${secs} segundos` : "un momento"} antes de pedir otro código.`;
  }
  if (m.includes("expired") || (m.includes("invalid") && (m.includes("otp") || m.includes("token")))) return "El código no es válido o ya venció. Pide uno nuevo.";
  if (error?.code === "phone_exists" || m.includes("phone number has already been registered"))
    return "Ese celular ya es de otra cuenta de Chambarrio. Escribe otro número.";
  if (m.includes("invalid login credentials")) return "El correo/teléfono o la contraseña no coinciden.";
  if (m.includes("not confirmed")) return "Todavía no confirmas tu cuenta. Entra con un código y listo.";
  if (m.includes("different from the old")) return "Esa ya es tu contraseña. Escribe una nueva.";
  if (m.includes("password") && m.includes("characters")) return "La contraseña debe tener al menos 8 caracteres.";
  if (m.includes("weak") || m.includes("pwned")) return "Esa contraseña es muy fácil de adivinar. Prueba otra.";
  // Twilio not configured yet: "Unsupported phone provider", "Phone logins are disabled", "phone_provider_disabled"…
  if (error?.code === "phone_provider_disabled" || (m.includes("phone") && (m.includes("provider") || m.includes("disabled") || m.includes("unsupported"))))
    return "Los mensajes SMS todavía no están activados. Entra con tu correo.";
  if (m.includes("signups not allowed") || m.includes("signup is disabled")) return "Por ahora no estamos aceptando cuentas nuevas.";
  if (m.includes("email") && m.includes("invalid")) return "Revisa tu correo: parece que tiene un error.";
  return "Algo salió mal. Intenta de nuevo.";
}

/**
 * Sends a 6-digit code. New users are created on the fly: sign-up passes the role they picked, and
 * the email link lands on that role's home. Sign-in (/entrar) lands on /entrar/listo, which routes by
 * the account's own role; it may pass `newRole`, the type a brand-new account gets (the side of
 * /entrar it came from). Either role only reaches a new account: the profile trigger reads it on insert.
 * `next`: a same-site path the email's link returns to instead (e.g. "/unirse?t=…" for a team invite,
 * so tapping the link instead of typing the code still lands on the same invite).
 */
export async function sendCode(channel: Channel, to: string, role?: Role, next?: string, newRole?: Role): Promise<string | null> {
  const sb = client();
  const metaRole = role ?? newRole;
  const data = metaRole ? { role: metaRole } : undefined;
  if (channel === "email") {
    const custom = next && next.startsWith("/") && !next.startsWith("//") ? `?next=${encodeURIComponent(next)}` : "";
    const query = custom || (role ? `?next=${role === "empresa" ? "/empresa" : "/inicio"}` : "");
    const { error } = await sb.auth.signInWithOtp({
      email: to.trim().toLowerCase(),
      options: { shouldCreateUser: true, data, emailRedirectTo: `${window.location.origin}/auth/confirm${query}` },
    });
    return error ? friendly(error) : null;
  }
  const phone = toE164MX(to);
  if (!phone) return "Escribe tu número de 10 dígitos.";
  const { error } = await sb.auth.signInWithOtp({ phone, options: { shouldCreateUser: true, data, channel: "sms" } });
  return error ? friendly(error) : null;
}

export async function verifyCode(channel: Channel, to: string, token: string): Promise<string | null> {
  const sb = client();
  const code = token.replace(/\D/g, "");
  const { error } =
    channel === "email"
      ? await sb.auth.verifyOtp({ email: to.trim().toLowerCase(), token: code, type: "email" })
      : await sb.auth.verifyOtp({ phone: toE164MX(to) ?? to, token: code, type: "sms" });
  return error ? friendly(error) : null;
}

/**
 * Adds (or changes) the celular you sign in with, on the account you're already in: Supabase texts a
 * code to the new number and only links it once that code comes back (verifyPhoneChange). The phone
 * typed in the profile is contact info only, so an email account can't "Entrar con SMS" until this.
 */
export async function sendPhoneChangeCode(raw: string): Promise<string | null> {
  const phone = toE164MX(raw);
  if (!phone) return "Escribe tu número de 10 dígitos.";
  const { error } = await client().auth.updateUser({ phone });
  return error ? friendly(error) : null;
}

export async function verifyPhoneChange(raw: string, token: string): Promise<string | null> {
  const phone = toE164MX(raw);
  if (!phone) return "Escribe tu número de 10 dígitos.";
  const { error } = await client().auth.verifyOtp({ phone, token: token.replace(/\D/g, ""), type: "phone_change" });
  return error ? friendly(error) : null;
}

/** Password sign-in with whichever identifier the user typed (email if it has an @, else MX phone). */
export async function signInWithPassword(identifier: string, password: string): Promise<string | null> {
  const sb = client();
  const id = identifier.trim();
  const { error } = id.includes("@")
    ? await sb.auth.signInWithPassword({ email: id.toLowerCase(), password })
    : await sb.auth.signInWithPassword({ phone: toE164MX(id) ?? id, password });
  return error ? friendly(error) : null;
}

/** Optional: lets a signed-in user add (or change) a password so next time they can skip the code. */
export async function setPassword(password: string): Promise<string | null> {
  if (password.length < 8) return "La contraseña debe tener al menos 8 caracteres.";
  // The flag lets the UI know a password exists (Supabase doesn't expose that): useLiveUser().hasPassword.
  const { error } = await client().auth.updateUser({ password, data: { has_password: true } });
  return error ? friendly(error) : null;
}

export async function signOutLive(): Promise<void> {
  await getSupabase()?.auth.signOut();
}

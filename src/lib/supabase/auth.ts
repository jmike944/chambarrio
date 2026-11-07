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
  if (m.includes("rate limit") || m.includes("too many")) return "Pediste muchos códigos. Espera un minuto y vuelve a intentar.";
  if (m.includes("expired") || (m.includes("invalid") && (m.includes("otp") || m.includes("token")))) return "El código no es válido o ya venció. Pide uno nuevo.";
  if (m.includes("invalid login credentials")) return "El correo/teléfono o la contraseña no coinciden.";
  if (m.includes("password") && m.includes("characters")) return "La contraseña debe tener al menos 8 caracteres.";
  if (m.includes("weak") || m.includes("pwned")) return "Esa contraseña es muy fácil de adivinar. Prueba otra.";
  if (m.includes("phone") && m.includes("provider")) return "Los mensajes SMS todavía no están activados. Entra con tu correo.";
  return "Algo salió mal. Intenta de nuevo.";
}

/** Sends a 6-digit code. New users are created on the fly with their chosen role. */
export async function sendCode(channel: Channel, to: string, role: Role): Promise<string | null> {
  const sb = client();
  if (channel === "email") {
    const { error } = await sb.auth.signInWithOtp({
      email: to.trim().toLowerCase(),
      options: {
        shouldCreateUser: true,
        data: { role },
        emailRedirectTo: `${window.location.origin}/auth/confirm?next=${role === "empresa" ? "/empresa" : "/inicio"}`,
      },
    });
    return error ? friendly(error.message) : null;
  }
  const phone = toE164MX(to);
  if (!phone) return "Escribe tu número de 10 dígitos.";
  const { error } = await sb.auth.signInWithOtp({ phone, options: { shouldCreateUser: true, data: { role }, channel: "sms" } });
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

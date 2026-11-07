import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/supabase/database.types";
import { SUPABASE_KEY, SUPABASE_URL, isSupabaseConfigured } from "@/lib/supabase/env";

/*
 * RFC 8058 one-click unsubscribe: the target of each email's
 *   List-Unsubscribe: <https://chambarrio.com/avisos/baja/un-clic?t=<token>&k=<kind>>
 *   List-Unsubscribe-Post: List-Unsubscribe=One-Click
 * Mail providers POST here (body "List-Unsubscribe=One-Click") without cookies, so it calls the
 * public unsubscribe_email RPC with the publishable key. Unknown tokens still get 200 (the answer
 * never says whether a token exists). A GET (someone opening the URL) goes to the human page,
 * which asks before changing anything.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KINDS = new Set(["alerts", "updates", "all"]);
const NO_STORE = { "Cache-Control": "no-store" };

function text(body: string, status: number) {
  return new NextResponse(body, { status, headers: { "Content-Type": "text/plain; charset=utf-8", ...NO_STORE } });
}

/** t / k from the query string first, then (if missing) from a form body. */
async function readParams(request: NextRequest): Promise<{ t: string | null; k: string | null }> {
  const q = request.nextUrl.searchParams;
  let t = q.get("t");
  let k = q.get("k");
  if (t && k) return { t, k };
  const type = request.headers.get("content-type") ?? "";
  if (type.includes("application/x-www-form-urlencoded") || type.includes("multipart/form-data")) {
    try {
      const form = await request.formData();
      const ft = form.get("t");
      const fk = form.get("k");
      t ??= typeof ft === "string" ? ft : null;
      k ??= typeof fk === "string" ? fk : null;
    } catch {
      // Unreadable body: fall through with whatever the query had.
    }
  }
  return { t, k };
}

export async function POST(request: NextRequest) {
  const { t, k } = await readParams(request);
  const token = t?.trim() ?? "";
  // Our links always carry both; anything else is a mangled URL, not a request to drop everything.
  const kind = k?.trim() ?? "";
  if (!UUID.test(token) || !KINDS.has(kind)) return text("Solicitud no válida.", 400);
  if (!isSupabaseConfigured) return text("Los avisos por correo no están disponibles.", 503);

  const sb = createClient<Database>(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  try {
    const { error } = await sb.rpc("unsubscribe_email", { p_token: token, p_kind: kind });
    // Server trouble: a non-2xx lets the mail provider retry later. Never echo the error.
    if (error) return text("No pudimos procesarlo. Intenta más tarde.", 503);
  } catch {
    return text("No pudimos procesarlo. Intenta más tarde.", 503);
  }
  return text("Listo. Ya no te mandaremos esos correos.", 200);
}

export function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  const target = new URL("/avisos/baja", request.nextUrl.origin);
  for (const key of ["t", "k"]) {
    const v = q.get(key);
    if (v) target.searchParams.set(key, v);
  }
  return NextResponse.redirect(target, { status: 303, headers: NO_STORE });
}

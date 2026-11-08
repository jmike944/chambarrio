/**
 * send-emails: drains public.email_outbox through Resend.
 *
 * Woken by the email_outbox AFTER INSERT trigger and by the pg_cron retry tick (every 10 minutes,
 * only when rows are waiting), both through pg_net with an empty body and no Authorization header
 * (hence verify_jwt = false; see README.md).
 * The request body is never read: any call just means "send whatever is pending", and the outbox
 * claim (FOR UPDATE SKIP LOCKED) plus Resend's Idempotency-Key make extra or concurrent calls safe.
 *
 * Privacy: logs carry outbox ids, kinds, HTTP statuses and error codes only — never addresses,
 * names or payloads (a team_invite payload carries the invite link's token until the row settles;
 * the email_outbox_scrub_invite trigger then drops it).
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  isEmailKind,
  isTransactional,
  renderEmail,
  unsubscribeKindFor,
  urls,
  type EmailKind,
  type RenderedEmail,
} from "./templates.ts";

// Minimal ambient types (the web app's tsconfig excludes supabase/functions; this keeps editors quiet).
declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (req: Request) => Response | Promise<Response>): unknown;
};
const edgeRuntime = (globalThis as { EdgeRuntime?: { waitUntil(p: Promise<unknown>): void } }).EdgeRuntime;

const FROM = "Chambarrio <no-reply@chambarrio.com>";
const RESEND_URL = "https://api.resend.com/emails";
/** Rows claimed per round. Small, so stopping on a 429 or the time budget releases few untried rows. */
const BATCH_SIZE = 10;
/** Resend's default limit is 2 requests/second; keep one sender comfortably under it. */
const PACE_MS = 600;
/** Stop claiming new batches after this long (a batch takes ≤ ~7 s, so a run ends near 50 s). */
const CLAIM_UNTIL_MS = 43_000;
/** Hard stop: rows not yet tried after this go back to pending. */
const HARD_STOP_MS = 55_000;
/**
 * Answer the HTTP call by then; the run keeps going in the background. pg_net times out at 5 s and
 * a cold start can eat ~4 s of that before the handler even runs, so answer fast.
 */
const RESPOND_WITHIN_MS = 1_000;
/** Another run that claimed rows this recently is treated as active, so this call stands down. */
const ACTIVE_SENDER_WINDOW_MS = 90_000;

interface OutboxRow {
  id: string;
  kind: string;
  /** null only for team_invite (the invitee may not have an account yet). */
  user_id: string | null;
  to_email: string;
  payload: unknown;
  attempts: number;
}

interface ProfilePrefs {
  id: string;
  unsubscribe_token: string | null;
  email_alerts: boolean;
  email_updates: boolean;
}

interface Stats {
  ok: boolean;
  sent: number;
  failed: number;
  skipped: number;
  rate_limited?: boolean;
  note?: string;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

function log(event: string, fields: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ fn: "send-emails", event, ...fields }));
}

const errorName = (e: unknown) => (e instanceof Error ? e.name : typeof e);

/** Service key: the new secret key if the project has one, else the legacy service_role JWT. */
function serviceKey(): string | undefined {
  const raw = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (raw) {
    try {
      const key = (JSON.parse(raw) as Record<string, unknown>)["default"];
      if (typeof key === "string" && key) return key;
    } catch {
      // fall through to the legacy key
    }
  }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || undefined;
}

// --------------------------------------------------------------------------------------- db helpers

async function finish(db: SupabaseClient, row: OutboxRow, ok: boolean, error: string | null = null) {
  const { error: rpcError } = await db.rpc("finish_email", { p_id: row.id, p_ok: ok, p_error: error });
  // If this fails the row stays "sending" and is reclaimed after 10 min; the Idempotency-Key keeps
  // Resend from sending it twice within 24 h.
  if (rpcError) log("finish_failed", { id: row.id, code: rpcError.code });
}

/**
 * A claimed row this run never tried (time budget, rate limit, prefs lookup failure): back to
 * pending without spending one of its 5 attempts. Falls back to finish_email (which does spend one)
 * if release_email isn't there yet (migration 20261107223917 not applied).
 */
async function release(db: SupabaseClient, row: OutboxRow, reason: string) {
  const { error } = await db.rpc("release_email", { p_id: row.id, p_reason: reason });
  if (error) await finish(db, row, false, reason);
}

/** Terminal states finish_email can't express: skipped (opted out) or failed (unrenderable). */
async function settle(db: SupabaseClient, row: OutboxRow, status: "skipped" | "failed", reason: string) {
  const { error } = await db
    .from("email_outbox")
    .update({ status, last_error: reason.slice(0, 500) })
    .eq("id", row.id);
  if (error) log("settle_failed", { id: row.id, code: error.code });
}

async function anotherSenderActive(db: SupabaseClient): Promise<boolean> {
  const since = new Date(Date.now() - ACTIVE_SENDER_WINDOW_MS).toISOString();
  const { count, error } = await db
    .from("email_outbox")
    .select("id", { count: "exact", head: true })
    .eq("status", "sending")
    .gt("claimed_at", since);
  return !error && (count ?? 0) > 0;
}

async function loadPrefs(db: SupabaseClient, userIds: (string | null)[]): Promise<Map<string, ProfilePrefs> | null> {
  const ids = [...new Set(userIds.filter((id): id is string => !!id))];
  if (ids.length === 0) return new Map();
  const { data, error } = await db
    .from("profiles")
    .select("id, unsubscribe_token, email_alerts, email_updates")
    .in("id", ids);
  if (error) {
    log("prefs_failed", { code: error.code });
    return null;
  }
  return new Map((data as ProfilePrefs[]).map((p) => [p.id, p]));
}

// ------------------------------------------------------------------------------------------- resend

type SendResult = { ok: true } | { ok: false; status: number; error: string };

async function sendViaResend(
  apiKey: string,
  row: OutboxRow,
  kind: EmailKind,
  token: string | null,
  email: RenderedEmail,
): Promise<SendResult> {
  const headers: Record<string, string> = {};
  if (token) {
    // RFC 8058 one-click unsubscribe (Gmail/Yahoo bulk-sender requirement).
    headers["List-Unsubscribe"] = `<${urls.oneClickUnsubscribe(token, unsubscribeKindFor(kind))}>`;
    headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
  }
  let res: Response;
  try {
    res = await fetch(RESEND_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        // Same outbox row → same key, so a retry after a lost response never double-sends (24 h window).
        "Idempotency-Key": row.id,
      },
      body: JSON.stringify({
        from: FROM,
        to: [row.to_email],
        subject: email.subject,
        html: email.html,
        text: email.text,
        headers,
        tags: [{ name: "kind", value: kind }],
      }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch (e) {
    return { ok: false, status: 0, error: `network ${errorName(e)}` };
  }
  if (res.ok) {
    await res.body?.cancel();
    return { ok: true };
  }
  // Resend errors look like {statusCode, name, message}. Keep the code; the message only goes to the
  // service-role-only outbox row (it can quote the address), never to logs.
  let name = "unknown_error";
  let message = "";
  try {
    const body = (await res.json()) as { name?: unknown; message?: unknown };
    if (typeof body.name === "string") name = body.name;
    if (typeof body.message === "string") message = body.message;
  } catch {
    // non-JSON error body
  }
  return { ok: false, status: res.status, error: `resend ${res.status} ${name}${message ? `: ${message}` : ""}` };
}

// -------------------------------------------------------------------------------------------- drain

async function drain(db: SupabaseClient, apiKey: string, stats: Stats, startedAt: number) {
  // Each enqueue statement that adds rows fires a wake-up, so bursts of applications can start a few
  // runs at once. A short random delay plus "is someone already sending?" keeps it to roughly one
  // sender, which keeps us under Resend's rate limit. A rare overlap is harmless: claims never overlap.
  await sleep(Math.floor(Math.random() * 1200));
  if (await anotherSenderActive(db)) {
    stats.note = "another run is sending";
    return;
  }

  let lastSendAt = 0;
  let stop = false;

  while (!stop && Date.now() - startedAt < CLAIM_UNTIL_MS) {
    const { data, error } = await db.rpc("claim_email_batch", { p_limit: BATCH_SIZE });
    if (error) {
      log("claim_failed", { code: error.code });
      stats.ok = false;
      return;
    }
    const rows = (data ?? []) as OutboxRow[];
    if (rows.length === 0) return;

    const prefs = await loadPrefs(db, rows.map((r) => r.user_id));
    if (!prefs) {
      for (const row of rows) await release(db, row, "profile lookup failed (not tried)");
      stats.ok = false;
      return;
    }

    for (const row of rows) {
      if (stop || Date.now() - startedAt > HARD_STOP_MS) {
        stop = true;
        // Not tried this run: back to pending, attempt not spent.
        await release(db, row, stats.rate_limited ? "rate limited (not tried)" : "time budget (not tried)");
        continue;
      }

      if (!isEmailKind(row.kind)) {
        await settle(db, row, "failed", `unknown kind ${row.kind}`);
        stats.failed++;
        log("unknown_kind", { id: row.id });
        continue;
      }
      const kind = row.kind;
      // team_invite: no recipient account / preferences, and no unsubscribe link (a one-off the dueño asked for).
      const transactional = isTransactional(kind);
      const profile = !transactional && row.user_id ? prefs.get(row.user_id) : undefined;

      // Preferences can change between enqueue and send (and retries can lag): re-check them.
      if (profile && !(kind === "job_digest" ? profile.email_alerts : profile.email_updates)) {
        await settle(db, row, "skipped", "opted out");
        stats.skipped++;
        log("skipped", { id: row.id, kind, reason: "opted_out" });
        continue;
      }

      const token = transactional ? null : (profile?.unsubscribe_token ?? null);
      let email: RenderedEmail;
      try {
        email = renderEmail(kind, row.payload, token);
      } catch (e) {
        // Thrown for payloads it can't render (e.g. an unknown status): retrying won't help.
        await settle(db, row, "failed", `render: ${e instanceof Error ? e.message : "error"}`);
        stats.failed++;
        log("render_failed", { id: row.id, kind });
        continue;
      }

      const wait = lastSendAt + PACE_MS - Date.now();
      if (wait > 0) await sleep(wait);
      lastSendAt = Date.now();

      const result = await sendViaResend(apiKey, row, kind, token, email);

      if (result.ok) {
        await finish(db, row, true);
        stats.sent++;
        log("sent", { id: row.id, kind, attempt: row.attempts });
      } else if (result.status === 429) {
        await finish(db, row, false, "rate limited");
        stats.rate_limited = true;
        stop = true;
        log("rate_limited", { id: row.id, kind });
      } else {
        await finish(db, row, false, result.error);
        stats.failed++;
        log("send_failed", {
          id: row.id,
          kind,
          status: result.status,
          code: result.error.split(":")[0],
          attempt: row.attempts,
        });
      }
    }
  }
}

// ------------------------------------------------------------------------------------------ handler

Deno.serve(async (req: Request) => {
  if (req.method !== "POST" && req.method !== "GET") {
    return json({ ok: false, error: "method not allowed" }, 405);
  }

  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) return json({ ok: true, skipped: "RESEND_API_KEY not set" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const key = serviceKey();
  if (!supabaseUrl || !key) {
    log("misconfigured");
    return json({ ok: false, error: "Supabase service credentials missing" }, 500);
  }
  const db = createClient(supabaseUrl, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const startedAt = Date.now();
  const stats: Stats = { ok: true, sent: 0, failed: 0, skipped: 0 };
  const run = drain(db, apiKey, stats, startedAt)
    .catch((e) => {
      stats.ok = false;
      log("run_crashed", { error: errorName(e) });
    })
    .finally(() => {
      if (stats.sent || stats.failed || stats.skipped || stats.rate_limited) {
        log("run_done", { ...stats, ms: Date.now() - startedAt });
      }
    });
  // Keep the worker alive until the run ends even if the caller hangs up (pg_net gives up after 5 s).
  edgeRuntime?.waitUntil(run);

  const finished = await Promise.race([run.then(() => true), sleep(RESPOND_WITHIN_MS).then(() => false)]);
  return json(finished ? stats : { ...stats, running: true });
});

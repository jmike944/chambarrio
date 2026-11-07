# Supabase Edge Functions

## `send-emails`

Sends Chambarrio's notification emails through [Resend](https://resend.com) from the
`public.email_outbox` queue (see `supabase/migrations/20261107213000_email_notifications.sql`).

| File | What it is |
| --- | --- |
| `send-emails/index.ts` | Deno handler: claims outbox rows, renders, sends, records the result |
| `send-emails/templates.ts` | Pure HTML + plain-text templates (no Deno APIs, so they render in Node too) |
| `send-emails/deno.json` | Import map (`@supabase/supabase-js` → `npm:` for Deno; Node/tsc resolve it from `node_modules`) |

Kinds: `new_applicant` (business owner: someone applied, showing only colonia and distance),
`application_status` (candidate: `vista` / `entrevista` / `contratada`) and `job_digest`
(candidate: the daily vacancies near them). Sender: `Chambarrio <no-reply@chambarrio.com>`.

### How it runs

1. Database events insert rows into `email_outbox`. An AFTER INSERT trigger calls this function
   via `pg_net` (once per statement that actually added rows; the daily digest is a single
   INSERT for every candidate). `pg_cron` runs `email_retry_tick()` every 10 min, which wakes the
   function only when rows are waiting, and enqueues the digest at 14:00 UTC (8:00 in Saltillo).
2. Each call claims batches of 10 with `claim_email_batch`, re-checks the recipient's
   `email_alerts` / `email_updates` (opted-out rows become `skipped`) and renders the email. It
   then sends with `Idempotency-Key: <outbox id>`, `List-Unsubscribe` (one-click, RFC 8058) and a
   `kind` tag, and records the result with `finish_email`.
3. Pacing is 600 ms per send because Resend allows 2 req/s by default. A 429 stops the run, and
   the remaining claimed rows go back to `pending`. A run stops claiming after about 45 s.
   Failures retry until 5 attempts, then become `failed`. Rows a run claimed but never tried go
   back with `release_email`, which gives the attempt back. Rows stuck in `sending` after their
   5th attempt are marked `failed` by the retry tick.
4. The HTTP call is answered within about 1 s, and the rest of the run continues through
   `EdgeRuntime.waitUntil`, because pg_net gives up after 5 s and a cold start can take most of
   that. When a burst of wake-ups arrives, each call waits a random 0–1.2 s and then stands down
   if another run claimed rows in the last 90 s, so usually only one run sends.

Logs contain only outbox ids, kinds, HTTP statuses and error codes. They never contain addresses,
names or payloads.

### Why `verify_jwt = false`

`pg_net` (trigger) and `pg_cron` call the function with an empty body and **no Authorization
header**, and no key is stored in SQL. With JWT verification on, every wake-up would get a 401.
Leaving the endpoint open is safe for these reasons:

- It ignores the request body and takes no input. A call only means "send what is already queued".
- Only the service role can write the queue (RLS is on and there are no policies), so a caller
  can't add or change emails.
- `FOR UPDATE SKIP LOCKED` claims and Resend idempotency keys make extra or concurrent calls
  harmless. They can't cause double sends.

Keep it off on every redeploy:

```sh
supabase functions deploy send-emails --no-verify-jwt --project-ref hggxrdwjnvhuymkaqiwo
```

### Secrets

- `RESEND_API_KEY`: set it in Dashboard → Edge Functions → Secrets (or
  `supabase secrets set RESEND_API_KEY=...`). Without it, the function answers
  `{"ok":true,"skipped":"RESEND_API_KEY not set"}` and leaves the queue untouched.
- `SUPABASE_URL` and `SUPABASE_SECRET_KEYS` (or the legacy `SUPABASE_SERVICE_ROLE_KEY`) are
  provided automatically.

### Links in the emails (contract with the web app)

- Footer unsubscribe: `https://chambarrio.com/avisos/baja?t=<token>&k=<alerts|updates>`
- One-click (`List-Unsubscribe`, POST): `https://chambarrio.com/avisos/baja/un-clic?t=<token>&k=<kind>`
- `k=alerts` for `job_digest`, `k=updates` for the other two.

### Type checking

The app's `tsconfig.json` excludes `supabase/functions` (Deno resolves `./templates.ts` and
`npm:` imports itself). Check the function with `deno check supabase/functions/send-emails/index.ts`.
`index.ts` still declares a minimal `Deno` type so editors without the Deno extension stay quiet.

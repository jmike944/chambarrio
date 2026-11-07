-- Chambarrio · email notifications (Resend via the `send-emails` Edge Function)
--
-- Flow: database events enqueue rows in public.email_outbox → an AFTER INSERT trigger pings the
-- `send-emails` Edge Function (pg_net) → the function claims a batch, renders each email, sends it
-- through Resend and marks it sent/failed. pg_cron retries leftovers every 10 minutes and builds the
-- daily "vacantes nuevas cerca" digest at 8:00 Saltillo time (14:00 UTC, no DST).
--
-- Kinds:
--   new_applicant       → company owner: someone applied (colonia + rounded km only, never name/phone)
--   application_status  → candidate: their application was seen / interview / hired
--   job_digest          → candidate: today's new open vacancies inside their radius & interests
-- Preferences live on profiles (email_alerts = digest, email_updates = the other two) and can be
-- turned off without signing in through unsubscribe_email(token, kind).

create extension if not exists pg_net;
create extension if not exists pg_cron with schema pg_catalog;

-- ---------------------------------------------------------------- preferences
alter table public.profiles
  add column email_alerts boolean not null default true,
  add column email_updates boolean not null default true,
  add column unsubscribe_token uuid not null default gen_random_uuid();
create unique index profiles_unsubscribe_token_idx on public.profiles (unsubscribe_token);

-- ---------------------------------------------------------------- outbox
create table public.email_outbox (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('new_applicant', 'application_status', 'job_digest')),
  user_id uuid not null references auth.users (id) on delete cascade,
  to_email text not null,
  payload jsonb not null default '{}',
  dedupe_key text not null unique,
  status text not null default 'pending' check (status in ('pending', 'sending', 'sent', 'failed', 'skipped')),
  attempts smallint not null default 0,
  last_error text,
  claimed_at timestamptz,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index email_outbox_pending_idx on public.email_outbox (status, created_at) where status in ('pending', 'sending');
create index email_outbox_user_idx on public.email_outbox (user_id);
-- Service role only (the Edge Function). No policies = no access for anon/authenticated.
alter table public.email_outbox enable row level security;

-- ---------------------------------------------------------------- helpers
create or replace function public.user_email(p_user uuid) returns text
language sql stable security definer set search_path = '' as $$
  select nullif(email, '') from auth.users where id = p_user;
$$;
revoke all on function public.user_email(uuid) from public, anon, authenticated;

-- Wake the sender (fire-and-forget HTTP call; the function drains whatever is pending).
create or replace function public.kick_email_sender() returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform net.http_post(
    url := 'https://hggxrdwjnvhuymkaqiwo.supabase.co/functions/v1/send-emails',
    body := '{}'::jsonb,
    headers := '{"Content-Type": "application/json"}'::jsonb,
    timeout_milliseconds := 5000
  );
end $$;
revoke all on function public.kick_email_sender() from public, anon, authenticated;

create or replace function public.on_email_enqueued() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform public.kick_email_sender();
  return null;
end $$;
revoke all on function public.on_email_enqueued() from public, anon, authenticated;

create trigger email_outbox_kick after insert on public.email_outbox
  for each statement execute function public.on_email_enqueued();

-- ---------------------------------------------------------------- event → outbox
-- Someone applied → tell the company owner (seeded demo companies have no owner: no email).
create or replace function public.enqueue_new_applicant() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid;
  v_email text;
  v_payload jsonb;
begin
  select c.owner_id,
         jsonb_build_object(
           'application_id', new.id,
           'job_id', j.id,
           'job_title', j.title,
           'company_name', c.name,
           'branch_name', b.name,
           'colonia', p.colonia,
           'km', case when p.home is null then null
                      else round((extensions.st_distance(b.location, p.home) / 100.0)::numeric) / 10.0 end,
           'experience', p.experience
         )
    into v_owner, v_payload
  from public.jobs j
  join public.companies c on c.id = j.company_id
  join public.branches b on b.id = j.branch_id
  left join public.profiles p on p.id = new.candidate_id
  where j.id = new.job_id;

  if v_owner is null then return null; end if;
  if not exists (select 1 from public.profiles where id = v_owner and email_updates) then return null; end if;
  v_email := public.user_email(v_owner);
  if v_email is null then return null; end if;

  insert into public.email_outbox (kind, user_id, to_email, payload, dedupe_key)
  values ('new_applicant', v_owner, v_email, v_payload, 'new_applicant:' || new.id)
  on conflict (dedupe_key) do nothing;
  return null;
end $$;
revoke all on function public.enqueue_new_applicant() from public, anon, authenticated;

create trigger applications_notify_company after insert on public.applications
  for each row execute function public.enqueue_new_applicant();

-- The company moved an application forward → tell the candidate.
create or replace function public.enqueue_application_status() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_email text;
  v_payload jsonb;
begin
  if new.status is not distinct from old.status or new.status not in ('vista', 'entrevista', 'contratada') then
    return null;
  end if;
  if not exists (select 1 from public.profiles where id = new.candidate_id and email_updates) then return null; end if;
  v_email := public.user_email(new.candidate_id);
  if v_email is null then return null; end if;

  select jsonb_build_object(
           'application_id', new.id,
           'status', new.status,
           'job_id', j.id,
           'job_title', j.title,
           'company_name', c.name,
           'branch_name', b.name,
           'colonia', b.colonia,
           'phone', j.phone
         )
    into v_payload
  from public.jobs j
  join public.companies c on c.id = j.company_id
  join public.branches b on b.id = j.branch_id
  where j.id = new.job_id;

  insert into public.email_outbox (kind, user_id, to_email, payload, dedupe_key)
  values ('application_status', new.candidate_id, v_email, v_payload, 'status:' || new.id || ':' || new.status)
  on conflict (dedupe_key) do nothing;
  return null;
end $$;
revoke all on function public.enqueue_application_status() from public, anon, authenticated;

create trigger applications_notify_candidate after update of status on public.applications
  for each row execute function public.enqueue_application_status();

-- Daily digest: one email per candidate with new vacancies (last 24 h) in radius & interests.
create or replace function public.enqueue_job_digests() returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_count integer := 0;
  v_day text := to_char((now() at time zone 'America/Monterrey')::date, 'YYYY-MM-DD');
  r record;
begin
  for r in
    select p.id, p.home, p.radius_km, p.interests, p.name, public.user_email(p.id) as email
    from public.profiles p
    where p.role = 'candidato' and p.onboarded and p.email_alerts and p.home is not null
  loop
    continue when r.email is null;
    insert into public.email_outbox (kind, user_id, to_email, payload, dedupe_key)
    select 'job_digest', r.id, r.email,
           jsonb_build_object(
             'name', r.name,
             'radius_km', r.radius_km,
             'total', count(*),
             'jobs', (jsonb_agg(to_jsonb(x) order by x.km) filter (where x.rn <= 5))
           ),
           'digest:' || r.id || ':' || v_day
    from (
      select j.id, j.title, j.category, j.pay, j.pay_max, j.period, c.name as company_name, b.name as branch_name,
             b.colonia, round((extensions.st_distance(b.location, r.home) / 100.0)::numeric) / 10.0 as km,
             row_number() over (order by extensions.st_distance(b.location, r.home)) as rn
      from public.jobs j
      join public.branches b on b.id = j.branch_id
      join public.companies c on c.id = j.company_id
      where j.status = 'abierta'
        and j.created_at > now() - interval '24 hours'
        and extensions.st_dwithin(b.location, r.home, r.radius_km * 1000)
        and (cardinality(r.interests) = 0 or j.category = any (r.interests))
    ) x
    having count(*) > 0
    on conflict (dedupe_key) do nothing;
    if found then v_count := v_count + 1; end if;
  end loop;
  return v_count;
end $$;
revoke all on function public.enqueue_job_digests() from public, anon, authenticated;

-- ---------------------------------------------------------------- sender API (service role only)
-- Claim up to p_limit emails (pending, or stuck in "sending" for 10+ min) for one sender run.
create or replace function public.claim_email_batch(p_limit integer default 25)
returns setof public.email_outbox
language sql security definer set search_path = '' as $$
  update public.email_outbox o
     set status = 'sending', attempts = o.attempts + 1, claimed_at = now()
   where o.id in (
     select id from public.email_outbox
      where (status = 'pending' or (status = 'sending' and claimed_at < now() - interval '10 minutes'))
        and attempts < 5
      order by created_at
      limit least(greatest(p_limit, 1), 100)
      for update skip locked
   )
  returning o.*;
$$;

-- Record the outcome. Failures go back to pending until 5 attempts, then stay failed.
create or replace function public.finish_email(p_id uuid, p_ok boolean, p_error text default null)
returns void
language sql security definer set search_path = '' as $$
  update public.email_outbox
     set status = case when p_ok then 'sent' when attempts >= 5 then 'failed' else 'pending' end,
         sent_at = case when p_ok then now() else sent_at end,
         last_error = case when p_ok then null else left(p_error, 500) end
   where id = p_id;
$$;

-- Unsubscribe token → recipient (the function puts it in each email's footer / List-Unsubscribe).
create or replace function public.unsubscribe_token_for(p_user uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select unsubscribe_token from public.profiles where id = p_user;
$$;

revoke all on function public.claim_email_batch(integer) from public, anon, authenticated;
revoke all on function public.finish_email(uuid, boolean, text) from public, anon, authenticated;
revoke all on function public.unsubscribe_token_for(uuid) from public, anon, authenticated;
grant execute on function public.claim_email_batch(integer) to service_role;
grant execute on function public.finish_email(uuid, boolean, text) to service_role;
grant execute on function public.unsubscribe_token_for(uuid) to service_role;

-- ---------------------------------------------------------------- unsubscribe (no sign-in needed)
-- p_kind: 'alerts' (daily digest), 'updates' (applications), 'all'. Returns false for unknown tokens.
create or replace function public.unsubscribe_email(p_token uuid, p_kind text default 'all') returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if p_kind not in ('alerts', 'updates', 'all') then
    raise exception 'Tipo de aviso no válido';
  end if;
  update public.profiles
     set email_alerts = case when p_kind in ('alerts', 'all') then false else email_alerts end,
         email_updates = case when p_kind in ('updates', 'all') then false else email_updates end
   where unsubscribe_token = p_token;
  return found;
end $$;
revoke all on function public.unsubscribe_email(uuid, text) from public;
grant execute on function public.unsubscribe_email(uuid, text) to anon, authenticated;

-- ---------------------------------------------------------------- schedules
select cron.schedule('chambarrio-email-retry', '*/10 * * * *', $$ select public.kick_email_sender(); $$);
select cron.schedule('chambarrio-job-digest', '0 14 * * *', $$ select public.enqueue_job_digests(); $$);

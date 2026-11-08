-- Chambarrio · email outbox follow-ups (review of 20261107210635_email_notifications.sql)
--
--  (pg_net moving out of `public` is its own migration, 20261107230633_pg_net_schema.sql.)
--  1. The outbox is service-role only: drop the default table grants to anon/authenticated too
--     (RLS without policies already hid every row; this also hides the table itself).
--  2. One wake-up per INSERT statement that actually added rows (statement triggers fire even when
--     ON CONFLICT DO NOTHING / HAVING inserted nothing), and the daily digest is one INSERT for
--     everyone instead of one per candidate — so it wakes the sender once, not once per candidate.
--  3. release_email(): rows a run claimed but never tried (time budget, rate limit, prefs lookup
--     failure) go back to pending without spending one of their 5 attempts.
--  4. The 10-minute retry tick only wakes the sender when there's work, and gives up on rows stuck
--     in "sending" after their 5th attempt (claim_email_batch never picks those up again).

-- ---------------------------------------------------------------- 1. outbox grants
revoke all on table public.email_outbox from anon, authenticated;

-- ---------------------------------------------------------------- 2. wake once, only for new rows
drop trigger if exists email_outbox_kick on public.email_outbox;

create or replace function public.on_email_enqueued() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from new_rows) then
    perform public.kick_email_sender();
  end if;
  return null;
end $$;
revoke all on function public.on_email_enqueued() from public, anon, authenticated;

create trigger email_outbox_kick after insert on public.email_outbox
  referencing new table as new_rows
  for each statement execute function public.on_email_enqueued();

-- Same payload as before; one statement for all candidates.
create or replace function public.enqueue_job_digests() returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_count integer := 0;
  v_day text := to_char((now() at time zone 'America/Monterrey')::date, 'YYYY-MM-DD');
begin
  insert into public.email_outbox (kind, user_id, to_email, payload, dedupe_key)
  select 'job_digest', p.id, e.email,
         jsonb_build_object('name', p.name, 'radius_km', p.radius_km, 'total', d.total, 'jobs', d.jobs),
         'digest:' || p.id || ':' || v_day
  from public.profiles p
  cross join lateral (select public.user_email(p.id) as email) e
  cross join lateral (
    select count(*) as total,
           jsonb_agg(to_jsonb(x) order by x.km) filter (where x.rn <= 5) as jobs
    from (
      select j.id, j.title, j.category, j.pay, j.pay_max, j.period, c.name as company_name, b.name as branch_name,
             b.colonia, round((extensions.st_distance(b.location, p.home) / 100.0)::numeric) / 10.0 as km,
             row_number() over (order by extensions.st_distance(b.location, p.home)) as rn
      from public.jobs j
      join public.branches b on b.id = j.branch_id
      join public.companies c on c.id = j.company_id
      where j.status = 'abierta'
        and j.created_at > now() - interval '24 hours'
        and extensions.st_dwithin(b.location, p.home, p.radius_km * 1000)
        and (cardinality(p.interests) = 0 or j.category = any (p.interests))
    ) x
  ) d
  where p.role = 'candidato' and p.onboarded and p.email_alerts and p.home is not null
    and e.email is not null and d.total > 0
  on conflict (dedupe_key) do nothing;
  get diagnostics v_count = row_count;
  return v_count;
end $$;
revoke all on function public.enqueue_job_digests() from public, anon, authenticated;

-- ---------------------------------------------------------------- 3. release untried rows
create or replace function public.release_email(p_id uuid, p_reason text default null)
returns void
language sql security definer set search_path = '' as $$
  update public.email_outbox
     set status = 'pending',
         attempts = greatest(attempts - 1, 0),
         claimed_at = null,
         last_error = coalesce(left(p_reason, 500), last_error)
   where id = p_id and status = 'sending';
$$;
revoke all on function public.release_email(uuid, text) from public, anon, authenticated;
grant execute on function public.release_email(uuid, text) to service_role;

-- ---------------------------------------------------------------- 4. retry tick
create or replace function public.email_retry_tick() returns void
language plpgsql security definer set search_path = '' as $$
begin
  -- A run died (or couldn't record the result) on the 5th attempt: stop waiting for it.
  update public.email_outbox
     set status = 'failed', last_error = coalesce(last_error, 'no result after 5 attempts')
   where status = 'sending' and attempts >= 5 and claimed_at < now() - interval '10 minutes';

  if exists (
    select 1 from public.email_outbox
     where attempts < 5
       and (status = 'pending' or (status = 'sending' and claimed_at < now() - interval '10 minutes'))
  ) then
    perform public.kick_email_sender();
  end if;
end $$;
revoke all on function public.email_retry_tick() from public, anon, authenticated;

-- Same job name → pg_cron updates the existing job.
select cron.schedule('chambarrio-email-retry', '*/10 * * * *', $$ select public.email_retry_tick(); $$);

-- Chambarrio · candidates keep their vacancy and timeline after it pauses or closes
--
-- A company usually pauses a vacancy while it interviews and closes it after hiring. Until now the
-- candidate could only read OPEN vacancies ("jobs: anyone reads open"), so from that moment on the app
-- lost everything it needs for the interview and the hire: the title, the company, the branch (place
-- and map pin), the phone for "¿No puedes ir? Llama o manda SMS", and the timeline itself.
--
--  1. "events: candidate or company reads" no longer joins public.jobs (that join ran under the jobs
--     policies and hid every event of a paused/closed vacancy from its candidate). The candidate is
--     checked on applications; the company through owns_application() (security definer).
--  2. "jobs: applicant reads": a signed-in candidate also reads the paused/closed vacancies they
--     applied to. A security-definer helper does the check: a subquery on applications right in the
--     policy would recurse (the applications policies read jobs). Public reads are unchanged: anyone
--     still reads only open vacancies, owners their own. Companies and branches are public already.
--  3. application_events / application_notes keep only the grants the app uses (they had Supabase's
--     default ALL for anon and authenticated, TRUNCATE included, which RLS doesn't cover).
--
-- Replaces: policy "events: candidate or company reads" (20261107233000_hiring_pipeline.sql).
-- New: function applied_to_job(text), policy "jobs: applicant reads".
-- NOT APPLIED. Review, then apply together with 20261108010100_pipeline_notify_v3.sql.

-- ---------------------------------------------------------------- 1. timeline read
drop policy if exists "events: candidate or company reads" on public.application_events;
create policy "events: candidate or company reads" on public.application_events for select to authenticated
  using (
    exists (
      select 1 from public.applications a
      where a.id = application_id and a.candidate_id = (select auth.uid())
    )
    or public.owns_application(application_id)
  );

-- ---------------------------------------------------------------- 2. the vacancies I applied to
create or replace function public.applied_to_job(p_job text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.applications a
    where a.job_id = p_job and a.candidate_id = auth.uid()
  );
$$;
revoke all on function public.applied_to_job(text) from public, anon;
grant execute on function public.applied_to_job(text) to authenticated;

drop policy if exists "jobs: applicant reads" on public.jobs;
-- Open vacancies are already public; the cheap status test first keeps the helper off the hot path
-- of every catalog read.
create policy "jobs: applicant reads" on public.jobs for select to authenticated
  using (status <> 'abierta' and public.applied_to_job(id));

-- ---------------------------------------------------------------- 3. grants
-- Events: written only by the trigger (security definer); read under RLS.
revoke all on table public.application_events from anon;
revoke insert, update, delete, truncate, references, trigger on table public.application_events from authenticated;
grant select on table public.application_events to authenticated;
-- Notes: the company reads, writes and deletes its own (RLS); nobody updates them.
revoke all on table public.application_notes from anon;
revoke update, truncate, references, trigger on table public.application_notes from authenticated;
grant select, insert, delete on table public.application_notes to authenticated;

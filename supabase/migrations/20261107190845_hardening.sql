-- Security/performance advisor follow-ups.

-- Trigger functions are never meant to be called over the API.
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.guard_application_status() from public, anon, authenticated;
revoke all on function public.touch_updated_at() from public, anon, authenticated;
revoke all on function public.keep_one_branch() from public, anon, authenticated;

-- Anonymous readers only ever see open vacancies; the ownership check is for signed-in owners.
drop policy "jobs: read open or own" on public.jobs;
create policy "jobs: anyone reads open" on public.jobs for select using (status = 'abierta');
create policy "jobs: owner reads own" on public.jobs for select to authenticated using (public.is_company_owner(company_id));
revoke all on function public.is_company_owner(text) from public, anon;
grant execute on function public.is_company_owner(text) to authenticated;

-- These only touch the caller's own rows, which RLS already allows: run them with the caller's rights.
alter function public.set_my_home(double precision, double precision, text, public.location_source) security invoker;
alter function public.add_branch(text, text, text, double precision, double precision) security invoker;

-- Covering indexes for foreign keys.
drop index if exists public.jobs_branch_idx;
create index jobs_branch_company_idx on public.jobs (branch_id, company_id);
create index job_unlocks_company_idx on public.job_unlocks (company_id);
create index saved_jobs_job_idx on public.saved_jobs (job_id);

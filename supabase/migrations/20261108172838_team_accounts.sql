-- Chambarrio · "Tu equipo": team accounts
--
-- Until now one company = one user (companies.owner_id) and every permission keyed on it. From here a
-- company has members, each with a role:
--   dueno       everything: plan / billing, the team, company profile, branches, vacancies, applicants
--   admin       company profile (name, kind, size, phone, about, employees), vacancies, branches,
--               applicants, interviews, notes
--   reclutador  applicants, interviews, notes; optionally only for some branches (branch_ids): then they
--               only see those branches' vacancies (paused/closed ones; open ones are public anyway) and
--               applicants, and only get those new-applicant emails
-- The dueño invites people by email (invite_member → a one-time link chambarrio.com/unirse?t=<token>,
-- emailed through the outbox as kind 'team_invite'); the invitee signs in with a code and accept_invite
-- adds them. Rules the database enforces (the app mirrors them, never replaces them):
--   · only a dueño manages the team (invite / cancel / change role or branches / remove)
--   · a company always keeps at least one dueño; nobody can raise their own role; anyone can leave
--   · removing someone revokes their access at once (every check reads company_members live)
--   · plan limits on people (members + pending, unexpired invites): por-vacante 2, pyme 5, industrial ∞
--   · one company per person (company_members.user_id is unique) — the app shows one business
-- companies.owner_id stays (compatibility; kept pointing at a dueño) but no longer grants anything.
--
-- Shared work: vacancies, applicants and private notes ("Solo tu equipo las ve") belong to the team;
-- application_events.actor_user_id records which member did each company step, and
-- application_notes.author_id already records who wrote each note (team_people() names them).
--
-- Every function / policy below that keyed on owner_id is replaced by its deployed body (read from the
-- live project with pg_get_functiondef / pg_policies on 2026-11-08) with only the ownership test
-- changed, except where noted ("also:").
--
-- Replaces (functions, same signatures and grants):
--   is_company_owner(text)          now: the caller is a dueño of the company (kept for compatibility;
--                                   no policy uses it any more)
--   owns_application(uuid)          now: the caller is a member who can see the application's branch,
--                                   and it isn't their own application (policies "events: candidate or
--                                   company reads", "notes: company reads", "notes: company writes",
--                                   "notes: author deletes" keep their text and follow it)
--   can_view_candidate_files(text)  now: member in scope (policy "candidate files: unlocked employers
--                                   read" keeps its text)
--   job_applicants(text), job_applicants_detail(text)   now: member in scope
--   add_branch(text, text, text, float8, float8)       now: dueño or admin
--   guard_application_status()      now: member in scope. also: the company-side test uses the row's
--                                   current vacancy (old.job_id), not the one the update asks for (an
--                                   applicant who belonged to a team could otherwise pass the test by
--                                   pointing new.job_id at their own company's vacancy), and a member
--                                   never moves their own application
--   enqueue_new_applicant()         now: one email per responsible member (dueños and admins always,
--                                   reclutadores in scope), each with its own dedupe key and prefs
--   log_application_event()         also: stamps actor_user_id on company-side events
-- Replaces (policies, dropped and created):
--   companies "companies: update own"                           → "companies: admin updates" (dueño or
--                                                                    admin; the column grants still keep
--                                                                    plan / verified / owner_id server-only)
--   companies "companies: delete own"                           → "companies: dueno deletes"
--   branches  "branches: owner insert/update/delete"            → "branches: admin insert/update/delete"
--   jobs      "jobs: owner reads own"                           → "jobs: team reads own" (branch scope;
--                                                                    paused / closed only: open ones are public)
--   jobs      "jobs: owner insert/update/delete"                → "jobs: admin insert/update/delete"
--   applications "applications: candidate or company reads/updates" (same names, team + scope)
--   job_unlocks  "unlocks: company reads own"                   → "unlocks: team reads" (branch scope)
-- Kept as is: "companies: create own" (owner_id = auth.uid(): the creator, who becomes its dueño).
-- Changes: email_outbox gains kind 'team_invite' and a nullable user_id (an invitee may have no account
-- yet); send-emails must be deployed with this migration (templates.ts / index.ts know the new kind).
--
-- New: type team_role; tables company_members, company_invites; functions team_limit, team_token_hash,
-- mask_email, company_role, is_company_member, can_see_branch, can_see_job, my_membership, team_members,
-- team_invites, team_people, invite_preview, team_scope, invite_member, revoke_invite, accept_invite,
-- update_member, remove_member, leave_company, drop_stale_applicant_emails, application_event_actors;
-- trigger functions check_new_member, keep_one_dueno, sync_company_owner, add_company_creator,
-- scrub_invite_token.
--
-- Security review (2026-11-08, executed end to end on Postgres 18 / PGlite with Supabase-style roles and
-- stubs): branch scope also on job_unlocks; a member never reads the team's notes on their own
-- application; the jobs team policy skips the helper on open vacancies; invite emails capped at 3 per
-- address per day (the link still works: emailed=false) plus 30 new invites per business per day; strict
-- invite address syntax; only verified (non-anonymous) accounts invite; inviter name capped at 80; pending new-applicant emails dropped for someone
-- removed / re-scoped; can_view_candidate_files joins the membership instead of a helper per row;
-- application_events.actor_user_id is not selectable by `authenticated` (column grants: candidates read
-- their own timeline there), the team reads it through application_event_actors().

-- ---------------------------------------------------------------- 0. pre-check
-- One company per person: refuse to run (instead of silently dropping someone's access) if an owner
-- has several. The live project had none on 2026-11-08.
do $$
begin
  if exists (select 1 from public.companies where owner_id is not null group by owner_id having count(*) > 1) then
    raise exception 'team_accounts: some users own more than one company; resolve that before this migration';
  end if;
end $$;

-- ---------------------------------------------------------------- 1. roles and tables
-- Ordered so that role >= 'admin' reads "admin or dueño".
create type public.team_role as enum ('reclutador', 'admin', 'dueno');

create table public.company_members (
  company_id text not null references public.companies (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.team_role not null,
  -- null = every branch. Only a reclutador can be limited. Ids of branches deleted later are simply
  -- ignored (fail closed: a reclutador whose branches are all gone sees nothing until re-scoped).
  branch_ids text[],
  created_at timestamptz not null default now(),
  invited_by uuid references auth.users (id) on delete set null,
  constraint company_members_pkey primary key (company_id, user_id),
  constraint company_members_scope check (branch_ids is null or (role = 'reclutador' and cardinality(branch_ids) between 1 and 100))
);
-- One company per person (drop this index to allow several; the app would then need a switcher).
create unique index company_members_user_idx on public.company_members (user_id);
create index company_members_invited_by_idx on public.company_members (invited_by) where invited_by is not null;
comment on table public.company_members is 'Who works for each company and with which role (team accounts). Written only by the team RPCs and triggers.';

create table public.company_invites (
  id uuid primary key default gen_random_uuid(),
  company_id text not null references public.companies (id) on delete cascade,
  email text not null check (char_length(email) between 3 and 254 and email = lower(btrim(email))),
  role public.team_role not null,
  branch_ids text[],
  -- sha-256 (hex) of the one-time token; the token itself is only returned once and emailed once.
  token_hash text not null check (token_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz not null default now() + interval '7 days',
  created_at timestamptz not null default now(),
  last_sent_at timestamptz not null default now(),
  invited_by uuid references auth.users (id) on delete set null,
  accepted_at timestamptz,
  accepted_by uuid references auth.users (id) on delete set null,
  revoked_at timestamptz,
  constraint company_invites_scope check (branch_ids is null or (role = 'reclutador' and cardinality(branch_ids) between 1 and 100)),
  constraint company_invites_one_outcome check (accepted_at is null or revoked_at is null)
);
create unique index company_invites_token_idx on public.company_invites (token_hash);
-- One open invite per company and address (inviting again rotates its token).
create unique index company_invites_open_idx on public.company_invites (company_id, email)
  where accepted_at is null and revoked_at is null;
create index company_invites_company_idx on public.company_invites (company_id);
create index company_invites_invited_by_idx on public.company_invites (invited_by) where invited_by is not null;
create index company_invites_accepted_by_idx on public.company_invites (accepted_by) where accepted_by is not null;
comment on table public.company_invites is 'Pending / used / cancelled team invitations. Service role + RPCs only (token_hash never leaves the database).';

-- Members read their own team's rows; every write goes through the RPCs below (security definer).
alter table public.company_members enable row level security;
revoke all on table public.company_members from anon;
revoke insert, update, delete, truncate, references, trigger on table public.company_members from authenticated;
grant select on table public.company_members to authenticated;

alter table public.company_invites enable row level security;
revoke all on table public.company_invites from anon, authenticated;

-- ---------------------------------------------------------------- 2. small helpers (internal)
-- People per plan, counting active members + pending (unexpired) invites. null = no limit.
create or replace function public.team_limit(p_plan public.plan_id) returns integer
language sql immutable set search_path = '' as $$
  select case p_plan when 'pyme' then 5 when 'industrial' then null else 2 end;
$$;

create or replace function public.team_token_hash(p_token text) returns text
language sql immutable set search_path = '' as $$
  select encode(sha256(convert_to(coalesce(p_token, ''), 'UTF8')), 'hex');
$$;

-- "mariana@gmail.com" → "ma•••@gmail.com" (shown on the invite page and in "wrong account" errors).
create or replace function public.mask_email(p_email text) returns text
language sql immutable set search_path = '' as $$
  select case when position('@' in coalesce(p_email, '')) > 1
              then left(split_part(p_email, '@', 1), 2) || '•••@' || split_part(p_email, '@', 2)
              else '•••' end;
$$;

revoke all on function public.team_limit(public.plan_id) from public, anon, authenticated;
revoke all on function public.team_token_hash(text) from public, anon, authenticated;
revoke all on function public.mask_email(text) from public, anon, authenticated;

-- ---------------------------------------------------------------- 3. permission helpers (RLS)
-- All read company_members as the definer, so policies can call them without recursion. They only
-- ever answer about the caller (auth.uid()).

-- The caller's role in the company, or null.
create or replace function public.company_role(p_company_id text) returns public.team_role
language sql stable security definer set search_path = '' as $$
  select m.role from public.company_members m where m.company_id = p_company_id and m.user_id = auth.uid();
$$;

-- The caller is a member with at least p_min_role ('reclutador' < 'admin' < 'dueno').
create or replace function public.is_company_member(p_company_id text, p_min_role public.team_role default 'reclutador')
returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.company_members m
    where m.company_id = p_company_id and m.user_id = auth.uid()
      and m.role >= coalesce(p_min_role, 'reclutador'::public.team_role)
  );
$$;

-- The caller is a member whose scope includes this branch (dueños and admins: every branch).
create or replace function public.can_see_branch(p_company_id text, p_branch_id text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.company_members m
    where m.company_id = p_company_id and m.user_id = auth.uid()
      and (m.role >= 'admin' or m.branch_ids is null or p_branch_id = any (m.branch_ids))
  );
$$;

-- The caller is a member whose scope includes this vacancy's branch (works its applicants).
create or replace function public.can_see_job(p_job_id text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.jobs j
    join public.company_members m on m.company_id = j.company_id and m.user_id = auth.uid()
    where j.id = p_job_id
      and (m.role >= 'admin' or m.branch_ids is null or j.branch_id = any (m.branch_ids))
  );
$$;

revoke all on function public.company_role(text) from public, anon;
revoke all on function public.is_company_member(text, public.team_role) from public, anon;
revoke all on function public.can_see_branch(text, text) from public, anon;
revoke all on function public.can_see_job(text) from public, anon;
grant execute on function public.company_role(text) to authenticated;
grant execute on function public.is_company_member(text, public.team_role) to authenticated;
grant execute on function public.can_see_branch(text, text) to authenticated;
grant execute on function public.can_see_job(text) to authenticated;

-- Replaces 20261107190629_init.sql: was "owner_id = auth.uid()". Kept for compatibility; = dueño.
create or replace function public.is_company_owner(cid text) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_company_member(cid, 'dueno');
$$;

-- Replaces 20261107223917_hiring_pipeline.sql: was "c.owner_id = auth.uid()". Same grants.
-- also: never on the caller's own application (a member who applied to one of their own company's
-- vacancies doesn't read or write the team's private notes about themselves; they still read its
-- timeline as its candidate).
create or replace function public.owns_application(p_app uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.applications a
    join public.jobs j on j.id = a.job_id
    join public.company_members m on m.company_id = j.company_id and m.user_id = auth.uid()
    where a.id = p_app
      and a.candidate_id <> m.user_id
      and (m.role >= 'admin' or m.branch_ids is null or j.branch_id = any (m.branch_ids))
  );
$$;

-- ---------------------------------------------------------------- 4. membership triggers
-- Before a member is added: one company per person, and the plan's limit (the RPCs check first and
-- lock the company row, so this is the backstop).
create or replace function public.check_new_member() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_plan public.plan_id;
  v_limit integer;
begin
  if exists (select 1 from public.company_members m where m.user_id = new.user_id and m.company_id <> new.company_id) then
    raise exception 'Ya perteneces al equipo de otro negocio. Sal de ese equipo antes de unirte a otro.'
      using errcode = '23505', hint = 'team:other_company';
  end if;
  select c.plan into v_plan from public.companies c where c.id = new.company_id;
  v_limit := public.team_limit(v_plan);
  if v_limit is not null and (select count(*) from public.company_members m where m.company_id = new.company_id) >= v_limit then
    raise exception 'El equipo de este negocio ya está completo: su plan permite % personas.', v_limit
      using errcode = 'P0001', hint = 'team:limit';
  end if;
  return new;
end $$;
revoke all on function public.check_new_member() from public, anon, authenticated;
create trigger company_members_check before insert on public.company_members
  for each row execute function public.check_new_member();

-- A company always keeps at least one dueño. Not while the company itself, or the person's account,
-- is being deleted (the cascade removes the membership then).
create or replace function public.keep_one_dueno() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.role = 'dueno'
     and (tg_op = 'DELETE' or new.role <> 'dueno')
     and exists (select 1 from public.companies c where c.id = old.company_id)
     and exists (select 1 from auth.users u where u.id = old.user_id)
     and not exists (
       select 1 from public.company_members m
       where m.company_id = old.company_id and m.role = 'dueno' and m.user_id <> old.user_id
     ) then
    raise exception 'Tu negocio necesita al menos un dueño. Nombra a otra persona como dueña primero.'
      using errcode = 'P0001', hint = 'team:last_dueno';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  -- Who and where never change; only role and scope do.
  new.company_id := old.company_id;
  new.user_id := old.user_id;
  new.created_at := old.created_at;
  return new;
end $$;
revoke all on function public.keep_one_dueno() from public, anon, authenticated;
create trigger company_members_keep_dueno before update or delete on public.company_members
  for each row execute function public.keep_one_dueno();

-- companies.owner_id (compatibility only) keeps naming a dueño: when the one it names stops being one,
-- it moves to the longest-standing dueño.
create or replace function public.sync_company_owner() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_company text;
  v_first uuid;
begin
  v_company := case when tg_op = 'DELETE' then old.company_id else new.company_id end;
  if exists (
    select 1 from public.companies c
    join public.company_members m on m.company_id = c.id and m.user_id = c.owner_id and m.role = 'dueno'
    where c.id = v_company
  ) then
    return null;
  end if;
  select m.user_id into v_first from public.company_members m
   where m.company_id = v_company and m.role = 'dueno'
   order by m.created_at, m.user_id
   limit 1;
  update public.companies c set owner_id = v_first where c.id = v_company and c.owner_id is distinct from v_first;
  return null;
end $$;
revoke all on function public.sync_company_owner() from public, anon, authenticated;
create trigger company_members_sync_owner after insert or update or delete on public.company_members
  for each row execute function public.sync_company_owner();

-- Whoever creates a company ("companies: create own" still requires owner_id = auth.uid()) is its dueño.
create or replace function public.add_company_creator() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.owner_id is not null then
    insert into public.company_members (company_id, user_id, role)
    values (new.id, new.owner_id, 'dueno')
    on conflict on constraint company_members_pkey do nothing;
  end if;
  return null;
end $$;
revoke all on function public.add_company_creator() from public, anon, authenticated;
create trigger companies_add_creator after insert on public.companies
  for each row execute function public.add_company_creator();

-- ---------------------------------------------------------------- 5. backfill
-- Every existing owner becomes their company's dueño (seeded companies without an owner get nobody).
insert into public.company_members (company_id, user_id, role, created_at)
select c.id, c.owner_id, 'dueno', c.created_at
from public.companies c
where c.owner_id is not null
on conflict on constraint company_members_pkey do nothing;

-- ---------------------------------------------------------------- 6. policies
-- companies (public read and "create own" unchanged)
drop policy if exists "companies: update own" on public.companies;
drop policy if exists "companies: delete own" on public.companies;
-- The company profile (name, kind, size, about, employees, phone: the only columns `authenticated` may
-- update, 20261107190629_init.sql) is edited by dueños and admins. plan / verified stay server-only.
create policy "companies: admin updates" on public.companies for update to authenticated
  using (public.is_company_member(id, 'admin')) with check (public.is_company_member(id, 'admin'));
create policy "companies: dueno deletes" on public.companies for delete to authenticated
  using (public.is_company_member(id, 'dueno'));

-- branches (public read unchanged)
drop policy if exists "branches: owner insert" on public.branches;
drop policy if exists "branches: owner update" on public.branches;
drop policy if exists "branches: owner delete" on public.branches;
create policy "branches: admin insert" on public.branches for insert to authenticated
  with check (public.is_company_member(company_id, 'admin'));
create policy "branches: admin update" on public.branches for update to authenticated
  using (public.is_company_member(company_id, 'admin')) with check (public.is_company_member(company_id, 'admin'));
create policy "branches: admin delete" on public.branches for delete to authenticated
  using (public.is_company_member(company_id, 'admin'));

-- jobs ("jobs: anyone reads open" and "jobs: applicant reads" unchanged)
drop policy if exists "jobs: owner reads own" on public.jobs;
drop policy if exists "jobs: owner insert" on public.jobs;
drop policy if exists "jobs: owner update" on public.jobs;
drop policy if exists "jobs: owner delete" on public.jobs;
-- Open vacancies are public already ("jobs: anyone reads open"): the cheap status test first keeps
-- the helper off every catalog row (Postgres ORs the permissive policies with this one FIRST, so
-- without it every signed-in catalog read called the helper once per vacancy).
create policy "jobs: team reads own" on public.jobs for select to authenticated
  using (status <> 'abierta' and public.can_see_branch(company_id, branch_id));
create policy "jobs: admin insert" on public.jobs for insert to authenticated
  with check (public.is_company_member(company_id, 'admin'));
create policy "jobs: admin update" on public.jobs for update to authenticated
  using (public.is_company_member(company_id, 'admin')) with check (public.is_company_member(company_id, 'admin'));
create policy "jobs: admin delete" on public.jobs for delete to authenticated
  using (public.is_company_member(company_id, 'admin'));

-- applications ("applications: candidate applies" unchanged). can_see_job is a security-definer
-- helper, so the company side no longer depends on the jobs policies.
drop policy if exists "applications: candidate or company reads" on public.applications;
drop policy if exists "applications: candidate or company updates" on public.applications;
create policy "applications: candidate or company reads" on public.applications for select to authenticated
  using (candidate_id = (select auth.uid()) or public.can_see_job(job_id));
create policy "applications: candidate or company updates" on public.applications for update to authenticated
  using (candidate_id = (select auth.uid()) or public.can_see_job(job_id));

-- job_unlocks (a branch-limited reclutador only sees the unlocks of their branches' vacancies)
drop policy if exists "unlocks: company reads own" on public.job_unlocks;
create policy "unlocks: team reads" on public.job_unlocks for select to authenticated
  using (public.is_company_member(company_id) and public.can_see_job(job_id));

-- company_members: my own row and my team's rows.
create policy "members: team reads" on public.company_members for select to authenticated
  using (user_id = (select auth.uid()) or public.is_company_member(company_id));

-- ---------------------------------------------------------------- 7. functions that keyed on owner_id
-- Replaces 20261107190845_hardening.sql (security invoker): was is_company_owner(p_company_id).
create or replace function public.add_branch(p_company_id text, p_name text, p_colonia text, lat double precision, lng double precision)
returns text
language plpgsql set search_path = '' as $$
declare
  v_id text;
begin
  if not public.is_company_member(p_company_id, 'admin') then
    raise exception 'No autorizado';
  end if;
  insert into public.branches (company_id, name, colonia, location, sort)
  values (p_company_id, p_name, p_colonia, extensions.st_setsrid(extensions.st_makepoint(lng, lat), 4326)::extensions.geography,
          (select coalesce(max(sort), -1) + 1 from public.branches where company_id = p_company_id))
  returning id into v_id;
  return v_id;
end $$;

-- Replaces 20261107211254_candidate_profiles.sql: was "c.owner_id = auth.uid()". The membership is
-- joined (not a helper call per row: this runs for every avatar / CV read).
create or replace function public.can_view_candidate_files(p_folder text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.applications a
    join public.jobs j on j.id = a.job_id
    join public.companies c on c.id = j.company_id
    join public.company_members m on m.company_id = c.id and m.user_id = auth.uid()
    where a.candidate_id::text = p_folder
      and (m.role >= 'admin' or m.branch_ids is null or j.branch_id = any (m.branch_ids))
      and (c.plan in ('pyme', 'industrial') or exists (
        select 1 from public.job_unlocks u where u.job_id = j.id and u.company_id = c.id and u.unlocked_until > now()
      ))
  );
$$;

-- Replaces 20261107190629_init.sql: was "c.owner_id = auth.uid()".
create or replace function public.job_applicants(p_job_id text)
returns table (
  application_id uuid, status public.application_status, applied_at timestamptz, colonia text,
  km double precision, experience public.experience_level, interests public.category_id[],
  unlocked boolean, name text, phone text
)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_company text;
  v_plan public.plan_id;
  v_open boolean;
begin
  select j.company_id, c.plan into v_company, v_plan
  from public.jobs j join public.companies c on c.id = j.company_id
  where j.id = p_job_id and public.can_see_branch(j.company_id, j.branch_id);
  if v_company is null then
    raise exception 'No autorizado';
  end if;

  v_open := v_plan in ('pyme', 'industrial') or exists (
    select 1 from public.job_unlocks u where u.job_id = p_job_id and u.company_id = v_company and u.unlocked_until > now()
  );

  return query
  select a.id, a.status, a.created_at, p.colonia,
         (round((extensions.st_distance(b.location, p.home) / 100.0)::numeric) / 10.0)::double precision,
         p.experience, p.interests, v_open,
         case when v_open then p.name end,
         case when v_open then p.phone end
  from public.applications a
  join public.jobs j on j.id = a.job_id
  join public.branches b on b.id = j.branch_id
  join public.profiles p on p.id = a.candidate_id
  where a.job_id = p_job_id
  order by a.created_at desc;
end $$;

-- Replaces 20261108002840_avatar_config.sql: was "c.owner_id = auth.uid()".
create or replace function public.job_applicants_detail(p_job_id text)
returns table (
  application_id uuid, status public.application_status, applied_at timestamptz, colonia text, km double precision,
  unlocked boolean, strength smallint, profile jsonb, experiences jsonb, contact jsonb
)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_company text;
  v_plan public.plan_id;
  v_open boolean;
begin
  select j.company_id, c.plan into v_company, v_plan
  from public.jobs j join public.companies c on c.id = j.company_id
  where j.id = p_job_id and public.can_see_branch(j.company_id, j.branch_id);
  if v_company is null then
    raise exception 'No autorizado';
  end if;

  v_open := v_plan in ('pyme', 'industrial') or exists (
    select 1 from public.job_unlocks u where u.job_id = p_job_id and u.company_id = v_company and u.unlocked_until > now()
  );

  return query
  select a.id, a.status, a.created_at, p.colonia,
         (round((extensions.st_distance(b.location, p.home) / 100.0)::numeric) / 10.0)::double precision,
         v_open,
         public.profile_strength(p),
         jsonb_build_object(
           'experience', p.experience, 'interests', p.interests, 'headline', p.headline, 'about', p.about,
           'education', p.education, 'skills', p.skills, 'certifications', p.certifications,
           'languages', p.languages, 'shifts', p.shifts, 'available_from', p.available_from,
           'transport', p.transport, 'expected_pay', p.expected_pay, 'expected_period', p.expected_period,
           'has_photo', p.avatar_path is not null, 'has_cv', p.cv_path is not null,
           'avatar', p.avatar_config
         ),
         coalesce((
           select jsonb_agg(jsonb_build_object(
                    'title', w.title, 'company', w.company, 'category', w.category, 'start_month', w.start_month,
                    'end_month', w.end_month, 'is_current', w.is_current, 'description', w.description
                  ) order by w.is_current desc, w.end_month desc nulls first, w.sort)
           from public.work_experiences w where w.profile_id = p.id
         ), '[]'::jsonb),
         case when v_open then jsonb_build_object(
           'name', p.name, 'phone', p.phone, 'avatar_path', p.avatar_path, 'cv_path', p.cv_path
         ) end
  from public.applications a
  join public.jobs j on j.id = a.job_id
  join public.branches b on b.id = j.branch_id
  join public.profiles p on p.id = a.candidate_id
  where a.job_id = p_job_id
  order by a.created_at desc;
end $$;

-- Replaces 20261108041400_pipeline_notify_v3.sql (guard v3). Only the company-side test changed:
-- it was "c.owner_id = auth.uid()" on new.job_id (also computed, unused, on INSERT; now skipped there).
create or replace function public.guard_application_status() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  is_owner boolean;
begin
  -- The company side: a team member whose scope includes the vacancy the row is on now (old.job_id on
  -- updates: an update can't borrow powers by pointing job_id elsewhere; job_id is reset below), and
  -- never on their own application.
  if tg_op = 'UPDATE' then
    is_owner := public.can_see_job(old.job_id) and old.candidate_id is distinct from auth.uid();
  end if;

  if tg_op = 'INSERT' then
    new.status := 'enviada';
    new.seen_at := null; new.interview_at := null; new.interview_place := null; new.interview_note := null;
    new.company_message := null; new.hired_at := null; new.closed_by := null; new.closed_at := null;
    return new;
  end if;

  new.job_id := old.job_id;
  new.candidate_id := old.candidate_id;
  new.created_at := old.created_at;

  if not is_owner then
    -- Candidates can only withdraw; everything the company set stays as it was.
    if new.status is distinct from old.status and new.status <> 'cerrada' then
      raise exception 'Solo la empresa puede cambiar el estado de la postulación';
    end if;
    new.seen_at := old.seen_at; new.interview_at := old.interview_at; new.interview_place := old.interview_place;
    new.interview_note := old.interview_note; new.company_message := old.company_message; new.hired_at := old.hired_at;
    if new.status = 'cerrada' and old.status <> 'cerrada' then
      new.closed_by := 'candidato'; new.closed_at := now();
    else
      new.closed_by := old.closed_by; new.closed_at := old.closed_at;
    end if;
    return new;
  end if;

  -- Company side. A withdrawn application is frozen: no new status, message or interview.
  if old.status = 'cerrada' and old.closed_by = 'candidato' then
    if new.status is distinct from old.status
       or new.company_message is distinct from old.company_message
       or new.interview_at is distinct from old.interview_at
       or new.interview_place is distinct from old.interview_place
       or new.interview_note is distinct from old.interview_note then
      raise exception 'Esta persona retiró su postulación';
    end if;
    new.seen_at := old.seen_at; new.hired_at := old.hired_at; new.closed_by := old.closed_by; new.closed_at := old.closed_at;
    return new;
  end if;
  new.seen_at := case when new.status <> 'enviada' then coalesce(old.seen_at, now()) else old.seen_at end;
  if new.status = 'contratada' and old.status <> 'contratada' then new.hired_at := now();
  elsif new.status = 'contratada' then new.hired_at := old.hired_at; end if;
  if new.status <> 'contratada' then new.hired_at := case when old.status = 'contratada' then null else old.hired_at end; end if;
  if new.status = 'cerrada' and old.status <> 'cerrada' then
    new.closed_by := 'empresa'; new.closed_at := now();
  elsif new.status <> 'cerrada' then
    new.closed_by := null; new.closed_at := null;
  else
    -- Still declined (a message edit): the stamps stay the server's (the decline email key and the
    -- undo window are derived from closed_at).
    new.closed_by := old.closed_by; new.closed_at := old.closed_at;
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------- 8. who did what
alter table public.application_events
  add column if not exists actor_user_id uuid references auth.users (id) on delete set null;
create index if not exists application_events_actor_idx on public.application_events (actor_user_id)
  where actor_user_id is not null;
comment on column public.application_events.actor_user_id is
  'The team member who made a company-side step (null for the candidate''s own steps and for older rows). Team only, through application_event_actors(); names: team_people().';

-- The candidate reads their own timeline from this table, so the member ids stay out of what
-- `authenticated` can select (column privileges; the app lists its columns, never *). The team gets
-- them from application_event_actors() below.
revoke select on table public.application_events from authenticated;
grant select (id, application_id, status, actor, interview_at, created_at, change, message)
  on table public.application_events to authenticated;

-- Who made each company-side step, for applications the caller works (owns_application: member, in
-- branch scope, not their own). Up to 200 applications per call.
create or replace function public.application_event_actors(p_application_ids uuid[])
returns table (application_id uuid, event_id bigint, actor_user_id uuid)
language sql stable security definer set search_path = '' as $$
  select e.application_id, e.id, e.actor_user_id
  from public.application_events e
  where e.application_id = any (p_application_ids[1:200])
    and e.actor_user_id is not null
    and public.owns_application(e.application_id)
  order by e.application_id, e.id;
$$;
revoke all on function public.application_event_actors(uuid[]) from public, anon;
grant execute on function public.application_event_actors(uuid[]) to authenticated;

-- Replaces 20261108041400_pipeline_notify_v3.sql (events v3). Only the last INSERT gained
-- actor_user_id (auth.uid() on company-side steps).
create or replace function public.log_application_event() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_change text;
  v_last_decline bigint;
begin
  if tg_op = 'INSERT' then
    insert into public.application_events (application_id, status, actor) values (new.id, new.status, 'candidato');
    return null;
  end if;

  if old.status = 'cerrada' and new.status <> 'cerrada' then
    -- Deshacer right after a decline: its email never went out, so for the candidate it never happened.
    if public.decline_undoable(old.id, old.closed_by, old.closed_at) then
      delete from public.application_events
       where id = (select max(e.id) from public.application_events e where e.application_id = new.id and e.status = 'cerrada');
      return null;
    end if;
    v_change := 'reabierta';
  elsif new.status is distinct from old.status then
    v_change := null;
  elsif new.status = 'entrevista' and new.interview_at is distinct from old.interview_at then
    v_change := 'hora';
  elsif new.status = 'entrevista' and new.interview_place is distinct from old.interview_place then
    v_change := 'lugar';
  elsif new.status = 'entrevista'
        and (new.interview_note is distinct from old.interview_note or new.company_message is distinct from old.company_message) then
    v_change := 'indicaciones';
  elsif new.status = 'contratada' and new.company_message is not null and new.company_message is distinct from old.company_message then
    v_change := 'mensaje';
  elsif new.status = 'cerrada' and new.closed_by = 'empresa' and new.company_message is distinct from old.company_message then
    -- The decline's message was edited: still one decline, with the message it has now.
    select max(e.id) into v_last_decline from public.application_events e where e.application_id = new.id and e.status = 'cerrada';
    update public.application_events set message = new.company_message where id = v_last_decline;
    return null;
  else
    return null;
  end if;

  insert into public.application_events (application_id, status, actor, interview_at, change, message, actor_user_id)
  values (new.id, new.status,
          case when new.status = 'cerrada' and new.closed_by = 'candidato' then 'candidato' else 'empresa' end,
          new.interview_at,
          v_change,
          case when new.status = 'cerrada' and new.closed_by = 'candidato' then null else new.company_message end,
          case when new.status = 'cerrada' and new.closed_by = 'candidato' then null else auth.uid() end);
  return null;
end $$;
revoke all on function public.log_application_event() from public, anon, authenticated;

-- ---------------------------------------------------------------- 9. email outbox: team invites
-- An invitee may not have an account yet: their row has no user (and no preferences / unsubscribe
-- link: it's a one-off, requested by the dueño). Every other kind still names its recipient.
alter table public.email_outbox drop constraint if exists email_outbox_kind_check;
alter table public.email_outbox add constraint email_outbox_kind_check
  check (kind in ('new_applicant', 'application_status', 'job_digest', 'team_invite'));
alter table public.email_outbox alter column user_id drop not null;
alter table public.email_outbox add constraint email_outbox_user_check check (user_id is not null or kind = 'team_invite');
-- invite_member's abuse guards (per company, per address) and the "drop the unsent email" updates.
create index email_outbox_invite_company_idx on public.email_outbox ((payload ->> 'company_id'), created_at)
  where kind = 'team_invite';
create index email_outbox_invite_to_idx on public.email_outbox (to_email, created_at)
  where kind = 'team_invite';
create index email_outbox_invite_id_idx on public.email_outbox ((payload ->> 'invite_id'))
  where kind = 'team_invite' and status = 'pending';

-- The invite link's token lives in the (service-role-only) outbox only until the row is settled.
create or replace function public.scrub_invite_token() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status in ('sent', 'failed', 'skipped') then
    new.payload := new.payload - 'token';
  end if;
  return new;
end $$;
revoke all on function public.scrub_invite_token() from public, anon, authenticated;
create trigger email_outbox_scrub_invite before update of status on public.email_outbox
  for each row when (new.kind = 'team_invite') execute function public.scrub_invite_token();

-- Replaces 20261107210635_email_notifications.sql: was one email to companies.owner_id. Now every
-- member responsible for the vacancy's branch (dueños and admins always, reclutadores in scope) gets
-- one, under their own preferences and dedupe key. Payload as before + recipient_role.
create or replace function public.enqueue_new_applicant() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_company text;
  v_branch text;
  v_payload jsonb;
begin
  select j.company_id, j.branch_id,
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
    into v_company, v_branch, v_payload
  from public.jobs j
  join public.companies c on c.id = j.company_id
  join public.branches b on b.id = j.branch_id
  left join public.profiles p on p.id = new.candidate_id
  where j.id = new.job_id;

  if v_company is null then return null; end if;

  -- One statement, so the sender is woken once (seeded companies have no members: no email).
  insert into public.email_outbox (kind, user_id, to_email, payload, dedupe_key)
  select 'new_applicant', m.user_id, e.email,
         v_payload || jsonb_build_object('recipient_role', m.role),
         'new_applicant:' || new.id || ':' || m.user_id
  from public.company_members m
  join public.profiles pr on pr.id = m.user_id and pr.email_updates
  cross join lateral (select public.user_email(m.user_id) as email) e
  where m.company_id = v_company
    and (m.role >= 'admin' or m.branch_ids is null or v_branch = any (m.branch_ids))
    and m.user_id <> new.candidate_id
    and e.email is not null
  on conflict (dedupe_key) do nothing;
  return null;
end $$;
revoke all on function public.enqueue_new_applicant() from public, anon, authenticated;

-- ---------------------------------------------------------------- 10. team reads (RPC)
-- My membership (0 or 1 row). branch_ids: null = every branch; ids of deleted branches are dropped.
create or replace function public.my_membership()
returns table (company_id text, company_name text, plan public.plan_id, role public.team_role, branch_ids text[], joined_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select m.company_id, c.name, c.plan, m.role,
         case when m.branch_ids is not null then array(
           select x from unnest(m.branch_ids) x
           where exists (select 1 from public.branches b where b.id = x and b.company_id = m.company_id)
         ) end,
         m.created_at
  from public.company_members m
  join public.companies c on c.id = m.company_id
  where m.user_id = auth.uid();
$$;

-- The team as any member sees it. Emails: the dueño sees everyone's; others only their own.
create or replace function public.team_members(p_company_id text)
returns table (user_id uuid, role public.team_role, branch_ids text[], name text, email text, joined_at timestamptz, invited_by uuid, is_me boolean)
language sql stable security definer set search_path = '' as $$
  with me as (select public.company_role(p_company_id) as role)
  select m.user_id, m.role,
         case when m.branch_ids is not null then array(
           select x from unnest(m.branch_ids) x
           where exists (select 1 from public.branches b where b.id = x and b.company_id = m.company_id)
         ) end,
         coalesce(p.name, ''),
         case when m.user_id = auth.uid() or me.role = 'dueno' then u.email::text end,
         m.created_at, m.invited_by, m.user_id = auth.uid()
  from public.company_members m
  cross join me
  join auth.users u on u.id = m.user_id
  left join public.profiles p on p.id = m.user_id
  where m.company_id = p_company_id and me.role is not null
  order by m.role desc, m.created_at, m.user_id;
$$;

-- Open invites (pending and expired-but-not-cancelled), for the dueño only (others get none).
create or replace function public.team_invites(p_company_id text)
returns table (id uuid, email text, role public.team_role, branch_ids text[], created_at timestamptz, last_sent_at timestamptz, expires_at timestamptz, invited_by uuid, expired boolean)
language sql stable security definer set search_path = '' as $$
  select i.id, i.email, i.role, i.branch_ids, i.created_at, i.last_sent_at, i.expires_at, i.invited_by, i.expires_at <= now()
  from public.company_invites i
  where i.company_id = p_company_id and i.accepted_at is null and i.revoked_at is null
    and public.company_role(p_company_id) = 'dueno'
  order by i.last_sent_at desc;
$$;

-- Names for "who did what": current members plus anyone who wrote a note or made a step on this
-- company's applications (people who left keep their name; role is null for them).
create or replace function public.team_people(p_company_id text)
returns table (user_id uuid, name text, role public.team_role)
language sql stable security definer set search_path = '' as $$
  with ids as (
    select m.user_id from public.company_members m where m.company_id = p_company_id
    union
    select n.author_id from public.application_notes n
    join public.applications a on a.id = n.application_id
    join public.jobs j on j.id = a.job_id
    where j.company_id = p_company_id
    union
    select e.actor_user_id from public.application_events e
    join public.applications a on a.id = e.application_id
    join public.jobs j on j.id = a.job_id
    where j.company_id = p_company_id and e.actor_user_id is not null
  )
  select ids.user_id, coalesce(p.name, ''), m.role
  from ids
  left join public.profiles p on p.id = ids.user_id
  left join public.company_members m on m.company_id = p_company_id and m.user_id = ids.user_id
  where public.is_company_member(p_company_id);
$$;

-- What the /unirse page shows before (and after) signing in. No rows = no such invite. Anyone holding
-- the link may call it (the token is 256 random bits). email_matches: null when signed out.
create or replace function public.invite_preview(p_token text)
returns table (status text, company_name text, role public.team_role, branch_names text[], inviter_name text, email_hint text, expires_at timestamptz, email_matches boolean)
language sql stable security definer set search_path = '' as $$
  select case when i.accepted_at is not null then 'usada'
              when i.revoked_at is not null then 'cancelada'
              when i.expires_at <= now() then 'vencida'
              else 'vigente' end,
         c.name, i.role,
         case when i.branch_ids is not null then array(
           select b.name from public.branches b
           where b.company_id = i.company_id and b.id = any (i.branch_ids)
           order by b.sort, b.name
         ) end,
         nullif(left(btrim(p.name), 80), ''),
         public.mask_email(i.email),
         i.expires_at,
         case when auth.uid() is null then null
              else exists (select 1 from auth.users u where u.id = auth.uid() and lower(u.email) = i.email) end
  from public.company_invites i
  join public.companies c on c.id = i.company_id
  left join public.profiles p on p.id = i.invited_by
  where i.token_hash = public.team_token_hash(p_token);
$$;

-- ---------------------------------------------------------------- 11. team writes (RPC)
-- Every write locks the company row first, so limits and "at least one dueño" can't race.

-- Validates a reclutador's branch scope against the company: distinct, sorted, all its own branches.
-- null in → null (every branch); an empty list is an error.
create or replace function public.team_scope(p_company_id text, p_role public.team_role, p_branch_ids text[])
returns text[]
language plpgsql stable security definer set search_path = '' as $$
declare
  v_ids text[];
begin
  if p_role <> 'reclutador' or p_branch_ids is null then
    return null;
  end if;
  select array_agg(distinct x order by x) into v_ids from unnest(p_branch_ids) x where x is not null and x <> '';
  if v_ids is null then
    raise exception 'Elige al menos una sucursal, o todas.' using errcode = '22023', hint = 'team:bad_branches';
  end if;
  if cardinality(v_ids) > 100 or exists (
    select 1 from unnest(v_ids) x
    where not exists (select 1 from public.branches b where b.id = x and b.company_id = p_company_id)
  ) then
    raise exception 'Alguna de esas sucursales ya no es de tu negocio. Vuelve a elegirlas.' using errcode = '22023', hint = 'team:bad_branches';
  end if;
  return v_ids;
end $$;
revoke all on function public.team_scope(text, public.team_role, text[]) from public, anon, authenticated;

-- Invite someone by email (dueño only). Inviting the same address again (still pending or expired)
-- rotates its token: the old link stops working and its unsent email is dropped. Returns the raw token
-- once ({ id, token, expires_at, email, emailed }); only its hash is stored. Emails it as kind
-- 'team_invite', except when that address already got 3 invitation emails in the last 24 hours (from
-- any business): the invite and its link still work, but no email goes out (emailed: false; the dueño
-- shares the link). Abuse guards: 30 invitation emails and 30 new invites per business per 24 hours.
-- Addresses: plain ascii addr-spec only (no display names, quotes, brackets or commas).
create or replace function public.invite_member(p_company_id text, p_email text, p_role public.team_role, p_branch_ids text[] default null)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_branches text[];
  v_company_name text;
  v_plan public.plan_id;
  v_limit integer;
  v_id uuid;
  v_token text := translate(encode(extensions.gen_random_bytes(32), 'base64'), '+/=', '-_');
  v_hash text;
  v_expires timestamptz := now() + interval '7 days';
  v_emailed boolean;
begin
  if v_uid is null or public.company_role(p_company_id) is distinct from 'dueno' then
    raise exception 'Solo el dueño del negocio puede invitar a su equipo.' using errcode = '42501', hint = 'team:not_allowed';
  end if;
  -- Our sender only mails on behalf of a verified account (never an anonymous / unconfirmed one).
  if not exists (
    select 1 from auth.users u
    where u.id = v_uid and not coalesce(u.is_anonymous, false)
      and (u.email_confirmed_at is not null or u.phone_confirmed_at is not null)
  ) then
    raise exception 'Confirma tu correo con el código que te enviamos antes de invitar a tu equipo.'
      using errcode = '42501', hint = 'team:email_unconfirmed';
  end if;
  if p_role is null then
    raise exception 'Elige qué puede hacer esa persona.' using errcode = '22023', hint = 'team:bad_role';
  end if;
  if char_length(v_email) > 254
     or v_email !~ '^[a-z0-9.!#$%&''*+/=?^_`{|}~-]+@[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$' then
    raise exception 'Revisa el correo: parece que tiene un error.' using errcode = '22023', hint = 'team:bad_email';
  end if;
  v_branches := public.team_scope(p_company_id, p_role, p_branch_ids);

  select c.name, c.plan into v_company_name, v_plan from public.companies c where c.id = p_company_id for update;
  -- Re-checked under the lock (a concurrent change may have demoted the caller).
  if public.company_role(p_company_id) is distinct from 'dueno' then
    raise exception 'Solo el dueño del negocio puede invitar a su equipo.' using errcode = '42501', hint = 'team:not_allowed';
  end if;

  if exists (
    select 1 from public.company_members m join auth.users u on u.id = m.user_id
    where m.company_id = p_company_id and lower(u.email) = v_email
  ) then
    raise exception 'Esa persona ya está en tu equipo.' using errcode = '23505', hint = 'team:already_member';
  end if;

  -- Abuse guards: our sender, their recipients.
  if (select count(*) from public.email_outbox o
       where o.kind = 'team_invite' and o.payload ->> 'company_id' = p_company_id
         and o.created_at > now() - interval '24 hours') >= 30
     or (select count(*) from public.company_invites i
          where i.company_id = p_company_id and i.created_at > now() - interval '24 hours') >= 30 then
    raise exception 'Enviaste muchas invitaciones hoy. Intenta de nuevo mañana.' using errcode = 'P0001', hint = 'team:too_many_invites';
  end if;
  -- One address gets at most 3 invitation emails a day, whoever sends them (counted before this
  -- call drops a still-unsent one, so a fast re-send loop can't slip past it).
  v_emailed := (select count(*) from public.email_outbox o
                 where o.kind = 'team_invite' and o.to_email = v_email
                   and o.created_at > now() - interval '24 hours' and o.status <> 'skipped') < 3;

  v_limit := public.team_limit(v_plan);
  if v_limit is not null
     and (select count(*) from public.company_members m where m.company_id = p_company_id)
       + (select count(*) from public.company_invites i
           where i.company_id = p_company_id and i.accepted_at is null and i.revoked_at is null
             and i.expires_at > now() and i.email <> v_email) >= v_limit then
    raise exception 'Tu plan permite hasta % personas en tu equipo, contando las invitaciones pendientes.', v_limit
      using errcode = 'P0001', hint = 'team:limit';
  end if;

  v_hash := public.team_token_hash(v_token);
  update public.company_invites i
     set role = p_role, branch_ids = v_branches, token_hash = v_hash, expires_at = v_expires,
         invited_by = v_uid, last_sent_at = now()
   where i.company_id = p_company_id and i.email = v_email and i.accepted_at is null and i.revoked_at is null
  returning i.id into v_id;

  if v_id is null then
    insert into public.company_invites (company_id, email, role, branch_ids, token_hash, expires_at, invited_by)
    values (p_company_id, v_email, p_role, v_branches, v_hash, v_expires, v_uid)
    returning id into v_id;
  else
    -- The previous link no longer works: its email, if still waiting, must not go out.
    update public.email_outbox o
       set status = 'skipped', last_error = 'invitación reenviada'
     where o.kind = 'team_invite' and o.status = 'pending' and o.payload ->> 'invite_id' = v_id::text;
  end if;

  if v_emailed then
    insert into public.email_outbox (kind, user_id, to_email, payload, dedupe_key)
    values (
      'team_invite', null, v_email,
      jsonb_build_object(
        'invite_id', v_id,
        'company_id', p_company_id,
        'company_name', v_company_name,
        'inviter_name', (select nullif(left(btrim(p.name), 80), '') from public.profiles p where p.id = v_uid),
        'email', v_email,
        'role', p_role,
        'branch_names', case when v_branches is null then null else to_jsonb(array(
          select b.name from public.branches b
          where b.company_id = p_company_id and b.id = any (v_branches)
          order by b.sort, b.name
        )) end,
        'expires_at', v_expires,
        'token', v_token
      ),
      'team_invite:' || v_id || ':' || left(v_hash, 16)
    )
    on conflict (dedupe_key) do nothing;
  end if;

  return jsonb_build_object('id', v_id, 'token', v_token, 'expires_at', v_expires, 'email', v_email, 'emailed', v_emailed);
end $$;

-- Cancel an open invite (dueño only). Idempotent; an invite already accepted is left alone.
create or replace function public.revoke_invite(p_invite_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_company text;
begin
  select i.company_id into v_company from public.company_invites i where i.id = p_invite_id;
  if v_company is null or auth.uid() is null or public.company_role(v_company) is distinct from 'dueno' then
    raise exception 'Solo el dueño del negocio puede cancelar invitaciones.' using errcode = '42501', hint = 'team:not_allowed';
  end if;
  update public.company_invites i set revoked_at = now()
   where i.id = p_invite_id and i.accepted_at is null and i.revoked_at is null;
  update public.email_outbox o
     set status = 'skipped', last_error = 'invitación cancelada'
   where o.kind = 'team_invite' and o.status = 'pending' and o.payload ->> 'invite_id' = p_invite_id::text;
end $$;

-- Join through an invite link. The signed-in account's (confirmed) email must be the invited one.
-- Idempotent: accepting again after it went through returns the same membership. A fresh account
-- (never finished onboarding) becomes a business account with no business onboarding; p_name fills
-- an empty profile name. Returns { company_id, company_name, role, branch_ids, profile_role }.
create or replace function public.accept_invite(p_token text, p_name text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_name text := nullif(left(btrim(coalesce(p_name, '')), 80), '');
  v_invite_id uuid;
  v_company text;
  v_email text;
  v_role public.team_role;
  v_branches text[];
  v_expires timestamptz;
  v_accepted_at timestamptz;
  v_accepted_by uuid;
  v_revoked_at timestamptz;
  v_invited_by uuid;
  v_user_email text;
  v_confirmed boolean;
  v_plan public.plan_id;
  v_limit integer;
  v_member_company text;
  v_member_role public.team_role;
  v_member_branches text[];
  v_profile_role public.app_role;
begin
  if v_uid is null then
    raise exception 'Entra con tu correo para aceptar la invitación.' using errcode = '42501', hint = 'team:not_signed_in';
  end if;

  -- Same lock order as invite_member (company row, then invite row), so a re-send racing an accept
  -- waits instead of deadlocking.
  select i.company_id into v_company from public.company_invites i where i.token_hash = public.team_token_hash(p_token);
  if v_company is not null then
    select c.plan into v_plan from public.companies c where c.id = v_company for update;
  end if;
  select i.id, i.company_id, i.email, i.role, i.branch_ids, i.expires_at, i.accepted_at, i.accepted_by, i.revoked_at, i.invited_by
    into v_invite_id, v_company, v_email, v_role, v_branches, v_expires, v_accepted_at, v_accepted_by, v_revoked_at, v_invited_by
  from public.company_invites i
  where i.token_hash = public.team_token_hash(p_token)
  for update;
  if v_invite_id is null then
    raise exception 'Esta invitación no existe. Revisa que el enlace esté completo.' using errcode = 'P0002', hint = 'team:invite_not_found';
  end if;

  if v_accepted_at is not null then
    -- A second tap / a retry after a lost answer: same answer, if it's still theirs.
    if v_accepted_by = v_uid then
      select m.company_id, m.role, m.branch_ids into v_member_company, v_member_role, v_member_branches
      from public.company_members m where m.company_id = v_company and m.user_id = v_uid;
      if v_member_company is not null then
        select p.role into v_profile_role from public.profiles p where p.id = v_uid;
        return jsonb_build_object(
          'company_id', v_member_company,
          'company_name', (select c.name from public.companies c where c.id = v_member_company),
          'role', v_member_role,
          'branch_ids', to_jsonb(v_member_branches),
          'profile_role', v_profile_role);
      end if;
    end if;
    raise exception 'Esta invitación ya se usó. Pide una nueva a quien te invitó.' using errcode = 'P0001', hint = 'team:invite_used';
  end if;
  if v_revoked_at is not null then
    raise exception 'Esta invitación fue cancelada. Pide una nueva a quien te invitó.' using errcode = 'P0001', hint = 'team:invite_revoked';
  end if;
  if v_expires <= now() then
    raise exception 'Esta invitación venció. Pide a quien te invitó que te la reenvíe.' using errcode = 'P0001', hint = 'team:invite_expired';
  end if;

  select lower(u.email), u.email_confirmed_at is not null into v_user_email, v_confirmed
  from auth.users u where u.id = v_uid;
  if v_user_email is null or v_user_email <> v_email then
    raise exception 'Esta invitación es para %. Entra con ese correo para aceptarla.', public.mask_email(v_email)
      using errcode = '42501', hint = 'team:wrong_email';
  end if;
  if not v_confirmed then
    raise exception 'Confirma tu correo con el código que te enviamos y vuelve a intentar.' using errcode = '42501', hint = 'team:email_unconfirmed';
  end if;

  select m.company_id, m.role, m.branch_ids into v_member_company, v_member_role, v_member_branches
  from public.company_members m where m.user_id = v_uid;
  if v_member_company is not null and v_member_company <> v_company then
    raise exception 'Ya perteneces al equipo de otro negocio. Sal de ese equipo antes de unirte a este.'
      using errcode = '23505', hint = 'team:other_company';
  end if;

  if v_member_company is null then
    v_limit := public.team_limit(v_plan);
    if v_limit is not null and (select count(*) from public.company_members m where m.company_id = v_company) >= v_limit then
      raise exception 'El equipo de este negocio ya está completo: su plan permite % personas. Avísale a quien te invitó.', v_limit
        using errcode = 'P0001', hint = 'team:limit';
    end if;
    -- Scope ids of branches deleted since the invite are kept; they simply match nothing.
    insert into public.company_members (company_id, user_id, role, branch_ids, invited_by)
    values (v_company, v_uid, v_role, case when v_role = 'reclutador' then v_branches end, v_invited_by)
    returning company_id, role, branch_ids into v_member_company, v_member_role, v_member_branches;
  end if;
  -- (Already in this team: they keep the role they have; the invite is used up either way.)

  update public.company_invites i set accepted_at = now(), accepted_by = v_uid where i.id = v_invite_id;
  update public.email_outbox o
     set status = 'skipped', last_error = 'invitación aceptada'
   where o.kind = 'team_invite' and o.status = 'pending' and o.payload ->> 'invite_id' = v_invite_id::text;

  update public.profiles p
     set role = 'empresa',
         onboarded = true,
         name = case when btrim(p.name) = '' and v_name is not null then v_name else p.name end
   where p.id = v_uid and not p.onboarded;
  select p.role into v_profile_role from public.profiles p where p.id = v_uid;

  return jsonb_build_object(
    'company_id', v_member_company,
    'company_name', (select c.name from public.companies c where c.id = v_member_company),
    'role', v_member_role,
    'branch_ids', to_jsonb(v_member_branches),
    'profile_role', v_profile_role);
end $$;

-- New-applicant emails still waiting for someone who left the team, or whose new branch scope no longer
-- includes that vacancy, don't go out (internal; update_member / remove_member / leave_company).
create or replace function public.drop_stale_applicant_emails(p_company_id text, p_user_id uuid) returns void
language sql security definer set search_path = '' as $$
  update public.email_outbox o
     set status = 'skipped', last_error = 'ya no está en el equipo de esta vacante'
   where o.kind = 'new_applicant' and o.status = 'pending' and o.user_id = p_user_id
     and exists (select 1 from public.jobs j where j.id = o.payload ->> 'job_id' and j.company_id = p_company_id)
     and not exists (
       select 1 from public.jobs j
       join public.company_members m on m.company_id = j.company_id and m.user_id = p_user_id
       where j.id = o.payload ->> 'job_id'
         and (m.role >= 'admin' or m.branch_ids is null or j.branch_id = any (m.branch_ids))
     );
$$;
revoke all on function public.drop_stale_applicant_emails(text, uuid) from public, anon, authenticated;

-- Change someone's role and branch scope (dueño only; both are set as given: p_branch_ids null =
-- every branch, and only applies to reclutadores). Can't leave the company without a dueño, and
-- nobody raises their own role.
create or replace function public.update_member(p_company_id text, p_user_id uuid, p_role public.team_role, p_branch_ids text[] default null)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_old public.team_role;
  v_branches text[];
begin
  if v_uid is null or public.company_role(p_company_id) is distinct from 'dueno' then
    raise exception 'Solo el dueño del negocio puede cambiar los permisos del equipo.' using errcode = '42501', hint = 'team:not_allowed';
  end if;
  if p_role is null then
    raise exception 'Elige qué puede hacer esa persona.' using errcode = '22023', hint = 'team:bad_role';
  end if;
  v_branches := public.team_scope(p_company_id, p_role, p_branch_ids);

  perform 1 from public.companies c where c.id = p_company_id for update;
  if public.company_role(p_company_id) is distinct from 'dueno' then
    raise exception 'Solo el dueño del negocio puede cambiar los permisos del equipo.' using errcode = '42501', hint = 'team:not_allowed';
  end if;

  select m.role into v_old from public.company_members m where m.company_id = p_company_id and m.user_id = p_user_id;
  if v_old is null then
    raise exception 'Esa persona ya no está en tu equipo.' using errcode = 'P0002', hint = 'team:not_member';
  end if;
  if p_user_id = v_uid and p_role > v_old then
    raise exception 'No puedes subir tu propio rol.' using errcode = '42501', hint = 'team:self_role';
  end if;
  if v_old = 'dueno' and p_role <> 'dueno' and not exists (
    select 1 from public.company_members m
    where m.company_id = p_company_id and m.role = 'dueno' and m.user_id <> p_user_id
  ) then
    raise exception 'Tu negocio necesita al menos un dueño. Nombra a otra persona como dueña primero.'
      using errcode = 'P0001', hint = 'team:last_dueno';
  end if;

  update public.company_members m set role = p_role, branch_ids = v_branches
   where m.company_id = p_company_id and m.user_id = p_user_id;
  perform public.drop_stale_applicant_emails(p_company_id, p_user_id);
end $$;

-- Remove someone (dueño only). Their access ends at once; their notes and timeline steps stay.
-- Idempotent (already gone = done).
create or replace function public.remove_member(p_company_id text, p_user_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_old public.team_role;
begin
  if v_uid is null or public.company_role(p_company_id) is distinct from 'dueno' then
    raise exception 'Solo el dueño del negocio puede quitar personas del equipo.' using errcode = '42501', hint = 'team:not_allowed';
  end if;
  perform 1 from public.companies c where c.id = p_company_id for update;
  if public.company_role(p_company_id) is distinct from 'dueno' then
    raise exception 'Solo el dueño del negocio puede quitar personas del equipo.' using errcode = '42501', hint = 'team:not_allowed';
  end if;

  select m.role into v_old from public.company_members m where m.company_id = p_company_id and m.user_id = p_user_id;
  if v_old is null then
    return;
  end if;
  if v_old = 'dueno' and not exists (
    select 1 from public.company_members m
    where m.company_id = p_company_id and m.role = 'dueno' and m.user_id <> p_user_id
  ) then
    raise exception 'Tu negocio necesita al menos un dueño. Nombra a otra persona como dueña primero.'
      using errcode = 'P0001', hint = 'team:last_dueno';
  end if;
  delete from public.company_members m where m.company_id = p_company_id and m.user_id = p_user_id;
  perform public.drop_stale_applicant_emails(p_company_id, p_user_id);
end $$;

-- Leave a team (anyone; the last dueño can't). Idempotent.
create or replace function public.leave_company(p_company_id text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_old public.team_role;
begin
  if v_uid is null then
    raise exception 'Tu sesión terminó. Vuelve a entrar.' using errcode = '42501', hint = 'team:not_signed_in';
  end if;
  select m.role into v_old from public.company_members m where m.company_id = p_company_id and m.user_id = v_uid;
  if v_old is null then
    return;
  end if;
  -- Lock only once we know they belong to it, then read again under the lock.
  perform 1 from public.companies c where c.id = p_company_id for update;
  select m.role into v_old from public.company_members m where m.company_id = p_company_id and m.user_id = v_uid;
  if v_old is null then
    return;
  end if;
  if v_old = 'dueno' and not exists (
    select 1 from public.company_members m
    where m.company_id = p_company_id and m.role = 'dueno' and m.user_id <> v_uid
  ) then
    raise exception 'Eres el único dueño. Nombra a otra persona como dueña antes de salir.'
      using errcode = 'P0001', hint = 'team:last_dueno';
  end if;
  delete from public.company_members m where m.company_id = p_company_id and m.user_id = v_uid;
  perform public.drop_stale_applicant_emails(p_company_id, v_uid);
end $$;

-- ---------------------------------------------------------------- 12. grants
revoke all on function public.my_membership() from public, anon;
revoke all on function public.team_members(text) from public, anon;
revoke all on function public.team_invites(text) from public, anon;
revoke all on function public.team_people(text) from public, anon;
revoke all on function public.invite_preview(text) from public;
revoke all on function public.invite_member(text, text, public.team_role, text[]) from public, anon;
revoke all on function public.revoke_invite(uuid) from public, anon;
revoke all on function public.accept_invite(text, text) from public, anon;
revoke all on function public.update_member(text, uuid, public.team_role, text[]) from public, anon;
revoke all on function public.remove_member(text, uuid) from public, anon;
revoke all on function public.leave_company(text) from public, anon;

grant execute on function public.my_membership() to authenticated;
grant execute on function public.team_members(text) to authenticated;
grant execute on function public.team_invites(text) to authenticated;
grant execute on function public.team_people(text) to authenticated;
grant execute on function public.invite_preview(text) to anon, authenticated;
grant execute on function public.invite_member(text, text, public.team_role, text[]) to authenticated;
grant execute on function public.revoke_invite(uuid) to authenticated;
grant execute on function public.accept_invite(text, text) to authenticated;
grant execute on function public.update_member(text, uuid, public.team_role, text[]) to authenticated;
grant execute on function public.remove_member(text, uuid) to authenticated;
grant execute on function public.leave_company(text) to authenticated;

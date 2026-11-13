-- Chambarrio · vacantes curadas (temporary, while companies onboard)
--
-- Chambarrio captures vacancies from public sources (a "Se solicita" banner outside a plant, a
-- company's careers page, Portal del Empleo…) and publishes them at the real branch, so the 2/5/10/15 km
-- radar has something to show before companies sign up. Rules:
--   * A curated vacancy (jobs.source = 'curada') belongs to a company with no team (owner_id null). It
--     takes no applications: nobody at the company would read them. Candidates call or text the phone
--     printed in the vacancy instead (or open the original posting).
--   * It goes stale: every curated vacancy carries checked_at (last time we confirmed it was open) and
--     expires_at. A cron job closes it once expires_at passes; re-importing it re-opens it.
--   * Only Chambarrio writes these columns (the importer runs as postgres). Team members can't mark
--     their own vacancies as curated or attach an outside link to them (guard_job_source).
--   * Claiming: someone signed in with the SAME celular printed in the vacancy (SMS-verified) becomes
--     the company's dueño (claim_company). Its vacancies then become regular ones and take
--     applications. claim_preview() tells the claim page what to show, signed out too.
--
-- New: enum job_source; jobs.source / source_label / source_url / checked_at / expires_at;
--      companies.claimed_at; functions phone10, guard_job_source (trigger), close_expired_curated_jobs
--      (cron, hourly), claim_preview, claim_company.
-- Replaces: jobs_near (adds the source columns, hides expired curated vacancies; return type changes,
--      so drop + create), policy "applications: candidate applies" (not on curated vacancies).

-- ---------------------------------------------------------------- 1. columns
create type public.job_source as enum ('chambarrio', 'curada');

alter table public.jobs
  add column source public.job_source not null default 'chambarrio',
  -- Where the information came from, as shown to candidates: "Lona afuera de la planta", "Bolsa de trabajo de la empresa"…
  add column source_label text,
  -- The original posting, when there is one online.
  add column source_url text,
  -- Last time Chambarrio confirmed the vacancy was still open.
  add column checked_at timestamptz,
  add column expires_at timestamptz;

alter table public.jobs
  add constraint jobs_source_label_len check (source_label is null or char_length(source_label) between 2 and 80),
  add constraint jobs_source_url_ok check (source_url is null or (char_length(source_url) <= 500 and source_url ~* '^https?://[^[:space:]]+$')),
  add constraint jobs_curated_fields check (
    source <> 'curada'
    or (checked_at is not null and expires_at is not null and (coalesce(btrim(phone), '') <> '' or source_url is not null))
  );

create index jobs_curated_expiry_idx on public.jobs (expires_at) where source = 'curada' and status = 'abierta';

comment on column public.jobs.source is 'chambarrio: published by the company. curada: captured by Chambarrio from a public source while the company is not on Chambarrio (no applications; becomes chambarrio when the company is claimed).';

-- When someone claimed a company Chambarrio had published from public information.
alter table public.companies add column claimed_at timestamptz;

-- ---------------------------------------------------------------- 2. only Chambarrio writes them
-- PostgREST callers (anon / authenticated) can't set or change the source columns; the importer (postgres)
-- and claim_company (security definer, runs as its owner) can. Not security definer on purpose: it
-- needs the caller's role.
create or replace function public.guard_job_source() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user in ('anon', 'authenticated') then
    if tg_op = 'INSERT' then
      new.source := 'chambarrio';
      new.source_label := null;
      new.source_url := null;
      new.checked_at := null;
      new.expires_at := null;
    else
      new.source := old.source;
      new.source_label := old.source_label;
      new.source_url := old.source_url;
      new.checked_at := old.checked_at;
      new.expires_at := old.expires_at;
    end if;
  end if;
  return new;
end $$;
revoke all on function public.guard_job_source() from public, anon, authenticated;
create trigger jobs_guard_source before insert or update on public.jobs
  for each row execute function public.guard_job_source();

-- ---------------------------------------------------------------- 3. no applications on curated vacancies
drop policy if exists "applications: candidate applies" on public.applications;
create policy "applications: candidate applies" on public.applications for insert to authenticated
  with check (
    candidate_id = (select auth.uid())
    and exists (select 1 from public.jobs j where j.id = job_id and j.status = 'abierta' and j.source = 'chambarrio')
  );

-- ---------------------------------------------------------------- 4. stale vacancies close by themselves
create or replace function public.close_expired_curated_jobs() returns integer
language sql security definer set search_path = '' as $$
  with closed as (
    update public.jobs j set status = 'cerrada'
    where j.source = 'curada' and j.status = 'abierta' and j.expires_at <= now()
    returning 1
  )
  select count(*)::integer from closed;
$$;
revoke all on function public.close_expired_curated_jobs() from public, anon, authenticated;

select cron.schedule('chambarrio-close-curated', '17 * * * *', $$ select public.close_expired_curated_jobs(); $$);

-- ---------------------------------------------------------------- 5. jobs_near with the source
drop function public.jobs_near(double precision, double precision, double precision);
create function public.jobs_near(lat double precision, lng double precision, radius_km double precision default 15)
returns table (
  id text, title text, category public.category_id, pay integer, pay_max integer, period public.pay_period,
  shift public.shift, schedule text, type public.employment_type, experience public.experience_level,
  benefits text[], requirements text[], description text, openings integer, urgent boolean, phone text,
  created_at timestamptz, company_id text, company_name text, company_verified boolean,
  branch_id text, branch_name text, colonia text, branch_lat double precision, branch_lng double precision,
  km double precision, bearing double precision, applicants bigint,
  source public.job_source, source_label text, source_url text, checked_at timestamptz, expires_at timestamptz
)
language sql stable security definer set search_path = '' as $$
  with here as (select extensions.st_setsrid(extensions.st_makepoint(lng, lat), 4326)::extensions.geography as g)
  select j.id, j.title, j.category, j.pay, j.pay_max, j.period, j.shift, j.schedule, j.type, j.experience,
         j.benefits, j.requirements, j.description, j.openings, j.urgent, j.phone, j.created_at,
         c.id, c.name, c.verified, b.id, b.name, b.colonia,
         extensions.st_y(b.location::extensions.geometry), extensions.st_x(b.location::extensions.geometry),
         extensions.st_distance(b.location, here.g) / 1000.0,
         degrees(extensions.st_azimuth(here.g::extensions.geometry, b.location::extensions.geometry)),
         (select count(*) from public.applications a where a.job_id = j.id),
         j.source, j.source_label, j.source_url, j.checked_at, j.expires_at
  from public.jobs j
  join public.branches b on b.id = j.branch_id
  join public.companies c on c.id = j.company_id
  cross join here
  where j.status = 'abierta'
    and (j.expires_at is null or j.expires_at > now())
    and extensions.st_dwithin(b.location, here.g, least(radius_km, 50) * 1000)
  order by extensions.st_distance(b.location, here.g);
$$;
revoke all on function public.jobs_near(double precision, double precision, double precision) from public;
grant execute on function public.jobs_near(double precision, double precision, double precision) to anon, authenticated;

-- ---------------------------------------------------------------- 6. claiming a company
-- The last 10 digits of a Mexican phone ("+52 844 123 4501", "528441234501", "844-123-4501" → "8441234501"),
-- or null when there aren't 10.
create or replace function public.phone10(p text) returns text
language sql immutable set search_path = '' as $$
  select case when length(d) >= 10 then right(d, 10) end
  from (select regexp_replace(coalesce(p, ''), '\D', '', 'g') as d) x;
$$;

-- What the claim page shows about a company, signed out too. Only public facts: the name, whether it
-- can still be claimed, and the last 2 digits of the phone(s) that can claim it (printed in the vacancy).
create or replace function public.claim_preview(p_company_id text)
returns table (company_id text, company_name text, claimable boolean, open_jobs integer, phone_hints text[])
language sql stable security definer set search_path = '' as $$
  select c.id, c.name,
         c.owner_id is null and not exists (select 1 from public.company_members m where m.company_id = c.id),
         (select count(*)::integer from public.jobs j where j.company_id = c.id and j.source = 'curada' and j.status = 'abierta'),
         coalesce((
           select array_agg(distinct right(p.d, 2))
           from (
             select public.phone10(c.phone) as d
             union
             select public.phone10(j.phone) from public.jobs j where j.company_id = c.id and j.source = 'curada'
           ) p
           where p.d is not null
         ), '{}')
  from public.companies c
  where c.id = p_company_id;
$$;
revoke all on function public.claim_preview(text) from public;
grant execute on function public.claim_preview(text) to anon, authenticated;

-- The signed-in caller claims a company Chambarrio published from public information. Allowed when
-- the company has no team yet and the caller's SMS-verified sign-in phone is the company's phone or
-- the phone of one of its curated vacancies. The caller becomes its dueño (sync_company_owner sets
-- owner_id), its curated vacancies become regular ones, and the profile becomes a business account.
-- Calling it again once it's theirs answers the same.
create or replace function public.claim_company(p_company_id text, p_name text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_name text := nullif(left(btrim(coalesce(p_name, '')), 80), '');
  v_company_name text;
  v_company_phone text;
  v_owner uuid;
  v_phone text;
  v_phone_ok boolean;
  v_member_company text;
begin
  if v_uid is null then
    raise exception 'Entra con tu celular para reclamar tu empresa.' using errcode = '42501', hint = 'claim:not_signed_in';
  end if;

  select c.name, c.phone, c.owner_id into v_company_name, v_company_phone, v_owner
  from public.companies c where c.id = p_company_id
  for update;
  if v_company_name is null then
    raise exception 'Esa empresa no existe. Revisa que el enlace esté completo.' using errcode = 'P0002', hint = 'claim:not_found';
  end if;

  select m.company_id into v_member_company from public.company_members m where m.user_id = v_uid;
  if v_member_company = p_company_id then
    return jsonb_build_object('company_id', p_company_id, 'company_name', v_company_name);
  end if;
  if v_owner is not null or exists (select 1 from public.company_members m where m.company_id = p_company_id) then
    raise exception 'Esta empresa ya tiene quien la administre en Chambarrio. Pídele que te invite a su equipo.'
      using errcode = 'P0001', hint = 'claim:taken';
  end if;
  if v_member_company is not null then
    raise exception 'Ya perteneces al equipo de otro negocio. Sal de ese equipo antes de reclamar este.'
      using errcode = '23505', hint = 'team:other_company';
  end if;

  select public.phone10(u.phone), u.phone_confirmed_at is not null into v_phone, v_phone_ok
  from auth.users u where u.id = v_uid;
  if v_phone is null or not v_phone_ok then
    raise exception 'Verifica tu celular por SMS para reclamar la empresa.' using errcode = '42501', hint = 'claim:no_phone';
  end if;
  if v_phone is distinct from public.phone10(v_company_phone)
     and not exists (
       select 1 from public.jobs j
       where j.company_id = p_company_id and j.source = 'curada' and public.phone10(j.phone) = v_phone
     ) then
    raise exception 'Tu celular no es el que aparece en la vacante. Entra con ese número para reclamarla.'
      using errcode = '42501', hint = 'claim:wrong_phone';
  end if;

  insert into public.company_members (company_id, user_id, role) values (p_company_id, v_uid, 'dueno');
  update public.companies c set claimed_at = now() where c.id = p_company_id;
  update public.jobs j set source = 'chambarrio', expires_at = null
   where j.company_id = p_company_id and j.source = 'curada';
  update public.profiles p
     set role = 'empresa',
         onboarded = true,
         name = case when btrim(p.name) = '' and v_name is not null then v_name else p.name end
   where p.id = v_uid;

  return jsonb_build_object('company_id', p_company_id, 'company_name', v_company_name);
end $$;
revoke all on function public.claim_company(text, text) from public, anon;
grant execute on function public.claim_company(text, text) to authenticated;

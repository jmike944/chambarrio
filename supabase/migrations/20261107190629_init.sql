-- Chambarrio · initial schema
-- Hyper-local job board: candidates browse vacancies within 2/5/10/15 km of home; companies (with one
-- or more branches) publish vacancies at a branch. Privacy rule from the product: a company only ever
-- sees an applicant's colonia and approximate distance, and sees name/phone only after unlocking the
-- vacancy. Everything below enforces that with RLS + security-definer functions.

create extension if not exists postgis with schema extensions;

-- ---------------------------------------------------------------- enums
create type public.app_role as enum ('candidato', 'empresa');
create type public.category_id as enum (
  'produccion', 'almacen', 'montacargas', 'chofer', 'restaurante', 'caja',
  'ventas', 'limpieza', 'mantenimiento', 'seguridad', 'oficina', 'construccion'
);
create type public.pay_period as enum ('semana', 'quincena', 'mes', 'dia');
create type public.shift as enum ('Matutino', 'Vespertino', 'Nocturno', 'Mixto', 'Rotativo');
create type public.employment_type as enum ('Tiempo completo', 'Medio tiempo', 'Temporal', 'Fines de semana');
create type public.experience_level as enum ('Sin experiencia', '6 meses', '1 año', '2 años o más');
create type public.company_size as enum ('Micro', 'Pequeña', 'Mediana', 'Grande');
create type public.plan_id as enum ('por-vacante', 'pyme', 'industrial');
create type public.application_status as enum ('enviada', 'vista', 'entrevista', 'contratada', 'cerrada');
create type public.job_status as enum ('abierta', 'pausada', 'cerrada');
create type public.location_source as enum ('colonia', 'gps');

-- ---------------------------------------------------------------- tables
-- One row per auth user. Exact home is private to the user; employers only ever get the colonia and
-- a rounded distance through job_applicants().
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.app_role not null default 'candidato',
  name text not null default '',
  phone text,
  email text,
  interests public.category_id[] not null default '{}',
  experience public.experience_level not null default 'Sin experiencia',
  colonia text,
  home extensions.geography(point, 4326),
  location_source public.location_source not null default 'colonia',
  radius_km smallint not null default 5 check (radius_km in (2, 5, 10, 15)),
  onboarded boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Text ids: seeded demo rows keep readable slugs; new rows get a uuid.
create table public.companies (
  id text primary key default gen_random_uuid()::text,
  owner_id uuid references auth.users (id) on delete set null,
  name text not null check (char_length(name) between 2 and 120),
  kind text not null default '',
  size public.company_size not null default 'Micro',
  verified boolean not null default false,
  about text not null default '',
  employees text not null default '',
  phone text,
  plan public.plan_id not null default 'por-vacante',
  created_at timestamptz not null default now()
);
create index companies_owner_idx on public.companies (owner_id);

-- Sucursales / plantas / bodegas. A company always keeps at least one (trigger below).
create table public.branches (
  id text primary key default gen_random_uuid()::text,
  company_id text not null references public.companies (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  colonia text not null,
  location extensions.geography(point, 4326) not null,
  sort smallint not null default 0,
  created_at timestamptz not null default now(),
  unique (id, company_id)
);
create index branches_company_idx on public.branches (company_id);
create index branches_location_idx on public.branches using gist (location);

create table public.jobs (
  id text primary key default gen_random_uuid()::text,
  company_id text not null references public.companies (id) on delete cascade,
  branch_id text not null,
  title text not null check (char_length(title) between 2 and 120),
  category public.category_id not null,
  pay integer not null check (pay > 0),
  pay_max integer check (pay_max is null or pay_max >= pay),
  period public.pay_period not null default 'semana',
  shift public.shift not null,
  schedule text not null default '',
  type public.employment_type not null default 'Tiempo completo',
  experience public.experience_level not null default 'Sin experiencia',
  benefits text[] not null default '{}',
  requirements text[] not null default '{}',
  description text not null default '',
  openings integer not null default 1 check (openings > 0),
  urgent boolean not null default false,
  phone text,
  status public.job_status not null default 'abierta',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- a vacancy must sit at a branch of its own company
  foreign key (branch_id, company_id) references public.branches (id, company_id) on delete restrict
);
create index jobs_branch_idx on public.jobs (branch_id);
create index jobs_company_idx on public.jobs (company_id);
create index jobs_open_idx on public.jobs (status, created_at desc);

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  job_id text not null references public.jobs (id) on delete cascade,
  candidate_id uuid not null references auth.users (id) on delete cascade,
  status public.application_status not null default 'enviada',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (job_id, candidate_id)
);
create index applications_candidate_idx on public.applications (candidate_id);

create table public.saved_jobs (
  candidate_id uuid not null references auth.users (id) on delete cascade,
  job_id text not null references public.jobs (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (candidate_id, job_id)
);

-- Paid unlocks of a vacancy's applicants (per-vacancy plan). Written only by the payment backend
-- (service role); companies can read their own.
create table public.job_unlocks (
  job_id text not null references public.jobs (id) on delete cascade,
  company_id text not null references public.companies (id) on delete cascade,
  unlocked_until timestamptz not null,
  created_at timestamptz not null default now(),
  primary key (job_id, company_id)
);

-- ---------------------------------------------------------------- helpers & triggers
create or replace function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();
create trigger jobs_touch before update on public.jobs for each row execute function public.touch_updated_at();
create trigger applications_touch before update on public.applications for each row execute function public.touch_updated_at();

-- New auth user → profile row (role/name may come from sign-up metadata).
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, role, name, phone, email)
  values (
    new.id,
    coalesce((new.raw_user_meta_data ->> 'role')::public.app_role, 'candidato'),
    coalesce(new.raw_user_meta_data ->> 'name', ''),
    new.phone,
    new.email
  )
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- A company can't drop its last branch.
create or replace function public.keep_one_branch() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (select count(*) from public.branches where company_id = old.company_id) <= 1
     and exists (select 1 from public.companies where id = old.company_id) then
    raise exception 'Una empresa necesita al menos una sucursal';
  end if;
  return old;
end $$;

create trigger branches_keep_one before delete on public.branches
  for each row execute function public.keep_one_branch();

-- Candidates can only create applications as 'enviada' and only change them to 'cerrada' (withdraw);
-- the job's company moves them through vista → entrevista → contratada / cerrada.
create or replace function public.guard_application_status() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  is_owner boolean;
begin
  select exists (
    select 1 from public.jobs j join public.companies c on c.id = j.company_id
    where j.id = new.job_id and c.owner_id = auth.uid()
  ) into is_owner;

  if tg_op = 'INSERT' then
    new.status := 'enviada';
  elsif not is_owner then
    if new.status is distinct from old.status and new.status <> 'cerrada' then
      raise exception 'Solo la empresa puede cambiar el estado de la postulación';
    end if;
    new.job_id := old.job_id;
    new.candidate_id := old.candidate_id;
  end if;
  return new;
end $$;

create trigger applications_guard before insert or update on public.applications
  for each row execute function public.guard_application_status();

create or replace function public.is_company_owner(cid text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.companies where id = cid and owner_id = auth.uid());
$$;

-- ---------------------------------------------------------------- RLS
alter table public.profiles enable row level security;
alter table public.companies enable row level security;
alter table public.branches enable row level security;
alter table public.jobs enable row level security;
alter table public.applications enable row level security;
alter table public.saved_jobs enable row level security;
alter table public.job_unlocks enable row level security;

create policy "profiles: read own" on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy "profiles: update own" on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "companies: public read" on public.companies for select using (true);
create policy "companies: create own" on public.companies for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "companies: update own" on public.companies for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "companies: delete own" on public.companies for delete to authenticated using (owner_id = (select auth.uid()));

create policy "branches: public read" on public.branches for select using (true);
create policy "branches: owner insert" on public.branches for insert to authenticated with check (public.is_company_owner(company_id));
create policy "branches: owner update" on public.branches for update to authenticated using (public.is_company_owner(company_id)) with check (public.is_company_owner(company_id));
create policy "branches: owner delete" on public.branches for delete to authenticated using (public.is_company_owner(company_id));

create policy "jobs: read open or own" on public.jobs for select
  using (status = 'abierta' or public.is_company_owner(company_id));
create policy "jobs: owner insert" on public.jobs for insert to authenticated with check (public.is_company_owner(company_id));
create policy "jobs: owner update" on public.jobs for update to authenticated using (public.is_company_owner(company_id)) with check (public.is_company_owner(company_id));
create policy "jobs: owner delete" on public.jobs for delete to authenticated using (public.is_company_owner(company_id));

create policy "applications: candidate or company reads" on public.applications for select to authenticated
  using (candidate_id = (select auth.uid()) or exists (select 1 from public.jobs j where j.id = job_id and public.is_company_owner(j.company_id)));
create policy "applications: candidate applies" on public.applications for insert to authenticated
  with check (candidate_id = (select auth.uid()) and exists (select 1 from public.jobs j where j.id = job_id and j.status = 'abierta'));
create policy "applications: candidate or company updates" on public.applications for update to authenticated
  using (candidate_id = (select auth.uid()) or exists (select 1 from public.jobs j where j.id = job_id and public.is_company_owner(j.company_id)));

create policy "saved: own" on public.saved_jobs for all to authenticated using (candidate_id = (select auth.uid())) with check (candidate_id = (select auth.uid()));

create policy "unlocks: company reads own" on public.job_unlocks for select to authenticated using (public.is_company_owner(company_id));

-- ---------------------------------------------------------------- read models (RPC)
-- Open vacancies within radius_km of a point, nearest first, with distance and bearing (degrees from
-- north) so the radar can place pins. The point is the caller's own home; nothing about it is stored.
create or replace function public.jobs_near(lat double precision, lng double precision, radius_km double precision default 15)
returns table (
  id text, title text, category public.category_id, pay integer, pay_max integer, period public.pay_period,
  shift public.shift, schedule text, type public.employment_type, experience public.experience_level,
  benefits text[], requirements text[], description text, openings integer, urgent boolean, phone text,
  created_at timestamptz, company_id text, company_name text, company_verified boolean,
  branch_id text, branch_name text, colonia text, branch_lat double precision, branch_lng double precision,
  km double precision, bearing double precision, applicants bigint
)
language sql stable security definer set search_path = '' as $$
  with here as (select extensions.st_setsrid(extensions.st_makepoint(lng, lat), 4326)::extensions.geography as g)
  select j.id, j.title, j.category, j.pay, j.pay_max, j.period, j.shift, j.schedule, j.type, j.experience,
         j.benefits, j.requirements, j.description, j.openings, j.urgent, j.phone, j.created_at,
         c.id, c.name, c.verified, b.id, b.name, b.colonia,
         extensions.st_y(b.location::extensions.geometry), extensions.st_x(b.location::extensions.geometry),
         extensions.st_distance(b.location, here.g) / 1000.0,
         degrees(extensions.st_azimuth(here.g::extensions.geometry, b.location::extensions.geometry)),
         (select count(*) from public.applications a where a.job_id = j.id)
  from public.jobs j
  join public.branches b on b.id = j.branch_id
  join public.companies c on c.id = j.company_id
  cross join here
  where j.status = 'abierta'
    and extensions.st_dwithin(b.location, here.g, least(radius_km, 50) * 1000)
  order by extensions.st_distance(b.location, here.g);
$$;

-- What a company may see about the applicants of ONE of its vacancies: colonia + distance (rounded to
-- 100 m) always; name and phone only while the vacancy is unlocked (or on a plan that includes it).
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
  where j.id = p_job_id and c.owner_id = auth.uid();
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

-- Set the caller's home from lat/lng (keeps PostGIS details out of the client).
create or replace function public.set_my_home(lat double precision, lng double precision, p_colonia text, p_source public.location_source default 'colonia')
returns void
language sql security definer set search_path = '' as $$
  update public.profiles
     set home = extensions.st_setsrid(extensions.st_makepoint(lng, lat), 4326)::extensions.geography,
         colonia = p_colonia,
         location_source = p_source
   where id = auth.uid();
$$;

-- Add a branch from lat/lng (owner only; RLS on branches still applies to direct writes).
create or replace function public.add_branch(p_company_id text, p_name text, p_colonia text, lat double precision, lng double precision)
returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_id text;
begin
  if not public.is_company_owner(p_company_id) then
    raise exception 'No autorizado';
  end if;
  insert into public.branches (company_id, name, colonia, location, sort)
  values (p_company_id, p_name, p_colonia, extensions.st_setsrid(extensions.st_makepoint(lng, lat), 4326)::extensions.geography,
          (select coalesce(max(sort), -1) + 1 from public.branches where company_id = p_company_id))
  returning id into v_id;
  return v_id;
end $$;

-- Branches with plain lat/lng for clients.
create or replace view public.branches_view with (security_invoker = true) as
  select b.id, b.company_id, b.name, b.colonia, b.sort,
         extensions.st_y(b.location::extensions.geometry) as lat,
         extensions.st_x(b.location::extensions.geometry) as lng
  from public.branches b;

-- `verified` and `plan` are set by staff / the payment backend (service role), never by the client.
revoke insert, update on public.companies from anon, authenticated;
grant insert (id, owner_id, name, kind, size, about, employees, phone) on public.companies to authenticated;
grant update (name, kind, size, about, employees, phone) on public.companies to authenticated;

revoke all on function public.job_applicants(text) from public, anon;
revoke all on function public.set_my_home(double precision, double precision, text, public.location_source) from public, anon;
revoke all on function public.add_branch(text, text, text, double precision, double precision) from public, anon;
revoke all on function public.is_company_owner(text) from public, anon;
grant execute on function public.is_company_owner(text) to authenticated;
grant execute on function public.job_applicants(text) to authenticated;
grant execute on function public.set_my_home(double precision, double precision, text, public.location_source) to authenticated;
grant execute on function public.add_branch(text, text, text, double precision, double precision) to authenticated;
grant execute on function public.jobs_near(double precision, double precision, double precision) to anon, authenticated;

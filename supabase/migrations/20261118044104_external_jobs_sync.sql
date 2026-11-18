-- Chambarrio · Jooble vacancies in the database (approximate location)
--
-- Jooble's operative vacancies in Saltillo / Ramos Arizpe / Arteaga are synced every hour into the
-- regular tables, so Inicio, the map and the radar show them, not only the search's outside list.
--   * They are curated vacancies (source 'curada') with origin = 'jooble': no applications (people
--     apply on Jooble, source_url), no phone, so nobody can claim their companies.
--   * Jooble only names the town, so each company gets one branch per town, placed 300–1,200 m from
--     the town's centre in a direction fixed per company (pins don't stack) and named "… (zona
--     aproximada)". The app says the location and distance are approximate.
--   * Pay may be unknown: pay = 0 is allowed only for them (the app shows "Sueldo no publicado").
--   * They expire 3 days after Jooble last listed them (the hourly cron closes them); every sync
--     re-opens and extends the ones still listed. Companies someone manages are never touched.
--   * No secrets: pg_net calls our own public route /api/vacantes-externas?solo=jooble (which reads
--     Jooble with the key in Vercel, cached for an hour) and the next tick applies the answer.
--   * Not in the daily email digest: their distance is approximate.
--
-- New: jobs.origin; table external_sync; functions slugify, external_jobs_apply, external_jobs_tick
--      (cron hourly at :41).
-- Replaces: check jobs_pay_check, guard_job_source (origin is Chambarrio's too), jobs_near (+ origin;
--      return type changes → drop + create), enqueue_job_digests (skips origin vacancies).

-- ---------------------------------------------------------------- 1. columns and rules
alter table public.jobs
  add column origin text constraint jobs_origin_known check (origin is null or origin in ('jooble'));
comment on column public.jobs.origin is 'Outside job board a curated vacancy is synced from (jooble): approximate location, may have no pay.';

alter table public.jobs drop constraint jobs_pay_check;
alter table public.jobs add constraint jobs_pay_check check (pay > 0 or (pay = 0 and origin is not null));

create index jobs_origin_idx on public.jobs (origin) where origin is not null;

-- Only Chambarrio sets origin (same rule as the other source columns).
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
      new.origin := null;
    else
      new.source := old.source;
      new.source_label := old.source_label;
      new.source_url := old.source_url;
      new.checked_at := old.checked_at;
      new.expires_at := old.expires_at;
      new.origin := old.origin;
    end if;
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------- 2. jobs_near with origin
drop function public.jobs_near(double precision, double precision, double precision);
create function public.jobs_near(lat double precision, lng double precision, radius_km double precision default 15)
returns table (
  id text, title text, category public.category_id, pay integer, pay_max integer, period public.pay_period,
  shift public.shift, schedule text, type public.employment_type, experience public.experience_level,
  benefits text[], requirements text[], description text, openings integer, urgent boolean, phone text,
  created_at timestamptz, company_id text, company_name text, company_verified boolean,
  branch_id text, branch_name text, colonia text, branch_lat double precision, branch_lng double precision,
  km double precision, bearing double precision, applicants bigint,
  source public.job_source, source_label text, source_url text, checked_at timestamptz, expires_at timestamptz,
  origin text
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
         j.source, j.source_label, j.source_url, j.checked_at, j.expires_at,
         j.origin
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

-- ---------------------------------------------------------------- 3. the daily digest skips them
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
        and j.origin is null
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

-- ---------------------------------------------------------------- 4. the sync
-- "Ensambles del Norte, S.A." → "ensambles-del-norte-s-a" (ids for synced companies).
create or replace function public.slugify(p text) returns text
language sql immutable set search_path = '' as $$
  select left(trim(both '-' from regexp_replace(
           translate(lower(coalesce(p, '')), 'áéíóúüñàèìòùâêîôûäëïö', 'aeiouunaeiouaeiouaeio'),
           '[^a-z0-9]+', '-', 'g')), 50);
$$;
revoke all on function public.slugify(text) from public, anon, authenticated;

-- One row: the pending request to our route and what the last sync did.
create table public.external_sync (
  id smallint primary key default 1 constraint external_sync_one check (id = 1),
  request_id bigint,
  requested_at timestamptz,
  applied_at timestamptz,
  last_result jsonb
);
alter table public.external_sync enable row level security;
revoke all on table public.external_sync from anon, authenticated;
insert into public.external_sync (id) values (1);
comment on table public.external_sync is 'Hourly Jooble sync state (external_jobs_tick). Service only.';

-- Upserts the vacancies from /api/vacantes-externas?solo=jooble (SyncJob[]). A bad item is skipped,
-- never the batch. Returns { jobs, skipped }.
create or replace function public.external_jobs_apply(p_jobs jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_job jsonb;
  v_company text;
  v_company_id text;
  v_city text;
  v_town text;
  v_center extensions.geography;
  v_branch_id text;
  v_h bigint;
  v_pay integer;
  v_pay_max integer;
  v_posted timestamptz;
  v_done integer := 0;
  v_skipped integer := 0;
begin
  for v_job in select * from jsonb_array_elements(case when jsonb_typeof(p_jobs) = 'array' then p_jobs else '[]'::jsonb end) loop
    begin
      v_company := left(btrim(coalesce(v_job ->> 'company', '')), 120);
      v_city := v_job ->> 'city';
      v_town := case v_city when 'saltillo' then 'Saltillo' when 'ramos-arizpe' then 'Ramos Arizpe'
                            when 'arteaga' then 'Arteaga' when 'derramadero' then 'Derramadero' end;
      v_center := case v_city
        when 'saltillo' then extensions.st_point(-101.0053, 25.4232, 4326)::extensions.geography
        when 'ramos-arizpe' then extensions.st_point(-100.9477, 25.5408, 4326)::extensions.geography
        when 'arteaga' then extensions.st_point(-100.8461, 25.4459, 4326)::extensions.geography
        when 'derramadero' then extensions.st_point(-101.1876, 25.2981, 4326)::extensions.geography
      end;
      v_company_id := 'ext-' || public.slugify(v_company);
      if v_center is null or char_length(v_company) < 2 or v_company_id = 'ext-'
         or coalesce(v_job ->> 'id', '') !~ '^-?[0-9]{1,30}$'
         or coalesce(v_job ->> 'url', '') !~* '^https?://[^[:space:]]+$' then
        v_skipped := v_skipped + 1;
        continue;
      end if;

      insert into public.companies (id, name, kind, size, about)
      values (v_company_id, v_company, '', 'Micro', '')
      on conflict (id) do nothing;

      v_branch_id := v_company_id || '-' || v_city;
      v_h := abs(hashtext(v_branch_id)::bigint);
      insert into public.branches (id, company_id, name, colonia, location, sort)
      values (
        v_branch_id, v_company_id, v_town || ' (zona aproximada)', v_town,
        extensions.st_project(v_center, 300 + (v_h % 900), radians((v_h / 7) % 360)),
        0)
      on conflict (id) do nothing;

      v_pay := greatest(0, round(coalesce((v_job ->> 'payMin')::numeric, 0)))::integer;
      v_pay_max := case when v_pay > 0 then round(nullif(v_job ->> 'payMax', '')::numeric)::integer end;
      if v_pay_max is not null and v_pay_max <= v_pay then
        v_pay_max := null;
      end if;
      v_posted := least(now(), coalesce(nullif(v_job ->> 'postedAt', '')::timestamptz, now()));

      insert into public.jobs (
        id, company_id, branch_id, title, category, pay, pay_max, period, shift, schedule, type, experience,
        benefits, requirements, description, openings, urgent, phone, status,
        source, origin, source_label, source_url, checked_at, expires_at, created_at)
      values (
        'ext-jooble-' || (v_job ->> 'id'), v_company_id, v_branch_id, left(btrim(v_job ->> 'title'), 120),
        (v_job ->> 'category')::public.category_id, v_pay, v_pay_max,
        coalesce(nullif(v_job ->> 'period', ''), 'mes')::public.pay_period,
        'Mixto', '', 'Tiempo completo', 'Sin experiencia',
        '{}', '{}', left(coalesce(v_job ->> 'snippet', ''), 1000), 1, false, null, 'abierta',
        'curada', 'jooble', 'Jooble', v_job ->> 'url', now(), now() + interval '3 days', v_posted)
      on conflict (id) do update set
        title = excluded.title, category = excluded.category, pay = excluded.pay, pay_max = excluded.pay_max,
        period = excluded.period, description = excluded.description, source_url = excluded.source_url,
        status = 'abierta', checked_at = excluded.checked_at, expires_at = excluded.expires_at
        where public.jobs.source = 'curada' and public.jobs.origin = 'jooble';
      v_done := v_done + 1;
    exception when others then
      v_skipped := v_skipped + 1;
    end;
  end loop;
  return jsonb_build_object('jobs', v_done, 'skipped', v_skipped);
end $$;
revoke all on function public.external_jobs_apply(jsonb) from public, anon, authenticated;

-- Hourly: applies the answer to the previous request (if it came back 200), then asks again.
create or replace function public.external_jobs_tick() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_req bigint;
  v_status integer;
  v_body text;
  v_result jsonb;
  v_new bigint;
begin
  select s.request_id into v_req from public.external_sync s where s.id = 1 for update;
  if v_req is not null then
    select r.status_code, r.content into v_status, v_body from net._http_response r where r.id = v_req;
    if v_status = 200 then
      v_result := public.external_jobs_apply(v_body::jsonb -> 'jobs');
      update public.external_sync
         set applied_at = now(), last_result = v_result || jsonb_build_object('status', v_status)
       where id = 1;
    elsif v_status is not null then
      v_result := jsonb_build_object('status', v_status, 'error', left(coalesce(v_body, ''), 200));
      update public.external_sync set last_result = v_result where id = 1;
    end if;
  end if;
  v_new := net.http_get(
    url := 'https://www.chambarrio.com/api/vacantes-externas?solo=jooble',
    headers := jsonb_build_object('User-Agent', 'chambarrio-sync/1.0'),
    timeout_milliseconds := 30000);
  update public.external_sync set request_id = v_new, requested_at = now() where id = 1;
  return coalesce(v_result, '{}'::jsonb);
end $$;
revoke all on function public.external_jobs_tick() from public, anon, authenticated;

select cron.schedule('chambarrio-external-jobs', '41 * * * *', $$ select public.external_jobs_tick(); $$);

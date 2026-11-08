-- Chambarrio · richer (optional) candidate profiles
--
-- Everything here is optional; a fuller profile just makes a candidate more competitive. Privacy model
-- stays the same as job_applicants(): a company sees skills, history, availability etc. for anyone who
-- applied to its vacancy, but name, phone, photo and CV only once that vacancy is unlocked.

create type public.education_level as enum ('primaria', 'secundaria', 'preparatoria', 'tecnico', 'licenciatura');
create type public.start_availability as enum ('inmediata', '1_semana', '2_semanas', '1_mes');

alter table public.profiles
  add column headline text check (headline is null or char_length(headline) <= 80),
  add column about text check (about is null or char_length(about) <= 500),
  add column education public.education_level,
  add column skills text[] not null default '{}' check (cardinality(skills) <= 20),
  add column certifications text[] not null default '{}' check (cardinality(certifications) <= 15),
  add column languages text[] not null default '{}' check (cardinality(languages) <= 6),
  add column shifts public.shift[] not null default '{}',
  add column available_from public.start_availability,
  add column transport text[] not null default '{}'
    check (transport <@ array['auto', 'moto', 'bici', 'camion', 'caminando']::text[]),
  add column expected_pay integer check (expected_pay is null or expected_pay between 100 and 200000),
  add column expected_period public.pay_period,
  add column avatar_path text check (avatar_path is null or char_length(avatar_path) <= 200),
  add column cv_path text check (cv_path is null or char_length(cv_path) <= 200);

-- ---------------------------------------------------------------- work history
create table public.work_experiences (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 2 and 80),
  company text check (company is null or char_length(company) <= 80),
  category public.category_id,
  start_month date,
  end_month date,
  is_current boolean not null default false,
  description text check (description is null or char_length(description) <= 300),
  sort smallint not null default 0,
  created_at timestamptz not null default now(),
  check (end_month is null or start_month is null or end_month >= start_month)
);
create index work_experiences_profile_idx on public.work_experiences (profile_id, sort);
alter table public.work_experiences enable row level security;

create policy "experiences: own read" on public.work_experiences for select to authenticated
  using (profile_id = (select auth.uid()));
create policy "experiences: own insert" on public.work_experiences for insert to authenticated
  with check (profile_id = (select auth.uid()));
create policy "experiences: own update" on public.work_experiences for update to authenticated
  using (profile_id = (select auth.uid())) with check (profile_id = (select auth.uid()));
create policy "experiences: own delete" on public.work_experiences for delete to authenticated
  using (profile_id = (select auth.uid()));

create or replace function public.limit_work_experiences() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (select count(*) from public.work_experiences where profile_id = new.profile_id) >= 10 then
    raise exception 'Puedes guardar hasta 10 experiencias';
  end if;
  return new;
end $$;
revoke all on function public.limit_work_experiences() from public, anon, authenticated;
create trigger work_experiences_limit before insert on public.work_experiences
  for each row execute function public.limit_work_experiences();

-- ---------------------------------------------------------------- profile strength (0–100)
-- Also a PostgREST computed column: select=*,profile_strength on the caller's own profile row.
-- Weights: name 10, phone 10, home 10, interests 5, headline 10, about 10, work history 15,
-- skills+certifications (≥3) 10, education 5, shifts+start date 5, photo 5, CV 5.
create or replace function public.profile_strength(p public.profiles) returns smallint
language sql stable set search_path = '' as $$
  select least(100,
      (case when char_length(coalesce(p.name, '')) >= 2 then 10 else 0 end)
    + (case when p.phone is not null then 10 else 0 end)
    + (case when p.home is not null then 10 else 0 end)
    + (case when cardinality(p.interests) > 0 then 5 else 0 end)
    + (case when char_length(coalesce(p.headline, '')) >= 10 then 10 else 0 end)
    + (case when char_length(coalesce(p.about, '')) >= 40 then 10 else 0 end)
    + (case when exists (select 1 from public.work_experiences w where w.profile_id = p.id) then 15 else 0 end)
    + (case when cardinality(p.skills) + cardinality(p.certifications) >= 3 then 10 else 0 end)
    + (case when p.education is not null then 5 else 0 end)
    + (case when cardinality(p.shifts) > 0 and p.available_from is not null then 5 else 0 end)
    + (case when p.avatar_path is not null then 5 else 0 end)
    + (case when p.cv_path is not null then 5 else 0 end)
  )::smallint;
$$;

-- ---------------------------------------------------------------- employer view (richer, same privacy)
-- One row per applicant: non-identifying profile always; contact (name, phone, photo, CV paths) only
-- while the vacancy is unlocked or the company is on a plan that includes it.
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
         v_open,
         public.profile_strength(p),
         jsonb_build_object(
           'experience', p.experience, 'interests', p.interests, 'headline', p.headline, 'about', p.about,
           'education', p.education, 'skills', p.skills, 'certifications', p.certifications,
           'languages', p.languages, 'shifts', p.shifts, 'available_from', p.available_from,
           'transport', p.transport, 'expected_pay', p.expected_pay, 'expected_period', p.expected_period,
           'has_photo', p.avatar_path is not null, 'has_cv', p.cv_path is not null
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
revoke all on function public.job_applicants_detail(text) from public, anon;
grant execute on function public.job_applicants_detail(text) to authenticated;

-- ---------------------------------------------------------------- photo + CV storage
-- Private buckets; files live under "<user id>/...". Owners manage their own folder; a company can
-- read a candidate's files only while it has an unlocked vacancy that person applied to.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('avatars', 'avatars', false, 2097152, array['image/jpeg', 'image/png', 'image/webp']),
  ('cvs', 'cvs', false, 5242880, array['application/pdf'])
on conflict (id) do nothing;

create or replace function public.can_view_candidate_files(p_folder text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.applications a
    join public.jobs j on j.id = a.job_id
    join public.companies c on c.id = j.company_id
    where a.candidate_id::text = p_folder
      and c.owner_id = auth.uid()
      and (c.plan in ('pyme', 'industrial') or exists (
        select 1 from public.job_unlocks u where u.job_id = j.id and u.company_id = c.id and u.unlocked_until > now()
      ))
  );
$$;
revoke all on function public.can_view_candidate_files(text) from public, anon;
grant execute on function public.can_view_candidate_files(text) to authenticated;

create policy "candidate files: owner reads" on storage.objects for select to authenticated
  using (bucket_id in ('avatars', 'cvs') and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "candidate files: owner uploads" on storage.objects for insert to authenticated
  with check (bucket_id in ('avatars', 'cvs') and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "candidate files: owner updates" on storage.objects for update to authenticated
  using (bucket_id in ('avatars', 'cvs') and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id in ('avatars', 'cvs') and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "candidate files: owner deletes" on storage.objects for delete to authenticated
  using (bucket_id in ('avatars', 'cvs') and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "candidate files: unlocked employers read" on storage.objects for select to authenticated
  using (bucket_id in ('avatars', 'cvs') and public.can_view_candidate_files((storage.foldername(name))[1]));

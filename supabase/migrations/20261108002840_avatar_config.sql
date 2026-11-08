-- Chambarrio · "Crea tu avatar"
--
-- A candidate can build an illustrated avatar (skin tone, hair, headwear, outfit…) in /perfil. It is
-- stored as a small JSON value (the app's AvatarConfig, versioned with "v") and sanitized by the app
-- (sanitizeAvatar) every time it is read, so the database only guards its shape and size (the text
-- length, not pg_column_size, which can measure a compressed/TOASTed value).
--
-- Privacy: the avatar is a drawing chosen from a fixed set of options. It identifies nobody, so a
-- company sees it from the moment someone applies (in job_applicants_detail's `profile`, next to
-- skills and history). The uploaded photo stays exactly as before: path only in `contact`, which is
-- null until the vacancy is unlocked.
--
-- The app fails soft while this migration isn't applied: the write comes back PGRST204 (unknown
-- column), so it keeps the avatar on the device and uploads it on a later session load.

-- ---------------------------------------------------------------- 1. column
alter table public.profiles
  add column avatar_config jsonb
    constraint profiles_avatar_config_shape check (
      avatar_config is null
      or (jsonb_typeof(avatar_config) = 'object' and octet_length(avatar_config::text) < 2048)
    );

comment on column public.profiles.avatar_config is
  'Illustrated avatar (app AvatarConfig JSON, sanitized on read). Non-identifying: shown to companies before unlock.';

-- ---------------------------------------------------------------- 2. employer view
-- Same as 20261107211254_candidate_profiles.sql, plus 'avatar' in the non-identifying profile.
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
revoke all on function public.job_applicants_detail(text) from public, anon;
grant execute on function public.job_applicants_detail(text) to authenticated;

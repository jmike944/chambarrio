-- Chambarrio · candidate profile follow-ups (review of 20261107211254_candidate_profiles.sql)
--
--  1. profiles.avatar_path / cv_path are client-writable, so a candidate could claim a photo or CV
--     that doesn't exist (+10 strength, "Foto"/"CV" promised on locked cards, nothing after the
--     unlock) or point at someone else's folder. A path must now name an object the user uploaded
--     to their own folder of the right bucket. The app uploads first and saves the path second, so
--     its flow is unchanged.
--  2. Each skill / certification / language is 1–60 characters (the editor's own limit), so the
--     employer's applicant card never renders unbounded text.

-- ---------------------------------------------------------------- 1. file paths
create or replace function public.check_profile_files() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.avatar_path is not null and new.avatar_path is distinct from old.avatar_path and not exists (
    select 1 from storage.objects o
     where o.bucket_id = 'avatars' and o.name = new.avatar_path
       and (storage.foldername(o.name))[1] = new.id::text
  ) then
    raise exception 'avatar_path: la foto no existe en tu carpeta' using errcode = '23514';
  end if;
  if new.cv_path is not null and new.cv_path is distinct from old.cv_path and not exists (
    select 1 from storage.objects o
     where o.bucket_id = 'cvs' and o.name = new.cv_path
       and (storage.foldername(o.name))[1] = new.id::text
  ) then
    raise exception 'cv_path: el CV no existe en tu carpeta' using errcode = '23514';
  end if;
  return new;
end $$;
revoke all on function public.check_profile_files() from public, anon, authenticated;

create trigger profiles_check_files before update of avatar_path, cv_path on public.profiles
  for each row execute function public.check_profile_files();

-- ---------------------------------------------------------------- 2. list items
create or replace function public.text_items_ok(p_items text[], p_max integer) returns boolean
language sql immutable set search_path = '' as $$
  select coalesce(bool_and(x is not null and char_length(btrim(x)) between 1 and p_max), true)
  from unnest(p_items) as x;
$$;

alter table public.profiles
  add constraint profiles_skill_item_length check (public.text_items_ok(skills, 60)),
  add constraint profiles_certification_item_length check (public.text_items_ok(certifications, 60)),
  add constraint profiles_language_item_length check (public.text_items_ok(languages, 60));

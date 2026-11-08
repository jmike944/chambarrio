-- Chambarrio · hiring pipeline (enviada → vista → entrevista → contratada, or cerrada)
--
-- The candidate sees the real process on their application: when it was seen, interview day/time/place
-- and instructions, a message from the company (next steps or a courteous "no"), and can withdraw.
-- Only the company that owns the vacancy can move it forward; the guard trigger enforces that and
-- stamps the timestamps. Every change is logged in application_events (the timeline both sides see);
-- application_notes are private recruiter notes. The candidate email trigger now carries interview
-- details, re-notifies on a rescheduled interview, and sends a courteous message when declined.

alter table public.applications
  add column seen_at timestamptz,
  add column interview_at timestamptz,
  add column interview_place text check (interview_place is null or char_length(interview_place) <= 160),
  add column interview_note text check (interview_note is null or char_length(interview_note) <= 500),
  add column company_message text check (company_message is null or char_length(company_message) <= 500),
  add column hired_at timestamptz,
  add column closed_by text check (closed_by is null or closed_by in ('empresa', 'candidato')),
  add column closed_at timestamptz;

-- ---------------------------------------------------------------- timeline
create table public.application_events (
  id bigint generated always as identity primary key,
  application_id uuid not null references public.applications (id) on delete cascade,
  status public.application_status not null,
  actor text not null check (actor in ('candidato', 'empresa')),
  interview_at timestamptz,
  created_at timestamptz not null default now()
);
create index application_events_app_idx on public.application_events (application_id, created_at);
alter table public.application_events enable row level security;
-- Written only by the trigger below (security definer); read by the candidate or the vacancy's company.
create policy "events: candidate or company reads" on public.application_events for select to authenticated
  using (exists (
    select 1 from public.applications a join public.jobs j on j.id = a.job_id
    where a.id = application_id and (a.candidate_id = (select auth.uid()) or public.is_company_owner(j.company_id))
  ));

-- ---------------------------------------------------------------- private recruiter notes
create or replace function public.owns_application(p_app uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.applications a
    join public.jobs j on j.id = a.job_id
    join public.companies c on c.id = j.company_id
    where a.id = p_app and c.owner_id = auth.uid()
  );
$$;
revoke all on function public.owns_application(uuid) from public, anon;
grant execute on function public.owns_application(uuid) to authenticated;

create table public.application_notes (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications (id) on delete cascade,
  author_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index application_notes_app_idx on public.application_notes (application_id, created_at);
alter table public.application_notes enable row level security;
create policy "notes: company reads" on public.application_notes for select to authenticated
  using (public.owns_application(application_id));
create policy "notes: company writes" on public.application_notes for insert to authenticated
  with check (author_id = (select auth.uid()) and public.owns_application(application_id));
create policy "notes: author deletes" on public.application_notes for delete to authenticated
  using (author_id = (select auth.uid()) and public.owns_application(application_id));

-- ---------------------------------------------------------------- guard v2
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

  -- Company side.
  if old.status = 'cerrada' and old.closed_by = 'candidato' and new.status <> 'cerrada' then
    raise exception 'Esta persona retiró su postulación';
  end if;
  new.seen_at := case when new.status <> 'enviada' then coalesce(old.seen_at, now()) else old.seen_at end;
  if new.status = 'contratada' and old.status <> 'contratada' then new.hired_at := now(); end if;
  if new.status <> 'contratada' then new.hired_at := case when old.status = 'contratada' then null else old.hired_at end; end if;
  if new.status = 'cerrada' and old.status <> 'cerrada' then
    new.closed_by := 'empresa'; new.closed_at := now();
  elsif new.status <> 'cerrada' then
    new.closed_by := null; new.closed_at := null;
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------- event log
create or replace function public.log_application_event() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    insert into public.application_events (application_id, status, actor) values (new.id, new.status, 'candidato');
  elsif new.status is distinct from old.status
     or (new.status = 'entrevista' and new.interview_at is distinct from old.interview_at) then
    insert into public.application_events (application_id, status, actor, interview_at)
    values (new.id, new.status,
            case when new.status = 'cerrada' and new.closed_by = 'candidato' then 'candidato' else 'empresa' end,
            new.interview_at);
  end if;
  return null;
end $$;
revoke all on function public.log_application_event() from public, anon, authenticated;
create trigger applications_log_events after insert or update on public.applications
  for each row execute function public.log_application_event();

-- Backfill: one "enviada" event for applications created before this migration.
insert into public.application_events (application_id, status, actor, created_at)
select a.id, 'enviada', 'candidato', a.created_at from public.applications a
where not exists (select 1 from public.application_events e where e.application_id = a.id);

-- ---------------------------------------------------------------- candidate emails v2
create or replace function public.enqueue_application_status() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_email text;
  v_payload jsonb;
  v_changed boolean := new.status is distinct from old.status;
  v_resched boolean;
  v_key text;
begin
  v_resched := new.status = 'entrevista' and not v_changed
               and new.interview_at is not null and new.interview_at is distinct from old.interview_at;
  if not (v_resched or (v_changed and (new.status in ('vista', 'entrevista', 'contratada')
                                       or (new.status = 'cerrada' and new.closed_by = 'empresa')))) then
    return null;
  end if;
  if not exists (select 1 from public.profiles where id = new.candidate_id and email_updates) then return null; end if;
  v_email := public.user_email(new.candidate_id);
  if v_email is null then return null; end if;

  select jsonb_build_object(
           'application_id', new.id,
           'status', new.status,
           'rescheduled', v_resched,
           'job_id', j.id,
           'job_title', j.title,
           'company_name', c.name,
           'branch_name', b.name,
           'colonia', b.colonia,
           'phone', j.phone,
           'interview_at', new.interview_at,
           'interview_place', new.interview_place,
           'interview_note', new.interview_note,
           'company_message', new.company_message
         )
    into v_payload
  from public.jobs j
  join public.companies c on c.id = j.company_id
  join public.branches b on b.id = j.branch_id
  where j.id = new.job_id;

  v_key := 'status:' || new.id || ':' || new.status
           || case when new.status = 'entrevista' and new.interview_at is not null
                   then ':' || extract(epoch from new.interview_at)::bigint else '' end;

  insert into public.email_outbox (kind, user_id, to_email, payload, dedupe_key)
  values ('application_status', new.candidate_id, v_email, v_payload, v_key)
  on conflict (dedupe_key) do nothing;
  return null;
end $$;
revoke all on function public.enqueue_application_status() from public, anon, authenticated;

drop trigger applications_notify_candidate on public.applications;
create trigger applications_notify_candidate after update of status, interview_at on public.applications
  for each row execute function public.enqueue_application_status();

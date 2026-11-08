-- Chambarrio · hiring pipeline v3: what the candidate is told always matches what happened
--
-- Review of 20261107233000_hiring_pipeline.sql (applied). Problems this fixes:
--   a. "Deshacer" after Descartar didn't undo anything for the candidate: the decline email went out
--      at once, the timeline kept "Esta vez no quedaste", the reopen logged a second "entrevista"
--      (read as "Cambiaron la hora"), and a later real decline sent no email (dedupe key per status).
--   b. Moving an interview A → B → A sent no email for the move back (same dedupe key as the first).
--   c. Changing only the place or the instructions of an interview sent nothing and logged nothing.
--   d. A welcome message written after the hire reached nobody; a later "Reabrir" was silent.
--   e. A company could still rewrite the message / interview of a withdrawn application.
--
--  1. email_outbox.send_after: a row isn't claimed before it. Every kind still sends at once
--     (default now()); only a company decline waits 10 minutes, the time "Deshacer" has.
--     claim_email_batch / email_retry_tick / on_email_enqueued only pick (or wake the sender for)
--     due rows; the 10-minute retry tick sends the delayed ones (10–20 min after the decline).
--  2. application_events.change ('hora' | 'lugar' | 'indicaciones' | 'mensaje' | 'reabierta') says
--     what a non-status event was; application_events.message keeps the company's message as it
--     was at that step (the decline notice no longer shows whatever the row says later).
--  3. decline_undoable(): a company decline is still undoable while it's under 10 minutes old and its
--     email hasn't started sending.
--  4. guard v3: on a candidate-withdrawn application the company can't change anything; editing a
--     decline's or a hire's message never moves closed_at / closed_by / hired_at (server stamps only).
--  5. events v3: Deshacer deletes the decline event (it never happened for the candidate); a later
--     reopen logs 'reabierta'; time / place / instructions changes and a welcome message log their
--     own event; editing a decline's message updates that decline's event.
--  6. candidate emails v3: decline delayed 10 min and keyed by its closed_at (each real decline
--     gets its email); Deshacer skips it and sends nothing; a later reopen skips a decline email
--     still waiting (and then sends no "retomó" either: the inbox never heard of the decline).
--     Every step and every interview change (time, place, instructions), a later welcome message
--     or a reopen gets its own email, keyed by its event id (A → B → A emails three times).
--     The trigger now also fires on interview_place, interview_note and company_message.
--
-- Replaces the deployed bodies of: claim_email_batch, email_retry_tick, on_email_enqueued
-- (20261107233100_email_outbox_hardening.sql); guard_application_status, log_application_event,
-- enqueue_application_status and trigger applications_notify_candidate (20261107233000).
-- The payload gains "change" (send-emails renders it; deploy that function with this migration).
-- NOT APPLIED. Review, then apply together with 20261108010000_candidate_reads_after_close.sql.

-- ---------------------------------------------------------------- 1. send_after
alter table public.email_outbox add column if not exists send_after timestamptz not null default now();

create or replace function public.claim_email_batch(p_limit integer default 25)
returns setof public.email_outbox
language sql security definer set search_path = '' as $$
  update public.email_outbox o
     set status = 'sending', attempts = o.attempts + 1, claimed_at = now()
   where o.id in (
     select id from public.email_outbox
      where ((status = 'pending' and send_after <= now())
             or (status = 'sending' and claimed_at < now() - interval '10 minutes'))
        and attempts < 5
      order by created_at
      limit least(greatest(p_limit, 1), 100)
      for update skip locked
   )
  returning o.*;
$$;
revoke all on function public.claim_email_batch(integer) from public, anon, authenticated;
grant execute on function public.claim_email_batch(integer) to service_role;

create or replace function public.email_retry_tick() returns void
language plpgsql security definer set search_path = '' as $$
begin
  -- A run died (or couldn't record the result) on the 5th attempt: stop waiting for it.
  update public.email_outbox
     set status = 'failed', last_error = coalesce(last_error, 'no result after 5 attempts')
   where status = 'sending' and attempts >= 5 and claimed_at < now() - interval '10 minutes';

  if exists (
    select 1 from public.email_outbox
     where attempts < 5
       and ((status = 'pending' and send_after <= now())
            or (status = 'sending' and claimed_at < now() - interval '10 minutes'))
  ) then
    perform public.kick_email_sender();
  end if;
end $$;
revoke all on function public.email_retry_tick() from public, anon, authenticated;

-- Wake the sender only for rows it may send now (a delayed decline waits for the retry tick).
create or replace function public.on_email_enqueued() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from new_rows where send_after <= now()) then
    perform public.kick_email_sender();
  end if;
  return null;
end $$;
revoke all on function public.on_email_enqueued() from public, anon, authenticated;

-- ---------------------------------------------------------------- 2. what each event was
alter table public.application_events
  add column if not exists change text check (change is null or change in ('hora', 'lugar', 'indicaciones', 'mensaje', 'reabierta')),
  add column if not exists message text check (message is null or char_length(message) <= 500);

-- ---------------------------------------------------------------- 3. undo window
-- The email check matches this decline's row ('status:<id>:cerrada:<epoch>', enqueued in the same
-- transaction, so created_at = closed_at) and also the pre-v3 key 'status:<id>:cerrada' (sent at once):
-- a decline made just before this migration whose email already went out is never "undone" silently.
create or replace function public.decline_undoable(p_app uuid, p_closed_by text, p_closed_at timestamptz) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(p_closed_by = 'empresa', false)
     and p_closed_at is not null
     and p_closed_at > now() - interval '10 minutes'
     and not exists (
       select 1 from public.email_outbox o
        where o.kind = 'application_status'
          and starts_with(o.dedupe_key, 'status:' || p_app || ':cerrada')
          and o.created_at >= p_closed_at
          and o.status in ('sending', 'sent')
     );
$$;
revoke all on function public.decline_undoable(uuid, text, timestamptz) from public, anon, authenticated;

-- ---------------------------------------------------------------- 4. guard v3
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

-- ---------------------------------------------------------------- 5. events v3
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

  insert into public.application_events (application_id, status, actor, interview_at, change, message)
  values (new.id, new.status,
          case when new.status = 'cerrada' and new.closed_by = 'candidato' then 'candidato' else 'empresa' end,
          new.interview_at,
          v_change,
          case when new.status = 'cerrada' and new.closed_by = 'candidato' then null else new.company_message end);
  return null;
end $$;
revoke all on function public.log_application_event() from public, anon, authenticated;

-- ---------------------------------------------------------------- 6. candidate emails v3
create or replace function public.enqueue_application_status() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_email text;
  v_payload jsonb;
  v_changed boolean := new.status is distinct from old.status;
  v_decline boolean := new.status is distinct from old.status and new.status = 'cerrada' and new.closed_by = 'empresa';
  v_change text;
  v_event bigint;
  v_key text;
  v_skipped integer := 0;
  v_decline_prefix text := 'status:' || new.id || ':cerrada:';
begin
  if old.status = 'cerrada' and new.status <> 'cerrada' then
    -- Checked before the skip below (it looks for a decline email that already started sending).
    v_change := case when public.decline_undoable(old.id, old.closed_by, old.closed_at) then 'deshacer' else 'reabierta' end;
    -- Undone or reopened: a decline email that hasn't gone out never will.
    update public.email_outbox
       set status = 'skipped', last_error = 'reabierta antes de enviar'
     where status = 'pending' and kind = 'application_status' and starts_with(dedupe_key, v_decline_prefix);
    get diagnostics v_skipped = row_count;
    if v_change = 'deshacer' then return null; end if;
    -- Reopened after the undo window but before the retry tick sent the decline: the inbox never
    -- got "no quedaste", so it doesn't get "olvida el aviso anterior" either (the app shows both).
    if v_skipped > 0 then return null; end if;
  elsif not v_changed and new.status = 'cerrada' then
    -- Still declined, message edited: the email waiting to go out says the new one.
    if new.closed_by = 'empresa' and new.company_message is distinct from old.company_message then
      update public.email_outbox
         set payload = jsonb_set(payload, '{company_message}', coalesce(to_jsonb(new.company_message), 'null'::jsonb))
       where status = 'pending' and kind = 'application_status' and starts_with(dedupe_key, v_decline_prefix);
    end if;
    return null;
  elsif v_changed then
    -- Candidate withdrawals (cerrada by candidato) and anything else send nothing.
    if not (v_decline or new.status in ('vista', 'entrevista', 'contratada')) then return null; end if;
  elsif new.status = 'entrevista' and new.interview_at is not null and new.interview_at is distinct from old.interview_at then
    v_change := 'hora';
  elsif new.status = 'entrevista' and new.interview_place is distinct from old.interview_place then
    v_change := 'lugar';
  elsif new.status = 'entrevista'
        and (new.interview_note is distinct from old.interview_note or new.company_message is distinct from old.company_message) then
    v_change := 'indicaciones';
  elsif new.status = 'contratada' and new.company_message is not null and new.company_message is distinct from old.company_message then
    v_change := 'mensaje';
  else
    return null;
  end if;

  if not exists (select 1 from public.profiles where id = new.candidate_id and email_updates) then return null; end if;
  v_email := public.user_email(new.candidate_id);
  if v_email is null then return null; end if;

  select jsonb_build_object(
           'application_id', new.id,
           'status', new.status,
           'change', v_change,
           'rescheduled', v_change = 'hora',
           'job_id', j.id,
           'job_title', j.title,
           'company_name', c.name,
           'branch_name', b.name,
           'colonia', b.colonia,
           'phone', coalesce(nullif(j.phone, ''), nullif(c.phone, '')),
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

  if v_decline then
    v_key := v_decline_prefix || extract(epoch from coalesce(new.closed_at, now()))::bigint;
    insert into public.email_outbox (kind, user_id, to_email, payload, dedupe_key, send_after)
    values ('application_status', new.candidate_id, v_email, v_payload, v_key, now() + interval '10 minutes')
    on conflict (dedupe_key) do nothing;
    return null;
  end if;

  -- Every step and every change gets its own email, keyed by the event the log trigger just wrote
  -- (applications_log_events fires before this trigger): moving an interview A → B → A emails all
  -- three times, and reaching a step again after a reopen emails again. The old per-step keys
  -- ('status:<id>:<status>[:<epoch>]') dropped those as duplicates.
  select max(e.id) into v_event from public.application_events e where e.application_id = new.id;
  if v_change is null then
    v_key := 'status:' || new.id || ':' || new.status || ':ev'
             || coalesce(v_event::text, (extract(epoch from clock_timestamp()) * 1000)::bigint::text);
  else
    v_key := 'change:' || new.id || ':' || v_change || ':'
             || coalesce(v_event::text, (extract(epoch from clock_timestamp()) * 1000)::bigint::text);
  end if;

  insert into public.email_outbox (kind, user_id, to_email, payload, dedupe_key)
  values ('application_status', new.candidate_id, v_email, v_payload, v_key)
  on conflict (dedupe_key) do nothing;
  return null;
end $$;
revoke all on function public.enqueue_application_status() from public, anon, authenticated;

drop trigger if exists applications_notify_candidate on public.applications;
create trigger applications_notify_candidate
  after update of status, interview_at, interview_place, interview_note, company_message on public.applications
  for each row execute function public.enqueue_application_status();

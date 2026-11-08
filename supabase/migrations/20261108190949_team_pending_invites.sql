-- Chambarrio · Tu equipo: how many invitations are pending, for everyone in the team.
--
-- team_invites() lists the invitations (emails included) only to the dueño, so admins and reclutadores
-- saw the plan's places counter without them: "2 de 5 personas" while a pending invitation already
-- held the third place. This returns only the count (no emails, no names), with the same rule
-- invite_member() uses against the plan limit: open (not accepted, not cancelled) and not expired.
-- 0 for anyone outside the team.

create or replace function public.team_pending_invites(p_company_id text) returns integer
language sql stable security definer set search_path = '' as $$
  select count(*)::integer
  from public.company_invites i
  where i.company_id = p_company_id
    and i.accepted_at is null and i.revoked_at is null and i.expires_at > now()
    and public.is_company_member(p_company_id);
$$;

revoke all on function public.team_pending_invites(text) from public, anon;
grant execute on function public.team_pending_invites(text) to authenticated;

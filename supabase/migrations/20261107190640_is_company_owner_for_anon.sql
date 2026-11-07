-- RLS on public.jobs calls is_company_owner() for every reader, including anonymous visitors
-- browsing vacancies; it simply returns false for them. (Superseded by the hardening migration.)
grant execute on function public.is_company_owner(text) to anon;

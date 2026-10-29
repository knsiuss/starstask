-- Least-privilege fix for function grants.
--
-- Supabase's default privileges grant EXECUTE on every new function in the
-- public schema to anon, authenticated, and service_role. Revoking from PUBLIC
-- alone therefore leaves anon able to reach these SECURITY DEFINER functions
-- over /rest/v1/rpc; they still refuse anonymous callers internally, but the
-- grant should not exist in the first place.
REVOKE ALL ON function public.create_or_get_course (text, text, text)
FROM
  anon;


REVOKE ALL ON function public.register_push_subscription (text, text, text, text)
FROM
  anon;

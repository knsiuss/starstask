-- Close the PUBLIC execute grant left by 20261103180000.
--
-- That migration revoked execute from `anon` and `authenticated` but never revoked
-- the default grant to PUBLIC, so `=X/postgres` stayed in the function ACL and an
-- unauthenticated request reached the function body. It failed closed on the
-- `auth.uid()` guard, but the intended surface is authenticated-only. An explicit
-- revoke here makes the database match that intent; the named grant to
-- `authenticated` below keeps the app's own call path working.
REVOKE ALL ON FUNCTION public.set_leave_request_subjects (uuid, UUID[])
FROM
  public,
  anon;


GRANT
EXECUTE ON FUNCTION public.set_leave_request_subjects (uuid, UUID[]) TO authenticated;

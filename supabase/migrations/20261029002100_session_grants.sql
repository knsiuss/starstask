-- EXECUTE grants for the discussion session functions.
--
-- The function migration revoked the default PUBLIC grant so anonymous callers
-- cannot reach the write paths over /rest/v1/rpc. Revoking from PUBLIC is not
-- enough on its own to describe intent: Supabase also installs default
-- privileges that grant EXECUTE directly to anon/authenticated/service_role, so
-- this migration states every grant the application actually relies on. Grants
-- are idempotent, which keeps a fresh database and an already-migrated one in
-- the same state.
--
-- `can_view_session` is evaluated inside the discussion_sessions RLS policy, so
-- the querying role needs EXECUTE on it. Anonymous visitors are included because
-- a session with `visibility = 'public'` is readable without an account.
GRANT
EXECUTE ON function public.can_view_session (uuid) TO anon;


GRANT
EXECUTE ON function public.can_view_session (uuid) TO authenticated;


-- The public listing. Anonymous callers only ever match the public branch of
-- `can_view_session`, and the function nulls the agenda and join link for them.
GRANT
EXECUTE ON function public.list_discussion_sessions (
  uuid,
  text,
  text,
  timestamptz,
  timestamptz,
  integer,
  integer
) TO anon;


GRANT
EXECUTE ON function public.list_discussion_sessions (
  uuid,
  text,
  text,
  timestamptz,
  timestamptz,
  integer,
  integer
) TO authenticated;


-- `session_class_id` backs the RSVP read policy, which is authenticated-only.
GRANT
EXECUTE ON function public.session_class_id (uuid) TO authenticated;


GRANT
EXECUTE ON function public.session_attendance (uuid) TO authenticated;


GRANT
EXECUTE ON function public.can_organize_class_sessions (uuid) TO authenticated;


-- Write paths. Each function re-checks `can_organize_class_sessions` (or the
-- caller's own RSVP row) internally, so the grant only decides who may ask.
GRANT
EXECUTE ON function public.create_discussion_session (
  uuid,
  text,
  text,
  timestamptz,
  timestamptz,
  text,
  text,
  text,
  text,
  text,
  integer,
  timestamptz,
  text,
  uuid
) TO authenticated;


GRANT
EXECUTE ON function public.update_discussion_session (
  uuid,
  text,
  text,
  timestamptz,
  timestamptz,
  text,
  text,
  text,
  text,
  text,
  integer,
  timestamptz,
  text,
  uuid
) TO authenticated;


GRANT
EXECUTE ON function public.set_discussion_session_status (uuid, text) TO authenticated;


GRANT
EXECUTE ON function public.rsvp_discussion_session (uuid, text) TO authenticated;


GRANT
EXECUTE ON function public.cancel_session_rsvp (uuid) TO authenticated;

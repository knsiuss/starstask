-- Realtime: publish dashboard source tables for auto-refresh.
-- =====================================================================
-- The dashboard (get_dashboard_overview RPC + week/schedule sections)
-- reads from assignments, discussion_sessions and class_memberships.
-- Publishing them lets the browser subscribe via postgres_changes and
-- refresh on INSERT/UPDATE/DELETE without manual reload.
--
-- RLS still applies to realtime payloads: clients only receive rows
-- their policies allow (REPLICA IDENTITY FULL is not required for
-- INSERT/UPDATE payloads used here; the client only refetches).
--
-- Rollback: ALTER PUBLICATION supabase_realtime DROP TABLE
-- assignments, discussion_sessions, class_memberships;

ALTER PUBLICATION supabase_realtime ADD TABLE
  public.assignments,
  public.discussion_sessions,
  public.class_memberships;

-- Phase 5K benchmark: old N RPC vs new batched RPC.
-- Run only on a disposable database seeded with the synthetic fixture.
-- The fixture must already exist (supabase/tests/phase5k-session-checkin-summary-many-validation.sql
-- seeds it); this script only EXPLAINs. It deletes nothing and inserts nothing.
SET request.jwt.claim.sub = '00000000-0000-4000-8000-000000000001';

-- Fixture: synthetic class + 120 meetings already present in the disposable DB.
-- This script is documentation of the benchmark actually run; for a clean
-- reproduction, recreate the fixture from the implementation report steps.

EXPLAIN (ANALYZE, BUFFERS)
SELECT public.session_checkin_summary(id)
FROM (
  SELECT id
  FROM public.discussion_sessions
  WHERE class_id = '00000000-0000-4000-8000-000000000003'
    AND meeting_number IS NULL
) AS ordered_ids;

EXPLAIN (ANALYZE, BUFFERS)
SELECT *
FROM public.session_checkin_summary_many((
  SELECT array_agg(id ORDER BY id)
  FROM public.discussion_sessions
  WHERE class_id = '00000000-0000-4000-8000-000000000003'
    AND meeting_number IS NULL
));

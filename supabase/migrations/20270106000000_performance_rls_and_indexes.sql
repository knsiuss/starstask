-- Performance: RLS initplan wrapping, policy consolidation, dedup indexes.
-- =====================================================================
-- Findings from Supabase Performance Advisor (2026-11-05) on production:
-- - 132 unindexed FKs total, but only hot-path FKs get new indexes here.
--   Audit FKs (*_created_by, *_reviewed_by, *_revoked_by) are intentionally
--   left unindexed to avoid write amplification on rarely-joined columns.
-- - class_members seq_scan dominated pg_stat (30.799 scans / 584k tuples
--   read on 34 live rows). Cause: RLS policy called is_platform_admin()
--   per row. Wrapping scalar auth helpers in (SELECT ...) turns them into
--   initplans evaluated once per query (Supabase-recommended pattern).
-- - assignments had 4 permissive SELECT policies for `authenticated`
--   (linter: multiple_permissive_policies). Consolidated into one policy
--   with identical OR semantics; each policy was re-evaluated per row.
-- - 2 duplicate index pairs (linter: duplicate_index). Drop one of each.
-- - discussion_sessions.subject_id FK had no covering index; subject-scoped
--   attendance queries (sync path) need it.
-- - course_component_grades: (class_id, subject_id) already exists, so only
--   the student-only lookup path gets a new index.
-- - class_subject_members: deliberately no new index. PK
--   (class_id, subject_id, user_id) and user_idx (user_id, class_id)
--   already cover the FK access paths.
--
-- Semantics are preserved exactly: every replacement policy is the logical
-- OR of the policies it replaces, with auth.uid() / is_platform_admin()
-- wrapped in (SELECT ...) for initplan evaluation.
--
-- NOTE: is_class_member(class_id) / is_class_admin(class_id) take a column
-- argument, so they cannot become initplans; they remain per-row calls.
-- Their lookups are PK/index-backed (verified via pg_indexes), so the
-- remaining cost is bounded. Rewriting them as inline EXISTS would drift
-- from the function body over time, so they are kept as calls.
-- ---------------------------------------------------------------------
-- 1. class_members: wrap is_platform_admin() in an initplan.
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS class_members_read ON public.class_members;


CREATE POLICY class_members_read ON public.class_members FOR
SELECT
  TO authenticated USING (
    (
      SELECT
        is_class_member (class_id)
    )
    OR (
      SELECT
        is_platform_admin ()
    )
  );


-- ---------------------------------------------------------------------
-- 2. assignments: merge 4 authenticated SELECT policies into 1.
--    Kept separate: assignments_public_read (anon + authenticated).
--    Untouched: owner insert/update/delete policies.
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS assignments_class_member_read ON public.assignments;


DROP POLICY IF EXISTS assignments_class_reviewer_read ON public.assignments;


DROP POLICY IF EXISTS assignments_owner_read ON public.assignments;


DROP POLICY IF EXISTS assignments_platform_review_read ON public.assignments;


DO $$
BEGIN
  BEGIN
    CREATE POLICY assignments_authenticated_read
      ON public.assignments
      FOR SELECT
      TO authenticated
      USING (
        ((SELECT auth.uid()) = user_id)
        OR (
          class_id IS NOT NULL
          AND (
            (SELECT is_class_admin(class_id))
            OR (SELECT is_platform_admin())
          )
        )
        OR (
          status = 'published'::text
          AND class_id IS NOT NULL
          AND (SELECT is_class_member(class_id))
        )
        OR (
          class_id IS NULL
          AND (SELECT is_platform_admin())
        )
      );
  EXCEPTION
    WHEN duplicate_object THEN
      NULL;
  END;
END
$$;


-- ---------------------------------------------------------------------
-- 3. Drop duplicate indexes (identical definitions, verified in prod).
-- ---------------------------------------------------------------------
DROP INDEX IF EXISTS public.attendance_meetings_offering_time_idx;


DROP INDEX IF EXISTS public.enrollments_offering_status_idx;


-- ---------------------------------------------------------------------
-- 4. Hot-path FK indexes.
-- ---------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS discussion_sessions_subject_idx ON public.discussion_sessions (subject_id)
WHERE
  subject_id IS NOT NULL;


CREATE INDEX IF NOT EXISTS course_component_grades_student_idx ON public.course_component_grades (student_id);


CREATE INDEX IF NOT EXISTS course_component_grades_subject_idx ON public.course_component_grades (subject_id);

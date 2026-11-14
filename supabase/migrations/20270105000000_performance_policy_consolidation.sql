-- Performance: consolidate final 2 multiple-permissive policy pairs.
-- =====================================================================
-- Advisor finding: multiple_permissive_policies (WARN, 2 remaining).
-- Both consolidations preserve the exact OR semantics of the original
-- policies; they also fix unwrapped per-row helper calls to initplans.
--
-- assignment_attachments:
--   read:     EXISTS(assignment published OR owned by caller)
--   reviewer: EXISTS(is_platform_admin() OR is_class_admin(class))
--   merged:   EXISTS(published OR owned OR platform_admin OR class_admin)
-- feedback_entries:
--   admin_read: is_platform_admin()
--   owner_read: user_id = auth.uid()
--   merged:     (SELECT is_platform_admin()) OR user_id = (SELECT auth.uid())
--
-- Rollback: recreate the two original policies per table (see git history
-- of this file's predecessor policies in earlier migrations).
DROP POLICY IF EXISTS assignment_attachments_read ON public.assignment_attachments;


DROP POLICY IF EXISTS assignment_attachments_reviewer_read ON public.assignment_attachments;


CREATE POLICY assignment_attachments_read ON public.assignment_attachments FOR
SELECT
  TO authenticated USING (
    EXISTS (
      SELECT
        1
      FROM
        public.assignments a
      WHERE
        a.id = assignment_attachments.assignment_id
        AND (
          a.status = 'published'::text
          OR a.user_id = (
            SELECT
              auth.uid ()
          )
          OR (
            SELECT
              is_platform_admin ()
          )
          OR (
            a.class_id IS NOT NULL
            AND (
              SELECT
                is_class_admin (a.class_id)
            )
          )
        )
    )
  );


DROP POLICY IF EXISTS feedback_entries_admin_read ON public.feedback_entries;


DROP POLICY IF EXISTS feedback_entries_owner_read ON public.feedback_entries;


CREATE POLICY feedback_entries_read ON public.feedback_entries FOR
SELECT
  TO authenticated USING (
    (
      SELECT
        is_platform_admin ()
    )
    OR (
      user_id = (
        SELECT
          auth.uid ()
      )
    )
  );

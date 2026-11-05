-- Performance follow-up: clear remaining linter findings in hot tables.
-- =====================================================================
-- - assignments still had 2 permissive SELECT policies for `authenticated`
--   (assignments_authenticated_read + assignments_public_read, because the
--   public policy also listed `authenticated`). The public branch
--   (status = 'published' AND class_id IS NULL) is folded into
--   assignments_authenticated_read as an extra OR branch, and
--   assignments_public_read is narrowed to `anon` only. Semantics for
--   authenticated users are unchanged (same OR of all branches).
-- - native_push_tokens (20261134000000) and class_invitation_declines
--   policies used bare auth.uid(), re-evaluated per row. Wrapped in
--   (SELECT auth.uid()) to become initplans.
-- - assignment_attachments and feedback_entries multiple-permissive
--   findings are intentionally left as-is: cold admin/reviewer paths,
--   merging them would churn working policies for negligible gain.

DROP POLICY IF EXISTS assignments_public_read
  ON public.assignments;

DROP POLICY IF EXISTS assignments_authenticated_read
  ON public.assignments;

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
    OR (
      status = 'published'::text
      AND class_id IS NULL
    )
  );

CREATE POLICY assignments_public_read
  ON public.assignments
  FOR SELECT
  TO anon
  USING (
    status = 'published'::text
    AND class_id IS NULL
  );

DROP POLICY IF EXISTS native_push_tokens_owner_read
  ON public.native_push_tokens;

CREATE POLICY native_push_tokens_owner_read
  ON public.native_push_tokens
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS native_push_tokens_owner_insert
  ON public.native_push_tokens;

CREATE POLICY native_push_tokens_owner_insert
  ON public.native_push_tokens
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS native_push_tokens_owner_update
  ON public.native_push_tokens;

CREATE POLICY native_push_tokens_owner_update
  ON public.native_push_tokens
  FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS native_push_tokens_owner_delete
  ON public.native_push_tokens;

CREATE POLICY native_push_tokens_owner_delete
  ON public.native_push_tokens
  FOR DELETE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS class_invitation_declines_user_read
  ON public.class_invitation_declines;

CREATE POLICY class_invitation_declines_user_read
  ON public.class_invitation_declines
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS class_invitation_declines_user_insert
  ON public.class_invitation_declines;

CREATE POLICY class_invitation_declines_user_insert
  ON public.class_invitation_declines
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

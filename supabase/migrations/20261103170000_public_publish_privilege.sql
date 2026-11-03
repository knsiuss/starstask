-- A class admin already publishes straight to their own class, so the public
-- board should not queue their briefs either. The submit flow and the insert
-- policy ask the same question, so they cannot drift apart. The predicate is
-- SECURITY DEFINER because `platform_admins` has no client grant at all.
CREATE OR REPLACE FUNCTION public.can_publish_public_assignment () returns boolean language sql stable security definer
SET
  search_path = '' AS $$
select
  exists (
    select
      1
    from
      public.platform_admins pa
    where
      pa.user_id = (
        select
          auth.uid ()
      )
  )
  or exists (
    select
      1
    from
      public.class_admins ca
    where
      ca.user_id = (
        select
          auth.uid ()
      )
  );
$$;


REVOKE ALL ON FUNCTION public.can_publish_public_assignment ()
FROM
  public;


GRANT
EXECUTE ON FUNCTION public.can_publish_public_assignment () TO authenticated;


-- Same shape as 20261103160000_assignment_status_write_grant.sql; only the
-- status clause changes. A member without a class to manage still submits a
-- request a platform admin has to approve, and no one may insert a status other
-- than `pending` or `published`, so a reviewer decision cannot be fabricated at
-- creation time.
DROP POLICY IF EXISTS assignments_owner_insert ON public.assignments;


CREATE POLICY assignments_owner_insert ON public.assignments FOR insert TO authenticated
WITH
  CHECK (
    (
      SELECT
        auth.uid ()
    ) = user_id
    AND (
      class_id IS NULL
      OR public.is_class_member (class_id)
      OR public.is_class_admin (class_id)
      OR public.is_platform_admin ()
    )
    AND (
      status = 'pending'
      OR (
        status = 'published'
        AND public.can_publish_public_assignment ()
      )
    )
  );

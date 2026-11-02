-- Published assignments inside a class group are readable only by that group.
--
-- Until now `assignments_public_read` matched every row with status =
-- 'published' for anon and authenticated, so anyone holding a class link — or
-- simply calling PostgREST — could read the work of a class they never joined.
--
-- Class-less published assignments keep the old behaviour: they are the public
-- repository entries that belong to no class group, and no membership could
-- ever grant access to them.
--
-- Consequence, accepted deliberately: the public class page
-- (`/classes/[slug]`) reads through `list_assignments`, which is SECURITY
-- INVOKER, so visitors who are not members now see an empty assignment list.

DROP POLICY IF EXISTS assignments_public_read ON public.assignments;


CREATE POLICY assignments_public_read ON public.assignments FOR
SELECT
  TO anon,
  authenticated USING (status = 'published' AND class_id IS NULL);


DROP POLICY IF EXISTS assignments_class_member_read ON public.assignments;


CREATE POLICY assignments_class_member_read ON public.assignments FOR
SELECT
  TO authenticated USING (
    status = 'published'
    AND class_id IS NOT NULL
    AND (
      public.is_class_member (class_id)
      OR public.is_class_admin (class_id)
      OR public.is_platform_admin ()
    )
  );

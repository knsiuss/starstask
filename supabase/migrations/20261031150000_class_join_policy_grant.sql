-- ---------------------------------------------------------------------------
-- classes.join_policy: read access for signed-in users
-- ---------------------------------------------------------------------------
-- The class management page shows the current join policy. Only signed-in
-- users may read the column, so the public class page keeps its column list
-- unchanged and anonymous visitors cannot select it.
GRANT
SELECT
  (join_policy) ON public.classes TO authenticated;

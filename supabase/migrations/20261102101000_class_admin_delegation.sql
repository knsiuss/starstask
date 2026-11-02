-- Class Admin delegation.
--
-- Previously only a platform admin could grant or revoke the class admin role,
-- so a class admin could not appoint a peer and every promotion went through an
-- operator. Class admins may now manage the admin list of the class they
-- already administer.
--
-- The guard is the only change. `is_class_admin(p_class_id)` is evaluated for
-- the class being changed, so an admin of class A still cannot touch class B,
-- and a member cannot promote themselves. The last-admin rule and the audit
-- trail are unchanged.

CREATE OR REPLACE FUNCTION public.assign_class_admin (p_class_id uuid, p_user_id uuid) returns boolean language plpgsql security definer
SET
  search_path = public,
  pg_temp AS $$
DECLARE
  v_actor uuid := (
    SELECT
      auth.uid ()
  );
BEGIN IF NOT (
  public.is_platform_admin ()
  OR public.is_class_admin (p_class_id)
) THEN
  RAISE EXCEPTION 'class admin required'
  USING
    ERRCODE = '42501';
END IF;
IF NOT EXISTS (
  SELECT
    1
  FROM
    public.classes c
  WHERE
    c.id = p_class_id
) THEN
  RAISE EXCEPTION 'class not found'
  USING
    ERRCODE = 'P0002';
END IF;
INSERT INTO
  public.class_members (class_id, user_id, joined_via)
VALUES
  (p_class_id, p_user_id, 'admin_assignment') ON CONFLICT (class_id, user_id) DO NOTHING;
INSERT INTO
  public.class_admins (class_id, user_id, assigned_by)
VALUES
  (p_class_id, p_user_id, v_actor) ON CONFLICT (class_id, user_id) DO NOTHING;
PERFORM public.record_audit(
  'class_admin_assigned',
  'class_admin',
  p_user_id,
  p_class_id,
  '{}'::jsonb
);
PERFORM public.enqueue_notification_event(
  p_user_id,
  'class_admin_assigned',
  'class_admin:' || p_class_id || ':' || p_user_id || ':assigned',
  jsonb_build_object(
    'title',
    'You are now a class admin',
    'body',
    'You can review submissions for your class on StarsTask.',
    'url',
    '/dashboard'
  )
);
RETURN TRUE;
END;

$$;


CREATE OR REPLACE FUNCTION public.revoke_class_admin (p_class_id uuid, p_user_id uuid) returns boolean language plpgsql security definer
SET
  search_path = public,
  pg_temp AS $$
BEGIN IF NOT (
  public.is_platform_admin ()
  OR public.is_class_admin (p_class_id)
) THEN
  RAISE EXCEPTION 'class admin required'
  USING
    ERRCODE = '42501';
END IF;
IF (
  SELECT
    count(*)
  FROM
    public.class_admins ca
  WHERE
    ca.class_id = p_class_id
) <= 1
AND EXISTS (
  SELECT
    1
  FROM
    public.class_admins ca
  WHERE
    ca.class_id = p_class_id
    AND ca.user_id = p_user_id
) THEN
  RAISE EXCEPTION 'class must keep at least one admin'
  USING
    ERRCODE = '22023';
END IF;
DELETE FROM
  public.class_admins
WHERE
  class_id = p_class_id
  AND user_id = p_user_id;
IF NOT found THEN
  RAISE EXCEPTION 'class admin not found'
  USING
    ERRCODE = 'P0002';
END IF;
PERFORM public.record_audit(
  'class_admin_revoked',
  'class_admin',
  p_user_id,
  p_class_id,
  '{}'::jsonb
);
RETURN TRUE;
END;

$$;


REVOKE ALL ON function public.assign_class_admin (uuid, uuid)
FROM
  public;


GRANT
EXECUTE ON function public.assign_class_admin (uuid, uuid) TO authenticated;


REVOKE ALL ON function public.revoke_class_admin (uuid, uuid)
FROM
  public;


GRANT
EXECUTE ON function public.revoke_class_admin (uuid, uuid) TO authenticated;

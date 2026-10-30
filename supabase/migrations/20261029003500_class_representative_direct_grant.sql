-- Direct class representative grant (owner decision, 2026-10-29).
--
-- The verification review flow is temporarily disabled: a class member can
-- claim class representative access (a class_admins row) directly, without
-- evidence or a platform admin decision. A class can hold at most 5 class
-- admins, enforced by a trigger on every insert path so no future code path
-- can bypass the cap.

CREATE OR REPLACE FUNCTION public.enforce_class_admin_cap ()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET
  search_path = public,
  pg_temp AS $$
BEGIN
  -- Serialize concurrent grants on the class row so the count below cannot
  -- race with another insert in the same instant.
  PERFORM 1
  FROM
    public.classes
  WHERE
    id = NEW.class_id
  FOR UPDATE;

  IF (
    SELECT
      count(*)
    FROM
      public.class_admins
    WHERE
      class_id = NEW.class_id
  ) >= 5 THEN
    RAISE EXCEPTION 'class representative limit reached' USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;


DROP TRIGGER IF EXISTS class_admins_cap_trigger ON public.class_admins;


CREATE TRIGGER class_admins_cap_trigger
BEFORE INSERT ON public.class_admins FOR EACH ROW
EXECUTE FUNCTION public.enforce_class_admin_cap ();


CREATE OR REPLACE FUNCTION public.become_class_representative (p_class_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET
  search_path = public,
  pg_temp AS $$
DECLARE
  v_user uuid := (SELECT auth.uid ());
  v_class_status text;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING errcode = '42501';
  END IF;

  -- Lock the class row so the representative count cannot race with a
  -- concurrent grant or an admin approval landing at the same time.
  SELECT
    status
  INTO
    v_class_status
  FROM
    public.classes
  WHERE
    id = p_class_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN 'class_not_found';
  END IF;

  IF v_class_status IS DISTINCT FROM 'active' THEN
    RETURN 'class_inactive';
  END IF;

  IF NOT EXISTS (
    SELECT
      1
    FROM
      public.class_members
    WHERE
      class_id = p_class_id
      AND user_id = v_user
  ) THEN
    RETURN 'not_member';
  END IF;

  IF EXISTS (
    SELECT
      1
    FROM
      public.class_admins
    WHERE
      class_id = p_class_id
      AND user_id = v_user
  ) THEN
    RETURN 'already_representative';
  END IF;

  IF (
    SELECT
      count(*)
    FROM
      public.class_admins
    WHERE
      class_id = p_class_id
  ) >= 5 THEN
    RETURN 'limit_reached';
  END IF;

  INSERT INTO public.class_admins (class_id, user_id, assigned_by)
  VALUES (p_class_id, v_user, v_user);

  PERFORM
    public.record_audit (
      'class_representative_direct_grant',
      'class_admin',
      NULL,
      p_class_id,
      jsonb_build_object ('granted_via', 'direct')
    );

  RETURN 'granted';
END;
$$;


GRANT EXECUTE ON FUNCTION public.become_class_representative (uuid) TO authenticated;

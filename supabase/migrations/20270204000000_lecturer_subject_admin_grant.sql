-- Assigning a lecturer to a course makes them an admin of that class, while
-- can_manage_subject() still limits what they may actually manage.
-- class_admins requires an existing class_members row, so create it first.
CREATE OR REPLACE FUNCTION public.grant_class_admin_to_subject_lecturer () RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET
  search_path = public,
  pg_temp AS $$
BEGIN
  IF NEW.lecturer_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT'
     OR NEW.lecturer_user_id IS DISTINCT FROM OLD.lecturer_user_id THEN
    INSERT INTO public.class_members (class_id, user_id, joined_via)
    VALUES (NEW.class_id, NEW.lecturer_user_id, 'lecturer_assignment')
    ON CONFLICT (class_id, user_id) DO NOTHING;

    INSERT INTO public.class_admins (class_id, user_id, assigned_by)
    VALUES (
      NEW.class_id,
      NEW.lecturer_user_id,
      coalesce(auth.uid(), NEW.lecturer_user_id)
    )
    ON CONFLICT (class_id, user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;


REVOKE ALL ON FUNCTION public.grant_class_admin_to_subject_lecturer ()
FROM
  PUBLIC;


DROP TRIGGER IF EXISTS class_subjects_lecturer_admin_grant ON public.class_subjects;


CREATE TRIGGER class_subjects_lecturer_admin_grant
AFTER INSERT OR UPDATE OF lecturer_user_id ON public.class_subjects FOR EACH ROW
EXECUTE FUNCTION public.grant_class_admin_to_subject_lecturer ();

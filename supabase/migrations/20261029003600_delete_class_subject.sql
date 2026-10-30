-- Class subject deletion for class admins.
--
-- Complements create/update_class_subject: a class admin can remove a subject
-- from their class group. Assignments keep existing (subject_id is set null by
-- the foreign key) and the subject's weekly schedule rows cascade away.

CREATE OR REPLACE FUNCTION public.delete_class_subject (p_subject_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER
SET
  search_path = public,
  pg_temp AS $$
DECLARE
  v_user uuid := (SELECT auth.uid ());
  v_subject public.class_subjects;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING errcode = '42501';
  END IF;

  SELECT * INTO v_subject FROM public.class_subjects WHERE id = p_subject_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'subject not found' USING errcode = 'P0002';
  END IF;

  IF NOT public.can_manage_class(v_subject.class_id) THEN
    RAISE EXCEPTION 'class admin permissions required' USING errcode = '42501';
  END IF;

  DELETE FROM public.class_subjects WHERE id = p_subject_id;

  PERFORM public.record_audit(
    'class_subject_deleted',
    'class_subject',
    p_subject_id,
    v_subject.class_id,
    jsonb_build_object('name', v_subject.name)
  );

  RETURN TRUE;
END;
$$;


GRANT EXECUTE ON FUNCTION public.delete_class_subject (uuid) TO authenticated;

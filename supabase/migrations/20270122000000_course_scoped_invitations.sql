-- Course-scoped class invitations.
-- Adds `subject_id` to `public.class_invitations` and updates `create_class_invitation`.
-- Course-scoped preview/accept RPCs (`get_invitation_preview`, `accept_class_invitation`)
-- run in `20270201000000_web_audit_security_and_logic_fixes.sql` after `20270124` adds
-- `class_members.course_scope` and `public.class_member_courses`.
ALTER TABLE public.class_invitations
ADD COLUMN IF NOT EXISTS subject_id uuid REFERENCES public.class_subjects (id) ON DELETE CASCADE;


CREATE INDEX IF NOT EXISTS class_invitations_subject_idx ON public.class_invitations (class_id, subject_id, created_at DESC)
WHERE
  subject_id IS NOT NULL;


DROP FUNCTION IF EXISTS public.create_class_invitation (uuid, text, timestamptz, integer, text);


CREATE OR REPLACE FUNCTION public.create_class_invitation (
  p_class_id uuid,
  p_token_hash text,
  p_expires_at timestamptz,
  p_max_uses integer DEFAULT 1,
  p_email_restriction text DEFAULT NULL,
  p_subject_id uuid DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER
SET
  search_path = public,
  pg_temp AS $$
DECLARE
  v_user uuid := (SELECT auth.uid ());
  v_hash text := lower(btrim(coalesce(p_token_hash, '')));
  v_email text := nullif(lower(btrim(coalesce(p_email_restriction, ''))), '');
  v_id uuid;
  v_invitee uuid;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;

  IF NOT public.can_manage_class (p_class_id) THEN
    RAISE EXCEPTION 'class admin required' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.classes c
    WHERE c.id = p_class_id
      AND c.status = 'active'
  ) THEN
    RAISE EXCEPTION 'class is not active' USING ERRCODE = '22023';
  END IF;

  IF p_subject_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.class_subjects s
    WHERE s.id = p_subject_id
      AND s.class_id = p_class_id
  ) THEN
    RAISE EXCEPTION 'subject not found in class' USING ERRCODE = 'P0002';
  END IF;

  IF v_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'invalid invitation token hash' USING ERRCODE = '22023';
  END IF;

  IF p_expires_at IS NULL
    OR p_expires_at <= now()
    OR p_expires_at > now() + interval '90 days' THEN
    RAISE EXCEPTION 'invalid invitation expiry' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.class_invitations (
    class_id,
    subject_id,
    created_by,
    token_hash,
    email_restriction,
    expires_at,
    max_uses
  )
  VALUES (
    p_class_id,
    p_subject_id,
    v_user,
    v_hash,
    v_email,
    p_expires_at,
    coalesce(p_max_uses, 1)
  )
  RETURNING id INTO v_id;

  PERFORM public.record_audit (
    'class_invitation_created',
    'class_invitation',
    v_id,
    p_class_id,
    jsonb_build_object(
      'max_uses', coalesce(p_max_uses, 1),
      'email_restricted', v_email IS NOT NULL,
      'subject_scoped', p_subject_id IS NOT NULL
    )
  );

  IF v_email IS NOT NULL THEN
    SELECT u.id INTO v_invitee
    FROM auth.users u
    WHERE lower(u.email) = v_email
    LIMIT 1;

    IF v_invitee IS NOT NULL THEN
      PERFORM public.enqueue_notification_event (
        v_invitee,
        'class_invitation',
        'class_invitation:' || v_id,
        jsonb_build_object(
          'title', CASE WHEN p_subject_id IS NOT NULL THEN 'Course invitation' ELSE 'Class invitation' END,
          'body', CASE WHEN p_subject_id IS NOT NULL THEN 'You were invited to join a course on StarsTask.' ELSE 'You were invited to join a class on StarsTask.' END,
          'url', '/app'
        )
      );
    END IF;
  END IF;

  RETURN v_id;
END;
$$;


REVOKE ALL ON FUNCTION public.create_class_invitation (uuid, text, timestamptz, integer, text, uuid)
FROM
  PUBLIC,
  anon;


GRANT
EXECUTE ON FUNCTION public.create_class_invitation (uuid, text, timestamptz, integer, text, uuid) TO authenticated;

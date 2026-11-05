-- Subject enrollment for attendance (temporary, Option 1).
--
-- A class group still inherits membership for browsing, but attendance
-- eligibility is now per subject: a repeat student enrolled only in
-- Kecerdasan Buatan cannot check in to (or be counted in) other subjects of
-- the same class. Full per-subject isolation (assignments, materials, RLS)
-- is Option 2; see docs/engineering/startask-subject-enrollment.md.
--
-- Backfill enrolls every current class member into every active subject of
-- the class, so behavior is unchanged until a manager removes an
-- enrollment row. New members and new subjects are auto-enrolled.
CREATE TABLE IF NOT EXISTS public.class_subject_members (
  class_id uuid NOT NULL REFERENCES public.classes (id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES public.class_subjects (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  enrolled_via text NOT NULL DEFAULT 'backfill',
  enrolled_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (class_id, subject_id, user_id),
  CONSTRAINT class_subject_members_via_allowed CHECK (
    enrolled_via IN (
      'backfill',
      'invitation',
      'admin_assignment',
      'platform_assignment',
      'manual'
    )
  ),
  FOREIGN KEY (class_id, user_id) REFERENCES public.class_members (class_id, user_id) ON DELETE CASCADE
);


COMMENT ON TABLE public.class_subject_members IS 'Per-subject enrollment that scopes attendance. Attendance RPCs require a row here when the meeting has a subject; full course isolation is a later step.';


CREATE INDEX IF NOT EXISTS class_subject_members_user_idx ON public.class_subject_members (user_id, class_id);


CREATE INDEX IF NOT EXISTS class_subject_members_subject_idx ON public.class_subject_members (subject_id);


ALTER TABLE public.class_subject_members ENABLE ROW LEVEL SECURITY;


CREATE POLICY class_subject_members_select ON public.class_subject_members FOR
SELECT
  TO authenticated USING (
    user_id = (
      SELECT
        auth.uid ()
    )
    OR public.can_manage_class (class_id)
  );


CREATE POLICY class_subject_members_insert ON public.class_subject_members FOR INSERT TO authenticated
WITH
  CHECK (public.can_manage_class (class_id));


CREATE POLICY class_subject_members_update ON public.class_subject_members
FOR UPDATE
  TO authenticated USING (public.can_manage_class (class_id))
WITH
  CHECK (public.can_manage_class (class_id));


CREATE POLICY class_subject_members_delete ON public.class_subject_members FOR DELETE TO authenticated USING (public.can_manage_class (class_id));


REVOKE ALL ON TABLE public.class_subject_members
FROM
  public,
  anon,
  authenticated;


GRANT
SELECT
,
  INSERT,
UPDATE,
DELETE ON TABLE public.class_subject_members TO authenticated;


CREATE OR REPLACE FUNCTION public.is_subject_member (p_class_id uuid, p_subject_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET
  search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.class_subject_members em
    WHERE em.class_id = p_class_id
      AND em.subject_id = p_subject_id
      AND em.user_id = (SELECT auth.uid ())
  );
$$;


REVOKE ALL ON FUNCTION public.is_subject_member (uuid, uuid)
FROM
  public,
  anon,
  authenticated;


GRANT
EXECUTE ON FUNCTION public.is_subject_member (uuid, uuid) TO authenticated;


CREATE OR REPLACE FUNCTION public.enroll_members_on_class_join () RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET
  search_path = public,
  pg_temp AS $$
BEGIN
  INSERT INTO public.class_subject_members (class_id, subject_id, user_id, enrolled_via, enrolled_at)
  SELECT NEW.class_id, s.id, NEW.user_id,
    CASE NEW.joined_via
      WHEN 'invitation' THEN 'invitation'
      WHEN 'admin_assignment' THEN 'admin_assignment'
      WHEN 'platform_assignment' THEN 'platform_assignment'
      ELSE 'manual'
    END,
    now()
  FROM public.class_subjects s
  WHERE s.class_id = NEW.class_id
    AND s.status = 'active'
  ON CONFLICT (class_id, subject_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$;


DROP TRIGGER IF EXISTS class_members_enroll_subjects ON public.class_members;


CREATE TRIGGER class_members_enroll_subjects
AFTER INSERT ON public.class_members FOR EACH ROW
EXECUTE FUNCTION public.enroll_members_on_class_join ();


CREATE OR REPLACE FUNCTION public.enroll_members_on_subject_create () RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET
  search_path = public,
  pg_temp AS $$
BEGIN
  IF NEW.status <> 'active' THEN
    RETURN NEW;
  END IF;
  INSERT INTO public.class_subject_members (class_id, subject_id, user_id, enrolled_via, enrolled_at)
  SELECT NEW.class_id, NEW.id, m.user_id, 'backfill', now()
  FROM public.class_members m
  WHERE m.class_id = NEW.class_id
  ON CONFLICT (class_id, subject_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$;


DROP TRIGGER IF EXISTS class_subjects_enroll_members ON public.class_subjects;


CREATE TRIGGER class_subjects_enroll_members
AFTER INSERT ON public.class_subjects FOR EACH ROW
EXECUTE FUNCTION public.enroll_members_on_subject_create ();


INSERT INTO
  public.class_subject_members (class_id, subject_id, user_id, enrolled_via, enrolled_at)
SELECT
  m.class_id,
  s.id,
  m.user_id,
  'backfill',
  now()
FROM
  public.class_members m
  JOIN public.class_subjects s ON s.class_id = m.class_id
WHERE
  s.status = 'active'
ON CONFLICT (class_id, subject_id, user_id) DO NOTHING;


-- Check-in: require subject enrollment after the class membership check.
DO $$
DECLARE
  v_def text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_def
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE p.proname = 'check_in_attendance_meeting'
    AND n.nspname = 'public'
    AND p.pronargs = 6;

  IF v_def IS NULL THEN
    RAISE EXCEPTION 'check_in_attendance_meeting not found';
  END IF;

  v_def := replace(
    v_def,
    E'  if not public.is_class_member (v_session.class_id) then\n    raise exception ''Only class members can check in'' using errcode = ''42501'';\n  end if;',
    E'  if not public.is_class_member (v_session.class_id) then\n    raise exception ''Only class members can check in'' using errcode = ''42501'';\n  end if;\n\n  if v_session.subject_id is not null\n  and not exists (\n    select\n      1\n    from\n      public.class_subject_members em\n    where\n      em.class_id = v_session.class_id\n      and em.subject_id = v_session.subject_id\n      and em.user_id = v_user_id\n  ) then\n    perform public.log_attendance_verification (p_session_id, v_user_id, ''not_available'');\n    return jsonb_build_object(\n      ''ok'', false,\n      ''code'', ''checkin_unavailable'',\n      ''message'', ''You are not enrolled in this course, so this meeting is not part of your attendance.''\n    );\n  end if;'
  );

  EXECUTE v_def;

  SELECT pg_get_functiondef(p.oid) INTO v_def
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE p.proname = 'check_in_attendance_meeting'
    AND n.nspname = 'public'
    AND p.pronargs = 6;

  IF v_def NOT LIKE '%not enrolled in this course%' THEN
    RAISE EXCEPTION 'check_in_attendance_meeting enrollment patch did not apply';
  END IF;
END;
$$;


CREATE OR REPLACE FUNCTION public.attendance_meeting_roster (p_session_id uuid) RETURNS TABLE (
  user_id uuid,
  full_name text,
  nim text,
  display_name text,
  joined_at timestamptz,
  eligible boolean,
  status text,
  method text,
  checked_in_at timestamptz,
  distance_m double precision,
  accuracy_m double precision,
  note text,
  reviewed_at timestamptz,
  identity_verified boolean
) LANGUAGE plpgsql STABLE SECURITY DEFINER
SET
  search_path = public,
  pg_temp AS $$
DECLARE
  v_class_id uuid;
  v_subject_id uuid;
  v_starts_at timestamptz;
  v_finalized boolean;
BEGIN
  SELECT s.class_id, s.subject_id, s.starts_at, s.attendance_finalized_at IS NOT NULL
  INTO v_class_id, v_subject_id, v_starts_at, v_finalized
  FROM public.discussion_sessions s
  WHERE s.id = p_session_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Meeting not found' USING ERRCODE = 'P0002';
  END IF;

  IF NOT public.can_organize_class_sessions (v_class_id) THEN
    RAISE EXCEPTION 'Not allowed to view this attendance roster' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    m.user_id,
    COALESCE(NULLIF(BTRIM(p.full_name), ''), p.display_name, 'Member') AS full_name,
    p.nim,
    p.display_name,
    m.joined_at,
    m.joined_at <= v_starts_at AS eligible,
    CASE
      WHEN m.joined_at > v_starts_at THEN 'not_applicable'
      WHEN c.id IS NOT NULL THEN c.status
      WHEN v_finalized THEN 'absent'
      ELSE 'not_recorded'
    END AS status,
    c.method,
    c.checked_in_at,
    c.distance_m,
    c.accuracy_m,
    c.note,
    c.reviewed_at,
    COALESCE(c.identity_verified, FALSE) AS identity_verified
  FROM public.class_members m
  LEFT JOIN public.profiles p ON p.id = m.user_id
  LEFT JOIN public.class_subject_members em
    ON em.class_id = m.class_id
    AND em.user_id = m.user_id
    AND em.subject_id = v_subject_id
  LEFT JOIN public.discussion_session_checkins c ON c.session_id = p_session_id
    AND c.user_id = m.user_id
  WHERE m.class_id = v_class_id
    AND (v_subject_id IS NULL OR em.user_id IS NOT NULL)
  ORDER BY
    LOWER(COALESCE(NULLIF(BTRIM(p.full_name), ''), p.display_name, 'Member')) ASC,
    p.nim ASC NULLS LAST,
    m.user_id ASC;
END;
$$;


CREATE OR REPLACE FUNCTION public.class_attendance_recap (p_class_id uuid, p_subject_id uuid) RETURNS TABLE (
  session_id uuid,
  meeting_number integer,
  meeting_date date,
  starts_at timestamptz,
  ends_at timestamptz,
  title text,
  location text,
  attendance_opens_at timestamptz,
  attendance_closes_at timestamptz,
  attendance_opened_at timestamptz,
  attendance_closed_at timestamptz,
  attendance_finalized_at timestamptz,
  user_id uuid,
  full_name text,
  nim text,
  joined_at timestamptz,
  eligible boolean,
  status text
) LANGUAGE plpgsql STABLE SECURITY DEFINER
SET
  search_path = public,
  pg_temp AS $$
BEGIN
  IF NOT public.can_manage_class (p_class_id) THEN
    RAISE EXCEPTION 'Not allowed to view the attendance recap' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.class_subjects s
    WHERE s.id = p_subject_id
      AND s.class_id = p_class_id
  ) THEN
    RAISE EXCEPTION 'The subject does not belong to this class' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  SELECT
    s.id,
    s.meeting_number,
    s.meeting_date,
    s.starts_at,
    s.ends_at,
    s.title,
    s.location,
    s.attendance_opens_at,
    s.attendance_closes_at,
    s.attendance_opened_at,
    s.attendance_closed_at,
    s.attendance_finalized_at,
    m.user_id,
    COALESCE(NULLIF(BTRIM(p.full_name), ''), p.display_name, 'Member') AS full_name,
    p.nim,
    m.joined_at,
    m.joined_at <= s.starts_at AS eligible,
    CASE
      WHEN m.joined_at > s.starts_at THEN 'not_applicable'
      WHEN c.id IS NOT NULL THEN c.status
      WHEN s.attendance_finalized_at IS NOT NULL THEN 'absent'
      ELSE 'not_recorded'
    END AS status
  FROM public.discussion_sessions s
  JOIN public.class_subject_members em
    ON em.class_id = s.class_id
    AND em.subject_id = s.subject_id
  JOIN public.class_members m
    ON m.class_id = em.class_id
    AND m.user_id = em.user_id
  LEFT JOIN public.profiles p ON p.id = m.user_id
  LEFT JOIN public.discussion_session_checkins c ON c.session_id = s.id
    AND c.user_id = m.user_id
  WHERE s.class_id = p_class_id
    AND s.subject_id = p_subject_id
    AND s.meeting_number IS NOT NULL
    AND s.status <> 'cancelled'
  ORDER BY
    s.meeting_number ASC,
    LOWER(COALESCE(NULLIF(BTRIM(p.full_name), ''), p.display_name, 'Member')) ASC,
    p.nim ASC NULLS LAST;
END;
$$;


-- Meeting list counts now count enrolled members only.
DO $$
DECLARE
  v_def text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_def
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE p.proname = 'class_attendance_meeting_list'
    AND n.nspname = 'public'
    AND p.pronargs = 1;

  IF v_def IS NULL THEN
    RAISE EXCEPTION 'class_attendance_meeting_list not found';
  END IF;

  v_def := replace(
    v_def,
    E'      from\n        public.class_members cm\n        left join public.discussion_session_checkins c on c.session_id = s.id\n        and c.user_id = cm.user_id\n      where\n        cm.class_id = s.class_id\n        and cm.joined_at <= s.starts_at',
    E'      from\n        public.class_subject_members csm\n        join public.class_members cm on cm.class_id = csm.class_id\n        and cm.user_id = csm.user_id\n        left join public.discussion_session_checkins c on c.session_id = s.id\n        and c.user_id = cm.user_id\n      where\n        csm.class_id = s.class_id\n        and csm.subject_id = s.subject_id\n        and cm.joined_at <= s.starts_at'
  );

  EXECUTE v_def;

  SELECT pg_get_functiondef(p.oid) INTO v_def
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE p.proname = 'class_attendance_meeting_list'
    AND n.nspname = 'public'
    AND p.pronargs = 1;

  IF v_def NOT LIKE '%csm.subject_id = s.subject_id%' THEN
    RAISE EXCEPTION 'class_attendance_meeting_list enrollment patch did not apply';
  END IF;
END;
$$;


COMMENT ON TABLE public.class_subject_members IS 'Per-subject enrollment scoping attendance. Option 1 only; assignments/materials still inherit class membership.';


COMMENT ON FUNCTION public.is_subject_member (uuid, uuid) IS 'True when the caller is enrolled in the subject. Attendance RPCs use this so repeat students are scoped per course.';

-- Student self-organized classes + automatic ketua kelas.
-- =====================================================================
-- User decisions (2026-11-13):
--   * First student to join a class becomes ketua automatically,
--     including lecturer-created classes.
--   * Students may create classes themselves (self-organized study groups),
--     in addition to the application queue and lecturer direct creation.
--   * Ketua gets: manage_attendance, manage_announcements, manage_assignments,
--     manage_grades, manage_leave_review. Never manage_admins/materials/schedule.
--   * Retake students join only specific subjects, never full membership:
--     they are NOT inserted into class_members (that would leak the roster).
--   * Cohort can recall a ketua: >= 50% of active members voting passes,
--     earliest-joined non-admin member takes over as acting ketua.
--
-- Supersedes 20270114000000_university_roles.sql: that revision of
--   class_members_joined_via_allowed dropped 'name_match' while
--   join_class_by_name still inserts it, so open-class join could fail.
-- The constraint below is the idempotent DROP/ADD with the full list.
-- =====================================================================
ALTER TABLE public.class_members
DROP CONSTRAINT IF EXISTS class_members_joined_via_allowed;


ALTER TABLE public.class_members
ADD CONSTRAINT class_members_joined_via_allowed CHECK (
  joined_via IN (
    'invitation',
    'admin_assignment',
    'platform_assignment',
    'lecturer_assignment',
    'name_match',
    'student_created'
  )
);


-- ---------------------------------------------------------------------------
-- Helper (defined first): the university backing a class, or NULL for a
-- university-less (student-created) class. Used by the recall flow to decide
-- whether the normalized RBAC dual-write applies.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.class_university (p_class_id uuid) RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER
SET
  search_path = '' AS $$
  SELECT university_id FROM public.classes WHERE id = p_class_id;
$$;


REVOKE ALL ON FUNCTION public.class_university (uuid)
FROM
  public,
  anon,
  authenticated;


-- ---------------------------------------------------------------------------
-- Ketua kelas assignments. Surrogate key + partial unique so a class may
-- hold one ACTIVE ketua at a time but unlimited revoked history; revoked
-- rows must not block succession after a recall.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.class_ketua_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.classes (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  source text NOT NULL,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  removed_reason text,
  CONSTRAINT class_ketua_assignments_source_allowed CHECK (source IN ('auto_first_join', 'acting_recall')),
  CONSTRAINT class_ketua_assignments_revoked_consistent CHECK ((revoked_at IS NULL) = (removed_reason IS NULL))
);


CREATE UNIQUE INDEX IF NOT EXISTS class_ketua_one_active ON public.class_ketua_assignments (class_id)
WHERE
  revoked_at IS NULL;


CREATE INDEX IF NOT EXISTS class_ketua_class_idx ON public.class_ketua_assignments (class_id, assigned_at);


COMMENT ON TABLE public.class_ketua_assignments IS 'Ketua kelas per class, one ACTIVE row per class; revoked rows stay as history (source: audit). A passed cohort recall revokes the active row and names an acting ketua.';


-- ---------------------------------------------------------------------------
-- grant_ketua_kelas: internal helper used by create/trigger/recall paths.
-- Dual-writes legacy class_admins and (when the class has a university) the
-- normalized class_admin_assignments + 5 permission codes. Never lets P0001
-- (5-admin cap) or an RBAC hiccup abort the caller: the trigger/RPC wraps the
-- grant and records an audit row on failure instead.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.grant_ketua_kelas (p_class_id uuid, p_user_id uuid, p_source text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER
SET
  search_path = '' AS $$
DECLARE
  v_university uuid;
  v_assignment_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;

  IF p_source NOT IN ('auto_first_join', 'acting_recall') THEN
    RAISE EXCEPTION 'invalid ketua source' USING ERRCODE = '22023';
  END IF;

  v_university := public.class_university(p_class_id);

  IF v_university IS NULL
     AND NOT EXISTS (SELECT 1 FROM public.classes WHERE id = p_class_id) THEN
    RAISE EXCEPTION 'class not found' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.class_ketua_assignments (class_id, user_id, source, assigned_at)
  VALUES (p_class_id, p_user_id, p_source, now());

  INSERT INTO public.class_admins (class_id, user_id, assigned_by)
  VALUES (p_class_id, p_user_id, NULL)
  ON CONFLICT (class_id, user_id) DO NOTHING;

  IF v_university IS NOT NULL THEN
    INSERT INTO public.class_admin_assignments (
      university_id, class_id, user_id, granted_by
    ) VALUES (
      v_university, p_class_id, p_user_id, p_user_id
    ) RETURNING id INTO v_assignment_id;

    INSERT INTO public.class_admin_permissions (assignment_id, permission_code)
    SELECT v_assignment_id, unnest(ARRAY[
      'manage_attendance',
      'manage_announcements',
      'manage_assignments',
      'manage_grades',
      'manage_leave_review'
    ]);
  END IF;

  RETURN TRUE;
END;
$$;


REVOKE ALL ON FUNCTION public.grant_ketua_kelas (uuid, uuid, text)
FROM
  public,
  anon,
  authenticated;


-- ---------------------------------------------------------------------------
-- AFTER INSERT trigger on class_members: first student member becomes ketua.
-- Skips elevated join paths; skips when the class already has an active ketua;
-- skips callers holding a lecturer/university_admin/platform-admin persona.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.maybe_grant_ketua_on_join () RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET
  search_path = '' AS $$
DECLARE
  v_university uuid;
  v_is_elevated boolean := false;
BEGIN
  IF NEW.joined_via IN ('lecturer_assignment', 'admin_assignment', 'platform_assignment') THEN
    RETURN NEW;
  END IF;

  IF EXISTS (SELECT 1 FROM public.class_ketua_assignments WHERE class_id = NEW.class_id AND revoked_at IS NULL) THEN
    RETURN NEW;
  END IF;

  -- Elevated only relative to the class's own university: a lecturer standing
  -- at another university is still a student here, and a class without a
  -- university has no tenant roles to scope against.
  SELECT university_id INTO v_university FROM public.classes WHERE id = NEW.class_id;

  SELECT
    public.is_platform_admin()
    OR (
      v_university IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.university_memberships m
        WHERE m.user_id = NEW.user_id
          AND m.status = 'active'
          AND m.role IN ('lecturer', 'university_admin')
          AND m.university_id = v_university
      )
    )
  INTO v_is_elevated;

  IF v_is_elevated THEN
    RETURN NEW;
  END IF;

  -- Serialize on the class row so two concurrent first joins cannot both grant.
  PERFORM 1
  FROM public.classes c
  WHERE c.id = NEW.class_id
  FOR UPDATE;

  IF EXISTS (SELECT 1 FROM public.class_ketua_assignments WHERE class_id = NEW.class_id AND revoked_at IS NULL) THEN
    RETURN NEW;
  END IF;

  BEGIN
    PERFORM public.grant_ketua_kelas(NEW.class_id, NEW.user_id, 'auto_first_join');

    PERFORM public.record_audit(
      'ketua_kelas_auto_granted',
      'class_ketua_assignment',
      NEW.class_id,
      NEW.class_id,
      jsonb_build_object('user_id', NEW.user_id, 'source', 'auto_first_join')
    );
  EXCEPTION WHEN OTHERS THEN
    -- A ketua grant must never abort the membership insert it rides on.
    PERFORM public.record_audit(
      'ketua_kelas_auto_grant_failed',
      'class_member',
      NEW.class_id,
      NEW.class_id,
      jsonb_build_object('user_id', NEW.user_id, 'error_code', SQLSTATE)
    );
  END;

  RETURN NEW;
END;
$$;


REVOKE ALL ON FUNCTION public.maybe_grant_ketua_on_join ()
FROM
  public,
  anon,
  authenticated;


DROP TRIGGER IF EXISTS class_members_ketua_after_insert ON public.class_members;


CREATE TRIGGER class_members_ketua_after_insert
AFTER INSERT ON public.class_members FOR EACH ROW
EXECUTE FUNCTION public.maybe_grant_ketua_on_join ();


-- ---------------------------------------------------------------------------
-- create_class_as_student: any signed-in user may open a self-organized
-- class. Abuse guard: at most 3 active student-created classes per user.
-- Creator's membership fires the ketua trigger, so creator becomes ketua.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_class_as_student (
  p_proposed_slug text,
  p_proposed_name text,
  p_course_name text,
  p_semester text,
  p_academic_year text,
  p_description text,
  p_join_policy text DEFAULT 'invitation',
  p_university_id uuid DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER
SET
  search_path = '' AS $$
DECLARE
  v_user uuid := auth.uid();
  v_slug text := lower(btrim(coalesce(p_proposed_slug, '')));
  v_name text := btrim(coalesce(p_proposed_name, ''));
  v_course_name text := btrim(coalesce(p_course_name, ''));
  v_semester text := btrim(coalesce(p_semester, ''));
  v_academic_year text := btrim(coalesce(p_academic_year, ''));
  v_description text := btrim(coalesce(p_description, ''));
  v_join_policy text := lower(btrim(coalesce(p_join_policy, 'invitation')));
  v_created_count integer;
  v_course_id uuid;
  v_class_id uuid;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;

  IF v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' OR char_length(v_slug) NOT BETWEEN 3 AND 80 THEN
    RAISE EXCEPTION 'invalid class slug' USING ERRCODE = '22023';
  END IF;

  IF char_length(v_name) NOT BETWEEN 3 AND 120 THEN
    RAISE EXCEPTION 'class name must be 3 to 120 characters' USING ERRCODE = '22023';
  END IF;

  IF char_length(v_description) NOT BETWEEN 10 AND 5000 THEN
    RAISE EXCEPTION 'description must be 10 to 5000 characters' USING ERRCODE = '22023';
  END IF;

  IF char_length(v_course_name) NOT BETWEEN 2 AND 120 THEN
    RAISE EXCEPTION 'course name must be 2 to 120 characters' USING ERRCODE = '22023';
  END IF;

  IF char_length(v_semester) NOT BETWEEN 1 AND 20 THEN
    RAISE EXCEPTION 'semester must be 1 to 20 characters' USING ERRCODE = '22023';
  END IF;

  IF v_academic_year !~ '^\d{4}/\d{4}$' THEN
    RAISE EXCEPTION 'academic year must look like 2026/2027' USING ERRCODE = '22023';
  END IF;

  IF v_join_policy NOT IN ('invitation', 'open') THEN
    RAISE EXCEPTION 'join policy must be invitation or open' USING ERRCODE = '22023';
  END IF;

  IF p_university_id IS NOT NULL
     AND NOT public.is_university_member(p_university_id) THEN
    RAISE EXCEPTION 'university membership required for that university' USING ERRCODE = '42501';
  END IF;

  -- Abuse guard: a user may own at most 3 active self-organized classes.
  SELECT count(*)
  INTO v_created_count
  FROM public.classes c
  WHERE c.created_by = v_user
    AND c.status = 'active';

  IF v_created_count >= 3 THEN
    RAISE EXCEPTION 'self-organized class limit reached (3)' USING ERRCODE = 'P0001';
  END IF;

  IF EXISTS (SELECT 1 FROM public.classes c WHERE c.slug = v_slug) THEN
    RAISE EXCEPTION 'class slug already taken' USING ERRCODE = '23505';
  END IF;

  INSERT INTO public.courses (name)
  VALUES (v_course_name)
  ON CONFLICT (normalized_name) DO UPDATE
  SET name = excluded.name
  RETURNING id INTO v_course_id;

  INSERT INTO public.classes (
    slug, name, description, course_id, course_name, lecturer_name,
    semester, academic_year, status, created_by, university_id, join_policy
  ) VALUES (
    v_slug, v_name, v_description, v_course_id, v_course_name,
    NULL, v_semester, v_academic_year, 'active', v_user, p_university_id, v_join_policy
  ) RETURNING id INTO v_class_id;

  INSERT INTO public.class_members (class_id, user_id, joined_via)
  VALUES (v_class_id, v_user, 'student_created')
  ON CONFLICT (class_id, user_id) DO NOTHING;

  PERFORM public.record_audit(
    'class_created_by_student',
    'class',
    v_class_id,
    v_class_id,
    jsonb_build_object('slug', v_slug, 'university_id', p_university_id, 'join_policy', v_join_policy)
  );

  RETURN v_class_id;
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'class already exists' USING ERRCODE = '23505';
END;
$$;


REVOKE ALL ON FUNCTION public.create_class_as_student (text, text, text, text, text, text, text, uuid)
FROM
  public,
  anon;


GRANT
EXECUTE ON FUNCTION public.create_class_as_student (text, text, text, text, text, text, text, uuid) TO authenticated;


COMMENT ON FUNCTION public.create_class_as_student (text, text, text, text, text, text, text, uuid) IS 'Self-organized class for any signed-in user. Creator becomes ketua via the class_members trigger. Abuse guard: at most 3 active self-organized classes per user. Join policy selectable (invitation default).';


-- ---------------------------------------------------------------------------
-- Retake enrollment: specific subjects only, never full membership.
-- Retake students are NOT class_members (their roster would leak). Per-subject
-- content isolation is delivered with a follow-up content-policy pass; the
-- predicate below is the additive hook those policies and the UI use.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.course_retake_enrollments (
  class_id uuid NOT NULL REFERENCES public.classes (id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES public.class_subjects (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  enrolled_via text NOT NULL DEFAULT 'retake',
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (class_id, subject_id, user_id),
  CONSTRAINT course_retake_enrollments_via_allowed CHECK (enrolled_via IN ('retake', 'admin_assignment'))
);


CREATE INDEX IF NOT EXISTS course_retake_user_idx ON public.course_retake_enrollments (user_id, class_id);


CREATE INDEX IF NOT EXISTS course_retake_subject_idx ON public.course_retake_enrollments (subject_id);


ALTER TABLE public.course_retake_enrollments ENABLE ROW LEVEL SECURITY;


REVOKE ALL ON TABLE public.course_retake_enrollments
FROM
  public,
  anon;


GRANT
SELECT
,
  INSERT,
UPDATE,
DELETE ON TABLE public.course_retake_enrollments TO authenticated;


DROP POLICY IF EXISTS course_retake_self_or_manager_read ON public.course_retake_enrollments;


CREATE POLICY course_retake_self_or_manager_read ON public.course_retake_enrollments FOR
SELECT
  TO authenticated USING (
    user_id = auth.uid ()
    OR public.can_manage_class (class_id)
    OR public.is_platform_admin ()
  );


CREATE OR REPLACE FUNCTION public.is_retake_enrolled (p_class_id uuid, p_subject_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET
  search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.course_retake_enrollments e
    WHERE e.class_id = p_class_id
      AND e.subject_id = p_subject_id
      AND e.user_id = (SELECT auth.uid())
  );
$$;


REVOKE ALL ON FUNCTION public.is_retake_enrolled (uuid, uuid)
FROM
  public,
  anon;


GRANT
EXECUTE ON FUNCTION public.is_retake_enrolled (uuid, uuid) TO authenticated;


CREATE OR REPLACE FUNCTION public.add_retake_enrollment (p_class_id uuid, p_subject_id uuid, p_user_id uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER
SET
  search_path = '' AS $$
DECLARE
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;

  IF NOT public.can_manage_class(p_class_id) THEN
    RAISE EXCEPTION 'class admin permission required' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.class_subjects s
    WHERE s.id = p_subject_id
      AND s.class_id = p_class_id
      AND s.status = 'active'
  ) THEN
    RAISE EXCEPTION 'subject not in this class' USING ERRCODE = 'P0002';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.class_members m
    WHERE m.class_id = p_class_id AND m.user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'user is already a full member of this class' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.course_retake_enrollments (class_id, subject_id, user_id, enrolled_via, created_by)
  VALUES (p_class_id, p_subject_id, p_user_id, 'admin_assignment', auth.uid())
  ON CONFLICT (class_id, subject_id, user_id) DO NOTHING
  RETURNING id INTO v_id;

  PERFORM public.record_audit(
    'retake_enrollment_added',
    'course_retake_enrollment',
    v_id,
    p_class_id,
    jsonb_build_object('subject_id', p_subject_id, 'user_id', p_user_id)
  );

  RETURN v_id;
END;
$$;


CREATE OR REPLACE FUNCTION public.remove_retake_enrollment (p_class_id uuid, p_subject_id uuid, p_user_id uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER
SET
  search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;

  IF NOT public.can_manage_class(p_class_id) THEN
    RAISE EXCEPTION 'class admin permission required' USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.course_retake_enrollments
  WHERE class_id = p_class_id
    AND subject_id = p_subject_id
    AND user_id = p_user_id;

  PERFORM public.record_audit(
    'retake_enrollment_removed',
    'course_retake_enrollment',
    NULL,
    p_class_id,
    jsonb_build_object('subject_id', p_subject_id, 'user_id', p_user_id)
  );

  RETURN FOUND;
END;
$$;


REVOKE ALL ON FUNCTION public.add_retake_enrollment (uuid, uuid, uuid)
FROM
  public,
  anon;


REVOKE ALL ON FUNCTION public.remove_retake_enrollment (uuid, uuid, uuid)
FROM
  public,
  anon;


GRANT
EXECUTE ON FUNCTION public.add_retake_enrollment (uuid, uuid, uuid) TO authenticated;


GRANT
EXECUTE ON FUNCTION public.remove_retake_enrollment (uuid, uuid, uuid) TO authenticated;


-- ---------------------------------------------------------------------------
-- Recall cohort: >= 50% of active members (class_members at vote time) recall
-- the ketua. One open petition per class. On passing: revoke the active ketua
-- row, remove the ketua's legacy/normalized admin rows for the class, and
-- install the earliest-joined non-admin member as acting ketua. If no acting
-- member remains, the class is left without a ketua (audit records the gap).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.class_ketua_recalls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.classes (id) ON DELETE CASCADE,
  opened_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  reason text,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  CONSTRAINT class_ketua_recalls_status_allowed CHECK (status IN ('open', 'passed', 'cancelled')),
  CONSTRAINT class_ketua_recalls_reason_length CHECK (
    reason IS NULL
    OR char_length(btrim(reason)) BETWEEN 1 AND 500
  )
);


CREATE UNIQUE INDEX IF NOT EXISTS class_ketua_recalls_one_open ON public.class_ketua_recalls (class_id)
WHERE
  status = 'open';


CREATE INDEX IF NOT EXISTS class_ketua_recalls_class_idx ON public.class_ketua_recalls (class_id, created_at DESC);


CREATE TABLE IF NOT EXISTS public.class_ketua_recall_votes (
  recall_id uuid NOT NULL REFERENCES public.class_ketua_recalls (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (recall_id, user_id)
);


ALTER TABLE public.class_ketua_recalls ENABLE ROW LEVEL SECURITY;


ALTER TABLE public.class_ketua_recall_votes ENABLE ROW LEVEL SECURITY;


REVOKE ALL ON TABLE public.class_ketua_recalls
FROM
  public,
  anon;


REVOKE ALL ON TABLE public.class_ketua_recall_votes
FROM
  public,
  anon;


GRANT
SELECT
  ON TABLE public.class_ketua_recalls TO authenticated;


GRANT
SELECT
  ON TABLE public.class_ketua_recall_votes TO authenticated;


DROP POLICY IF EXISTS class_ketua_recalls_member_read ON public.class_ketua_recalls;


CREATE POLICY class_ketua_recalls_member_read ON public.class_ketua_recalls FOR
SELECT
  TO authenticated USING (
    public.is_class_member (class_id)
    OR public.is_platform_admin ()
  );


DROP POLICY IF EXISTS class_ketua_recall_votes_member_read ON public.class_ketua_recall_votes;


CREATE POLICY class_ketua_recall_votes_member_read ON public.class_ketua_recall_votes FOR
SELECT
  TO authenticated USING (
    user_id = auth.uid ()
    OR EXISTS (
      SELECT
        1
      FROM
        public.class_ketua_recalls r
      WHERE
        r.id = class_ketua_recall_votes.recall_id
        AND (
          public.can_manage_class (r.class_id)
          OR public.is_platform_admin ()
        )
    )
  );


-- threshold uses ceil(active / 2): a 50% exactly vote passes (design decision).
CREATE OR REPLACE FUNCTION public.ketua_recall_threshold (p_class_id uuid) RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER
SET
  search_path = '' AS $$
  SELECT (count(*) + 1) / 2
  FROM public.class_members
  WHERE class_id = p_class_id;
$$;


REVOKE ALL ON FUNCTION public.ketua_recall_threshold (uuid)
FROM
  public,
  anon;


GRANT
EXECUTE ON FUNCTION public.ketua_recall_threshold (uuid) TO authenticated;


CREATE OR REPLACE FUNCTION public.open_ketua_recall (p_class_id uuid, p_reason text DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER
SET
  search_path = '' AS $$
DECLARE
  v_user uuid := auth.uid();
  v_recall_id uuid;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;

  IF NOT public.is_class_member(p_class_id) THEN
    RAISE EXCEPTION 'class membership required' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.class_ketua_assignments
    WHERE class_id = p_class_id AND revoked_at IS NULL
  ) THEN
    RAISE EXCEPTION 'this class has no ketua to recall' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.class_ketua_recalls
    WHERE class_id = p_class_id AND status = 'open'
  ) THEN
    RAISE EXCEPTION 'a recall petition is already open for this class' USING ERRCODE = '23505';
  END IF;

  INSERT INTO public.class_ketua_recalls (class_id, opened_by, reason, status)
  VALUES (
    p_class_id,
    v_user,
    NULLIF(btrim(coalesce(p_reason, '')), ''),
    'open'
  )
  RETURNING id INTO v_recall_id;

  INSERT INTO public.class_ketua_recall_votes (recall_id, user_id)
  VALUES (v_recall_id, v_user)
  ON CONFLICT DO NOTHING;

  PERFORM public.record_audit(
    'ketua_recall_opened',
    'class_ketua_recall',
    v_recall_id,
    p_class_id,
    jsonb_build_object('opened_by', v_user)
  );

  RETURN v_recall_id;
END;
$$;


CREATE OR REPLACE FUNCTION public.cast_ketua_recall_vote (p_recall_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET
  search_path = '' AS $$
DECLARE
  v_user uuid := auth.uid();
  v_recall public.class_ketua_recalls;
  v_threshold integer;
  v_votes integer;
  v_assignment public.class_ketua_assignments;
  v_acting uuid;
  v_university uuid;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_recall FROM public.class_ketua_recalls WHERE id = p_recall_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'recall petition not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_recall.status <> 'open' THEN
    RAISE EXCEPTION 'recall petition is not open' USING ERRCODE = '22023';
  END IF;

  IF NOT public.is_class_member(v_recall.class_id) THEN
    RAISE EXCEPTION 'class membership required' USING ERRCODE = '42501';
  END IF;

  -- One vote per member; idempotent re-submission.
  INSERT INTO public.class_ketua_recall_votes (recall_id, user_id)
  VALUES (p_recall_id, v_user)
  ON CONFLICT (recall_id, user_id) DO NOTHING;

  SELECT count(*) INTO v_votes
  FROM public.class_ketua_recall_votes
  WHERE recall_id = p_recall_id;

  v_threshold := public.ketua_recall_threshold(v_recall.class_id);

  IF v_votes < v_threshold THEN
    RETURN jsonb_build_object('status', 'open', 'votes', v_votes, 'threshold', v_threshold);
  END IF;

  -- Threshold reached: pass the recall atomically.
  SELECT * INTO v_assignment
  FROM public.class_ketua_assignments
  WHERE class_id = v_recall.class_id AND revoked_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    -- Ketua already gone (manual revoke / prior recall): close as passed.
    UPDATE public.class_ketua_recalls
    SET status = 'passed', decided_at = now()
    WHERE id = p_recall_id;

    RETURN jsonb_build_object('status', 'passed', 'votes', v_votes, 'threshold', v_threshold, 'acting_user_id', NULL);
  END IF;

  UPDATE public.class_ketua_recalls
  SET status = 'passed', decided_at = now()
  WHERE id = p_recall_id;

  -- Appoint acting ketua before removing the outgoing ketua's admin rows,
  -- to respect the "at least one admin" invariant.
  SELECT m.user_id INTO v_acting
  FROM public.class_members m
  WHERE m.class_id = v_recall.class_id
    AND m.user_id <> v_assignment.user_id
    AND NOT EXISTS (
      SELECT 1 FROM public.class_admins ca
      WHERE ca.class_id = v_recall.class_id AND ca.user_id = m.user_id
    )
  ORDER BY m.joined_at ASC
  LIMIT 1;

  UPDATE public.class_ketua_assignments
  SET revoked_at = now(), removed_reason = 'recall_passed'
  WHERE id = v_assignment.id;

  v_university := public.class_university(v_recall.class_id);

  DELETE FROM public.class_admins
  WHERE class_id = v_recall.class_id
    AND user_id = v_assignment.user_id;

  IF v_university IS NOT NULL THEN
    UPDATE public.class_admin_assignments
    SET revoked_at = now(), revoked_by = v_user
    WHERE class_id = v_recall.class_id
      AND user_id = v_assignment.user_id
      AND revoked_at IS NULL;
  END IF;

  IF v_acting IS NOT NULL THEN
    -- grant_ketua_kelas uses auth.uid() for granted_by; keep the voter as grantor.
    PERFORM public.grant_ketua_kelas(v_recall.class_id, v_acting, 'acting_recall');
  END IF;

  PERFORM public.record_audit(
    'ketua_recall_passed',
    'class_ketua_recall',
    p_recall_id,
    v_recall.class_id,
    jsonb_build_object('votes', v_votes, 'threshold', v_threshold, 'acting_user_id', v_acting)
  );

  PERFORM public.enqueue_notification_event(
    v_assignment.user_id,
    'class_ketua_recalled',
    'ketua_recall:' || p_recall_id::text,
    jsonb_build_object(
      'title', 'Peran ketua kelas kamu dicabut',
      'body', 'Cohort setuju untuk recall melalui petisi.',
      'url', '/classes'
    )
  );

  RETURN jsonb_build_object('status', 'passed', 'votes', v_votes, 'threshold', v_threshold, 'acting_user_id', v_acting);
END;
$$;


REVOKE ALL ON FUNCTION public.open_ketua_recall (uuid, text)
FROM
  public,
  anon;


REVOKE ALL ON FUNCTION public.cast_ketua_recall_vote (uuid)
FROM
  public,
  anon;


GRANT
EXECUTE ON FUNCTION public.open_ketua_recall (uuid, text) TO authenticated;


GRANT
EXECUTE ON FUNCTION public.cast_ketua_recall_vote (uuid) TO authenticated;


-- ---------------------------------------------------------------------------
-- notification kind: allow class_ketua_recalled (full restated list, idempotent).
-- ---------------------------------------------------------------------------
ALTER TABLE public.notification_events
DROP CONSTRAINT IF EXISTS notification_events_kind_allowed;


ALTER TABLE public.notification_events
ADD CONSTRAINT notification_events_kind_allowed CHECK (
  kind IN (
    'class_application_approved',
    'class_application_rejected',
    'class_admin_assigned',
    'class_invitation',
    'assignment_approved',
    'assignment_rejected',
    'submission_received',
    'moderation_required',
    'session_updated',
    'session_cancelled',
    'session_rsvp',
    'leave_request_submitted',
    'leave_request_revision_requested',
    'leave_request_forwarded',
    'leave_request_approved',
    'leave_request_rejected',
    'leave_request_cancelled',
    'verification_submitted',
    'verification_approved',
    'verification_rejected',
    'verification_revision_requested',
    'class_admin_revoked',
    'class_assignment_published',
    'assignment_report_reviewed',
    'assignment_created',
    'dm_message',
    'membership_role_updated',
    'class_ketua_recalled'
  )
);


ALTER TABLE public.class_ketua_assignments ENABLE ROW LEVEL SECURITY;


REVOKE ALL ON TABLE public.class_ketua_assignments
FROM
  public,
  anon;


GRANT
SELECT
  ON TABLE public.class_ketua_assignments TO authenticated;


DROP POLICY IF EXISTS class_ketua_assignments_member_read ON public.class_ketua_assignments;


CREATE POLICY class_ketua_assignments_member_read ON public.class_ketua_assignments FOR
SELECT
  TO authenticated USING (
    public.is_class_member (class_id)
    OR public.is_platform_admin ()
  );


-- ---------------------------------------------------------------------------
-- become_class_representative: a user whose ketua row was revoked by a passed
-- recall must not re-grant themselves an admin row (recall would be theater).
-- Signature is unchanged; only the recall guard is added.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.become_class_representative (p_class_id uuid) RETURNS text LANGUAGE plpgsql SECURITY DEFINER
SET
  search_path = public,
  pg_temp AS $$
DECLARE
  v_user uuid := (SELECT auth.uid());
  v_class_status text;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING errcode = '42501';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.class_ketua_assignments
    WHERE class_id = p_class_id
      AND user_id = v_user
      AND revoked_at IS NOT NULL
      AND removed_reason = 'recall_passed'
  ) THEN
    RETURN 'recalled';
  END IF;

  SELECT status INTO v_class_status FROM public.classes WHERE id = p_class_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN 'class_not_found';
  END IF;

  IF v_class_status IS DISTINCT FROM 'active' THEN
    RETURN 'class_inactive';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.class_members WHERE class_id = p_class_id AND user_id = v_user
  ) THEN
    RETURN 'not_member';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.class_admins WHERE class_id = p_class_id AND user_id = v_user
  ) THEN
    RETURN 'already_representative';
  END IF;

  IF (SELECT count(*) FROM public.class_admins WHERE class_id = p_class_id) >= 5 THEN
    RETURN 'limit_reached';
  END IF;

  INSERT INTO public.class_admins (class_id, user_id, assigned_by)
  VALUES (p_class_id, v_user, v_user);

  PERFORM public.record_audit(
    'class_representative_direct_grant',
    'class_admin',
    NULL,
    p_class_id,
    jsonb_build_object('granted_via', 'direct')
  );

  RETURN 'granted';
END;
$$;


REVOKE ALL ON FUNCTION public.become_class_representative (uuid)
FROM
  public,
  anon;


GRANT
EXECUTE ON FUNCTION public.become_class_representative (uuid) TO authenticated;

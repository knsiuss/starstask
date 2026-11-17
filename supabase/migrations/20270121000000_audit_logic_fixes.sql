-- Audit logic & authorization fixes: H-01, H-04, M-01, M-02, M-09, L-01, L-05.
-- =====================================================================
-- 1. H-01 & M-01: Track lecturer revocation on university_memberships so
--    demoted lecturers cannot self-reclaim via domain email, and revoke
--    class_admins / class_admin_assignments on classes they created as
--    lecturer in that university.
-- 2. M-02: Pass p_university_id through claim_lecturer_persona ->
--    grant_lecturer_membership_if_eligible so multi-university domain
--    matches target the requested university.
-- 3. H-04: Fix get_dashboard_overview Jakarta date boundary and exclude
--    assignment_completions from pastDeadline.
-- 4. M-09: Validate subject_ids belong to v_request.class_id in
--    set_leave_request_subjects.
-- 5. L-01: Allow cancelling revision_requested leave requests in
--    cancel_leave_request.
-- 6. L-05: Validate current assignment status before unpublish/archive in
--    moderate_assignment.
-- =====================================================================
-- ---------------------------------------------------------------------------
-- 1. university_memberships: lecturer_revoked_at + backfill from audit_logs
-- ---------------------------------------------------------------------------
ALTER TABLE public.university_memberships
ADD COLUMN IF NOT EXISTS lecturer_revoked_at timestamptz;


UPDATE public.university_memberships m
SET
  lecturer_revoked_at = latest.created_at
FROM
  (
    SELECT DISTINCT
      ON (a.entity_id) a.entity_id,
      a.created_at,
      a.metadata ->> 'from' AS from_role,
      a.metadata ->> 'to' AS to_role
    FROM
      public.audit_logs a
    WHERE
      a.action = 'university_membership_role_updated'
      AND a.entity_type = 'university_membership'
      AND a.entity_id IS NOT NULL
    ORDER BY
      a.entity_id,
      a.created_at DESC,
      a.id DESC
  ) latest
WHERE
  m.id = latest.entity_id
  AND m.role = 'student'
  AND latest.to_role = 'student'
  AND latest.from_role IN ('lecturer', 'university_admin')
  AND m.lecturer_revoked_at IS NULL;


-- ---------------------------------------------------------------------------
-- 2. H-01 & M-01: set_university_member_role
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_university_member_role (
  p_university_id uuid,
  p_user_id uuid,
  p_role text,
  p_reason text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER
SET
  search_path = '' AS $$
DECLARE
  v_caller uuid := auth.uid ();
  v_membership public.university_memberships;
  v_old_role text;
  v_new_role text := lower(btrim(coalesce(p_role, '')));
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_membership_id uuid;
  v_is_platform boolean := false;
  v_revoked_at timestamptz;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;

  IF v_new_role NOT IN ('student', 'lecturer', 'university_admin') THEN
    RAISE EXCEPTION 'unknown role' USING ERRCODE = '22023';
  END IF;

  v_is_platform := public.is_platform_admin ();

  IF NOT (
    v_is_platform
    OR public.is_university_admin (p_university_id)
  ) THEN
    RAISE EXCEPTION 'university admin required' USING ERRCODE = '42501';
  END IF;

  IF p_user_id = v_caller
     AND NOT v_is_platform THEN
    RAISE EXCEPTION 'cannot change your own role' USING ERRCODE = '42501';
  END IF;

  SELECT
    * INTO v_membership
  FROM
    public.university_memberships m
  WHERE
    m.user_id = p_user_id
    AND m.university_id = p_university_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'membership not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_membership.status <> 'active' THEN
    RAISE EXCEPTION 'only active memberships can change role' USING ERRCODE = '22023';
  END IF;

  v_old_role := v_membership.role;

  IF NOT v_is_platform THEN
    IF v_old_role = 'university_admin' THEN
      RAISE EXCEPTION 'only a platform admin may change a university admin' USING ERRCODE = '42501';
    END IF;

    IF v_new_role NOT IN ('student', 'lecturer') THEN
      RAISE EXCEPTION 'only platform admins may grant or revoke university_admin' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF v_old_role = v_new_role THEN
    RETURN v_membership.id;
  END IF;

  -- Record revocation when demoting to student; clear it on explicit re-promotion.
  v_revoked_at := CASE
    WHEN v_new_role = 'student'
    AND v_old_role IN ('lecturer', 'university_admin') THEN now()
    WHEN v_new_role IN ('lecturer', 'university_admin') THEN NULL
    ELSE v_membership.lecturer_revoked_at
  END;

  UPDATE public.university_memberships
  SET
    role = v_new_role,
    lecturer_revoked_at = v_revoked_at,
    updated_at = now()
  WHERE
    id = v_membership.id
  RETURNING
    id INTO v_membership_id;

  -- Revoke class admin privileges on classes created as lecturer in this university.
  IF v_new_role = 'student'
     AND v_old_role IN ('lecturer', 'university_admin') THEN
    DELETE FROM public.class_admins ca USING public.classes c
    WHERE
      ca.class_id = c.id
      AND ca.user_id = p_user_id
      AND c.university_id = p_university_id
      AND c.created_by = p_user_id;

    UPDATE public.class_admin_assignments a
    SET
      revoked_at = now(),
      revoked_by = v_caller
    FROM
      public.classes c
    WHERE
      a.class_id = c.id
      AND a.user_id = p_user_id
      AND a.revoked_at IS NULL
      AND c.university_id = p_university_id
      AND c.created_by = p_user_id;
  END IF;

  PERFORM public.record_audit (
    'university_membership_role_updated',
    'university_membership',
    v_membership_id,
    NULL,
    jsonb_build_object(
      'university_id',
      p_university_id,
      'from',
      v_old_role,
      'to',
      v_new_role,
      'reason',
      v_reason
    )
  );

  PERFORM public.enqueue_notification_event (
    p_user_id,
    'membership_role_updated',
    'membership_role:' || v_membership_id || ':' || v_new_role,
    jsonb_build_object(
      'title',
      'Peran kamu di universitas diperbarui',
      'body',
      'Perannya berubah dari ' || v_old_role || ' menjadi ' || v_new_role || '.',
      'url',
      '/university'
    )
  );

  RETURN v_membership_id;
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'role update conflicted with another transaction' USING ERRCODE = '23505';
END;
$$;


REVOKE ALL ON FUNCTION public.set_university_member_role (uuid, uuid, text, text)
FROM
  public,
  anon;


GRANT
EXECUTE ON FUNCTION public.set_university_member_role (uuid, uuid, text, text) TO authenticated;


COMMENT ON FUNCTION public.set_university_member_role (uuid, uuid, text, text) IS 'Promote/demote member role. Records lecturer_revoked_at and revokes lecturer-created class admin access on demotion to student.';


-- ---------------------------------------------------------------------------
-- 3. M-01 & M-02: grant_lecturer_membership_if_eligible & claim_lecturer_persona
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.grant_lecturer_membership_if_eligible (uuid, text, text);


CREATE OR REPLACE FUNCTION public.grant_lecturer_membership_if_eligible (
  p_user_id uuid,
  p_email text,
  p_verification_method text DEFAULT 'domain_email_auto',
  p_university_id uuid DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER
SET
  search_path = '' AS $$
DECLARE
  v_domain text;
  v_university public.universities;
  v_existing public.university_memberships;
  v_membership_id uuid;
BEGIN
  v_domain := split_part(lower(btrim(coalesce(p_email, ''))), '@', 2);

  IF v_domain = '' THEN
    RETURN NULL;
  END IF;

  SELECT
    uni.* INTO v_university
  FROM
    public.universities uni
  WHERE
    uni.status = 'active'
    AND (
      p_university_id IS NULL
      OR uni.id = p_university_id
    )
    AND EXISTS (
      SELECT
        1
      FROM
        unnest(uni.institutional_domains) AS d
      WHERE
        d = v_domain
        OR (
          d LIKE '*.%'
          AND v_domain LIKE '%.' || substr(d, 3)
        )
    )
  ORDER BY
    uni.slug
  LIMIT
    1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT
    * INTO v_existing
  FROM
    public.university_memberships m
  WHERE
    m.user_id = p_user_id
    AND m.university_id = v_university.id
  FOR UPDATE;

  IF FOUND
     AND v_existing.lecturer_revoked_at IS NOT NULL THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.university_memberships (
    user_id,
    university_id,
    role,
    status,
    created_at,
    updated_at
  )
  VALUES (
    p_user_id,
    v_university.id,
    'lecturer',
    'active',
    now(),
    now()
  )
  ON CONFLICT (user_id, university_id) DO UPDATE
  SET
    role = CASE
      WHEN public.university_memberships.role = 'university_admin' THEN public.university_memberships.role
      ELSE 'lecturer'
    END,
    status = CASE
      WHEN public.university_memberships.status = 'suspended' THEN public.university_memberships.status
      ELSE 'active'
    END,
    updated_at = public.university_memberships.updated_at
  RETURNING
    id INTO v_membership_id;

  INSERT INTO public.audit_logs (
    actor_id,
    action,
    entity_type,
    entity_id,
    university_id,
    metadata
  )
  VALUES (
    p_user_id,
    'lecturer_persona_auto_granted',
    'university_membership',
    v_membership_id,
    v_university.id,
    jsonb_build_object(
      'university_id',
      v_university.id,
      'verification_method',
      p_verification_method
    )
  );

  PERFORM public.enqueue_notification_event (
    p_user_id,
    'membership_role_updated',
    'lecturer_claim:' || v_membership_id,
    jsonb_build_object(
      'title',
      'Persona dosen StarsTask diaktifkan',
      'body',
      'Email institusimu cocok dengan universitas terdaftar. Akses dosen dibatasi ke kelas yang kamu kelola.',
      'url',
      '/app/lecturer'
    )
  );

  RETURN v_membership_id;
END;
$$;


REVOKE ALL ON FUNCTION public.grant_lecturer_membership_if_eligible (uuid, text, text, uuid)
FROM
  public,
  anon,
  authenticated;


COMMENT ON FUNCTION public.grant_lecturer_membership_if_eligible (uuid, text, text, uuid) IS 'Internal: enroll a confirmed account as lecturer for the active university whose institutional_domains match the email domain, unless lecturer role was explicitly revoked.';


CREATE OR REPLACE FUNCTION public.claim_lecturer_persona (
  p_nidn text DEFAULT NULL,
  p_university_id uuid DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER
SET
  search_path = '' AS $$
DECLARE
  v_user uuid := auth.uid ();
  v_email text;
  v_domain text;
  v_nidn text := nullif(btrim(coalesce(p_nidn, '')), '');
  v_membership_id uuid;
  v_email_confirmed boolean := false;
  v_university_id uuid := p_university_id;
  v_match_count integer := 0;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;

  IF v_nidn IS NOT NULL
     AND v_nidn !~ '^[0-9]{10}$' THEN
    RAISE EXCEPTION 'NIDN must be exactly 10 digits' USING ERRCODE = '22023';
  END IF;

  SELECT
    lower(u.email),
    (u.email_confirmed_at IS NOT NULL) INTO v_email,
    v_email_confirmed
  FROM
    auth.users u
  WHERE
    u.id = v_user;

  IF v_email IS NULL THEN
    RAISE EXCEPTION 'account has no email address' USING ERRCODE = '42501';
  END IF;

  IF NOT v_email_confirmed THEN
    RAISE EXCEPTION 'confirm your institutional email before claiming the lecturer persona' USING ERRCODE = '42501';
  END IF;

  v_domain := split_part(v_email, '@', 2);

  IF v_domain = '' THEN
    RAISE EXCEPTION 'account email is malformed' USING ERRCODE = '42501';
  END IF;

  IF v_university_id IS NULL THEN
    SELECT
      count(*) INTO v_match_count
    FROM
      public.universities uni
    WHERE
      uni.status = 'active'
      AND EXISTS (
        SELECT
          1
        FROM
          unnest(uni.institutional_domains) AS d
        WHERE
          d = v_domain
          OR (
            d LIKE '*.%'
            AND v_domain LIKE '%.' || substr(d, 3)
          )
      );

    IF v_match_count = 0 THEN
      RAISE EXCEPTION 'no active university is registered for the domain %; ask the platform operator to add it to institutional_domains',
      v_domain USING ERRCODE = '42501';
    ELSIF v_match_count > 1 THEN
      RAISE EXCEPTION 'more than one university claims this email domain; pass p_university_id' USING ERRCODE = '22023';
    END IF;

    SELECT
      uni.id INTO v_university_id
    FROM
      public.universities uni
    WHERE
      uni.status = 'active'
      AND EXISTS (
        SELECT
          1
        FROM
          unnest(uni.institutional_domains) AS d
        WHERE
          d = v_domain
          OR (
            d LIKE '*.%'
            AND v_domain LIKE '%.' || substr(d, 3)
          )
      )
    LIMIT
      1;
  ELSE
    IF NOT EXISTS (
      SELECT
        1
      FROM
        public.universities uni
      WHERE
        uni.id = v_university_id
        AND uni.status = 'active'
        AND EXISTS (
          SELECT
            1
          FROM
            unnest(uni.institutional_domains) AS d
          WHERE
            d = v_domain
            OR (
              d LIKE '*.%'
              AND v_domain LIKE '%.' || substr(d, 3)
            )
        )
    ) THEN
      RAISE EXCEPTION 'your email domain is not registered as institutional for that university, or the university is not active' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF EXISTS (
    SELECT
      1
    FROM
      public.university_memberships m
    WHERE
      m.user_id = v_user
      AND m.university_id = v_university_id
      AND m.lecturer_revoked_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'lecturer role was revoked by an administrator' USING ERRCODE = '42501';
  END IF;

  v_membership_id := public.grant_lecturer_membership_if_eligible (
    v_user,
    v_email,
    CASE
      WHEN v_nidn IS NULL THEN 'domain_email_auto'
      ELSE 'domain_email_nidn_auto'
    END,
    v_university_id
  );

  IF v_membership_id IS NULL THEN
    RAISE EXCEPTION 'no active university is registered for the domain %',
    v_domain USING ERRCODE = '42501';
  END IF;

  RETURN v_membership_id;
END;
$$;


REVOKE ALL ON FUNCTION public.claim_lecturer_persona (text, uuid)
FROM
  public,
  anon;


GRANT
EXECUTE ON FUNCTION public.claim_lecturer_persona (text, uuid) TO authenticated;


COMMENT ON FUNCTION public.claim_lecturer_persona (text, uuid) IS 'Self-claim the lecturer persona for the university whose institutional_domains contain the caller''s confirmed auth email domain. Respects p_university_id and refuses revoked lecturers.';


-- ---------------------------------------------------------------------------
-- 4. H-04: get_dashboard_overview (Jakarta date + exclude completed tasks)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_dashboard_overview (p_user_id uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET
  search_path = '' AS $$
DECLARE
  v_tz text;
  v_now timestamptz := now();
  v_due_start timestamptz;
  v_due_end timestamptz;
  v_new_since timestamptz;
  v_result jsonb;
BEGIN
  SELECT
    timezone INTO v_tz
  FROM
    public.notification_preferences
  WHERE
    user_id = p_user_id;

  IF v_tz IS NULL
     OR v_tz NOT IN (
       'Asia/Jakarta',
       'Asia/Makassar',
       'Asia/Jayapura',
       'UTC'
     ) THEN
    v_tz := NULL;
  END IF;

  v_due_start := ((v_now AT TIME ZONE 'Asia/Jakarta')::date)::timestamp AT TIME ZONE 'Asia/Jakarta';
  v_due_end := v_due_start + interval '7 days';
  v_new_since := v_now - interval '7 days';

  SELECT
    jsonb_build_object(
      'classes',
      COALESCE(classes_json, '[]'::jsonb),
      'stats',
      jsonb_build_object(
        'totalTasks',
        COALESCE(stats_json ->> 'totalTasks', '0')::int,
        'dueSoon',
        COALESCE(stats_json ->> 'dueSoon', '0')::int,
        'pastDeadline',
        COALESCE(stats_json ->> 'pastDeadline', '0')::int,
        'classCount',
        COALESCE(jsonb_array_length(classes_json), 0),
        'newThisWeek',
        COALESCE(stats_json ->> 'newThisWeek', '0')::int
      ),
      'recentTasks',
      COALESCE(recent_json, '[]'::jsonb),
      'timeZone',
      v_tz,
      'nowIso',
      v_now
    ) INTO v_result
  FROM
    (
      SELECT
        (
          SELECT
            jsonb_agg(
              row_to_json(t)
              ORDER BY
                t.name
            )
          FROM
            (
              SELECT
                cl.id,
                cl.slug,
                cl.name,
                cl.course_name,
                cl.semester,
                cl.academic_year,
                (
                  SELECT
                    count(*)
                  FROM
                    public.assignments a
                  WHERE
                    a.class_id = cl.id
                    AND a.status = 'published'
                ) + (
                  SELECT
                    count(*)
                  FROM
                    public.assignments a
                    JOIN public.class_subjects cs ON cs.class_id = cl.id
                    AND cs.course_id = a.course_id
                  WHERE
                    a.class_id IS NULL
                    AND a.subject_id IS NULL
                    AND a.status = 'published'
                ) AS task_count,
                EXISTS (
                  SELECT
                    1
                  FROM
                    public.class_admins ca
                  WHERE
                    ca.class_id = cl.id
                    AND ca.user_id = p_user_id
                ) AS is_admin,
                (
                  SELECT
                    count(*)
                  FROM
                    public.class_subjects cs
                  WHERE
                    cs.class_id = cl.id
                ) AS subject_count,
                NULL::text AS admin_name
              FROM
                public.classes cl
                JOIN public.class_members m ON m.class_id = cl.id
                AND m.user_id = p_user_id
              WHERE
                cl.status = 'active'
            ) t
        ) AS classes_json,
        (
          SELECT
            jsonb_build_object(
              'totalTasks',
              (
                SELECT
                  count(DISTINCT a.id)
                FROM
                  public.assignments a
                WHERE
                  a.status = 'published'
                  AND (
                    EXISTS (
                      SELECT
                        1
                      FROM
                        public.class_members m
                        JOIN public.classes cl ON cl.id = m.class_id
                      WHERE
                        m.user_id = p_user_id
                        AND cl.status = 'active'
                        AND a.class_id = cl.id
                    )
                    OR (
                      a.class_id IS NULL
                      AND a.subject_id IS NULL
                      AND EXISTS (
                        SELECT
                          1
                        FROM
                          public.class_members m
                          JOIN public.classes cl ON cl.id = m.class_id
                          JOIN public.class_subjects cs ON cs.class_id = cl.id
                        WHERE
                          m.user_id = p_user_id
                          AND cl.status = 'active'
                          AND cs.course_id = a.course_id
                      )
                    )
                  )
              ),
              'dueSoon',
              (
                SELECT
                  count(*)
                FROM
                  public.assignments a
                  JOIN public.class_members m ON m.class_id = a.class_id
                  AND m.user_id = p_user_id
                WHERE
                  a.status = 'published'
                  AND a.deadline >= v_due_start
                  AND a.deadline < v_due_end
              ),
              'pastDeadline',
              (
                SELECT
                  count(*)
                FROM
                  public.assignments a
                  JOIN public.class_members m ON m.class_id = a.class_id
                  AND m.user_id = p_user_id
                WHERE
                  a.status = 'published'
                  AND a.deadline < v_due_start
                  AND NOT EXISTS (
                    SELECT
                      1
                    FROM
                      public.assignment_completions ac
                    WHERE
                      ac.assignment_id = a.id
                      AND ac.user_id = p_user_id
                  )
              ),
              'newThisWeek',
              (
                SELECT
                  count(*)
                FROM
                  public.assignments a
                  JOIN public.class_members m ON m.class_id = a.class_id
                  AND m.user_id = p_user_id
                WHERE
                  a.status = 'published'
                  AND a.published_at >= v_new_since
              )
            )
        ) AS stats_json,
        (
          SELECT
            jsonb_agg(
              row_to_json(r)
              ORDER BY
                r.published_at DESC
            )
          FROM
            (
              SELECT
                a.id,
                a.title,
                a.deadline,
                cl.name AS class_name,
                a.published_at
              FROM
                public.assignments a
                JOIN public.classes cl ON cl.id = a.class_id
                JOIN public.class_members m ON m.class_id = cl.id
                AND m.user_id = p_user_id
              WHERE
                a.status = 'published'
              ORDER BY
                a.published_at DESC NULLS LAST
              LIMIT
                5
            ) r
        ) AS recent_json
    ) s;

  RETURN v_result;
END;
$$;


REVOKE ALL ON FUNCTION public.get_dashboard_overview (uuid)
FROM
  public,
  anon;


GRANT
EXECUTE ON FUNCTION public.get_dashboard_overview (uuid) TO authenticated;


COMMENT ON FUNCTION public.get_dashboard_overview (uuid) IS 'Dashboard overview in 1 roundtrip: classes+stats+recent. Uses Asia/Jakarta day boundary and excludes completed tasks from pastDeadline.';


-- ---------------------------------------------------------------------------
-- 5. M-09: set_leave_request_subjects
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_leave_request_subjects (
  p_request_id uuid,
  p_subject_ids UUID[]
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET
  search_path = public,
  pg_temp AS $$
DECLARE
  v_user_id uuid := auth.uid ();
  v_request public.leave_requests;
  v_ids uuid[] := coalesce(p_subject_ids, '{}'::uuid[]);
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT
    * INTO v_request
  FROM
    public.leave_requests r
  WHERE
    r.id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'absence request not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_request.student_id <> v_user_id THEN
    RAISE EXCEPTION 'only the owner may change the covered courses' USING ERRCODE = '42501';
  END IF;

  IF v_request.status NOT IN ('draft', 'revision_requested') THEN
    RAISE EXCEPTION 'this request can no longer be edited' USING ERRCODE = 'SS011';
  END IF;

  IF coalesce(array_length(v_ids, 1), 0) > 0 THEN
    IF EXISTS (
      SELECT
        1
      FROM
        unnest(v_ids) AS sid
      WHERE
        sid IS NULL
        OR NOT EXISTS (
          SELECT
            1
          FROM
            public.class_subjects cs
          WHERE
            cs.id = sid
            AND cs.class_id = v_request.class_id
        )
    ) THEN
      RAISE EXCEPTION 'one or more subjects do not belong to this class' USING ERRCODE = '22023';
    END IF;
  END IF;

  UPDATE public.leave_requests r
  SET
    subject_ids = v_ids
  WHERE
    r.id = p_request_id;
END;
$$;


REVOKE ALL ON FUNCTION public.set_leave_request_subjects (uuid, UUID[])
FROM
  public,
  anon;


GRANT
EXECUTE ON FUNCTION public.set_leave_request_subjects (uuid, UUID[]) TO authenticated;


COMMENT ON FUNCTION public.set_leave_request_subjects (uuid, UUID[]) IS 'Replaces the courses one draft or returned absence request covers, validating each subject belongs to the request class. Owner only.';


-- ---------------------------------------------------------------------------
-- 6. L-01: cancel_leave_request
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cancel_leave_request (
  p_request_id uuid,
  p_note text DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET
  search_path = public,
  pg_temp AS $$
DECLARE
  v_user_id uuid := auth.uid ();
  v_request public.leave_requests;
  v_is_owner boolean;
  v_is_admin boolean;
  v_note text;
  v_display_name text;
  v_class_slug text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT
    * INTO v_request
  FROM
    public.leave_requests r
  WHERE
    r.id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'absence request not found' USING ERRCODE = 'P0002';
  END IF;

  v_is_owner := v_request.student_id = v_user_id;
  v_is_admin := public.can_manage_class (v_request.class_id);

  IF NOT (v_is_owner OR v_is_admin) THEN
    RAISE EXCEPTION 'not allowed to cancel this request' USING ERRCODE = '42501';
  END IF;

  IF v_is_owner THEN
    IF v_request.status NOT IN ('draft', 'submitted', 'revision_requested') THEN
      RAISE EXCEPTION 'this request can no longer be cancelled' USING ERRCODE = 'SS012';
    END IF;
  ELSIF v_request.status NOT IN ('submitted', 'revision_requested') THEN
    RAISE EXCEPTION 'this request can no longer be cancelled' USING ERRCODE = 'SS012';
  END IF;

  IF p_note IS NOT NULL
     AND char_length(btrim(p_note)) > 2000 THEN
    RAISE EXCEPTION 'the cancellation note is too long' USING ERRCODE = '22023';
  END IF;

  v_note := nullif(btrim(coalesce(p_note, '')), '');

  UPDATE public.leave_requests r
  SET
    status = 'cancelled',
    cancelled_at = now(),
    cancelled_by = v_user_id,
    cancellation_note = v_note
  WHERE
    r.id = p_request_id;

  INSERT INTO public.leave_request_history (request_id, actor_id, action, note)
  VALUES (p_request_id, v_user_id, 'cancelled', v_note);

  PERFORM public.record_audit (
    'leave_request_cancelled',
    'leave_request',
    p_request_id,
    v_request.class_id,
    jsonb_build_object(
      'actor_role',
      CASE
        WHEN v_is_owner THEN 'student'
        ELSE 'class_admin'
      END
    )
  );

  v_class_slug := (
    SELECT
      c.slug
    FROM
      public.classes c
    WHERE
      c.id = v_request.class_id
  );

  IF v_is_owner THEN
    v_display_name := coalesce(
      (
        SELECT
          p.display_name
        FROM
          public.profiles p
        WHERE
          p.id = v_request.student_id
      ),
      'A student'
    );

    PERFORM public.notify_class_leave_reviewers (
      v_request.class_id,
      'leave_request_cancelled',
      'Absence request cancelled',
      v_display_name || ' cancelled an absence request.',
      '/dashboard/classes/' || v_class_slug || '/leave-requests',
      p_request_id::text || ':' || to_char(now(), 'YYYYMMDDHH24MISS')
    );
  ELSE
    v_display_name := coalesce(
      (
        SELECT
          p.display_name
        FROM
          public.profiles p
        WHERE
          p.id = v_user_id
      ),
      'Your class admin'
    );

    PERFORM public.enqueue_notification_event (
      v_request.student_id,
      'leave_request_cancelled',
      'leave_request_cancelled:' || p_request_id || ':' || v_request.student_id || ':' || to_char(now(), 'YYYYMMDDHH24MISS'),
      jsonb_build_object(
        'title',
        'Absence request cancelled',
        'body',
        v_display_name || ' cancelled your absence request. Open StarsTask for details.',
        'url',
        '/leave-requests/' || p_request_id::text
      )
    );
  END IF;
END;
$$;


REVOKE ALL ON FUNCTION public.cancel_leave_request (uuid, text)
FROM
  public,
  anon;


GRANT
EXECUTE ON FUNCTION public.cancel_leave_request (uuid, text) TO authenticated;


-- ---------------------------------------------------------------------------
-- 7. L-05: moderate_assignment
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.moderate_assignment (
  p_assignment_id uuid,
  p_action text,
  p_reason text DEFAULT NULL
) RETURNS text LANGUAGE plpgsql SECURITY DEFINER
SET
  search_path = public,
  pg_temp AS $$
DECLARE
  v_actor uuid := (
    SELECT
      auth.uid ()
  );
  v_assignment public.assignments;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_status text;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;

  IF p_action NOT IN ('unpublish', 'archive', 'restore') THEN
    RAISE EXCEPTION 'invalid moderation action' USING ERRCODE = '22023';
  END IF;

  SELECT
    * INTO v_assignment
  FROM
    public.assignments
  WHERE
    id = p_assignment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'assignment not found' USING ERRCODE = 'P0002';
  END IF;

  IF p_action = 'restore' THEN
    IF NOT public.is_platform_admin () THEN
      RAISE EXCEPTION 'platform admin required to restore' USING ERRCODE = '42501';
    END IF;

    IF v_assignment.status NOT IN ('unpublished', 'archived') THEN
      RAISE EXCEPTION 'only unpublished or archived assignments can be restored' USING ERRCODE = '22023';
    END IF;

    v_status := 'published';
  ELSE
    IF v_assignment.class_id IS NOT NULL THEN
      IF NOT public.can_manage_class (v_assignment.class_id) THEN
        RAISE EXCEPTION 'class admin or platform admin required' USING ERRCODE = '42501';
      END IF;
    ELSIF NOT public.is_platform_admin () THEN
      RAISE EXCEPTION 'platform admin required' USING ERRCODE = '42501';
    END IF;

    IF p_action = 'unpublish'
       AND v_assignment.status <> 'published' THEN
      RAISE EXCEPTION 'only published assignments can be unpublished' USING ERRCODE = '22023';
    END IF;

    IF p_action = 'archive'
       AND v_assignment.status NOT IN ('published', 'unpublished') THEN
      RAISE EXCEPTION 'only published or unpublished assignments can be archived' USING ERRCODE = '22023';
    END IF;

    IF v_reason IS NULL
       OR char_length(v_reason) < 3 THEN
      RAISE EXCEPTION 'moderation reason required' USING ERRCODE = '22023';
    END IF;

    v_status := CASE
      WHEN p_action = 'archive' THEN 'archived'
      ELSE 'unpublished'
    END;
  END IF;

  UPDATE public.assignments
  SET
    status = v_status,
    published_at = CASE
      WHEN v_status = 'published' THEN coalesce(published_at, now())
      ELSE published_at
    END
  WHERE
    id = p_assignment_id;

  INSERT INTO public.assignment_reviews (assignment_id, reviewer_id, decision, reason)
  VALUES (
    p_assignment_id,
    v_actor,
    CASE
      WHEN p_action = 'restore' THEN 'restored'
      WHEN p_action = 'archive' THEN 'archived'
      ELSE 'unpublished'
    END,
    v_reason
  );

  PERFORM public.record_audit (
    'assignment_' || p_action,
    'assignment',
    p_assignment_id,
    v_assignment.class_id,
    '{}'::jsonb
  );

  PERFORM public.enqueue_notification_event (
    v_assignment.user_id,
    'moderation_required',
    'assignment_moderation:' || p_assignment_id || ':' || v_status || ':' || extract(epoch FROM now()),
    jsonb_build_object(
      'title',
      'Assignment visibility changed',
      'body',
      'A moderator changed the visibility of your assignment.',
      'url',
      '/my-assignments'
    )
  );

  RETURN v_status;
END;
$$;


REVOKE ALL ON FUNCTION public.moderate_assignment (uuid, text, text)
FROM
  public,
  anon;


GRANT
EXECUTE ON FUNCTION public.moderate_assignment (uuid, text, text) TO authenticated;


-- ---------------------------------------------------------------------------
-- 8. M-04: allow non-admin author resubmit/re-review when editing published public assignment
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prevent_assignment_status_escalation () RETURNS trigger LANGUAGE plpgsql
SET
  search_path = '' AS $$
DECLARE
  v_touches_review boolean;
  v_is_resubmit boolean;
BEGIN
  IF current_user = 'authenticated' THEN
    v_touches_review := new.status IS DISTINCT FROM old.status
    OR new.rejection_reason IS DISTINCT FROM old.rejection_reason
    OR new.reviewed_by IS DISTINCT FROM old.reviewed_by
    OR new.reviewed_at IS DISTINCT FROM old.reviewed_at;

    v_is_resubmit := new.class_id IS NULL
    AND new.status = 'pending'
    AND new.rejection_reason IS NULL
    AND new.reviewed_by IS NULL
    AND new.reviewed_at IS NULL
    AND old.status IN ('pending', 'rejected', 'published');

    IF v_touches_review
    AND NOT v_is_resubmit THEN
      RAISE EXCEPTION 'only a platform admin can change an assignment decision'
      USING errcode = '42501';
    END IF;
  END IF;

  RETURN new;
END;
$$;

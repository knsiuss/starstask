-- Attendance auto-cutoff and grading weight/score validation.
-- 1. Course grade weights configuration table (Absensi + Tugas + UTS + UAS = 100).
CREATE TABLE IF NOT EXISTS public.course_grade_weights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.classes (id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES public.class_subjects (id) ON DELETE CASCADE,
  absensi_weight numeric(5, 2) NOT NULL DEFAULT 10,
  tugas_weight numeric(5, 2) NOT NULL DEFAULT 20,
  uts_weight numeric(5, 2) NOT NULL DEFAULT 30,
  uas_weight numeric(5, 2) NOT NULL DEFAULT 40,
  updated_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT course_grade_weights_range CHECK (
    absensi_weight >= 0
    AND absensi_weight <= 100
    AND tugas_weight >= 0
    AND tugas_weight <= 100
    AND uts_weight >= 0
    AND uts_weight <= 100
    AND uas_weight >= 0
    AND uas_weight <= 100
  ),
  CONSTRAINT course_grade_weights_sum_100 CHECK (
    absensi_weight + tugas_weight + uts_weight + uas_weight = 100
  ),
  CONSTRAINT course_grade_weights_unique UNIQUE (class_id, subject_id)
);


CREATE INDEX IF NOT EXISTS course_grade_weights_course_idx ON public.course_grade_weights (class_id, subject_id);


COMMENT ON TABLE public.course_grade_weights IS 'Per-course grading component weights (Absensi, Tugas, UTS, UAS) summing to 100%.';


DROP TRIGGER IF EXISTS course_grade_weights_set_updated_at ON public.course_grade_weights;


CREATE TRIGGER course_grade_weights_set_updated_at
BEFORE UPDATE ON public.course_grade_weights FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at ();


ALTER TABLE public.course_grade_weights ENABLE ROW LEVEL SECURITY;


REVOKE ALL ON public.course_grade_weights
FROM
  anon,
  authenticated;


GRANT
SELECT
  ON public.course_grade_weights TO authenticated;


DROP POLICY IF EXISTS course_grade_weights_member_read ON public.course_grade_weights;


CREATE POLICY course_grade_weights_member_read ON public.course_grade_weights FOR
SELECT
  TO authenticated USING (
    EXISTS (
      SELECT
        1
      FROM
        public.class_members m
      WHERE
        m.class_id = course_grade_weights.class_id
        AND m.user_id = (
          SELECT
            auth.uid ()
        )
    )
  );


-- 2. Pure SQL helper to validate score bounds (0..100) and weight sum (= 100).
CREATE OR REPLACE FUNCTION public.compute_weighted_course_grade (
  p_absensi numeric,
  p_tugas numeric,
  p_uts numeric,
  p_uas numeric,
  p_w_absensi numeric DEFAULT 10,
  p_w_tugas numeric DEFAULT 20,
  p_w_uts numeric DEFAULT 30,
  p_w_uas numeric DEFAULT 40
) RETURNS numeric LANGUAGE plpgsql IMMUTABLE
SET
  search_path = '' AS $$
DECLARE
  v_weight_sum numeric;
BEGIN
  IF p_absensi IS NULL OR p_absensi < 0 OR p_absensi > 100
     OR p_tugas IS NULL OR p_tugas < 0 OR p_tugas > 100
     OR p_uts IS NULL OR p_uts < 0 OR p_uts > 100
     OR p_uas IS NULL OR p_uas < 0 OR p_uas > 100 THEN
    RAISE EXCEPTION 'all grade scores must be between 0 and 100' USING ERRCODE = '22023';
  END IF;

  IF p_w_absensi IS NULL OR p_w_absensi < 0 OR p_w_absensi > 100
     OR p_w_tugas IS NULL OR p_w_tugas < 0 OR p_w_tugas > 100
     OR p_w_uts IS NULL OR p_w_uts < 0 OR p_w_uts > 100
     OR p_w_uas IS NULL OR p_w_uas < 0 OR p_w_uas > 100 THEN
    RAISE EXCEPTION 'all grade weights must be between 0 and 100' USING ERRCODE = '22023';
  END IF;

  v_weight_sum := p_w_absensi + p_w_tugas + p_w_uts + p_w_uas;

  IF v_weight_sum <> 100 THEN
    RAISE EXCEPTION 'grade weights must sum to 100, got %', v_weight_sum USING ERRCODE = '22023';
  END IF;

  RETURN round(
    (
      (p_absensi * p_w_absensi)
      + (p_tugas * p_w_tugas)
      + (p_uts * p_w_uts)
      + (p_uas * p_w_uas)
    ) / 100,
    2
  );
END;
$$;


-- 3. Idempotent auto-cutoff for expired attendance_meetings.
-- Marks unrecorded active-enrollment students as 'absent' once scheduled_at + cutoff
-- has passed, unless the student has an approved or forwarded leave_requests entry
-- covering the meeting date.
CREATE OR REPLACE FUNCTION public.auto_cutoff_expired_attendance_meetings (p_cutoff_minutes integer DEFAULT 15) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER
SET
  search_path = '' AS $$
DECLARE
  v_cutoff_minutes integer := GREATEST(COALESCE(p_cutoff_minutes, 15), 0);
  v_inserted_count integer := 0;
BEGIN
  WITH expired_meetings AS (
    SELECT
      am.id,
      am.university_id,
      am.offering_id,
      am.scheduled_at,
      am.created_by,
      co.class_id
    FROM
      public.attendance_meetings am
      JOIN public.course_offerings co
        ON co.id = am.offering_id
       AND co.university_id = am.university_id
    WHERE
      am.status IN ('scheduled', 'open')
      AND am.scheduled_at + make_interval(mins => v_cutoff_minutes) <= now()
  ),
  inserted_records AS (
    INSERT INTO public.attendance_records (
      university_id,
      meeting_id,
      student_identity_id,
      status,
      recorded_by,
      note
    )
    SELECT
      em.university_id,
      em.id,
      e.student_identity_id,
      'absent',
      em.created_by,
      'Auto-cutoff: no attendance recorded before deadline.'
    FROM
      expired_meetings em
      JOIN public.enrollments e
        ON e.offering_id = em.offering_id
       AND e.university_id = em.university_id
       AND e.status = 'active'
      JOIN public.student_identities si
        ON si.id = e.student_identity_id
       AND si.university_id = e.university_id
      JOIN public.university_memberships um
        ON um.id = si.university_membership_id
       AND um.university_id = si.university_id
    WHERE
      NOT EXISTS (
        SELECT
          1
        FROM
          public.attendance_records ar
        WHERE
          ar.meeting_id = em.id
          AND ar.student_identity_id = e.student_identity_id
      )
      AND NOT EXISTS (
        SELECT
          1
        FROM
          public.leave_requests lr
        WHERE
          lr.student_id = um.user_id
          AND lr.class_id = em.class_id
          AND lr.status IN ('approved', 'forwarded')
          AND lr.leave_start_date IS NOT NULL
          AND lr.leave_end_date IS NOT NULL
          AND (em.scheduled_at AT TIME ZONE 'Asia/Jakarta')::date
              BETWEEN lr.leave_start_date AND lr.leave_end_date
      )
    ON CONFLICT (meeting_id, student_identity_id) DO NOTHING
    RETURNING 1
  ),
  closed_meetings AS (
    UPDATE public.attendance_meetings am
    SET
      status = 'closed'
    FROM
      expired_meetings em
    WHERE
      am.id = em.id
      AND am.status IN ('scheduled', 'open')
    RETURNING 1
  )
  SELECT
    count(*)::integer
  INTO
    v_inserted_count
  FROM
    inserted_records;

  RETURN COALESCE(v_inserted_count, 0);
END;
$$;


REVOKE ALL ON FUNCTION public.auto_cutoff_expired_attendance_meetings (integer)
FROM
  PUBLIC,
  anon,
  authenticated;


GRANT
EXECUTE ON FUNCTION public.auto_cutoff_expired_attendance_meetings (integer) TO service_role;


COMMENT ON FUNCTION public.auto_cutoff_expired_attendance_meetings (integer) IS 'Idempotently closes expired attendance_meetings and marks unrecorded students absent unless covered by an approved or forwarded leave_requests entry.';

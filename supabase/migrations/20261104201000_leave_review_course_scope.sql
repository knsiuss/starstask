-- Scopes review_leave_request's attendance side effect to the covered courses,
-- and records previous/next status in the history.
--
-- Previously approval excused every session of the class whose date fell in
-- the absence window, while the request covers only the courses the student
-- selected (leave_requests.subject_ids). The two disagreed: a student absent
-- for one course could be excused in another. This replaces the function from
-- 20261104120000_leave_revision_flow with the identical decision logic and
-- the course predicate added to both attendance writes — the same predicate
-- used by record_leave_lecturer_outcome in 20261104200000_lecturer_outcomes.
CREATE OR REPLACE FUNCTION public.review_leave_request (
  p_request_id uuid,
  p_decision text,
  p_note text DEFAULT NULL
) returns text language plpgsql security definer
SET
  search_path = public,
  pg_temp AS $$
DECLARE
  v_user_id uuid := auth.uid ();
  v_request public.leave_requests;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_admin_name text;
  v_class_slug text;
  v_updated integer := 0;
  v_inserted integer := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'authentication required'
    USING ERRCODE = '42501';
  END IF;

  IF p_decision NOT IN ('approved', 'rejected', 'revision_requested') THEN
    RAISE EXCEPTION 'Unknown review decision'
    USING ERRCODE = '22023';
  END IF;

  IF v_note IS NOT NULL AND char_length(v_note) > 2000 THEN
    RAISE EXCEPTION 'the review note is too long'
    USING ERRCODE = '22023';
  END IF;

  -- Rejection and revision must tell the student what to do.
  IF p_decision IN ('rejected', 'revision_requested')
     AND (v_note IS NULL OR char_length(v_note) < 3) THEN
    RAISE EXCEPTION 'a rejection or revision note of at least 3 characters is required'
    USING ERRCODE = '22023';
  END IF;

  SELECT
    * INTO v_request
  FROM
    public.leave_requests r
  WHERE
    r.id = p_request_id
  FOR
    UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'absence request not found'
    USING ERRCODE = 'P0002';
  END IF;

  IF NOT public.can_manage_class (v_request.class_id) THEN
    RAISE EXCEPTION 'Not allowed to review this absence request'
    USING ERRCODE = '42501';
  END IF;

  -- A class admin may also be a student in the class. Deciding one's own
  -- absence is a conflict of interest, so another manager must review it.
  IF v_request.student_id = v_user_id THEN
    RAISE EXCEPTION 'You cannot review your own absence request'
    USING ERRCODE = '42501';
  END IF;

  -- Only a submitted request is awaiting a decision. Everything else is either
  -- unfinished, already decided, or withdrawn.
  IF v_request.status <> 'submitted' THEN
    RAISE EXCEPTION 'this absence request is no longer awaiting review'
    USING ERRCODE = 'SS012';
  END IF;

  UPDATE public.leave_requests
  SET
    status = p_decision
  WHERE
    id = p_request_id
    AND status = 'submitted';

  INSERT INTO public.leave_request_history (
    request_id, actor_id, action, note, previous_status, next_status
  )
  VALUES (p_request_id, v_user_id, p_decision, v_note, 'submitted', p_decision);

  -- Approval marks the matching sessions excused. Existing present or late rows
  -- are real evidence of attendance and are deliberately left untouched.
  -- A revision request never changes attendance.
  IF p_decision = 'approved' AND v_request.leave_start_date IS NOT NULL AND v_request.leave_end_date IS NOT NULL THEN
    UPDATE public.discussion_session_checkins c
    SET
      status = 'excused',
      method = 'manual',
      reviewed_by = v_user_id,
      reviewed_at = now(),
      updated_at = now(),
      note = coalesce(c.note, 'Excused after an approved absence request.')
    FROM
      public.discussion_sessions s
      JOIN public.class_members m ON m.class_id = s.class_id
      AND m.user_id = v_request.student_id
      AND m.joined_at <= s.starts_at
    WHERE
      c.session_id = s.id
      AND c.user_id = v_request.student_id
      AND s.class_id = v_request.class_id
      AND s.status <> 'cancelled'
      AND (s.starts_at AT TIME ZONE 'Asia/Jakarta')::date BETWEEN v_request.leave_start_date
      AND v_request.leave_end_date
      AND (cardinality (coalesce (v_request.subject_ids, '{}')) = 0
        OR s.subject_id = ANY (v_request.subject_ids))
      AND c.status IN ('absent', 'excused');

    GET DIAGNOSTICS v_updated = ROW_COUNT;

    -- Sessions the student had not been marked for yet get an excused row, so a
    -- finished session cannot end up as an unrecorded miss after approval.
    INSERT INTO public.discussion_session_checkins (
      session_id,
      user_id,
      status,
      method,
      note,
      reviewed_by,
      reviewed_at
    )
    SELECT
      s.id,
      v_request.student_id,
      'excused',
      'manual',
      'Excused after an approved absence request.',
      v_user_id,
      now()
    FROM
      public.discussion_sessions s
      JOIN public.class_members m ON m.class_id = s.class_id
      AND m.user_id = v_request.student_id
      AND m.joined_at <= s.starts_at
    WHERE
      s.class_id = v_request.class_id
      AND s.status <> 'cancelled'
      AND (s.starts_at AT TIME ZONE 'Asia/Jakarta')::date BETWEEN v_request.leave_start_date
      AND v_request.leave_end_date
      AND (cardinality (coalesce (v_request.subject_ids, '{}')) = 0
        OR s.subject_id = ANY (v_request.subject_ids))
    ON CONFLICT (session_id, user_id) DO NOTHING;

    GET DIAGNOSTICS v_inserted = ROW_COUNT;
  END IF;

  PERFORM public.record_audit (
    'leave_request_' || p_decision,
    'leave_request',
    p_request_id,
    v_request.class_id,
    jsonb_build_object(
      'decision', p_decision,
      'sessions_updated', v_updated,
      'sessions_created', v_inserted
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

  v_admin_name := coalesce(
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

  PERFORM public.enqueue_notification_event(
    v_request.student_id,
    'leave_request_' || p_decision,
    'leave_request_' || p_decision || ':' || p_request_id || ':' || v_request.student_id || ':' || to_char(now(), 'YYYYMMDDHH24MISS'),
    jsonb_build_object(
      'title',
      CASE p_decision
        WHEN 'approved' THEN 'Absence approved'
        WHEN 'rejected' THEN 'Absence rejected'
        ELSE 'Absence revision requested'
      END,
      'body',
      v_admin_name || CASE p_decision
        WHEN 'approved' THEN ' approved your absence request.'
        WHEN 'rejected' THEN ' rejected your absence request. Open StarsTask for details.'
        ELSE ' returned your absence request for correction. Open StarsTask to edit and resubmit.'
      END,
      'url',
      '/leave-requests/' || p_request_id::text
    )
  );

  RETURN p_decision;
END;
$$;


COMMENT ON FUNCTION public.review_leave_request (uuid, text, text) IS 'Approves, rejects, or returns a submitted absence for revision. Class managers only. Approval marks matching sessions as excused and never as present, scoped to the covered courses; revision changes no attendance.';

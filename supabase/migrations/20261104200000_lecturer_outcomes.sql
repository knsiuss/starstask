-- Lecturer outcomes and audit trail improvements for leave requests.
--
-- A forwarded request is not an approval. The class admin records the
-- lecturer's decision after confirming it outside StarsTask: forwarded ->
-- approved also marks the covered sessions excused (never present), the same
-- authorship rules as review_leave_request. An "awaiting" outcome records the
-- note but changes no status, so a request is never excused merely for having
-- been forwarded.
--
-- This migration also adds previous/next status columns to the append-only
-- history (historical rows stay NULL) and scopes the existing review
-- function's attendance side effect to the courses the request covers.

-- ---------------------------------------------------------------------------
-- leave_lecturer_outcomes
-- ---------------------------------------------------------------------------
-- One row per recorded lecturer decision; a request may accumulate several
-- ("awaiting" notes followed by a final decision). The status on
-- leave_requests stays the source of truth; this table is evidentiary.
CREATE TABLE IF NOT EXISTS public.leave_lecturer_outcomes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.leave_requests (id) ON DELETE CASCADE,
  outcome text NOT NULL CHECK (outcome IN ('approved', 'rejected', 'awaiting')),
  recorded_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE SET NULL,
  note text CHECK (note IS NULL OR char_length (btrim(note)) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);


CREATE INDEX IF NOT EXISTS leave_lecturer_outcomes_request_idx
  ON public.leave_lecturer_outcomes (request_id, created_at);


ALTER TABLE public.leave_lecturer_outcomes ENABLE ROW LEVEL SECURITY;


DROP POLICY IF EXISTS leave_lecturer_outcomes_select ON public.leave_lecturer_outcomes;

CREATE POLICY leave_lecturer_outcomes_select ON public.leave_lecturer_outcomes FOR
SELECT
  TO authenticated USING (public.can_view_leave_request (request_id));

-- No INSERT/UPDATE/DELETE grants: recording goes through the function below.

-- ---------------------------------------------------------------------------
-- History: previous/next status (audit trail)
-- ---------------------------------------------------------------------------
ALTER TABLE public.leave_request_history
  ADD COLUMN IF NOT EXISTS previous_status text,
  ADD COLUMN IF NOT EXISTS next_status text;

-- ---------------------------------------------------------------------------
-- record_leave_lecturer_outcome
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_leave_lecturer_outcome (
  p_request_id uuid,
  p_outcome text,
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

  IF p_outcome NOT IN ('approved', 'rejected', 'awaiting') THEN
    RAISE EXCEPTION 'Unknown lecturer outcome'
    USING ERRCODE = '22023';
  END IF;

  IF v_note IS NOT NULL AND char_length(v_note) > 2000 THEN
    RAISE EXCEPTION 'the outcome note is too long'
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
    RAISE EXCEPTION 'Not allowed to record a lecturer outcome for this request'
    USING ERRCODE = '42501';
  END IF;

  -- The same conflict of interest applies after forwarding: a class admin
  -- must not settle their own absence, however it is recorded.
  IF v_request.student_id = v_user_id THEN
    RAISE EXCEPTION 'You cannot record an outcome for your own absence request'
    USING ERRCODE = '42501';
  END IF;

  -- Only a forwarded request is with the lecturer. Recording any outcome
  -- against another status would invent a decision that never happened.
  IF v_request.status <> 'forwarded' THEN
    RAISE EXCEPTION 'this absence request is not waiting on a lecturer decision'
    USING ERRCODE = 'SS012';
  END IF;

  -- Recording the decision is the audit trail: what the lecturer decided,
  -- who recorded it, when, and any note from the external confirmation.
  INSERT INTO public.leave_lecturer_outcomes (request_id, outcome, recorded_by, note)
  VALUES (p_request_id, p_outcome, v_user_id, v_note);

  IF p_outcome = 'awaiting' THEN
    INSERT INTO public.leave_request_history (
      request_id, actor_id, action, note, previous_status, next_status
    )
    VALUES (p_request_id, v_user_id, 'awaiting', v_note, 'forwarded', 'forwarded');
  ELSE
    UPDATE public.leave_requests
    SET
      status = p_outcome
    WHERE
      id = p_request_id
      AND status = 'forwarded';

    INSERT INTO public.leave_request_history (
      request_id, actor_id, action, note, previous_status, next_status
    )
    VALUES (p_request_id, v_user_id, p_outcome, v_note, 'forwarded', p_outcome);

    -- A lecturer approval carries the same attendance consequence as a class
    -- admin approval: covered sessions become excused, never present, and
    -- only within the courses the request covers. Anything else (rejected,
    -- awaiting) never touches attendance.
    IF p_outcome = 'approved'
      AND v_request.leave_start_date IS NOT NULL
      AND v_request.leave_end_date IS NOT NULL THEN
      UPDATE public.discussion_session_checkins c
      SET
        status = 'excused',
        method = 'manual',
        reviewed_by = v_user_id,
        reviewed_at = now(),
        updated_at = now(),
        note = coalesce(c.note, 'Excused after the lecturer approved the absence request.')
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
        'Excused after the lecturer approved the absence request.',
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
  END IF;

  PERFORM public.record_audit (
    'leave_request_lecturer_' || p_outcome,
    'leave_request',
    p_request_id,
    v_request.class_id,
    jsonb_build_object(
      'outcome', p_outcome,
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
    'leave_request_lecturer_' || p_outcome,
    'leave_request_lecturer_' || p_outcome || ':' || p_request_id || ':' || v_request.student_id || ':' || to_char(now(), 'YYYYMMDDHH24MISS'),
    jsonb_build_object(
      'title',
      CASE p_outcome
        WHEN 'approved' THEN 'Lecturer approved your absence'
        WHEN 'rejected' THEN 'Lecturer rejected your absence'
        ELSE 'Absence still waiting on the lecturer'
      END,
      'body',
      CASE p_outcome
        WHEN 'approved' THEN v_admin_name || ' recorded that your lecturer approved your absence. The covered sessions are now excused.'
        WHEN 'rejected' THEN v_admin_name || ' recorded that your lecturer rejected your absence. Open StarsTask for details.'
        ELSE 'Your forwarded absence is still waiting for the lecturer''s decision. Forwarded does not mean approved.'
      END,
      'url',
      '/leave-requests/' || p_request_id::text
    )
  );

  RETURN p_outcome;
END;
$$;


REVOKE ALL ON FUNCTION public.record_leave_lecturer_outcome (uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_leave_lecturer_outcome (uuid, text, text) TO authenticated;


COMMENT ON FUNCTION public.record_leave_lecturer_outcome (uuid, text, text) IS 'Records the lecturer decision for a forwarded absence, confirmed outside StarsTask. Approved also excuses covered sessions; awaiting changes nothing. Class managers only.';

-- Proactive lecturer alerts: at-risk attendance + below-target teaching pace.
--
-- Once per cron run, enqueue an in-app + push notification per administering
-- lecturer when:
--   1. A supervised student's attendance percentage for an opened subject
--      falls below 75% (same shape as buildAttendanceRecap: opened meetings
--      only, attended = present + late, denominator = attended + absent +
--      not_recorded across opened meetings, eligible = joined_at <= starts_at).
--   2. A course offering administered by the lecturer is below its target
--      pace (meetings held < target).
--
-- JS `buildAttendanceRecap` remains the source of truth for display. This SQL
-- is a best-effort early-warning heuristic; policy drift is acceptable for the
-- alert but is documented here:
--   * Only opened meetings count. non-eligible members (joined_at > starts_at)
--     are excluded entirely, mirroring recap.ts.
--   * attended = present + late; denominator = attended + absent +
--     not_recorded; excused and sick leave the denominator out, mirroring
--     summarizeAttendanceCounts. A not_recorded meeting counts in the
--     denominator whether or not its attendance_finalized_at is 24h old; the
--     >24h rule in recap.ts only relabels NR as absent and cannot change the
--     percentage, so it is intentionally not re-implemented here.
--   * Late joiners are not eligible for a meeting; they never reach the
--     denominator.
--   * The alert compares attended/eligible < 0.75 with integer arithmetic and
--     never reports the percentage; the JS recap remains authoritative for
--     display.
--
-- Payloads are sanitized by the same SECURITY DEFINER sanitization path used
-- by other triggers: {title, body, url} only, no student names/NIMs, internal
-- path. Dedupe is per ISO week per administering class admin
-- ('attendance_at_risk:{class_id}:{subject_id}:{admin_user_id}:{iso_week}',
-- 'teaching_behind_pace:{offering_id}:{admin_user_id}:{iso_week}'). The
-- `notification_events_dedupe_key UNIQUE` index alone cannot express "one per
-- subject per admin" unless the admin is part of the key; including it keeps
-- the migration aligned with the "one per course per week per lecturer" rule
-- and avoids silently dropping every admin after the first. The brief's
-- example dedupe key omitted the admin; this is a deliberate deviation.
--
-- This migration is NOT applied automatically; the owner applies it. The
-- web cron route /api/cron/lecturer-proactive calls the RPC below.
-- ---------------------------------------------------------------------------
-- Recreate the notification_events kind CHECK constraint with the current
-- union from 20270117000000_student_class_self_service_ketua.sql (the latest
-- restatement), plus 'attendance_at_risk' and 'teaching_behind_pace'. Dropping
-- and re-adding the constraint keeps the migration idempotent.
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
    'class_ketua_recalled',
    'attendance_at_risk',
    'teaching_behind_pace'
  )
);


COMMENT ON TABLE public.notification_events IS 'Point-in-time push events. No tokens, emails, or moderation notes are stored in payload.';


-- ---------------------------------------------------------------------------
-- Lecturer proactive alerts
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enqueue_lecturer_proactive_alerts (p_now timestamptz DEFAULT now()) returns jsonb language plpgsql security definer
SET
  search_path = public,
  pg_temp AS $$
DECLARE
  v_now timestamptz := coalesce(p_now, now());
  v_iso_week text := to_char(v_now at time zone 'Asia/Jakarta', 'IYYY-"W"IW');
  v_at_risk integer := 0;
  v_behind_pace integer := 0;
  r record;
BEGIN
  -- 1) At-risk attendance alerts.
  --    A subject is "affected" when at least one eligible student has a
  --    percentage below 75. One notification per administering class admin,
  --    per ISO week, per (class, subject).
  FOR r IN
    WITH opened AS (
      SELECT
        s.id AS session_id,
        s.class_id,
        s.subject_id,
        s.starts_at,
        s.attendance_finalized_at
      FROM
        public.discussion_sessions s
      WHERE
        s.meeting_number IS NOT NULL
        AND s.subject_id IS NOT NULL
        AND s.attendance_opened_at IS NOT NULL
        AND s.status <> 'cancelled'
    ), cells AS (
      SELECT
        o.class_id,
        o.subject_id,
        m.user_id,
        o.session_id,
        coalesce(
          c.status,
          CASE
            WHEN o.attendance_finalized_at IS NOT NULL THEN 'absent'
            ELSE 'not_recorded'
          END
        ) AS effective_status,
        m.joined_at <= o.starts_at AS eligible
      FROM
        opened o
        JOIN public.class_members m ON m.class_id = o.class_id
        LEFT JOIN public.discussion_session_checkins c ON c.session_id = o.session_id
                                                     AND c.user_id = m.user_id
      WHERE
        -- Retake (mengulang) students scoped to a selected subject are excluded
        -- from every other subject's attendance, mirroring the JS roster filter
        -- used by the display path.
        (
          m.course_scope = 'all'
          OR EXISTS (
            SELECT
              1
            FROM
              public.class_member_courses cmc
            WHERE
              cmc.class_id = m.class_id
              AND cmc.user_id = m.user_id
              AND cmc.subject_id = o.subject_id
          )
        )
    ), per_student AS (
      SELECT
        cells.class_id,
        cells.subject_id,
        cells.user_id,
        count(*) FILTER (
          WHERE
            cells.eligible
            AND cells.effective_status IN ('present', 'late', 'absent', 'not_recorded')
        ) AS eligible_meetings,
        count(*) FILTER (
          WHERE
            cells.eligible
            AND cells.effective_status IN ('present', 'late')
        ) AS attended_meetings
      FROM
        cells
      GROUP BY
        cells.class_id,
        cells.subject_id,
        cells.user_id
    ), scored AS (
      SELECT
        per_student.class_id,
        per_student.subject_id,
        per_student.user_id,
        per_student.eligible_meetings,
        per_student.attended_meetings
      FROM
        per_student
      WHERE
        per_student.eligible_meetings > 0
    ), affected AS (
      SELECT
        scored.class_id,
        scored.subject_id,
        count(*) FILTER (WHERE scored.eligible_meetings > 0 AND (scored.attended_meetings * 1000 / scored.eligible_meetings) < 750) AS at_risk_count
      FROM
        scored
      GROUP BY
        scored.class_id,
        scored.subject_id
    )
    SELECT
      a.class_id,
      a.subject_id,
      a.at_risk_count,
      cls.slug,
      subj.name AS subject_name
    FROM
      affected a
      JOIN public.classes cls ON cls.id = a.class_id
      JOIN public.class_subjects subj ON subj.id = a.subject_id
    WHERE
      a.at_risk_count > 0
      AND cls.status = 'active'
      AND subj.status = 'active'
  LOOP
    PERFORM public.enqueue_notification_event(
      admin.user_id,
      'attendance_at_risk',
      'attendance_at_risk:' || r.class_id::text || ':' || r.subject_id::text || ':' || admin.user_id::text || ':' || v_iso_week,
      jsonb_build_object(
        'title', 'Attendance at risk',
        'body', r.at_risk_count || ' student' || CASE WHEN r.at_risk_count = 1 THEN '' ELSE 's' END || ' in ' || r.subject_name || ' under 75% attendance',
        'url', '/classes/' || r.slug || '/attendance'
      )
    )
    FROM
      public.class_admins admin
    WHERE
      admin.class_id = r.class_id;

    v_at_risk := v_at_risk + 1;
  END LOOP;

  -- 2) Below-target pace alerts.
  --    Meetings held = attendance_meetings in ('open', 'closed'); target comes
  --    from the contracts constants (default 14, clamp 14..16) and, if any
  --    meeting pins a different target in attendance_meetings.target_meetings,
  --    the maximum observed target wins. One notification per offering per
  --    administering class admin, per ISO week. Draft offerings are skipped:
  --    a course that never opened should not nag its admins every week; a
  --    closed offering (semester over) is likewise skipped.
  FOR r IN
    WITH held AS (
      SELECT
        co.id AS offering_id,
        co.class_id,
        count(am.id) FILTER (
          WHERE
            am.status IN ('open', 'closed')
        )::integer AS meetings_held,
        coalesce(max(am.target_meetings), 14)::integer AS configured_target
      FROM
        public.course_offerings co
        LEFT JOIN public.attendance_meetings am ON am.offering_id = co.id
      WHERE
        co.status = 'open'
      GROUP BY
        co.id,
        co.class_id
    ), paced AS (
      SELECT
        held.offering_id,
        held.class_id,
        held.meetings_held,
        least(16, greatest(14, held.configured_target)) AS target_meetings
      FROM
        held
    )
    SELECT
      paced.offering_id,
      paced.class_id,
      paced.meetings_held,
      paced.target_meetings,
      cls.slug,
      cls.course_name AS course_name
    FROM
      paced
      JOIN public.classes cls ON cls.id = paced.class_id
    WHERE
      paced.meetings_held < paced.target_meetings
      AND cls.status = 'active'
  LOOP
    PERFORM public.enqueue_notification_event(
      admin.user_id,
      'teaching_behind_pace',
      'teaching_behind_pace:' || r.offering_id::text || ':' || admin.user_id::text || ':' || v_iso_week,
      jsonb_build_object(
        'title', 'Below target pace',
        'body', r.course_name || ' is below target pace (' || r.meetings_held || '/' || r.target_meetings || ' meetings)',
        'url', '/classes/' || r.slug || '/attendance'
      )
    )
    FROM
      public.class_admins admin
    WHERE
      admin.class_id = r.class_id;

    v_behind_pace := v_behind_pace + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'at_risk_subjects', v_at_risk,
    'behind_pace_offerings', v_behind_pace
  );
END;
$$;


COMMENT ON function public.enqueue_lecturer_proactive_alerts (timestamptz) IS 'Enqueues one at-risk and behind-pace notification per administering class admin per subject/offering per ISO week. Best-effort heuristic; buildAttendanceRecap remains the display source of truth. Service role only.';


REVOKE ALL ON function public.enqueue_lecturer_proactive_alerts (timestamptz)
FROM
  public,
  anon,
  authenticated;


GRANT
EXECUTE ON function public.enqueue_lecturer_proactive_alerts (timestamptz) TO service_role;

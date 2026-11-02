-- Tell a reporter when their assignment report is resolved or dismissed.
--
-- Previously the reporter heard nothing: the report left the admin queue and
-- the outcome was only visible in the admin console. The event carries no
-- moderation note, only the outcome and a link to the assignment.
ALTER TABLE public.notification_events
DROP CONSTRAINT if EXISTS notification_events_kind_allowed;


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
    'leave_request_cancelled',
    'verification_submitted',
    'verification_approved',
    'verification_rejected',
    'verification_revision_requested',
    'class_admin_revoked',
    'class_assignment_published',
    'assignment_report_reviewed'
  )
);


CREATE OR REPLACE FUNCTION public.review_assignment_report (p_report_id uuid, p_status text, p_note text DEFAULT NULL) returns void language plpgsql security definer
SET
  search_path = public,
  pg_temp AS $$
declare
  v_class_id uuid;
  v_assignment_id uuid;
  v_report_status text;
  v_reporter_id uuid;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if p_status not in ('resolved', 'dismissed') then
    raise exception 'Unknown report status' using errcode = '22023';
  end if;

  if v_note is not null and char_length(v_note) < 5 then
    raise exception 'Add a short resolution note' using errcode = '22023';
  end if;

  select
    r.class_id,
    r.assignment_id,
    r.status,
    r.reporter_id into v_class_id,
    v_assignment_id,
    v_report_status,
    v_reporter_id
  from
    public.assignment_reports r
  where
    r.id = p_report_id;

  if not found then
    raise exception 'Report not found' using errcode = 'P0002';
  end if;

  if v_report_status <> 'open' then
    raise exception 'Report already reviewed' using errcode = '22023';
  end if;

  if not public.can_manage_class (v_class_id) then
    raise exception 'Not allowed to review this report' using errcode = '42501';
  end if;

  update public.assignment_reports
  set
    status = p_status,
    resolved_by = auth.uid (),
    resolved_at = now(),
    resolution_note = v_note,
    updated_at = now()
  where
    id = p_report_id
    and status = 'open';

  perform public.record_audit (
    'assignment_report_' || p_status,
    'assignment_report',
    p_report_id,
    v_class_id,
    jsonb_build_object('assignment_id', v_assignment_id)
  );

  -- The note stays out of the payload: it may contain moderation context the
  -- reporter does not need, and payloads are readable by the recipient.
  perform public.enqueue_notification_event(
    v_reporter_id,
    'assignment_report_reviewed',
    'assignment_report:' || p_report_id || ':' || p_status,
    jsonb_build_object(
      'title',
      case
        when p_status = 'resolved' then 'Report resolved'
        else 'Report dismissed'
      end,
      'body',
      case
        when p_status = 'resolved' then 'A platform admin reviewed your report and resolved it.'
        else 'A platform admin reviewed your report and found no action was needed.'
      end,
      'url',
      '/assignments/' || v_assignment_id
    )
  );
end;
$$;


COMMENT ON FUNCTION public.review_assignment_report (uuid, text, text) IS 'Resolves or dismisses one open report and notifies the reporter. Platform-admin path only.';

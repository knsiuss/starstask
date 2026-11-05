-- Assignment created notification: in-app + Web Push (Chrome).
-- New kind assignment_created, trigger on published class assignments.
-- Recipients: class members (except author). Dedupe per user+assignment.
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
    'assignment_created'
  )
);


CREATE OR REPLACE FUNCTION public.notify_assignment_created () RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET
  search_path = '' AS $$
DECLARE v_class_name text;
BEGIN
  IF NEW.status <> 'published' OR NEW.class_id IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'published' THEN RETURN NEW; END IF;
  SELECT name INTO v_class_name FROM public.classes WHERE id = NEW.class_id;
  INSERT INTO public.notification_events (user_id, kind, dedupe_key, payload)
  SELECT m.user_id, 'assignment_created',
         'assignment_created:' || NEW.id || ':' || m.user_id,
         jsonb_build_object(
           'title', 'Assignment baru: ' || NEW.title,
           'body', COALESCE(v_class_name, 'Kelas kamu') || ' • Deadline ' || COALESCE(NEW.deadline::text, '-'),
           'url', '/assignments/' || NEW.id
         )
  FROM public.class_members m
  WHERE m.class_id = NEW.class_id AND m.user_id <> NEW.user_id
  ON CONFLICT (dedupe_key) DO NOTHING;
  RETURN NEW;
END; $$;


REVOKE ALL ON FUNCTION public.notify_assignment_created ()
FROM
  public,
  anon,
  authenticated;


DROP TRIGGER IF EXISTS assignments_notify_created ON public.assignments;


CREATE TRIGGER assignments_notify_created
AFTER INSERT OR UPDATE OF status ON public.assignments FOR EACH ROW
EXECUTE FUNCTION public.notify_assignment_created ();


COMMENT ON FUNCTION public.notify_assignment_created () IS 'Fires in-app + Web Push notification to class members when a class assignment is published.';

-- DM notifications were silently failing: dm-notifications.ts inserted
-- columns (type, title, body, data) that do not exist on
-- notification_events, and the kind check does not allow 'dm_message'.
-- Recreate the kind check with the current production list plus
-- 'dm_message'. Payloads stay sanitized JSON (title/body/url); the DM
-- body never contains plaintext.
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
    'dm_message'
  )
);

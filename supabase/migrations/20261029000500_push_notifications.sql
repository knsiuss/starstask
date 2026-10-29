-- Web Push notification schema.
--
-- Four tables:
--   push_subscriptions     one row per browser/device push endpoint
--   notification_preferences  one row per user (opt-in + reminder windows)
--   saved_assignments      assignments a user explicitly follows
--   notification_deliveries    durable reminder ledger (dedupe + retry state)
--
-- The delivery ledger is what makes reminders idempotent: the unique key
-- (user_id, assignment_id, reminder_type, deadline_at) means a changed deadline
-- produces a new logical reminder while repeated scheduler runs cannot.
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  device_label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_success_at timestamptz,
  disabled_at timestamptz,
  CONSTRAINT push_subscriptions_endpoint_key UNIQUE (endpoint),
  CONSTRAINT push_subscriptions_endpoint_https CHECK (endpoint LIKE 'https://%'),
  CONSTRAINT push_subscriptions_endpoint_length CHECK (char_length(endpoint) BETWEEN 12 AND 2048),
  CONSTRAINT push_subscriptions_p256dh_length CHECK (char_length(p256dh) BETWEEN 16 AND 200),
  CONSTRAINT push_subscriptions_auth_length CHECK (char_length(auth) BETWEEN 8 AND 100),
  CONSTRAINT push_subscriptions_device_label_length CHECK (
    device_label IS NULL
    OR char_length(btrim(device_label)) BETWEEN 1 AND 60
  )
);


COMMENT ON TABLE public.push_subscriptions IS 'Browser push endpoints. Endpoints and keys are sensitive and are never exposed through the API.';


CREATE INDEX if NOT EXISTS push_subscriptions_user_active_idx ON public.push_subscriptions (user_id)
WHERE
  disabled_at IS NULL;


CREATE TRIGGER push_subscriptions_set_updated_at
BEFORE UPDATE ON public.push_subscriptions FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at ();


CREATE TABLE IF NOT EXISTS public.notification_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  push_enabled boolean NOT NULL DEFAULT FALSE,
  reminder_24h boolean NOT NULL DEFAULT TRUE,
  reminder_3h boolean NOT NULL DEFAULT TRUE,
  timezone text NOT NULL DEFAULT 'Asia/Jakarta',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT notification_preferences_timezone_length CHECK (char_length(btrim(timezone)) BETWEEN 1 AND 64)
);


COMMENT ON TABLE public.notification_preferences IS 'Per-user reminder opt-in. push_enabled = false stops delivery immediately.';


CREATE TRIGGER notification_preferences_set_updated_at
BEFORE UPDATE ON public.notification_preferences FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at ();


CREATE TABLE IF NOT EXISTS public.saved_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  assignment_id uuid NOT NULL REFERENCES public.assignments (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT saved_assignments_user_assignment_key UNIQUE (user_id, assignment_id)
);


CREATE INDEX if NOT EXISTS saved_assignments_user_recent_idx ON public.saved_assignments (user_id, created_at DESC);


CREATE INDEX if NOT EXISTS saved_assignments_assignment_idx ON public.saved_assignments (assignment_id);


CREATE TABLE IF NOT EXISTS public.notification_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  assignment_id uuid NOT NULL REFERENCES public.assignments (id) ON DELETE CASCADE,
  reminder_type text NOT NULL,
  deadline_at timestamptz NOT NULL,
  scheduled_for timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  attempt_count integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_error_category text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz,
  CONSTRAINT notification_deliveries_type_allowed CHECK (reminder_type IN ('24h', '3h')),
  CONSTRAINT notification_deliveries_status_allowed CHECK (
    status IN ('pending', 'processing', 'sent', 'failed', 'skipped')
  ),
  CONSTRAINT notification_deliveries_attempts_range CHECK (attempt_count BETWEEN 0 AND 10),
  CONSTRAINT notification_deliveries_error_length CHECK (
    last_error_category IS NULL
    OR char_length(last_error_category) BETWEEN 1 AND 40
  ),
  CONSTRAINT notification_deliveries_dedupe UNIQUE (user_id, assignment_id, reminder_type, deadline_at)
);


COMMENT ON TABLE public.notification_deliveries IS 'Durable reminder ledger. No notification payload or subscription key is stored here.';


CREATE INDEX if NOT EXISTS notification_deliveries_due_idx ON public.notification_deliveries (status, next_attempt_at);


CREATE INDEX if NOT EXISTS notification_deliveries_user_recent_idx ON public.notification_deliveries (user_id, created_at DESC);


CREATE TRIGGER notification_deliveries_set_updated_at
BEFORE UPDATE ON public.notification_deliveries FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at ();

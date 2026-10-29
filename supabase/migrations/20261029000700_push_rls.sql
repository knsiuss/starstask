-- Row Level Security for the Web Push tables.
--
-- Browser clients can manage their own subscriptions, preferences, and saved
-- assignments. They can read their own reminder history but can never create or
-- mutate delivery records: those are written only by the scheduler through the
-- service role.
ALTER TABLE public.push_subscriptions enable ROW level security;


ALTER TABLE public.notification_preferences enable ROW level security;


ALTER TABLE public.saved_assignments enable ROW level security;


ALTER TABLE public.notification_deliveries enable ROW level security;


-- ---------------------------------------------------------------------------
-- push_subscriptions
-- Endpoint and key material are deliberately not granted to clients: the
-- browser already knows its own subscription, and nothing in the UI needs to
-- read another device's endpoint.
-- ---------------------------------------------------------------------------
REVOKE ALL ON public.push_subscriptions
FROM
  anon,
  authenticated;


GRANT
SELECT
  (
    id,
    device_label,
    created_at,
    updated_at,
    last_success_at,
    disabled_at
  ) ON public.push_subscriptions TO authenticated;


GRANT insert (user_id, endpoint, p256dh, auth, device_label) ON public.push_subscriptions TO authenticated;


GRANT
UPDATE (device_label) ON public.push_subscriptions TO authenticated;


GRANT delete ON public.push_subscriptions TO authenticated;


DROP POLICY if EXISTS push_subscriptions_owner_read ON public.push_subscriptions;


CREATE POLICY push_subscriptions_owner_read ON public.push_subscriptions FOR
SELECT
  TO authenticated USING (
    (
      SELECT
        auth.uid ()
    ) = user_id
  );


DROP POLICY if EXISTS push_subscriptions_owner_insert ON public.push_subscriptions;


CREATE POLICY push_subscriptions_owner_insert ON public.push_subscriptions FOR insert TO authenticated
WITH
  CHECK (
    (
      SELECT
        auth.uid ()
    ) = user_id
  );


DROP POLICY if EXISTS push_subscriptions_owner_update ON public.push_subscriptions;


CREATE POLICY push_subscriptions_owner_update ON public.push_subscriptions
FOR UPDATE
  TO authenticated USING (
    (
      SELECT
        auth.uid ()
    ) = user_id
  )
WITH
  CHECK (
    (
      SELECT
        auth.uid ()
    ) = user_id
  );


DROP POLICY if EXISTS push_subscriptions_owner_delete ON public.push_subscriptions;


CREATE POLICY push_subscriptions_owner_delete ON public.push_subscriptions FOR delete TO authenticated USING (
  (
    SELECT
      auth.uid ()
  ) = user_id
);


-- ---------------------------------------------------------------------------
-- notification_preferences
-- ---------------------------------------------------------------------------
REVOKE ALL ON public.notification_preferences
FROM
  anon,
  authenticated;


GRANT
SELECT
  ON public.notification_preferences TO authenticated;


GRANT insert (user_id, push_enabled, reminder_24h, reminder_3h, timezone) ON public.notification_preferences TO authenticated;


GRANT
UPDATE (push_enabled, reminder_24h, reminder_3h, timezone) ON public.notification_preferences TO authenticated;


DROP POLICY if EXISTS notification_preferences_owner_read ON public.notification_preferences;


CREATE POLICY notification_preferences_owner_read ON public.notification_preferences FOR
SELECT
  TO authenticated USING (
    (
      SELECT
        auth.uid ()
    ) = user_id
  );


DROP POLICY if EXISTS notification_preferences_owner_insert ON public.notification_preferences;


CREATE POLICY notification_preferences_owner_insert ON public.notification_preferences FOR insert TO authenticated
WITH
  CHECK (
    (
      SELECT
        auth.uid ()
    ) = user_id
  );


DROP POLICY if EXISTS notification_preferences_owner_update ON public.notification_preferences;


CREATE POLICY notification_preferences_owner_update ON public.notification_preferences
FOR UPDATE
  TO authenticated USING (
    (
      SELECT
        auth.uid ()
    ) = user_id
  )
WITH
  CHECK (
    (
      SELECT
        auth.uid ()
    ) = user_id
  );


-- ---------------------------------------------------------------------------
-- saved_assignments
-- A save must point at an assignment the caller can already see.
-- ---------------------------------------------------------------------------
REVOKE ALL ON public.saved_assignments
FROM
  anon,
  authenticated;


GRANT
SELECT
  ON public.saved_assignments TO authenticated;


GRANT insert (user_id, assignment_id) ON public.saved_assignments TO authenticated;


GRANT delete ON public.saved_assignments TO authenticated;


DROP POLICY if EXISTS saved_assignments_owner_read ON public.saved_assignments;


CREATE POLICY saved_assignments_owner_read ON public.saved_assignments FOR
SELECT
  TO authenticated USING (
    (
      SELECT
        auth.uid ()
    ) = user_id
  );


DROP POLICY if EXISTS saved_assignments_owner_insert ON public.saved_assignments;


CREATE POLICY saved_assignments_owner_insert ON public.saved_assignments FOR insert TO authenticated
WITH
  CHECK (
    (
      SELECT
        auth.uid ()
    ) = user_id
    AND EXISTS (
      SELECT
        1
      FROM
        public.assignments a
      WHERE
        a.id = assignment_id
        AND (
          a.status = 'published'
          OR a.user_id = (
            SELECT
              auth.uid ()
          )
        )
    )
  );


DROP POLICY if EXISTS saved_assignments_owner_delete ON public.saved_assignments;


CREATE POLICY saved_assignments_owner_delete ON public.saved_assignments FOR delete TO authenticated USING (
  (
    SELECT
      auth.uid ()
  ) = user_id
);


-- ---------------------------------------------------------------------------
-- notification_deliveries: read-only history for the user it belongs to
-- ---------------------------------------------------------------------------
REVOKE ALL ON public.notification_deliveries
FROM
  anon,
  authenticated;


GRANT
SELECT
  (
    id,
    assignment_id,
    reminder_type,
    deadline_at,
    scheduled_for,
    status,
    attempt_count,
    last_error_category,
    created_at,
    updated_at,
    delivered_at
  ) ON public.notification_deliveries TO authenticated;


DROP POLICY if EXISTS notification_deliveries_owner_read ON public.notification_deliveries;


CREATE POLICY notification_deliveries_owner_read ON public.notification_deliveries FOR
SELECT
  TO authenticated USING (
    (
      SELECT
        auth.uid ()
    ) = user_id
  );

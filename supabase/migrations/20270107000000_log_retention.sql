-- Retention for append-only log tables.
-- =====================================================================
-- audit_logs, app_activity_events, app_error_events and
-- attendance_verification_attempts grow on every action and are never
-- cleaned up. They are the long-term drivers of database growth (files
-- live in Backblaze B2, not here). This migration follows the existing
-- purge pattern (purge_notification_deliveries): bounded deletes of
-- 5,000 rows per call, retention window validated, service_role only.
-- The Vercel cron route /api/cron/log-retention invokes them daily.
--
-- Windows (conservative, audit trail kept longest):
-- - audit_logs: 365 days (accountability/dispute window)
-- - attendance_verification_attempts: 180 days (one semester + margin)
-- - app_activity_events / app_error_events: 90 days (operational only)
CREATE INDEX IF NOT EXISTS audit_logs_created_idx ON public.audit_logs (created_at);


CREATE INDEX IF NOT EXISTS app_activity_events_created_idx ON public.app_activity_events (created_at);


CREATE INDEX IF NOT EXISTS app_error_events_created_idx ON public.app_error_events (created_at);


CREATE INDEX IF NOT EXISTS attendance_verification_attempts_created_idx ON public.attendance_verification_attempts (created_at);


CREATE OR REPLACE FUNCTION public.purge_audit_logs (p_retention_days integer DEFAULT 365) returns integer language plpgsql security definer
SET
  search_path = public,
  pg_temp AS $$
DECLARE
  v_retention_days integer := coalesce(p_retention_days, 365);
  v_count integer;
BEGIN
  IF v_retention_days < 1 OR v_retention_days > 3650 THEN
    RAISE EXCEPTION 'Retention must be between 1 and 3650 days'
    USING ERRCODE = '22023';
  END IF;

  WITH eligible AS (
    SELECT id
    FROM public.audit_logs
    WHERE created_at < now() - make_interval(days => v_retention_days)
    ORDER BY created_at ASC
    LIMIT 5000
  ), purged AS (
    DELETE FROM public.audit_logs
    WHERE id IN (SELECT id FROM eligible)
    RETURNING id
  )
  SELECT count(*) INTO v_count FROM purged;

  RETURN v_count;
END;
$$;


CREATE OR REPLACE FUNCTION public.purge_app_activity_events (p_retention_days integer DEFAULT 90) returns integer language plpgsql security definer
SET
  search_path = public,
  pg_temp AS $$
DECLARE
  v_retention_days integer := coalesce(p_retention_days, 90);
  v_count integer;
BEGIN
  IF v_retention_days < 1 OR v_retention_days > 3650 THEN
    RAISE EXCEPTION 'Retention must be between 1 and 3650 days'
    USING ERRCODE = '22023';
  END IF;

  WITH eligible AS (
    SELECT id
    FROM public.app_activity_events
    WHERE created_at < now() - make_interval(days => v_retention_days)
    ORDER BY created_at ASC
    LIMIT 5000
  ), purged AS (
    DELETE FROM public.app_activity_events
    WHERE id IN (SELECT id FROM eligible)
    RETURNING id
  )
  SELECT count(*) INTO v_count FROM purged;

  RETURN v_count;
END;
$$;


CREATE OR REPLACE FUNCTION public.purge_app_error_events (p_retention_days integer DEFAULT 90) returns integer language plpgsql security definer
SET
  search_path = public,
  pg_temp AS $$
DECLARE
  v_retention_days integer := coalesce(p_retention_days, 90);
  v_count integer;
BEGIN
  IF v_retention_days < 1 OR v_retention_days > 3650 THEN
    RAISE EXCEPTION 'Retention must be between 1 and 3650 days'
    USING ERRCODE = '22023';
  END IF;

  WITH eligible AS (
    SELECT id
    FROM public.app_error_events
    WHERE created_at < now() - make_interval(days => v_retention_days)
    ORDER BY created_at ASC
    LIMIT 5000
  ), purged AS (
    DELETE FROM public.app_error_events
    WHERE id IN (SELECT id FROM eligible)
    RETURNING id
  )
  SELECT count(*) INTO v_count FROM purged;

  RETURN v_count;
END;
$$;


CREATE OR REPLACE FUNCTION public.purge_attendance_verification_attempts (p_retention_days integer DEFAULT 180) returns integer language plpgsql security definer
SET
  search_path = public,
  pg_temp AS $$
DECLARE
  v_retention_days integer := coalesce(p_retention_days, 180);
  v_count integer;
BEGIN
  IF v_retention_days < 1 OR v_retention_days > 3650 THEN
    RAISE EXCEPTION 'Retention must be between 1 and 3650 days'
    USING ERRCODE = '22023';
  END IF;

  WITH eligible AS (
    SELECT id
    FROM public.attendance_verification_attempts
    WHERE created_at < now() - make_interval(days => v_retention_days)
    ORDER BY created_at ASC
    LIMIT 5000
  ), purged AS (
    DELETE FROM public.attendance_verification_attempts
    WHERE id IN (SELECT id FROM eligible)
    RETURNING id
  )
  SELECT count(*) INTO v_count FROM purged;

  RETURN v_count;
END;
$$;


COMMENT ON FUNCTION public.purge_audit_logs (integer) IS 'Deletes audit log rows older than the retention window. Service role only.';


COMMENT ON FUNCTION public.purge_app_activity_events (integer) IS 'Deletes activity event rows older than the retention window. Service role only.';


COMMENT ON FUNCTION public.purge_app_error_events (integer) IS 'Deletes error event rows older than the retention window. Service role only.';


COMMENT ON FUNCTION public.purge_attendance_verification_attempts (integer) IS 'Deletes verification attempt rows older than the retention window. Service role only.';


REVOKE ALL ON FUNCTION public.purge_audit_logs (integer)
FROM
  public,
  anon,
  authenticated;


GRANT
EXECUTE ON FUNCTION public.purge_audit_logs (integer) TO service_role;


REVOKE ALL ON FUNCTION public.purge_app_activity_events (integer)
FROM
  public,
  anon,
  authenticated;


GRANT
EXECUTE ON FUNCTION public.purge_app_activity_events (integer) TO service_role;


REVOKE ALL ON FUNCTION public.purge_app_error_events (integer)
FROM
  public,
  anon,
  authenticated;


GRANT
EXECUTE ON FUNCTION public.purge_app_error_events (integer) TO service_role;


REVOKE ALL ON FUNCTION public.purge_attendance_verification_attempts (integer)
FROM
  public,
  anon,
  authenticated;


GRANT
EXECUTE ON FUNCTION public.purge_attendance_verification_attempts (integer) TO service_role;

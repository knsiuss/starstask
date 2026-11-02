-- Retention for the reminder ledger.
--
-- `notification_deliveries` keeps delivery state so retries and deduplication
-- survive a restart. Once a row is terminal (`sent`, `failed`, or `skipped`)
-- there is no operational reason to keep it forever; it still links a user to
-- an assignment, which is personal data.
--
-- Pending and processing rows are never purged: the scheduler owns them. The
-- purge is bounded to 5,000 rows per call so a long-neglected deployment does
-- not hold a large delete lock. The scheduler runs it daily until the count is
-- zero.
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS notification_deliveries_retention_idx ON public.notification_deliveries (updated_at)
WHERE
  status IN ('sent', 'failed', 'skipped');


CREATE OR REPLACE FUNCTION public.purge_notification_deliveries (p_retention_days integer DEFAULT 180) returns integer language plpgsql security definer
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
    SELECT
      d.id
    FROM
      public.notification_deliveries d
    WHERE
      d.status IN ('sent', 'failed', 'skipped')
      AND d.updated_at < now() - make_interval(days => v_retention_days)
    ORDER BY
      d.updated_at ASC
    LIMIT
      5000
  ), purged AS (
    DELETE FROM public.notification_deliveries d
    WHERE
      d.id IN (
        SELECT
          eligible.id
        FROM
          eligible
      )
    RETURNING
      d.id
  )
  SELECT
    count(*) INTO v_count
  FROM
    purged;

  RETURN v_count;
END;
$$;


COMMENT ON function public.purge_notification_deliveries (integer) IS 'Deletes terminal reminder ledger rows older than the retention window. Pending and processing rows are kept. Service role only.';


REVOKE ALL ON function public.purge_notification_deliveries (integer)
FROM
  public,
  anon,
  authenticated;


GRANT
EXECUTE ON function public.purge_notification_deliveries (integer) TO service_role;

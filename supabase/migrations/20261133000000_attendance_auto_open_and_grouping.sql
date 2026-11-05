-- 1. Auto-open academic meetings: scheduled_at <= now + location set -> status open
CREATE OR REPLACE FUNCTION public.attendance_meetings_auto_open () RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET
  search_path = '' AS $$
BEGIN
  IF NEW.status = 'scheduled' AND NEW.location IS NOT NULL AND btrim(NEW.location) <> '' AND NEW.scheduled_at <= now() THEN
    NEW.status := 'open';
  END IF;
  RETURN NEW;
END; $$;


REVOKE ALL ON FUNCTION public.attendance_meetings_auto_open ()
FROM
  public,
  anon,
  authenticated;


DROP TRIGGER IF EXISTS attendance_meetings_auto_open_trg ON public.attendance_meetings;


CREATE TRIGGER attendance_meetings_auto_open_trg
BEFORE INSERT ON public.attendance_meetings FOR EACH ROW
EXECUTE FUNCTION public.attendance_meetings_auto_open ();


-- 2. Notif grouping per day: view grouping assignment_created by day
CREATE OR REPLACE VIEW public.notification_daily_digest AS
SELECT
  user_id,
  date_trunc('day', created_at) AS DAY,
  count(*) AS total,
  jsonb_agg(
    payload
    ORDER BY
      created_at DESC
  ) AS items
FROM
  public.notification_events
GROUP BY
  user_id,
  date_trunc('day', created_at);


-- 3. Offline check-in queue: table for pending offline check-ins (synced later)
CREATE TABLE IF NOT EXISTS public.offline_checkin_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  session_id uuid NOT NULL,
  payload jsonb NOT NULL,
  captured_at timestamptz NOT NULL DEFAULT now(),
  synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);


ALTER TABLE public.offline_checkin_queue ENABLE ROW LEVEL SECURITY;


CREATE POLICY offline_queue_own ON public.offline_checkin_queue FOR ALL TO authenticated USING (
  user_id = (
    SELECT
      auth.uid ()
  )
)
WITH
  CHECK (
    user_id = (
      SELECT
        auth.uid ()
    )
  );


REVOKE ALL ON TABLE public.offline_checkin_queue
FROM
  public,
  anon,
  authenticated;


GRANT
SELECT
,
  INSERT,
UPDATE ON TABLE public.offline_checkin_queue TO authenticated;


-- 4. Semester rolling: academic_years rollover helper view
CREATE OR REPLACE VIEW public.semester_rollover_candidates AS
SELECT
  ay.id AS old_year_id,
  ay.code AS old_code,
  ay.status AS old_status
FROM
  public.academic_years ay
WHERE
  ay.status IN ('open', 'closed')
  AND NOT EXISTS (
    SELECT
      1
    FROM
      public.academic_years nxt
    WHERE
      nxt.university_id = ay.university_id
      AND nxt.code > ay.code
  );


COMMENT ON VIEW public.notification_daily_digest IS 'Grouping notifikasi per hari: assignment + attendance + DM digabung per user per hari biar tidak spam.';


COMMENT ON TABLE public.offline_checkin_queue IS 'Antri check-in offline (basement kampus sinyal jelek), sync saat online.';

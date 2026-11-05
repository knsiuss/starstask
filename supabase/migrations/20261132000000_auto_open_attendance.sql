-- Auto-open attendance on create if location set + window already open.
-- Owner request 2026-11-05: admin selesai setup lokasi pas create -> status langsung open kalau waktunya sudah lewat.
-- Additive: trigger AFTER INSERT on discussion_sessions.
CREATE OR REPLACE FUNCTION public.auto_open_attendance_on_create () RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET
  search_path = '' AS $$
BEGIN
  -- Only attendance meetings (meeting_number not null), scheduled, with location set
  IF NEW.meeting_number IS NULL THEN RETURN NEW; END IF;
  IF NEW.status <> 'scheduled' THEN RETURN NEW; END IF;
  IF NEW.checkin_latitude IS NULL OR NEW.checkin_longitude IS NULL THEN RETURN NEW; END IF;
  -- Waktu sudah lewat (opens_at <= now < closes_at) -> langsung open
  IF COALESCE(NEW.attendance_opens_at, NEW.starts_at) <= now()
     AND COALESCE(NEW.attendance_closes_at, NEW.ends_at) > now() THEN
    UPDATE public.discussion_sessions
      SET attendance_opened_at = now(), attendance_closed_at = NULL, updated_at = now()
      WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END; $$;


REVOKE ALL ON FUNCTION public.auto_open_attendance_on_create ()
FROM
  public,
  anon,
  authenticated;


DROP TRIGGER IF EXISTS discussion_sessions_auto_open ON public.discussion_sessions;


CREATE TRIGGER discussion_sessions_auto_open
AFTER INSERT ON public.discussion_sessions FOR EACH ROW
EXECUTE FUNCTION public.auto_open_attendance_on_create ();


COMMENT ON FUNCTION public.auto_open_attendance_on_create () IS 'Auto-open: create with location + window open = attendance opened_at set immediately, no manual open needed.';

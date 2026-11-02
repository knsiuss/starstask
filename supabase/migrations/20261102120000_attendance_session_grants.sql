-- Restore the column grant the attendance pages depend on.
--
-- `20261029003700_session_checkins.sql` added `checkin_radius_m` but granted
-- only the pre-existing session columns to `authenticated`. A later attendance
-- grant listed the column, yet deployments that applied the earlier revision
-- still answer 42501 ("permission denied for table discussion_sessions") when a
-- student selects it, which surfaced as a whole-page error on /attendance.
--
-- The radius is not a location; it is the allowed distance around the saved
-- point. The raw point stays unreadable. Granting it keeps the student meeting
-- list able to show "within N metres" without widening anything else.
-- ---------------------------------------------------------------------------
GRANT
SELECT
  (checkin_radius_m) ON public.discussion_sessions TO authenticated;

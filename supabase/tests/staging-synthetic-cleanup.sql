-- StarsTask STAGING REHEARSAL — synthetic seed cleanup (LOCAL ONLY).
-- Removes every `syn-` disposable row, child-first. Run ONLY against the
-- disposable local stack, after the negative RLS suite and harness finish:
--   cat supabase/tests/staging-synthetic-cleanup.sql | \
--     docker exec -i supabase_db_starstask psql -U postgres -d postgres -v ON_ERROR_STOP=1
BEGIN;


DO $$
DECLARE ua uuid; ub uuid;
BEGIN
  SELECT id INTO ua FROM public.universities WHERE slug='syn-uni-a';
  SELECT id INTO ub FROM public.universities WHERE slug='syn-uni-b';

  DELETE FROM public.attendance_records
    WHERE university_id IN (ua,ub)
      AND meeting_id IN (SELECT id FROM public.attendance_meetings WHERE university_id IN (ua,ub));
  DELETE FROM public.attendance_meetings WHERE university_id IN (ua,ub);
  DELETE FROM public.course_offerings WHERE university_id IN (ua,ub);
  DELETE FROM public.class_admins WHERE class_id IN (SELECT id FROM public.classes WHERE slug LIKE 'syn-%');
  DELETE FROM public.class_members WHERE class_id IN (SELECT id FROM public.classes WHERE slug LIKE 'syn-%');
  DELETE FROM public.classes WHERE slug LIKE 'syn-%';
  DELETE FROM public.student_identities WHERE university_id IN (ua,ub);
  DELETE FROM public.university_memberships WHERE university_id IN (ua,ub);
  DELETE FROM public.universities WHERE slug LIKE 'syn-%';
  DELETE FROM auth.users WHERE email LIKE '%@synth.local';
  RAISE NOTICE 'STAGING SYNTHETIC CLEANUP PASS: remaining syn classes=%',
    (SELECT count(*) FROM public.classes WHERE slug LIKE 'syn-%');
END $$;


COMMIT;

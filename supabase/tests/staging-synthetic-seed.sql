-- StarsTask STAGING REHEARSAL — synthetic multi-university seed (LOCAL ONLY).
--
-- Disposable, clearly non-production fixture data. Slugs carry the `syn-`
-- prefix and emails use the reserved `@synth.local` domain. Re-runnable:
-- every block guards on the `syn-` slug so a second run inserts nothing new.
-- Run ONLY against a disposable local stack:
--   cat supabase/tests/staging-synthetic-seed.sql | \
--     docker exec -i supabase_db_starstask psql -U postgres -d postgres -v ON_ERROR_STOP=1
-- Clean up with supabase/tests/staging-synthetic-cleanup.sql.
-- Companion to docs/architecture/phase-5i/staging-rehearsal-report.md.
--
-- Inventory created (counts verified by the final NOTICE):
--   universities           2 (A, B)
--   university_memberships 4 (2 per university: student + admin role)
--   student_identities     4 (one per membership)
--   classes                4 (2 per university)
--   class_members          4 (student of A -> classA1, student of B -> classB1, +1 each)
--   class_admins           2 (one per university's first class)
--   course_offerings       2 (one per university, linked to its first class)
--   attendance_meetings    4 (2 per offering)
--   attendance_records     8 (2 identities x 2 meetings per offering)
--   notifications          0 (no notifications table in local schema; documented gap)
BEGIN;


DO $$
DECLARE
  ua uuid; ub uuid;
  ma1 uuid; ma2 uuid; mb1 uuid; mb2 uuid;
  ia1 uuid; ia2 uuid; ib1 uuid; ib2 uuid;
  ca1 uuid; ca2 uuid; cb1 uuid; cb2 uuid;
  oa uuid; ob uuid;
  m1 uuid; m2 uuid; m3 uuid; m4 uuid;
  fa int;
BEGIN
  -- Universities A and B (idempotent by slug).
  INSERT INTO public.universities(slug,name,status)
    VALUES ('syn-uni-a','Synthetic Uni A (staging rehearsal)','active')
    ON CONFLICT (slug) DO NOTHING;
  INSERT INTO public.universities(slug,name,status)
    VALUES ('syn-uni-b','Synthetic Uni B (staging rehearsal)','active')
    ON CONFLICT (slug) DO NOTHING;
  SELECT id INTO ua FROM public.universities WHERE slug='syn-uni-a';
  SELECT id INTO ub FROM public.universities WHERE slug='syn-uni-b';

  -- Throwaway auth users (fixed UUIDs; ON CONFLICT DO NOTHING on PK).
  INSERT INTO auth.users(id,email,encrypted_password,email_confirmed_at,raw_user_meta_data)
    VALUES ('aaaaaaaa-0000-0000-0000-000000000001','synth-a-student@synth.local','x',now(),'{}'::jsonb)
    ON CONFLICT (id) DO NOTHING;
  INSERT INTO auth.users(id,email,encrypted_password,email_confirmed_at,raw_user_meta_data)
    VALUES ('aaaaaaaa-0000-0000-0000-000000000002','synth-a-admin@synth.local','x',now(),'{}'::jsonb)
    ON CONFLICT (id) DO NOTHING;
  INSERT INTO auth.users(id,email,encrypted_password,email_confirmed_at,raw_user_meta_data)
    VALUES ('bbbbbbbb-0000-0000-0000-000000000001','synth-b-student@synth.local','x',now(),'{}'::jsonb)
    ON CONFLICT (id) DO NOTHING;
  INSERT INTO auth.users(id,email,encrypted_password,email_confirmed_at,raw_user_meta_data)
    VALUES ('bbbbbbbb-0000-0000-0000-000000000002','synth-b-admin@synth.local','x',now(),'{}'::jsonb)
    ON CONFLICT (id) DO NOTHING;

  -- Memberships: 2 per university (student + admin role).
  INSERT INTO public.university_memberships(user_id,university_id,student_id,role,status)
    VALUES ('aaaaaaaa-0000-0000-0000-000000000001',ua,'SYN-A-STU','student','active')
    ON CONFLICT DO NOTHING;
  INSERT INTO public.university_memberships(user_id,university_id,role,status)
    VALUES ('aaaaaaaa-0000-0000-0000-000000000002',ua,'admin','active')
    ON CONFLICT DO NOTHING;
  INSERT INTO public.university_memberships(user_id,university_id,student_id,role,status)
    VALUES ('bbbbbbbb-0000-0000-0000-000000000001',ub,'SYN-B-STU','student','active')
    ON CONFLICT DO NOTHING;
  INSERT INTO public.university_memberships(user_id,university_id,role,status)
    VALUES ('bbbbbbbb-0000-0000-0000-000000000002',ub,'admin','active')
    ON CONFLICT DO NOTHING;
  SELECT id INTO ma1 FROM public.university_memberships
    WHERE user_id='aaaaaaaa-0000-0000-0000-000000000001' AND university_id=ua;
  SELECT id INTO ma2 FROM public.university_memberships
    WHERE user_id='aaaaaaaa-0000-0000-0000-000000000002' AND university_id=ua;
  SELECT id INTO mb1 FROM public.university_memberships
    WHERE user_id='bbbbbbbb-0000-0000-0000-000000000001' AND university_id=ub;
  SELECT id INTO mb2 FROM public.university_memberships
    WHERE user_id='bbbbbbbb-0000-0000-0000-000000000002' AND university_id=ub;

  -- Student identities (one per membership).
  INSERT INTO public.student_identities(university_membership_id,university_id,student_id,status)
    VALUES (ma1,ua,'SYN-A-STU','active') ON CONFLICT DO NOTHING;
  INSERT INTO public.student_identities(university_membership_id,university_id,student_id,status)
    VALUES (ma2,ua,'SYN-A-ADM','active') ON CONFLICT DO NOTHING;
  INSERT INTO public.student_identities(university_membership_id,university_id,student_id,status)
    VALUES (mb1,ub,'SYN-B-STU','active') ON CONFLICT DO NOTHING;
  INSERT INTO public.student_identities(university_membership_id,university_id,student_id,status)
    VALUES (mb2,ub,'SYN-B-ADM','active') ON CONFLICT DO NOTHING;
  SELECT id INTO ia1 FROM public.student_identities WHERE university_membership_id=ma1;
  SELECT id INTO ia2 FROM public.student_identities WHERE university_membership_id=ma2;
  SELECT id INTO ib1 FROM public.student_identities WHERE university_membership_id=mb1;
  SELECT id INTO ib2 FROM public.student_identities WHERE university_membership_id=mb2;

  -- Classes: 2 per university (course_id points at the first course row).
  INSERT INTO public.classes(slug,name,description,course_id,course_name,semester,academic_year,status,join_policy,university_id)
    SELECT 'syn-class-a1','Synthetic Class A1','Staging rehearsal disposable class', id,'Synthetic Course','1','2025/2026','active','invitation', ua
    FROM public.courses LIMIT 1
    ON CONFLICT (slug) DO NOTHING;
  INSERT INTO public.classes(slug,name,description,course_id,course_name,semester,academic_year,status,join_policy,university_id)
    SELECT 'syn-class-a2','Synthetic Class A2','Staging rehearsal disposable class', id,'Synthetic Course','1','2025/2026','active','invitation', ua
    FROM public.courses LIMIT 1
    ON CONFLICT (slug) DO NOTHING;
  INSERT INTO public.classes(slug,name,description,course_id,course_name,semester,academic_year,status,join_policy,university_id)
    SELECT 'syn-class-b1','Synthetic Class B1','Staging rehearsal disposable class', id,'Synthetic Course','1','2025/2026','active','invitation', ub
    FROM public.courses LIMIT 1
    ON CONFLICT (slug) DO NOTHING;
  INSERT INTO public.classes(slug,name,description,course_id,course_name,semester,academic_year,status,join_policy,university_id)
    SELECT 'syn-class-b2','Synthetic Class B2','Staging rehearsal disposable class', id,'Synthetic Course','1','2025/2026','active','invitation', ub
    FROM public.courses LIMIT 1
    ON CONFLICT (slug) DO NOTHING;
  SELECT id INTO ca1 FROM public.classes WHERE slug='syn-class-a1';
  SELECT id INTO ca2 FROM public.classes WHERE slug='syn-class-a2';
  SELECT id INTO cb1 FROM public.classes WHERE slug='syn-class-b1';
  SELECT id INTO cb2 FROM public.classes WHERE slug='syn-class-b2';

  -- Class members: A-student only in A classes, B-student only in B classes.
  INSERT INTO public.class_members(class_id,user_id,joined_via)
    VALUES (ca1,'aaaaaaaa-0000-0000-0000-000000000001','invitation') ON CONFLICT DO NOTHING;
  INSERT INTO public.class_members(class_id,user_id,joined_via)
    VALUES (ca2,'aaaaaaaa-0000-0000-0000-000000000001','invitation') ON CONFLICT DO NOTHING;
  INSERT INTO public.class_members(class_id,user_id,joined_via)
    VALUES (cb1,'bbbbbbbb-0000-0000-0000-000000000001','invitation') ON CONFLICT DO NOTHING;
  INSERT INTO public.class_members(class_id,user_id,joined_via)
    VALUES (cb2,'bbbbbbbb-0000-0000-0000-000000000001','invitation') ON CONFLICT DO NOTHING;
  -- Admins must also be members (FK class_admins -> class_members).
  INSERT INTO public.class_members(class_id,user_id,joined_via)
    VALUES (ca1,'aaaaaaaa-0000-0000-0000-000000000002','invitation') ON CONFLICT DO NOTHING;
  INSERT INTO public.class_members(class_id,user_id,joined_via)
    VALUES (cb1,'bbbbbbbb-0000-0000-0000-000000000002','invitation') ON CONFLICT DO NOTHING;

  -- Class admins: A-admin on A1, B-admin on B1 (cross-class negative tests use these).
  INSERT INTO public.class_admins(class_id,user_id,assigned_by)
    VALUES (ca1,'aaaaaaaa-0000-0000-0000-000000000002','aaaaaaaa-0000-0000-0000-000000000002') ON CONFLICT DO NOTHING;
  INSERT INTO public.class_admins(class_id,user_id,assigned_by)
    VALUES (cb1,'bbbbbbbb-0000-0000-0000-000000000002','bbbbbbbb-0000-0000-0000-000000000002') ON CONFLICT DO NOTHING;

  -- Course offerings: one per university (linked to its first class).
  INSERT INTO public.course_offerings(university_id,class_id,course_id,status)
    SELECT ua,ca1,id,'open' FROM public.courses LIMIT 1
    ON CONFLICT DO NOTHING;
  INSERT INTO public.course_offerings(university_id,class_id,course_id,status)
    SELECT ub,cb1,id,'open' FROM public.courses LIMIT 1
    ON CONFLICT DO NOTHING;
  SELECT id INTO oa FROM public.course_offerings WHERE university_id=ua AND class_id=ca1;
  SELECT id INTO ob FROM public.course_offerings WHERE university_id=ub AND class_id=cb1;

  -- Attendance meetings: 2 per offering.
  INSERT INTO public.attendance_meetings(university_id,offering_id,scheduled_at,status,created_by)
    VALUES (ua,oa,now() - interval '7 days','closed','aaaaaaaa-0000-0000-0000-000000000002') ON CONFLICT DO NOTHING;
  INSERT INTO public.attendance_meetings(university_id,offering_id,scheduled_at,status,created_by)
    VALUES (ua,oa,now() - interval '2 days','closed','aaaaaaaa-0000-0000-0000-000000000002') ON CONFLICT DO NOTHING;
  INSERT INTO public.attendance_meetings(university_id,offering_id,scheduled_at,status,created_by)
    VALUES (ub,ob,now() - interval '7 days','closed','bbbbbbbb-0000-0000-0000-000000000002') ON CONFLICT DO NOTHING;
  INSERT INTO public.attendance_meetings(university_id,offering_id,scheduled_at,status,created_by)
    VALUES (ub,ob,now() - interval '2 days','closed','bbbbbbbb-0000-0000-0000-000000000002') ON CONFLICT DO NOTHING;
  SELECT id INTO m1 FROM public.attendance_meetings WHERE offering_id=oa ORDER BY scheduled_at LIMIT 1;
  SELECT id INTO m2 FROM public.attendance_meetings WHERE offering_id=oa ORDER BY scheduled_at DESC LIMIT 1;
  SELECT id INTO m3 FROM public.attendance_meetings WHERE offering_id=ob ORDER BY scheduled_at LIMIT 1;
  SELECT id INTO m4 FROM public.attendance_meetings WHERE offering_id=ob ORDER BY scheduled_at DESC LIMIT 1;

  -- Attendance records: identity x meeting per offering (present/present/absent cycle).
  INSERT INTO public.attendance_records(university_id,meeting_id,student_identity_id,status,recorded_by)
    VALUES (ua,m1,ia1,'present','aaaaaaaa-0000-0000-0000-000000000002')
    ON CONFLICT DO NOTHING;
  INSERT INTO public.attendance_records(university_id,meeting_id,student_identity_id,status,recorded_by)
    VALUES (ua,m1,ia2,'present','aaaaaaaa-0000-0000-0000-000000000002')
    ON CONFLICT DO NOTHING;
  INSERT INTO public.attendance_records(university_id,meeting_id,student_identity_id,status,recorded_by)
    VALUES (ua,m2,ia1,'present','aaaaaaaa-0000-0000-0000-000000000002')
    ON CONFLICT DO NOTHING;
  INSERT INTO public.attendance_records(university_id,meeting_id,student_identity_id,status,recorded_by)
    VALUES (ua,m2,ia2,'absent','aaaaaaaa-0000-0000-0000-000000000002')
    ON CONFLICT DO NOTHING;
  INSERT INTO public.attendance_records(university_id,meeting_id,student_identity_id,status,recorded_by)
    VALUES (ub,m3,ib1,'present','bbbbbbbb-0000-0000-0000-000000000002')
    ON CONFLICT DO NOTHING;
  INSERT INTO public.attendance_records(university_id,meeting_id,student_identity_id,status,recorded_by)
    VALUES (ub,m3,ib2,'present','bbbbbbbb-0000-0000-0000-000000000002')
    ON CONFLICT DO NOTHING;
  INSERT INTO public.attendance_records(university_id,meeting_id,student_identity_id,status,recorded_by)
    VALUES (ub,m4,ib1,'present','bbbbbbbb-0000-0000-0000-000000000002')
    ON CONFLICT DO NOTHING;
  INSERT INTO public.attendance_records(university_id,meeting_id,student_identity_id,status,recorded_by)
    VALUES (ub,m4,ib2,'absent','bbbbbbbb-0000-0000-0000-000000000002')
    ON CONFLICT DO NOTHING;

  SELECT count(*) INTO fa FROM public.classes WHERE slug LIKE 'syn-%';
  RAISE NOTICE 'STAGING SYNTHETIC SEED PASS: syn classes=% (expected 4), unis=% ',
    fa, (SELECT count(*) FROM public.universities WHERE slug LIKE 'syn-%');
END $$;


COMMIT;

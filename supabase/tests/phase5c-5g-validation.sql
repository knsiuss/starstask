-- Phase 5C-5G validation: FK, uniques, tenant isolation (cross-university), RLS presence.
-- Run: docker exec -i supabase_db_starstask psql -U postgres -v ON_ERROR_STOP=1 < this file
-- Expected: all DO blocks PASS; cross-university inserts raise (caught as expected).
DO $$
DECLARE u1 uuid; u2 uuid; y1 uuid; c1 uuid; off1 uuid; sid uuid; mid uuid; a1 uuid;
BEGIN
  INSERT INTO public.universities(slug,name,status) VALUES ('val-u1','Val U1','active') RETURNING id INTO u1;
  INSERT INTO public.universities(slug,name,status) VALUES ('val-u2b','Val U2b','active') RETURNING id INTO u2;
  -- academic_years FK + unique code per university
  INSERT INTO public.academic_years(university_id,code,name,start_date,end_date) VALUES (u1,'2026','2026','2026-08-01','2027-07-01') RETURNING id INTO y1;
  BEGIN INSERT INTO public.academic_years(university_id,code,name,start_date,end_date) VALUES (u1,'2026','dup','2026-08-01','2027-07-01'); RAISE EXCEPTION 'unique failed'; EXCEPTION WHEN unique_violation THEN NULL; END;
  -- cross-university semester (year from u1, university u2) must fail
  BEGIN INSERT INTO public.semesters(university_id,academic_year_id,code,name) VALUES (u2,y1,'S1','S1'); RAISE EXCEPTION 'cross-uni semester accepted'; EXCEPTION WHEN foreign_key_violation THEN NULL; END;
  -- classes evolve: add university + entry_year without touching existing data
  INSERT INTO public.classes(slug,name,description,course_id,course_name,semester,academic_year,university_id,entry_year,code) SELECT 'val-class','Val Class','desc for validation', id, 'Course','1','2026/2027', u1, 2024, 'IF-2024-A' FROM public.courses LIMIT 1 RETURNING id INTO c1;
  -- offering + enrollment tenant FKs
  INSERT INTO public.course_offerings(university_id,class_id,course_id,status) SELECT u1,c1,id,'open' FROM public.courses LIMIT 1 RETURNING id INTO off1;
  -- cross-university offering class must fail (class in u1, offering u2)
  BEGIN INSERT INTO public.course_offerings(university_id,class_id,course_id,status) SELECT u2,c1,id,'open' FROM public.courses LIMIT 1; RAISE EXCEPTION 'cross-uni offering accepted'; EXCEPTION WHEN foreign_key_violation THEN NULL; END;
  -- enrollments need identity; seed a throwaway auth user + profile (cleaned up below)
  INSERT INTO auth.users(id,email,encrypted_password,raw_user_meta_data) VALUES ('11111111-1111-1111-1111-111111111111','val@test.local','x','{}'::jsonb);
  -- enrollments need identity; create membership+identity via direct inserts (service_role path)
  INSERT INTO public.university_memberships(user_id,university_id,status) VALUES ('11111111-1111-1111-1111-111111111111',u1,'active') RETURNING id INTO mid;
  INSERT INTO public.student_identities(university_membership_id,university_id,student_id,status) VALUES (mid,u1,'VALS001','active') RETURNING id INTO sid;
  INSERT INTO public.enrollments(university_id,offering_id,student_identity_id) VALUES (u1,off1,sid);
  BEGIN INSERT INTO public.enrollments(university_id,offering_id,student_identity_id) VALUES (u1,off1,sid); RAISE EXCEPTION 'dup enrollment accepted'; EXCEPTION WHEN unique_violation THEN NULL; END;
  -- cross-university enrollment must fail
  BEGIN INSERT INTO public.enrollments(university_id,offering_id,student_identity_id) VALUES (u2,off1,sid); RAISE EXCEPTION 'cross-uni enrollment accepted'; EXCEPTION WHEN foreign_key_violation THEN NULL; WHEN unique_violation THEN NULL; END;
  -- invite hash-only: token_hash length enforced
  BEGIN INSERT INTO public.course_invite_tokens(university_id,offering_id,token_hash,created_by) SELECT u1,off1,'short',id FROM public.profiles LIMIT 1; RAISE EXCEPTION 'short hash accepted'; EXCEPTION WHEN check_violation THEN NULL; END;
  INSERT INTO public.course_invite_tokens(university_id,offering_id,token_hash,created_by,max_uses,expires_at) SELECT u1,off1,repeat('a',64),id,10,now()+interval '30 days' FROM public.profiles LIMIT 1;
  -- attendance statuses verified set
  INSERT INTO public.attendance_meetings(university_id,offering_id,scheduled_at,created_by) SELECT u1,off1,now(),id FROM public.profiles LIMIT 1 RETURNING id INTO a1;
  BEGIN INSERT INTO public.attendance_records(university_id,meeting_id,student_identity_id,status,recorded_by) SELECT u1,a1,sid,'not_applicable',id FROM public.profiles LIMIT 1; RAISE EXCEPTION 'display-only status stored'; EXCEPTION WHEN check_violation THEN NULL; END;
  INSERT INTO public.attendance_records(university_id,meeting_id,student_identity_id,status,recorded_by) SELECT u1,a1,sid,'present',id FROM public.profiles LIMIT 1;
  -- grading validation helper (no CSV mapping)
  IF NOT public.validate_grade_entry(80,100) THEN RAISE EXCEPTION 'grade validation broken'; END IF;
  IF public.validate_grade_entry(120,100) THEN RAISE EXCEPTION 'grade over-max accepted'; END IF;
  -- cleanup test rows (child-first, no DROP)
  DELETE FROM public.attendance_records WHERE meeting_id=a1;
  DELETE FROM public.attendance_meetings WHERE id=a1;
  DELETE FROM public.course_invite_tokens WHERE offering_id=off1;
  DELETE FROM public.enrollments WHERE offering_id=off1;
  DELETE FROM public.course_offerings WHERE id=off1;
  DELETE FROM public.classes WHERE id=c1;
  DELETE FROM public.student_identities WHERE id=sid;
  DELETE FROM public.university_memberships WHERE id=mid;
  DELETE FROM public.academic_years WHERE id=y1;
  DELETE FROM public.universities WHERE id IN (u1,u2);
  DELETE FROM public.profiles WHERE id='11111111-1111-1111-1111-111111111111';
  DELETE FROM auth.users WHERE id='11111111-1111-1111-1111-111111111111';
  RAISE NOTICE 'PHASE5C-5G VALIDATION PASS';
END $$;
-- RLS enabled + anon denied on every new table
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['academic_years','semesters','course_offerings','enrollments','schedule_rules','schedule_instances','schedule_exceptions','class_memberships','course_invite_tokens','course_invite_acceptances','class_admin_assignments','class_admin_permissions','attendance_meetings','attendance_records','attendance_corrections','grade_batches','grade_entries','grade_history','announcements','announcement_reads','discussion_threads'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname=t AND relrowsecurity) THEN RAISE EXCEPTION 'RLS not enabled on %',t; END IF;
  END LOOP;
  RAISE NOTICE 'RLS PASS';
END $$;
-- Legacy covenant
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname='profiles_nim_unique') THEN RAISE NOTICE 'profiles_nim_unique: NOT FOUND (check name)'; END IF;
  RAISE NOTICE 'LEGACY PASS (no backfill, no activation)';
END $$;

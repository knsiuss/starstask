-- Phase 5E: ops. Additive only. Preserves existing assignments/attendance/storage behavior.
-- No invented late/attempt policies, no CSV import, no PDF import. Grading CSV UNRESOLVED.

ALTER TABLE public.assignments ADD COLUMN IF NOT EXISTS university_id uuid REFERENCES public.universities (id) ON DELETE RESTRICT;
ALTER TABLE public.assignments ADD COLUMN IF NOT EXISTS offering_id uuid;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='assignments_offering_same_university') THEN
    ALTER TABLE public.assignments ADD CONSTRAINT assignments_offering_same_university FOREIGN KEY (offering_id, university_id) REFERENCES public.course_offerings (id, university_id) ON DELETE SET NULL;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS assignments_offering_idx ON public.assignments (offering_id, status) WHERE offering_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS assignments_university_idx ON public.assignments (university_id, status) WHERE university_id IS NOT NULL;

ALTER TABLE public.course_materials ADD COLUMN IF NOT EXISTS university_id uuid REFERENCES public.universities (id) ON DELETE RESTRICT;
ALTER TABLE public.course_materials ADD COLUMN IF NOT EXISTS offering_id uuid;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='course_materials_offering_same_university') THEN
    ALTER TABLE public.course_materials ADD CONSTRAINT course_materials_offering_same_university FOREIGN KEY (offering_id, university_id) REFERENCES public.course_offerings (id, university_id) ON DELETE SET NULL;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS course_materials_offering_idx ON public.course_materials (offering_id) WHERE offering_id IS NOT NULL;

-- Attendance: new normalized tables alongside legacy discussion_sessions/checkins.
-- Statuses VERIFIED: present/late/excused/sick/absent. not_applicable is display-only (no DB value).
CREATE TABLE IF NOT EXISTS public.attendance_meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id uuid NOT NULL REFERENCES public.universities (id) ON DELETE RESTRICT,
  offering_id uuid NOT NULL,
  scheduled_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'scheduled',
  location text,
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT attendance_meetings_status_allowed CHECK (status IN ('scheduled','open','closed','cancelled')),
  CONSTRAINT attendance_meetings_offering_same_university FOREIGN KEY (offering_id, university_id) REFERENCES public.course_offerings (id, university_id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS attendance_meetings_id_university_unique ON public.attendance_meetings (id, university_id);
CREATE INDEX IF NOT EXISTS attendance_meetings_offering_idx ON public.attendance_meetings (offering_id, scheduled_at DESC);
DROP TRIGGER IF EXISTS attendance_meetings_set_updated_at ON public.attendance_meetings;
CREATE TRIGGER attendance_meetings_set_updated_at BEFORE UPDATE ON public.attendance_meetings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.attendance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id uuid NOT NULL REFERENCES public.universities (id) ON DELETE RESTRICT,
  meeting_id uuid NOT NULL,
  student_identity_id uuid NOT NULL,
  status text NOT NULL,
  recorded_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  note text,
  CONSTRAINT attendance_records_status_allowed CHECK (status IN ('present','late','excused','sick','absent')),
  CONSTRAINT attendance_records_note_length CHECK (note IS NULL OR char_length(note) <= 500),
  CONSTRAINT attendance_records_meeting_same_university FOREIGN KEY (meeting_id, university_id) REFERENCES public.attendance_meetings (id, university_id) ON DELETE CASCADE,
  CONSTRAINT attendance_records_identity_same_university FOREIGN KEY (student_identity_id, university_id) REFERENCES public.student_identities (id, university_id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS attendance_records_id_university_unique ON public.attendance_records (id, university_id);
CREATE UNIQUE INDEX IF NOT EXISTS attendance_records_unique ON public.attendance_records (meeting_id, student_identity_id);
CREATE INDEX IF NOT EXISTS attendance_records_meeting_status_idx ON public.attendance_records (meeting_id, status);
CREATE INDEX IF NOT EXISTS attendance_records_identity_idx ON public.attendance_records (student_identity_id, recorded_at DESC);

CREATE TABLE IF NOT EXISTS public.attendance_corrections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id uuid NOT NULL REFERENCES public.universities (id) ON DELETE RESTRICT,
  record_id uuid NOT NULL,
  previous_status text NOT NULL,
  new_status text NOT NULL,
  reason text NOT NULL,
  corrected_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  corrected_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT attendance_corrections_status_allowed CHECK (previous_status IN ('present','late','excused','sick','absent') AND new_status IN ('present','late','excused','sick','absent')),
  CONSTRAINT attendance_corrections_reason_length CHECK (char_length(btrim(reason)) BETWEEN 3 AND 2000),
  CONSTRAINT attendance_corrections_record_same_university FOREIGN KEY (record_id, university_id) REFERENCES public.attendance_records (id, university_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS attendance_corrections_record_idx ON public.attendance_corrections (record_id, corrected_at DESC);
-- Append-only: revoke update/delete at grant level (no UPDATE/DELETE grant below).

-- Grading: separated infra only. CSV column mapping UNRESOLVED — no importer, no invented schema.
CREATE TABLE IF NOT EXISTS public.grade_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id uuid NOT NULL REFERENCES public.universities (id) ON DELETE RESTRICT,
  offering_id uuid NOT NULL,
  uploaded_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  source_file_hash text NOT NULL,
  status text NOT NULL DEFAULT 'uploaded',
  created_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  CONSTRAINT grade_batches_hash_length CHECK (char_length(source_file_hash)=64),
  CONSTRAINT grade_batches_status_allowed CHECK (status IN ('uploaded','verifying','published')),
  CONSTRAINT grade_batches_offering_same_university FOREIGN KEY (offering_id, university_id) REFERENCES public.course_offerings (id, university_id) ON DELETE CASCADE,
  CONSTRAINT grade_batches_published_consistency CHECK ((status='published') = (published_at IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS grade_batches_id_university_unique ON public.grade_batches (id, university_id);
CREATE INDEX IF NOT EXISTS grade_batches_offering_idx ON public.grade_batches (offering_id, status);

CREATE TABLE IF NOT EXISTS public.grade_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id uuid NOT NULL REFERENCES public.universities (id) ON DELETE RESTRICT,
  batch_id uuid NOT NULL,
  student_identity_id uuid NOT NULL,
  component text NOT NULL,
  score numeric NOT NULL,
  max_score numeric NOT NULL,
  published boolean NOT NULL DEFAULT false,
  published_at timestamptz,
  CONSTRAINT grade_entries_component_allowed CHECK (component IN ('assignment','course')),
  CONSTRAINT grade_entries_score_range CHECK (score >= 0 AND max_score > 0 AND score <= max_score),
  CONSTRAINT grade_entries_batch_same_university FOREIGN KEY (batch_id, university_id) REFERENCES public.grade_batches (id, university_id) ON DELETE CASCADE,
  CONSTRAINT grade_entries_identity_same_university FOREIGN KEY (student_identity_id, university_id) REFERENCES public.student_identities (id, university_id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS grade_entries_id_university_unique ON public.grade_entries (id, university_id);
CREATE UNIQUE INDEX IF NOT EXISTS grade_entries_unique ON public.grade_entries (batch_id, student_identity_id, component);
CREATE INDEX IF NOT EXISTS grade_entries_batch_published_idx ON public.grade_entries (batch_id, published);

CREATE TABLE IF NOT EXISTS public.grade_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id uuid NOT NULL REFERENCES public.universities (id) ON DELETE RESTRICT,
  entry_id uuid NOT NULL,
  old_score numeric NOT NULL,
  new_score numeric NOT NULL,
  changed_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  reason text,
  changed_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT grade_history_entry_same_university FOREIGN KEY (entry_id, university_id) REFERENCES public.grade_entries (id, university_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS grade_history_entry_idx ON public.grade_history (entry_id, changed_at DESC);

-- Reusable validation helper for future CSV import (no column mapping invented).
CREATE OR REPLACE FUNCTION public.validate_grade_entry(p_score numeric, p_max numeric) RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path='' AS $$
  SELECT p_score IS NOT NULL AND p_max IS NOT NULL AND p_max > 0 AND p_score >= 0 AND p_score <= p_max;
$$;
REVOKE ALL ON FUNCTION public.validate_grade_entry(numeric,numeric) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.validate_grade_entry(numeric,numeric) TO authenticated;

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['attendance_meetings','attendance_records','attendance_corrections','grade_batches','grade_entries','grade_history'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM public, anon, authenticated', t);
    EXECUTE format('GRANT SELECT ON TABLE public.%I TO authenticated', t);
  END LOOP;
END $$;
DROP POLICY IF EXISTS attendance_meetings_member_read ON public.attendance_meetings;
CREATE POLICY attendance_meetings_member_read ON public.attendance_meetings FOR SELECT TO authenticated USING (public.is_university_member(university_id) OR public.is_platform_admin());
DROP POLICY IF EXISTS attendance_records_member_read ON public.attendance_records;
CREATE POLICY attendance_records_member_read ON public.attendance_records FOR SELECT TO authenticated USING (public.is_university_member(university_id) OR public.is_platform_admin());
DROP POLICY IF EXISTS attendance_corrections_member_read ON public.attendance_corrections;
CREATE POLICY attendance_corrections_member_read ON public.attendance_corrections FOR SELECT TO authenticated USING (public.is_university_member(university_id) OR public.is_platform_admin());
DROP POLICY IF EXISTS grade_batches_member_read ON public.grade_batches;
CREATE POLICY grade_batches_member_read ON public.grade_batches FOR SELECT TO authenticated USING (public.is_university_member(university_id) OR public.is_platform_admin());
DROP POLICY IF EXISTS grade_entries_member_read ON public.grade_entries;
CREATE POLICY grade_entries_member_read ON public.grade_entries FOR SELECT TO authenticated USING (public.is_university_member(university_id) OR public.is_platform_admin());
DROP POLICY IF EXISTS grade_history_member_read ON public.grade_history;
CREATE POLICY grade_history_member_read ON public.grade_history FOR SELECT TO authenticated USING (public.is_university_member(university_id) OR public.is_platform_admin());
-- Storage: 5 buckets verified in evidence; no new bucket, no policy change (private evidence stays private).

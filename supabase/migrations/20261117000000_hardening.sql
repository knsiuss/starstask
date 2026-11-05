-- Phase 5G: hardening. Additive only.
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS university_id uuid REFERENCES public.universities (id) ON DELETE RESTRICT;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS before_state jsonb;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS after_state jsonb;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='audit_logs_before_object') THEN ALTER TABLE public.audit_logs ADD CONSTRAINT audit_logs_before_object CHECK (before_state IS NULL OR jsonb_typeof(before_state)='object'); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='audit_logs_after_object') THEN ALTER TABLE public.audit_logs ADD CONSTRAINT audit_logs_after_object CHECK (after_state IS NULL OR jsonb_typeof(after_state)='object'); END IF;
END $$;
CREATE INDEX IF NOT EXISTS audit_logs_university_idx ON public.audit_logs (university_id, created_at DESC) WHERE university_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS audit_logs_entity_idx ON public.audit_logs (entity_type, entity_id, created_at DESC) WHERE entity_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS enrollments_offering_status_idx ON public.enrollments (offering_id, status);
CREATE INDEX IF NOT EXISTS attendance_meetings_offering_time_idx ON public.attendance_meetings (offering_id, scheduled_at DESC);
CREATE INDEX IF NOT EXISTS announcements_class_time_idx ON public.announcements (class_id, published_at DESC);
CREATE INDEX IF NOT EXISTS class_memberships_class_active_idx ON public.class_memberships (class_id) WHERE left_at IS NULL;
REVOKE ALL ON TABLE public.academic_years, public.semesters, public.course_offerings, public.enrollments, public.schedule_rules, public.schedule_instances, public.schedule_exceptions, public.class_memberships, public.course_invite_tokens, public.course_invite_acceptances, public.class_admin_assignments, public.class_admin_permissions, public.attendance_meetings, public.attendance_records, public.attendance_corrections, public.grade_batches, public.grade_entries, public.grade_history, public.announcements, public.announcement_reads, public.discussion_threads FROM anon;

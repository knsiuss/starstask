-- Phase 5I + hardening (model duplication cleanup) — additive only.
-- Deprecation comments + reporting views + one provably-safe CHECK.
-- No data moves, no backfill, no read-path switch, no DROP, no NOT NULL.
-- Local-validated; do NOT push to remote without approval.
-- Sequence 20261119+ (after 20261119000001).
-- ---------------------------------------------------------------------------
-- 1. Deprecation comments (preserve existing text; append, never replace)
-- ---------------------------------------------------------------------------
DO $stub$
DECLARE v_existing text;
BEGIN
  SELECT description INTO v_existing FROM pg_description d JOIN pg_class c ON d.objoid=c.oid WHERE c.relname='class_members';
  EXECUTE 'COMMENT ON TABLE public.class_members IS $c$' ||
    replace(coalesce(v_existing,'') || E'\nDEPRECATED (expand-contract step 1, 2026-11-05): superseded by public.class_memberships once upstream identity linkage (student_identities + university_memberships) exists. Source of truth for is_class_member() remains class_members until an approved cutover ADR + backfill. Do not DROP.', E'\n', E'\n') || '$c$';
  SELECT description INTO v_existing FROM pg_description d JOIN pg_class c ON d.objoid=c.oid WHERE c.relname='class_admins';
  EXECUTE 'COMMENT ON TABLE public.class_admins IS $c$' ||
    replace(coalesce(v_existing,'') || E'\nDEPRECATED (expand-contract step 1, 2026-11-05): superseded by public.class_admin_assignments + class_admin_permissions. Legacy is_class_admin()/can_manage_class() keep reading this table until an approved cutover. Do not DROP.', E'\n', E'\n') || '$c$';
END $stub$;


COMMENT ON COLUMN public.classes.academic_year IS 'LEGACY text (NNNN/NNNN). Prefer classes.academic_year_id when NOT NULL; backfill mapping is TBD (see docs/architecture/phase-5i/migration-mapping.md).';


COMMENT ON COLUMN public.classes.semester IS 'LEGACY text. Prefer classes.semester_id when NOT NULL; backfill mapping is TBD.';


COMMENT ON COLUMN public.classes.institution IS 'LEGACY free text. Prefer classes.university_id; fuzzy string-to-registry mapping is open question #7 (ADR-002).';


COMMENT ON COLUMN public.classes.class_code IS 'Human-readable class code (display + duplicate detection). Current read-path code; supersedes classes.code only after a consolidation ADR.';


COMMENT ON COLUMN public.classes.code IS 'Deprecated alias candidate for classes.class_code; 0 rows populate it locally. Do not write new rows here without an ADR.';


COMMENT ON COLUMN public.classes.course_name IS 'Creation-time snapshot of courses.name (denormalized). Snapshot may diverge from courses.name on purpose; use course_id join for live name.';


COMMENT ON TABLE public.discussion_sessions IS 'Real domain: scheduled class attendance/meeting row (starts_at/ends_at/checkins/RSVPs/reminders). It is NOT a chat thread; the module name predates the attendance normalization. Do not rename until a cutover date is approved. Reporting view: public.discussion_sessions_domain_view.';


COMMENT ON COLUMN public.assignments.course_id IS 'Catalog course for this row (existing since 20261029). One of four coexisting grains: course_id (catalogue) / class_id (class group) / subject_id (course-in-context) / offering_id (dated tenant offering). Single-owner consolidation requires catalogue scope decision #2 first; see migration-mapping.md.';


COMMENT ON COLUMN public.assignments.class_id IS 'Class group scope (RLS grain). NULL means public-repo entry. See sibling comment on course_id.';


COMMENT ON COLUMN public.assignments.subject_id IS 'FK to class_subjects(id): the course-in-context inside the class. NULL for public-repo entries. See sibling comment on course_id.';


COMMENT ON COLUMN public.assignments.offering_id IS 'FK to course_offerings(id): dated tenant offering of the course. NULL until offerings are populated. See sibling comment on course_id.';


COMMENT ON COLUMN public.assignments.content_type IS 'lecturer_assignment vs class_announcement. Announcements are migrating to public.announcements; content_type=class_announcement is the legacy read path until an approved cutover.';


-- ---------------------------------------------------------------------------
-- 2. Provably-safe CHECK: assignments status/archived consistency
-- Enforced already by trigger sync_assignment_archived_at; this is a redundant
-- guard that also surfaces drift. Safe on empty and populated tables.
-- ---------------------------------------------------------------------------
DO $stub$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='assignments_status_archived_consistency') THEN
    ALTER TABLE public.assignments ADD CONSTRAINT assignments_status_archived_consistency CHECK ((status='archived') = (archived_at IS NOT NULL)) NOT VALID;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname='assignments_status_archived_consistency' AND NOT convalidated) THEN
    EXECUTE 'ALTER TABLE public.assignments VALIDATE CONSTRAINT assignments_status_archived_consistency';
  END IF;
END $stub$;


-- ---------------------------------------------------------------------------
-- 3. discussion_sessions: rename-comment VIEW (no FK break, read-only)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.discussion_sessions_domain_view AS
SELECT
  id,
  class_id,
  assignment_id,
  organizer_id,
  session_type AS meeting_type,
  starts_at,
  ends_at,
  (ends_at - starts_at) AS window_length,
  status,
  cancelled_at,
  completed_at,
  (status = 'cancelled') AS is_cancelled,
  (status = 'completed') AS is_completed,
  (status = 'scheduled') AS is_upcoming
FROM
  public.discussion_sessions;


-- ---------------------------------------------------------------------------
-- 4. assignments: reporting view computing the effective owner grain
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.assignments_owner_reporting AS
SELECT
  id,
  course_id,
  class_id,
  subject_id,
  offering_id,
  content_type,
  status,
  CASE
    WHEN offering_id IS NOT NULL THEN 'offering'
    WHEN subject_id IS NOT NULL THEN 'subject'
    WHEN class_id IS NOT NULL THEN 'class'
    ELSE 'public_repo'
  END AS effective_owner_grain,
  university_id
FROM
  public.assignments;


-- ---------------------------------------------------------------------------
-- 5. classes: legacy-vs-FK gap observability (no read-path change)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.classes_legacy_vs_fk_gap AS
SELECT
  id,
  (academic_year_id IS NULL) AS missing_year_fk,
  (semester_id IS NULL) AS missing_semester_fk,
  (university_id IS NULL) AS missing_university_fk,
  (class_code IS NULL) AS missing_class_code,
  academic_year,
  semester
FROM
  public.classes;

-- Phase 5C: academic structure. Additive expand step (ADR-018).
-- New: academic_years, semesters, course_offerings, enrollments,
-- schedule_rules/instances/exceptions. Evolve: classes (+university_id,
-- academic_unit_id, entry_year, code), courses (+university_id nullable catalog).
-- Preserves: classes data/behavior, class_subjects, class_course_schedules.
-- No backfill, no activation, no destructive change. Rollback: drop new
-- tables child-first + drop added columns (see phase-5c docs).
CREATE TABLE IF NOT EXISTS public.academic_years (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id uuid NOT NULL REFERENCES public.universities (id) ON DELETE RESTRICT,
  code text NOT NULL,
  name text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  status text NOT NULL DEFAULT 'planned',
  is_current boolean NOT NULL DEFAULT FALSE,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT academic_years_code_length CHECK (char_length(btrim(code)) BETWEEN 1 AND 40),
  CONSTRAINT academic_years_name_length CHECK (char_length(btrim(name)) BETWEEN 2 AND 200),
  CONSTRAINT academic_years_date_order CHECK (end_date >= start_date),
  CONSTRAINT academic_years_status_allowed CHECK (status IN ('planned', 'open', 'closed', 'archived'))
);


CREATE UNIQUE INDEX IF NOT EXISTS academic_years_university_code_unique ON public.academic_years (university_id, lower(btrim(code)));


CREATE UNIQUE INDEX IF NOT EXISTS academic_years_id_university_unique ON public.academic_years (id, university_id);


CREATE UNIQUE INDEX IF NOT EXISTS academic_years_one_current ON public.academic_years (university_id)
WHERE
  is_current;


CREATE INDEX IF NOT EXISTS academic_years_university_status_idx ON public.academic_years (university_id, status);


DROP TRIGGER IF EXISTS academic_years_set_updated_at ON public.academic_years;


CREATE TRIGGER academic_years_set_updated_at
BEFORE UPDATE ON public.academic_years FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at ();


CREATE TABLE IF NOT EXISTS public.semesters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id uuid NOT NULL REFERENCES public.universities (id) ON DELETE RESTRICT,
  academic_year_id uuid NOT NULL,
  code text NOT NULL,
  name text NOT NULL,
  sequence_no smallint NOT NULL DEFAULT 1,
  start_date date,
  end_date date,
  status text NOT NULL DEFAULT 'planned',
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT semesters_code_length CHECK (char_length(btrim(code)) BETWEEN 1 AND 40),
  CONSTRAINT semesters_name_length CHECK (char_length(btrim(name)) BETWEEN 2 AND 200),
  CONSTRAINT semesters_sequence_range CHECK (sequence_no BETWEEN 1 AND 20),
  CONSTRAINT semesters_date_order CHECK (
    start_date IS NULL
    OR end_date IS NULL
    OR end_date >= start_date
  ),
  CONSTRAINT semesters_status_allowed CHECK (status IN ('planned', 'open', 'closed', 'archived')),
  CONSTRAINT semesters_year_same_university FOREIGN KEY (academic_year_id, university_id) REFERENCES public.academic_years (id, university_id) ON DELETE RESTRICT
);


CREATE UNIQUE INDEX IF NOT EXISTS semesters_university_year_code_unique ON public.semesters (university_id, academic_year_id, lower(btrim(code)));


CREATE UNIQUE INDEX IF NOT EXISTS semesters_id_university_unique ON public.semesters (id, university_id);


CREATE INDEX IF NOT EXISTS semesters_year_idx ON public.semesters (academic_year_id, sequence_no);


DROP TRIGGER IF EXISTS semesters_set_updated_at ON public.semesters;


CREATE TRIGGER semesters_set_updated_at
BEFORE UPDATE ON public.semesters FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at ();


ALTER TABLE public.classes
ADD COLUMN IF NOT EXISTS university_id uuid REFERENCES public.universities (id) ON DELETE RESTRICT;


ALTER TABLE public.classes
ADD COLUMN IF NOT EXISTS academic_unit_id uuid;


ALTER TABLE public.classes
ADD COLUMN IF NOT EXISTS academic_year_id uuid;


ALTER TABLE public.classes
ADD COLUMN IF NOT EXISTS semester_id uuid;


ALTER TABLE public.classes
ADD COLUMN IF NOT EXISTS entry_year int;


ALTER TABLE public.classes
ADD COLUMN IF NOT EXISTS code text;


DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='classes_entry_year_range') THEN ALTER TABLE public.classes ADD CONSTRAINT classes_entry_year_range CHECK (entry_year IS NULL OR entry_year BETWEEN 1950 AND 2100); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='classes_code_length') THEN ALTER TABLE public.classes ADD CONSTRAINT classes_code_length CHECK (code IS NULL OR char_length(btrim(code)) BETWEEN 1 AND 40); END IF;
END $$;


-- composite FKs (MATCH SIMPLE: NULL skips, existing rows unaffected)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='classes_unit_same_university') THEN
    ALTER TABLE public.classes ADD CONSTRAINT classes_unit_same_university FOREIGN KEY (academic_unit_id, university_id) REFERENCES public.academic_units (id, university_id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='classes_year_same_university') THEN
    ALTER TABLE public.classes ADD CONSTRAINT classes_year_same_university FOREIGN KEY (academic_year_id, university_id) REFERENCES public.academic_years (id, university_id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='classes_semester_same_university') THEN
    ALTER TABLE public.classes ADD CONSTRAINT classes_semester_same_university FOREIGN KEY (semester_id, university_id) REFERENCES public.semesters (id, university_id) ON DELETE RESTRICT;
  END IF;
END $$;


CREATE UNIQUE INDEX IF NOT EXISTS classes_id_university_unique ON public.classes (id, university_id);


CREATE INDEX IF NOT EXISTS classes_university_idx ON public.classes (university_id, status)
WHERE
  university_id IS NOT NULL;


CREATE INDEX IF NOT EXISTS classes_unit_idx ON public.classes (academic_unit_id)
WHERE
  academic_unit_id IS NOT NULL;


-- Course catalogue scope UNRESOLVED (36#2): nullable university_id, courses stay global until decided.
ALTER TABLE public.courses
ADD COLUMN IF NOT EXISTS university_id uuid REFERENCES public.universities (id) ON DELETE RESTRICT;


CREATE INDEX IF NOT EXISTS courses_university_idx ON public.courses (university_id)
WHERE
  university_id IS NOT NULL;


CREATE TABLE IF NOT EXISTS public.course_offerings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id uuid NOT NULL REFERENCES public.universities (id) ON DELETE RESTRICT,
  class_id uuid NOT NULL,
  course_id uuid NOT NULL REFERENCES public.courses (id) ON DELETE RESTRICT,
  academic_year_id uuid,
  semester_id uuid,
  lecturer_name text,
  status text NOT NULL DEFAULT 'draft',
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT course_offerings_status_allowed CHECK (status IN ('draft', 'open', 'closed', 'archived')),
  CONSTRAINT course_offerings_class_same_university FOREIGN KEY (class_id, university_id) REFERENCES public.classes (id, university_id) ON DELETE CASCADE,
  CONSTRAINT course_offerings_year_same_university FOREIGN KEY (academic_year_id, university_id) REFERENCES public.academic_years (id, university_id) ON DELETE RESTRICT,
  CONSTRAINT course_offerings_semester_same_university FOREIGN KEY (semester_id, university_id) REFERENCES public.semesters (id, university_id) ON DELETE RESTRICT
);


CREATE UNIQUE INDEX IF NOT EXISTS course_offerings_id_university_unique ON public.course_offerings (id, university_id);


CREATE UNIQUE INDEX IF NOT EXISTS course_offerings_unique ON public.course_offerings (
  university_id,
  class_id,
  course_id,
  coalesce(semester_id, '00000000-0000-0000-0000-000000000000'::uuid)
);


CREATE INDEX IF NOT EXISTS course_offerings_class_idx ON public.course_offerings (class_id, status);


CREATE INDEX IF NOT EXISTS course_offerings_course_idx ON public.course_offerings (course_id);


DROP TRIGGER IF EXISTS course_offerings_set_updated_at ON public.course_offerings;


CREATE TRIGGER course_offerings_set_updated_at
BEFORE UPDATE ON public.course_offerings FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at ();


-- Enrollments are their own table: retake in offering B must not mutate home class.
CREATE TABLE IF NOT EXISTS public.enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id uuid NOT NULL REFERENCES public.universities (id) ON DELETE RESTRICT,
  offering_id uuid NOT NULL,
  student_identity_id uuid NOT NULL,
  source text NOT NULL DEFAULT 'home_class',
  status text NOT NULL DEFAULT 'active',
  enrolled_at timestamptz NOT NULL DEFAULT now(),
  dropped_at timestamptz,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT enrollments_source_allowed CHECK (
    source IN ('home_class', 'invite_token', 'admin_add', 'retake')
  ),
  CONSTRAINT enrollments_status_allowed CHECK (status IN ('active', 'dropped', 'completed')),
  CONSTRAINT enrollments_offering_same_university FOREIGN KEY (offering_id, university_id) REFERENCES public.course_offerings (id, university_id) ON DELETE CASCADE,
  CONSTRAINT enrollments_identity_same_university FOREIGN KEY (student_identity_id, university_id) REFERENCES public.student_identities (id, university_id) ON DELETE CASCADE
);


CREATE UNIQUE INDEX IF NOT EXISTS enrollments_active_unique ON public.enrollments (offering_id, student_identity_id)
WHERE
  status = 'active';


CREATE INDEX IF NOT EXISTS enrollments_identity_idx ON public.enrollments (student_identity_id, status);


CREATE INDEX IF NOT EXISTS enrollments_offering_idx ON public.enrollments (offering_id, status);


DROP TRIGGER IF EXISTS enrollments_set_updated_at ON public.enrollments;


CREATE TRIGGER enrollments_set_updated_at
BEFORE UPDATE ON public.enrollments FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at ();


-- Schedule: rules/instances/exceptions. Existing class_course_schedules preserved untouched.
CREATE TABLE IF NOT EXISTS public.schedule_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id uuid NOT NULL REFERENCES public.universities (id) ON DELETE RESTRICT,
  offering_id uuid NOT NULL,
  weekday smallint NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  room text,
  timezone text NOT NULL,
  effective_from date,
  effective_to date,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT schedule_rules_weekday_range CHECK (weekday BETWEEN 1 AND 7),
  CONSTRAINT schedule_rules_time_window CHECK (end_time > start_time),
  CONSTRAINT schedule_rules_date_order CHECK (
    effective_from IS NULL
    OR effective_to IS NULL
    OR effective_to >= effective_from
  ),
  CONSTRAINT schedule_rules_room_length CHECK (
    room IS NULL
    OR char_length(btrim(room)) BETWEEN 1 AND 120
  ),
  CONSTRAINT schedule_rules_offering_same_university FOREIGN KEY (offering_id, university_id) REFERENCES public.course_offerings (id, university_id) ON DELETE CASCADE
);


CREATE UNIQUE INDEX IF NOT EXISTS schedule_rules_id_university_unique ON public.schedule_rules (id, university_id);


CREATE INDEX IF NOT EXISTS schedule_rules_offering_idx ON public.schedule_rules (offering_id, weekday, start_time);


DROP TRIGGER IF EXISTS schedule_rules_set_updated_at ON public.schedule_rules;


CREATE TRIGGER schedule_rules_set_updated_at
BEFORE UPDATE ON public.schedule_rules FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at ();


CREATE TABLE IF NOT EXISTS public.schedule_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id uuid NOT NULL REFERENCES public.universities (id) ON DELETE RESTRICT,
  rule_id uuid NOT NULL,
  instance_date date NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'scheduled',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT schedule_instances_status_allowed CHECK (status IN ('scheduled', 'cancelled', 'moved')),
  CONSTRAINT schedule_instances_window CHECK (ends_at > starts_at),
  CONSTRAINT schedule_instances_rule_same_university FOREIGN KEY (rule_id, university_id) REFERENCES public.schedule_rules (id, university_id) ON DELETE CASCADE
);


CREATE UNIQUE INDEX IF NOT EXISTS schedule_instances_id_university_unique ON public.schedule_instances (id, university_id);


CREATE UNIQUE INDEX IF NOT EXISTS schedule_instances_rule_date_unique ON public.schedule_instances (rule_id, instance_date);


CREATE INDEX IF NOT EXISTS schedule_instances_date_idx ON public.schedule_instances (university_id, instance_date);


DROP TRIGGER IF EXISTS schedule_instances_set_updated_at ON public.schedule_instances;


CREATE TRIGGER schedule_instances_set_updated_at
BEFORE UPDATE ON public.schedule_instances FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at ();


CREATE TABLE IF NOT EXISTS public.schedule_exceptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id uuid NOT NULL REFERENCES public.universities (id) ON DELETE RESTRICT,
  instance_id uuid NOT NULL,
  kind text NOT NULL,
  note text,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT schedule_exceptions_kind_allowed CHECK (kind IN ('cancel', 'move', 'substitute')),
  CONSTRAINT schedule_exceptions_note_length CHECK (
    note IS NULL
    OR char_length(btrim(note)) BETWEEN 1 AND 2000
  ),
  CONSTRAINT schedule_exceptions_instance_same_university FOREIGN KEY (instance_id, university_id) REFERENCES public.schedule_instances (id, university_id) ON DELETE CASCADE
);


CREATE INDEX IF NOT EXISTS schedule_exceptions_instance_idx ON public.schedule_exceptions (instance_id, created_at DESC);


-- RLS: member read via existing helpers, no anon, no client writes (service_role/RPC only).
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['academic_years','semesters','course_offerings','enrollments','schedule_rules','schedule_instances','schedule_exceptions'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM public, anon, authenticated', t);
    EXECUTE format('GRANT SELECT ON TABLE public.%I TO authenticated', t);
  END LOOP;
END $$;


DROP POLICY IF EXISTS academic_years_member_read ON public.academic_years;


CREATE POLICY academic_years_member_read ON public.academic_years FOR
SELECT
  TO authenticated USING (
    public.is_university_member (university_id)
    OR public.is_platform_admin ()
  );


DROP POLICY IF EXISTS semesters_member_read ON public.semesters;


CREATE POLICY semesters_member_read ON public.semesters FOR
SELECT
  TO authenticated USING (
    public.is_university_member (university_id)
    OR public.is_platform_admin ()
  );


DROP POLICY IF EXISTS course_offerings_member_read ON public.course_offerings;


CREATE POLICY course_offerings_member_read ON public.course_offerings FOR
SELECT
  TO authenticated USING (
    public.is_class_member (class_id)
    OR public.is_university_member (university_id)
    OR public.is_platform_admin ()
  );


DROP POLICY IF EXISTS enrollments_member_read ON public.enrollments;


CREATE POLICY enrollments_member_read ON public.enrollments FOR
SELECT
  TO authenticated USING (
    public.is_university_member (university_id)
    OR public.is_platform_admin ()
  );


DROP POLICY IF EXISTS schedule_rules_member_read ON public.schedule_rules;


CREATE POLICY schedule_rules_member_read ON public.schedule_rules FOR
SELECT
  TO authenticated USING (
    public.is_university_member (university_id)
    OR public.is_platform_admin ()
  );


DROP POLICY IF EXISTS schedule_instances_member_read ON public.schedule_instances;


CREATE POLICY schedule_instances_member_read ON public.schedule_instances FOR
SELECT
  TO authenticated USING (
    public.is_university_member (university_id)
    OR public.is_platform_admin ()
  );


DROP POLICY IF EXISTS schedule_exceptions_member_read ON public.schedule_exceptions;


CREATE POLICY schedule_exceptions_member_read ON public.schedule_exceptions FOR
SELECT
  TO authenticated USING (
    public.is_university_member (university_id)
    OR public.is_platform_admin ()
  );

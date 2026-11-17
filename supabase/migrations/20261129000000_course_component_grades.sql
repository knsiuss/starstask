-- Per-component course grades for the attendance sheet (Tugas/UTS/UAS).
--
-- Grades live apart from the published grade batches, which are immutable
-- verification artifacts. These rows are the working scores a class admin
-- edits inline in the sheet; every write goes through
-- set_course_component_grade(), which requires a class manager and writes
-- an audit row in the same transaction.
CREATE TABLE IF NOT EXISTS public.course_component_grades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.classes (id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES public.class_subjects (id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  component text NOT NULL,
  score numeric(5, 2) NOT NULL,
  updated_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT course_component_grades_component_allowed CHECK (component IN ('tugas', 'uts', 'uas')),
  CONSTRAINT course_component_grades_score_range CHECK (
    score >= 0
    AND score <= 100
  ),
  CONSTRAINT course_component_grades_one_per_component UNIQUE (class_id, subject_id, student_id, component)
);


CREATE INDEX if NOT EXISTS course_component_grades_course_idx ON public.course_component_grades (class_id, subject_id);


COMMENT ON TABLE public.course_component_grades IS 'Working per-component scores (Tugas/UTS/UAS) edited inline in the attendance sheet. Managers only; see set_course_component_grade().';


CREATE TRIGGER course_component_grades_set_updated_at
BEFORE UPDATE ON public.course_component_grades FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at ();


ALTER TABLE public.course_component_grades enable ROW level security;


REVOKE ALL ON public.course_component_grades
FROM
  anon,
  authenticated;


CREATE OR REPLACE FUNCTION public.set_course_component_grade (
  p_class_id uuid,
  p_subject_id uuid,
  p_student_id uuid,
  p_component text,
  p_score numeric
) returns numeric language plpgsql security definer
SET
  search_path = public,
  pg_temp AS $$
declare
  v_user_id uuid := (select auth.uid ());
  v_score numeric;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if p_component not in ('tugas', 'uts', 'uas') then
    raise exception 'unknown grade component' using errcode = '22023';
  end if;

  v_score := p_score;

  if v_score is null
  or v_score < 0
  or v_score > 100 then
    raise exception 'score must be between 0 and 100' using errcode = '22023';
  end if;

  if not public.can_manage_class (p_class_id) then
    raise exception 'not allowed to edit grades for this class' using errcode = '42501';
  end if;

  if not exists (
    select
      1
    from
      public.class_subjects s
    where
      s.id = p_subject_id
      and s.class_id = p_class_id
  ) then
    raise exception 'course does not belong to this class' using errcode = '22023';
  end if;

  if not exists (
    select
      1
    from
      public.class_members m
    where
      m.class_id = p_class_id
      and m.user_id = p_student_id
  ) then
    raise exception 'student is not a member of this class' using errcode = '22023';
  end if;

  insert into public.course_component_grades (
    class_id,
    subject_id,
    student_id,
    component,
    score,
    updated_by
  )
  values (
    p_class_id,
    p_subject_id,
    p_student_id,
    p_component,
    v_score,
    v_user_id
  )
  on conflict (class_id, subject_id, student_id, component)
  do update
  set
    score = excluded.score,
    updated_by = excluded.updated_by,
    updated_at = now();

  perform public.record_audit (
    'course_component_grade_set',
    'course_component_grade',
    null,
    p_class_id,
    jsonb_build_object(
      'subjectId', p_subject_id,
      'studentId', p_student_id,
      'component', p_component,
      'score', v_score
    )
  );

  return v_score;
end;
$$;


CREATE OR REPLACE FUNCTION public.list_course_component_grades (p_class_id uuid, p_subject_id uuid) returns jsonb language plpgsql security definer
SET
  search_path = public,
  pg_temp AS $$
declare
  v_user_id uuid := (select auth.uid ());
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if not exists (
    select
      1
    from
      public.class_members m
    where
      m.class_id = p_class_id
      and m.user_id = v_user_id
  ) then
    raise exception 'not a member of this class' using errcode = '42501';
  end if;

  return coalesce(
    (
      select
        jsonb_object_agg(
          g.student_id::text || ':' || g.component,
          g.score
        )
      from
        public.course_component_grades g
      where
        g.class_id = p_class_id
        and g.subject_id = p_subject_id
    ),
    '{}'::jsonb
  );
end;
$$;


REVOKE ALL ON FUNCTION public.set_course_component_grade (uuid, uuid, uuid, text, numeric)
FROM
  public;


GRANT
EXECUTE ON FUNCTION public.set_course_component_grade (uuid, uuid, uuid, text, numeric) TO authenticated;


REVOKE ALL ON FUNCTION public.list_course_component_grades (uuid, uuid)
FROM
  public;


GRANT
EXECUTE ON FUNCTION public.list_course_component_grades (uuid, uuid) TO authenticated;

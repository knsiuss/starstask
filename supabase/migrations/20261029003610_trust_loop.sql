-- Trust loop for the public assignment archive.
--
--   assignment_reports    a student says a brief is wrong; the class admin or a
--                         platform admin works the queue.
--   assignment_revisions  an append-only snapshot of the fields readers rely
--                         on, written by a trigger so a normal UPDATE cannot
--                         skip it.
--
-- Mutations are function-only: no INSERT/UPDATE policy or grant exists on
-- either table, so a client cannot resolve its own report or forge a revision.
-- ---------------------------------------------------------------------------
-- assignment_reports
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.assignment_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  assignment_id uuid NOT NULL REFERENCES public.assignments (id) ON DELETE CASCADE,
  reporter_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  -- Denormalised for the review queue and RLS; kept in sync by report_assignment().
  class_id uuid NOT NULL REFERENCES public.classes (id) ON DELETE CASCADE,
  reason text NOT NULL,
  note text,
  status text NOT NULL DEFAULT 'open',
  resolved_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  resolved_at timestamptz,
  resolution_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT assignment_reports_reason_allowed CHECK (
    reason IN (
      'wrong_deadline',
      'wrong_details',
      'duplicate',
      'broken_attachment',
      'other'
    )
  ),
  CONSTRAINT assignment_reports_status_allowed CHECK (
    status IN ('open', 'resolved', 'dismissed')
  ),
  CONSTRAINT assignment_reports_note_length CHECK (
    note IS NULL
    OR char_length(btrim(note)) BETWEEN 5 AND 2000
  ),
  CONSTRAINT assignment_reports_resolution_note_length CHECK (
    resolution_note IS NULL
    OR char_length(btrim(resolution_note)) BETWEEN 5 AND 2000
  )
);


COMMENT ON TABLE public.assignment_reports IS 'Reader-submitted problems with an assignment. One open report per reader per assignment; written only through report_assignment() and reviewed through review_assignment_report().';


CREATE INDEX IF NOT EXISTS assignment_reports_queue_idx ON public.assignment_reports (status, created_at DESC);


CREATE INDEX IF NOT EXISTS assignment_reports_class_idx ON public.assignment_reports (class_id, status, created_at DESC);


-- A reader may re-report after their previous report was closed, but not stack
-- duplicates while one is still open.
CREATE UNIQUE INDEX IF NOT EXISTS assignment_reports_one_open_idx ON public.assignment_reports (assignment_id, reporter_id)
WHERE
  status = 'open';


-- ---------------------------------------------------------------------------
-- assignment_revisions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.assignment_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  assignment_id uuid NOT NULL REFERENCES public.assignments (id) ON DELETE CASCADE,
  class_id uuid REFERENCES public.classes (id) ON DELETE SET NULL,
  editor_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  revision integer NOT NULL,
  change_kind text NOT NULL DEFAULT 'updated',
  -- Only the fields a reader can see, so a revision never becomes a shadow
  -- copy of unrelated columns.
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  changed_fields text[] NOT NULL DEFAULT ARRAY[]::text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT assignment_revisions_kind_allowed CHECK (
    change_kind IN ('created', 'updated', 'moderated')
  )
);


COMMENT ON TABLE public.assignment_revisions IS 'Append-only snapshots of reader-visible assignment fields, written by the assignments trigger. Never updated or deleted from a client.';


CREATE INDEX IF NOT EXISTS assignment_revisions_assignment_idx ON public.assignment_revisions (assignment_id, created_at DESC);


-- ---------------------------------------------------------------------------
-- Trigger: snapshot every meaningful assignment change
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_assignment_revision () returns trigger language plpgsql security definer
SET
  search_path = public,
  pg_temp AS $$
declare
  v_changed text[] := array[]::text[];
begin
  if tg_op = 'INSERT' then
    insert into public.assignment_revisions (
      assignment_id, class_id, editor_id, revision, change_kind, snapshot, changed_fields
    ) values (
      new.id,
      new.class_id,
      new.user_id,
      new.revision,
      'created',
      jsonb_build_object(
        'title', new.title,
        'description', new.description,
        'deadline', new.deadline,
        'status', new.status,
        'course_id', new.course_id
      ),
      array['title', 'description', 'deadline', 'status', 'course_id']
    );
    return new;
  end if;

  -- The trigger fires only for the columns listed in its UPDATE OF clause, but
  -- compare explicitly so a no-op update does not create noise.
  if old.title is distinct from new.title then
    v_changed := array_append(v_changed, 'title');
  end if;

  if old.description is distinct from new.description then
    v_changed := array_append(v_changed, 'description');
  end if;

  if old.deadline is distinct from new.deadline then
    v_changed := array_append(v_changed, 'deadline');
  end if;

  if old.status is distinct from new.status then
    v_changed := array_append(v_changed, 'status');
  end if;

  if old.course_id is distinct from new.course_id then
    v_changed := array_append(v_changed, 'course_id');
  end if;

  if old.class_id is distinct from new.class_id then
    v_changed := array_append(v_changed, 'class_id');
  end if;

  if array_length(v_changed, 1) is null then
    return new;
  end if;

  insert into public.assignment_revisions (
    assignment_id, class_id, editor_id, revision, change_kind, snapshot, changed_fields
  ) values (
    new.id,
    new.class_id,
    (select auth.uid ()),
    new.revision,
    case when v_changed @> array['status'] then 'moderated' else 'updated' end,
    jsonb_build_object(
      'title', new.title,
      'description', new.description,
      'deadline', new.deadline,
      'status', new.status,
      'course_id', new.course_id
    ),
    v_changed
  );

  return new;
end;
$$;


DROP TRIGGER IF EXISTS assignments_record_revision ON public.assignments;


CREATE TRIGGER assignments_record_revision
AFTER INSERT
OR UPDATE OF title, description, deadline, status, course_id, class_id ON public.assignments FOR EACH ROW
EXECUTE FUNCTION public.record_assignment_revision ();


-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------
ALTER TABLE public.assignment_reports enable ROW LEVEL SECURITY;


ALTER TABLE public.assignment_revisions enable ROW LEVEL SECURITY;


-- A reader sees their own reports; a reviewer sees every report in a class they
-- manage (platform admins inherit that through can_manage_class).
DROP POLICY if EXISTS assignment_reports_select ON public.assignment_reports;


CREATE POLICY assignment_reports_select ON public.assignment_reports FOR
SELECT
  TO authenticated USING (
    reporter_id = (
      SELECT
        auth.uid ()
    )
    OR public.can_manage_class (class_id)
  );


-- Revision history is for people who can already act on the assignment: its
-- author, the class reviewers, and platform admins. It is not exposed to anon.
DROP POLICY if exists assignment_revisions_select ON public.assignment_revisions;

CREATE POLICY assignment_revisions_select ON public.assignment_revisions FOR
SELECT
  TO authenticated USING (
    public.can_manage_class (class_id)
    OR EXISTS (
      SELECT
        1
      FROM
        public.assignments a
      WHERE
        a.id = assignment_id
        AND a.user_id = (
          SELECT
            auth.uid ()
        )
    )
  );


-- ---------------------------------------------------------------------------
-- report_assignment
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.report_assignment (
  p_assignment_id uuid,
  p_reason text,
  p_note text DEFAULT NULL
) returns uuid language plpgsql security definer
SET
  search_path = public,
  pg_temp AS $$
declare
  v_user_id uuid := auth.uid ();
  v_class_id uuid;
  v_status text;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_report_id uuid;
begin
  if v_user_id is null then
    raise exception 'Sign in to report an assignment' using errcode = '42501';
  end if;

  select
    a.class_id,
    a.status into v_class_id,
    v_status
  from
    public.assignments a
  where
    a.id = p_assignment_id;

  if not found or v_status <> 'published' or v_class_id is null then
    raise exception 'Assignment not available' using errcode = 'P0002';
  end if;

  if p_reason not in (
    'wrong_deadline',
    'wrong_details',
    'duplicate',
    'broken_attachment',
    'other'
  ) then
    raise exception 'Unknown report reason' using errcode = '22023';
  end if;

  if v_note is not null and char_length(v_note) < 5 then
    raise exception 'Add a little more detail' using errcode = '22023';
  end if;

  insert into public.assignment_reports (
    assignment_id, reporter_id, class_id, reason, note
  ) values (
    p_assignment_id, v_user_id, v_class_id, p_reason, v_note
  )
  on conflict (assignment_id, reporter_id)
    where status = 'open'
  do update
  set
    reason = excluded.reason,
    note = excluded.note,
    updated_at = now()
  returning id
  into v_report_id;

  return v_report_id;
end;
$$;


-- ---------------------------------------------------------------------------
-- review_assignment_report
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.review_assignment_report (
  p_report_id uuid,
  p_status text,
  p_note text DEFAULT NULL
) returns void language plpgsql security definer
SET
  search_path = public,
  pg_temp AS $$
declare
  v_class_id uuid;
  v_assignment_id uuid;
  v_report_status text;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if p_status not in ('resolved', 'dismissed') then
    raise exception 'Unknown report status' using errcode = '22023';
  end if;

  if v_note is not null and char_length(v_note) < 5 then
    raise exception 'Add a short resolution note' using errcode = '22023';
  end if;

  select
    r.class_id,
    r.assignment_id,
    r.status into v_class_id,
    v_assignment_id,
    v_report_status
  from
    public.assignment_reports r
  where
    r.id = p_report_id;

  if not found then
    raise exception 'Report not found' using errcode = 'P0002';
  end if;

  if v_report_status <> 'open' then
    raise exception 'Report already reviewed' using errcode = '22023';
  end if;

  if not public.can_manage_class (v_class_id) then
    raise exception 'Not allowed to review this report' using errcode = '42501';
  end if;

  update public.assignment_reports
  set
    status = p_status,
    resolved_by = auth.uid (),
    resolved_at = now(),
    resolution_note = v_note,
    updated_at = now()
  where
    id = p_report_id
    and status = 'open';

  perform public.record_audit (
    'assignment_report_' || p_status,
    'assignment_report',
    p_report_id,
    v_class_id,
    jsonb_build_object('assignment_id', v_assignment_id)
  );
end;
$$;


-- ---------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------
REVOKE ALL ON function public.record_assignment_revision () FROM public;

REVOKE ALL ON function public.report_assignment (uuid, text, text) FROM public;

REVOKE ALL ON function public.review_assignment_report (uuid, text, text) FROM public;

GRANT
EXECUTE ON function public.report_assignment (uuid, text, text) TO authenticated;

GRANT
EXECUTE ON function public.review_assignment_report (uuid, text, text) TO authenticated;

GRANT
SELECT
  ON public.assignment_reports TO authenticated;

GRANT
SELECT
  ON public.assignment_revisions TO authenticated;

-- Class identity, academic-period scoping, lifecycle, and safe deletion.
--
-- Classes keep their UUID as the only relationship key. A human-readable class
-- code is added for display and duplicate detection, but it never replaces the
-- UUID. The same name and code may exist in different academic periods.
--
-- Lifecycle: draft -> active -> archived -> active. Draft classes are visible to
-- their managers only and cannot receive invitations or submissions. Archiving
-- keeps every membership, assignment, session, leave request, and schedule row.
-- Permanent deletion is limited to classes without academic history; everything
-- else must be archived.
-- ---------------------------------------------------------------------------
-- Class code and archive metadata
-- ---------------------------------------------------------------------------
ALTER TABLE public.classes
ADD COLUMN IF NOT EXISTS class_code text,
ADD COLUMN IF NOT EXISTS archived_at timestamptz,
ADD COLUMN IF NOT EXISTS archived_by uuid REFERENCES auth.users (id) ON DELETE SET NULL;


ALTER TABLE public.classes
ADD COLUMN IF NOT EXISTS class_code_normalized text generated always AS (nullif(lower(btrim(coalesce(class_code, ''))), '')) stored,
ADD COLUMN IF NOT EXISTS institution_normalized text generated always AS (nullif(lower(btrim(coalesce(institution, ''))), '')) stored;


ALTER TABLE public.classes
DROP CONSTRAINT IF EXISTS classes_class_code_length;


ALTER TABLE public.classes
ADD CONSTRAINT classes_class_code_length CHECK (
  class_code IS NULL
  OR char_length(btrim(class_code)) BETWEEN 2 AND 20
);


-- Draft joins active and archived. Existing rows are unaffected.
ALTER TABLE public.classes
DROP CONSTRAINT IF EXISTS classes_status_allowed;


ALTER TABLE public.classes
ADD CONSTRAINT classes_status_allowed CHECK (status IN ('draft', 'active', 'archived'));


-- A class code identifies a class inside one academic period and institution.
-- Reusing it in a different period is allowed; reusing it in the same period is
-- not, regardless of letter case or surrounding whitespace.
CREATE UNIQUE INDEX IF NOT EXISTS classes_period_code_key ON public.classes (
  class_code_normalized,
  academic_year,
  semester,
  coalesce(institution_normalized, '')
)
WHERE
  class_code_normalized IS NOT NULL;


CREATE INDEX IF NOT EXISTS classes_period_idx ON public.classes (academic_year, semester, status);


CREATE OR REPLACE FUNCTION public.sync_class_archived_at () returns trigger language plpgsql
SET
  search_path = '' AS $$ begin if new.status = 'archived'
  and old.status is distinct
from
  'archived' then new.archived_at := coalesce(new.archived_at, now());
new.archived_by := coalesce(
  new.archived_by,
  (
    select
      auth.uid ()
  )
);
elsif new.status <> 'archived' then new.archived_at := null;
new.archived_by := null;
end if;
return new;
end;
$$;


DROP TRIGGER IF EXISTS classes_sync_archived_at ON public.classes;


CREATE TRIGGER classes_sync_archived_at
BEFORE UPDATE ON public.classes FOR EACH ROW
EXECUTE FUNCTION public.sync_class_archived_at ();


-- ---------------------------------------------------------------------------
-- Column grants: class code is public metadata; archived_by stays private
-- ---------------------------------------------------------------------------
REVOKE ALL ON public.classes
FROM
  anon,
  authenticated;


GRANT
SELECT
  (
    id,
    slug,
    name,
    class_code,
    description,
    course_id,
    course_name,
    institution,
    lecturer_name,
    semester,
    academic_year,
    status,
    archived_at,
    created_at,
    updated_at
  ) ON public.classes TO anon;


-- join_policy is internal configuration and stays signed-in only, as
-- 20261031150000 intended.
GRANT
SELECT
  (
    id,
    slug,
    name,
    class_code,
    description,
    course_id,
    course_name,
    institution,
    lecturer_name,
    semester,
    academic_year,
    status,
    join_policy,
    archived_at,
    created_at,
    updated_at
  ) ON public.classes TO authenticated;


-- Draft classes stay manager-only. Archived classes remain readable for their
-- own members and managers; everyone else loses access.
DROP POLICY IF EXISTS classes_read ON public.classes;


CREATE POLICY classes_read ON public.classes FOR
SELECT
  TO anon,
  authenticated USING (
    status = 'active'
    OR (
      status = 'draft'
      AND public.can_manage_class (id)
    )
    OR (
      status = 'archived'
      AND (
        public.is_class_member (id)
        OR public.can_manage_class (id)
      )
    )
  );


-- ---------------------------------------------------------------------------
-- Applications carry the proposed class code
-- ---------------------------------------------------------------------------
ALTER TABLE public.class_applications
ADD COLUMN IF NOT EXISTS proposed_class_code text;


ALTER TABLE public.class_applications
DROP CONSTRAINT IF EXISTS class_applications_class_code_length;


ALTER TABLE public.class_applications
ADD CONSTRAINT class_applications_class_code_length CHECK (
  proposed_class_code IS NULL
  OR char_length(btrim(proposed_class_code)) BETWEEN 2 AND 20
);


REVOKE ALL ON public.class_applications
FROM
  anon,
  authenticated;


GRANT
SELECT
  (
    id,
    applicant_id,
    proposed_slug,
    proposed_name,
    proposed_class_code,
    course_name,
    institution,
    lecturer_name,
    semester,
    academic_year,
    description,
    reason,
    supporting_info,
    status,
    reviewed_by,
    reviewed_at,
    decision_note,
    created_class_id,
    created_at,
    updated_at
  ) ON public.class_applications TO authenticated;


-- ---------------------------------------------------------------------------
-- apply_for_class / revise_class_application: store the normalized class code
-- ---------------------------------------------------------------------------
DROP FUNCTION if EXISTS public.apply_for_class (text, text, text, text, text, text, text, text, text, text);


CREATE OR REPLACE FUNCTION public.apply_for_class (
  p_proposed_slug text,
  p_proposed_name text,
  p_course_name text,
  p_semester text,
  p_academic_year text,
  p_description text,
  p_reason text,
  p_institution text DEFAULT NULL,
  p_lecturer_name text DEFAULT NULL,
  p_supporting_info text DEFAULT NULL,
  p_proposed_class_code text DEFAULT NULL
) returns uuid language plpgsql security definer
SET
  search_path = public,
  pg_temp AS $$
declare
  v_user uuid := (
    select
      auth.uid ()
  );
  v_slug text := lower(btrim(coalesce(p_proposed_slug, '')));
  v_code text := nullif(upper(btrim(coalesce(p_proposed_class_code, ''))), '');
  v_id uuid;
begin if v_user is null then raise exception 'authentication required' using errcode = '42501';
end if;
insert into public.class_applications (
  applicant_id,
  proposed_slug,
  proposed_name,
  proposed_class_code,
  course_name,
  institution,
  lecturer_name,
  semester,
  academic_year,
  description,
  reason,
  supporting_info
)
values (
  v_user,
  v_slug,
  btrim(p_proposed_name),
  v_code,
  btrim(p_course_name),
  nullif(btrim(coalesce(p_institution, '')), ''),
  nullif(btrim(coalesce(p_lecturer_name, '')), ''),
  btrim(p_semester),
  btrim(p_academic_year),
  btrim(p_description),
  btrim(p_reason),
  nullif(btrim(coalesce(p_supporting_info, '')), '')
)
returning
  id into v_id;
perform public.record_audit(
  'class_application_submitted',
  'class_application',
  v_id,
  null,
  jsonb_build_object('proposed_slug', v_slug, 'proposed_class_code', v_code)
);
return v_id;
exception
  when unique_violation then raise exception 'an open application for this class already exists' using errcode = '23505';
end;
$$;


REVOKE ALL ON function public.apply_for_class (
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text
)
FROM
  public,
  anon,
  authenticated;


GRANT
EXECUTE ON function public.apply_for_class (
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text
) TO authenticated;


DROP FUNCTION if EXISTS public.revise_class_application (
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text
);


CREATE OR REPLACE FUNCTION public.revise_class_application (
  p_application_id uuid,
  p_proposed_slug text,
  p_proposed_name text,
  p_course_name text,
  p_semester text,
  p_academic_year text,
  p_description text,
  p_reason text,
  p_institution text DEFAULT NULL,
  p_lecturer_name text DEFAULT NULL,
  p_supporting_info text DEFAULT NULL,
  p_proposed_class_code text DEFAULT NULL
) returns boolean language plpgsql security definer
SET
  search_path = public,
  pg_temp AS $$
declare
  v_user uuid := (
    select
      auth.uid ()
  );
  v_id uuid;
begin if v_user is null then raise exception 'authentication required' using errcode = '42501';
end if;
update public.class_applications
set
  proposed_slug = lower(btrim(coalesce(p_proposed_slug, ''))),
  proposed_name = btrim(p_proposed_name),
  proposed_class_code = nullif(upper(btrim(coalesce(p_proposed_class_code, ''))), ''),
  course_name = btrim(p_course_name),
  institution = nullif(btrim(coalesce(p_institution, '')), ''),
  lecturer_name = nullif(btrim(coalesce(p_lecturer_name, '')), ''),
  semester = btrim(p_semester),
  academic_year = btrim(p_academic_year),
  description = btrim(p_description),
  reason = btrim(p_reason),
  supporting_info = nullif(btrim(coalesce(p_supporting_info, '')), ''),
  status = 'pending',
  reviewed_by = null,
  reviewed_at = null,
  decision_note = null,
  created_class_id = null
where
  id = p_application_id
  and applicant_id = v_user
  and status in ('pending', 'rejected')
returning
  id into v_id;
if v_id is null then raise exception 'application not found or not editable' using errcode = 'P0002';
end if;
perform public.record_audit(
  'class_application_revised',
  'class_application',
  v_id,
  null,
  '{}'::jsonb
);
return true;
exception
  when unique_violation then raise exception 'an open application for this class already exists' using errcode = '23505';
end;
$$;


REVOKE ALL ON function public.revise_class_application (
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text
)
FROM
  public,
  anon,
  authenticated;


GRANT
EXECUTE ON function public.revise_class_application (
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text
) TO authenticated;


-- ---------------------------------------------------------------------------
-- findByClassDuplicates: preliminary warning for applicants and managers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.find_class_duplicates (
  p_name text,
  p_class_code text,
  p_academic_year text,
  p_semester text,
  p_institution text DEFAULT NULL,
  p_exclude_class_id uuid DEFAULT NULL
) returns TABLE (
  class_id uuid,
  slug text,
  name text,
  class_code text,
  academic_year text,
  semester text,
  institution text,
  status text,
  code_match boolean,
  name_match boolean
) language sql stable security definer
SET
  search_path = public,
  pg_temp AS $$
select
  c.id,
  c.slug,
  c.name,
  c.class_code,
  c.academic_year,
  c.semester,
  c.institution,
  c.status,
  (
    c.class_code_normalized is not null
    and c.class_code_normalized = nullif(lower(btrim(coalesce(p_class_code, ''))), '')
  ) as code_match,
  lower(btrim(c.name)) = lower(btrim(coalesce(p_name, ''))) as name_match
from
  public.classes c
where
  (p_exclude_class_id is null or c.id <> p_exclude_class_id)
  and c.academic_year = btrim(coalesce(p_academic_year, ''))
  and lower(btrim(c.semester)) = lower(btrim(coalesce(p_semester, '')))
  and coalesce(c.institution_normalized, '') = coalesce(
    nullif(lower(btrim(coalesce(p_institution, ''))), ''),
    ''
  )
  and (
    (
      c.class_code_normalized is not null
      and c.class_code_normalized = nullif(lower(btrim(coalesce(p_class_code, ''))), '')
    )
    or lower(btrim(c.name)) = lower(btrim(coalesce(p_name, '')))
  )
  and (c.status <> 'draft' or public.can_manage_class (c.id))
order by
  c.created_at desc
limit 10;
$$;


COMMENT ON FUNCTION public.find_class_duplicates (text, text, text, text, text, uuid) IS 'Classes in the same academic period and institution whose normalized code or name matches. Used for a warning, never for an automatic merge.';


REVOKE ALL ON function public.find_class_duplicates (text, text, text, text, text, uuid)
FROM
  public,
  anon,
  authenticated;


GRANT
EXECUTE ON function public.find_class_duplicates (text, text, text, text, text, uuid) TO authenticated;


-- ---------------------------------------------------------------------------
-- decide_class_application: preserve the class code, allow starting as draft
-- ---------------------------------------------------------------------------
DROP FUNCTION if EXISTS public.decide_class_application (uuid, text, text, boolean);


CREATE OR REPLACE FUNCTION public.decide_class_application (
  p_application_id uuid,
  p_decision text,
  p_note text DEFAULT NULL,
  p_grant_class_admin boolean DEFAULT FALSE,
  p_initial_status text DEFAULT 'active'
) returns uuid language plpgsql security definer
SET
  search_path = public,
  pg_temp AS $$
declare
  v_reviewer uuid := (
    select
      auth.uid ()
  );
  v_app public.class_applications;
  v_class_id uuid;
  v_course_id uuid;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_status text := coalesce(p_initial_status, 'active');
  v_constraint text;
begin if not public.is_platform_admin () then raise exception 'platform admin required' using errcode = '42501';
end if;
if p_decision not in ('approved', 'rejected') then raise exception 'invalid decision' using errcode = '22023';
end if;
if v_status not in ('draft', 'active') then raise exception 'invalid initial class status' using errcode = '22023';
end if;
select
  * into v_app
from
  public.class_applications
where
  id = p_application_id for
update;
if not found then raise exception 'application not found' using errcode = 'P0002';
end if;
if v_app.status <> 'pending' then raise exception 'application is not pending' using errcode = '22023';
end if;
if p_decision = 'rejected' then if v_note is null
or char_length(v_note) < 3 then raise exception 'rejection reason required' using errcode = '22023';
end if;
update public.class_applications
set
  status = 'rejected',
  reviewed_by = v_reviewer,
  reviewed_at = now(),
  decision_note = v_note
where
  id = v_app.id;
insert into public.class_application_reviews (application_id, reviewer_id, decision, note)
values (v_app.id, v_reviewer, 'rejected', v_note);
perform public.record_audit(
  'class_application_rejected',
  'class_application',
  v_app.id,
  null,
  '{}'::jsonb
);
perform public.enqueue_notification_event(
  v_app.applicant_id,
  'class_application_rejected',
  'class_application:' || v_app.id || ':rejected',
  jsonb_build_object(
    'title',
    'Class application rejected',
    'body',
    'Open StarsTask to read the reviewer note and resubmit if needed.',
    'url',
    '/dashboard'
  )
);
return null;
end if;
if exists (
  select
    1
  from
    public.classes c
  where
    c.slug = v_app.proposed_slug
) then raise exception 'class slug already taken' using errcode = '23505';
end if;
insert into public.courses (name)
values (v_app.course_name) on conflict (normalized_name) do
update
set
  name = excluded.name returning id into v_course_id;
begin
insert into public.classes (
  slug,
  name,
  class_code,
  description,
  course_id,
  course_name,
  institution,
  lecturer_name,
  semester,
  academic_year,
  status,
  created_by
)
values (
  v_app.proposed_slug,
  v_app.proposed_name,
  nullif(upper(btrim(coalesce(v_app.proposed_class_code, ''))), ''),
  v_app.description,
  v_course_id,
  v_app.course_name,
  v_app.institution,
  v_app.lecturer_name,
  v_app.semester,
  v_app.academic_year,
  v_status,
  v_reviewer
)
returning
  id into v_class_id;
exception
  when unique_violation then get stacked diagnostics v_constraint = constraint_name;
  if v_constraint = 'classes_period_code_key' then raise exception 'class code already used in this academic period' using errcode = '23505';
  end if;
  raise;
end;
insert into public.class_members (class_id, user_id, joined_via)
values (v_class_id, v_app.applicant_id, 'platform_assignment');
if p_grant_class_admin then
insert into public.class_admins (class_id, user_id, assigned_by)
values (v_class_id, v_app.applicant_id, v_reviewer);
end if;
update public.class_applications
set
  status = 'approved',
  reviewed_by = v_reviewer,
  reviewed_at = now(),
  decision_note = v_note,
  created_class_id = v_class_id
where
  id = v_app.id;
insert into public.class_application_reviews (application_id, reviewer_id, decision, note)
values (v_app.id, v_reviewer, 'approved', v_note);
perform public.record_audit(
  'class_application_approved',
  'class_application',
  v_app.id,
  v_class_id,
  jsonb_build_object(
    'slug',
    v_app.proposed_slug,
    'class_code',
    v_app.proposed_class_code,
    'status',
    v_status
  )
);
perform public.enqueue_notification_event(
  v_app.applicant_id,
  'class_application_approved',
  'class_application:' || v_app.id || ':approved',
  jsonb_build_object(
    'title',
    'Class application approved',
    'body',
    case
      when v_status = 'draft' then 'Your class is approved as a draft. Activate it from Manage when it is ready.'
      else 'Your class is live on StarsTask.'
    end,
    'url',
    case
      when v_status = 'draft' then '/dashboard/classes/' || v_app.proposed_slug || '/manage'
      else '/classes/' || v_app.proposed_slug
    end
  )
);
return v_class_id;
end;
$$;


REVOKE ALL ON function public.decide_class_application (uuid, text, text, boolean, text)
FROM
  public,
  anon,
  authenticated;


GRANT
EXECUTE ON function public.decide_class_application (uuid, text, text, boolean, text) TO authenticated;


-- ---------------------------------------------------------------------------
-- set_class_status: controlled transitions, managers may archive and restore
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_class_status (p_class_id uuid, p_status text) returns boolean language plpgsql security definer
SET
  search_path = public,
  pg_temp AS $$
declare
  v_actor uuid := (
    select
      auth.uid ()
  );
  v_class public.classes;
  v_action text;
begin if v_actor is null then raise exception 'authentication required' using errcode = '42501';
end if;
if p_status not in ('draft', 'active', 'archived') then raise exception 'invalid class status' using errcode = '22023';
end if;
if not public.can_manage_class (p_class_id) then raise exception 'class manager required' using errcode = '42501';
end if;
select
  * into v_class
from
  public.classes
where
  id = p_class_id for
update;
if not found then raise exception 'class not found' using errcode = 'P0002';
end if;
if v_class.status = p_status then return true;
end if;
-- draft can be activated or archived; active can be archived; archived can be
-- restored. Moving an active class back to draft would silently hide it from its
-- members, so it is not a valid transition.
if not (
  (v_class.status = 'draft' and p_status in ('active', 'archived'))
  or (v_class.status = 'active' and p_status = 'archived')
  or (v_class.status = 'archived' and p_status = 'active')
) then raise exception 'invalid class status transition from % to %', v_class.status, p_status using errcode = '22023';
end if;
v_action := case
  when p_status = 'archived' then 'class_archived'
  when v_class.status = 'draft' then 'class_activated'
  else 'class_restored'
end;
update public.classes
set
  status = p_status,
  archived_at = case
    when p_status = 'archived' then now()
    else null
  end,
  archived_by = case
    when p_status = 'archived' then v_actor
    else null
  end
where
  id = p_class_id;
perform public.record_audit(
  v_action,
  'class',
  p_class_id,
  p_class_id,
  jsonb_build_object('from', v_class.status, 'to', p_status)
);
return true;
end;
$$;


REVOKE ALL ON function public.set_class_status (uuid, text)
FROM
  public,
  anon,
  authenticated;


GRANT
EXECUTE ON function public.set_class_status (uuid, text) TO authenticated;


-- ---------------------------------------------------------------------------
-- get_class_dependencies: the numbers the delete confirmation must show
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_class_dependencies (p_class_id uuid) returns TABLE (
  class_status text,
  member_count bigint,
  assignment_count bigint,
  submission_count bigint,
  session_count bigint,
  attendance_count bigint,
  schedule_count bigint,
  calendar_event_count bigint,
  leave_request_count bigint,
  subject_count bigint,
  invitation_count bigint,
  has_history boolean,
  can_delete boolean
) language plpgsql stable security definer
SET
  search_path = public,
  pg_temp AS $$
declare
  v_class public.classes;
  v_members bigint;
  v_assignments bigint;
  v_submissions bigint;
  v_sessions bigint;
  v_attendance bigint;
  v_schedules bigint;
  v_events bigint;
  v_leave bigint;
  v_subjects bigint;
  v_invitations bigint;
begin if not public.can_manage_class (p_class_id) then raise exception 'class manager required' using errcode = '42501';
end if;
select
  * into v_class
from
  public.classes
where
  id = p_class_id;
if not found then raise exception 'class not found' using errcode = 'P0002';
end if;
select count(*) into v_members
from
  public.class_members
where
  class_id = p_class_id;
select count(*) into v_assignments
from
  public.assignments
where
  class_id = p_class_id;
select count(distinct r.assignment_id) into v_submissions
from
  public.assignment_reviews r
  join public.assignments a on a.id = r.assignment_id
where
  a.class_id = p_class_id;
select count(*) into v_sessions
from
  public.discussion_sessions
where
  class_id = p_class_id;
select count(*) into v_attendance
from
  public.discussion_session_checkins c
  join public.discussion_sessions s on s.id = c.session_id
where
  s.class_id = p_class_id;
select count(*) into v_schedules
from
  public.class_course_schedules
where
  class_id = p_class_id;
select count(*) into v_events
from
  public.class_calendar_events
where
  class_id = p_class_id;
select count(*) into v_leave
from
  public.leave_requests
where
  class_id = p_class_id;
select count(*) into v_subjects
from
  public.class_subjects
where
  class_id = p_class_id;
select count(*) into v_invitations
from
  public.class_invitations
where
  class_id = p_class_id;
return query
select
  v_class.status,
  v_members,
  v_assignments,
  v_submissions,
  v_sessions,
  v_attendance,
  v_schedules,
  v_events,
  v_leave,
  v_subjects,
  v_invitations,
  (
    v_assignments + v_submissions + v_sessions + v_attendance + v_leave
  ) > 0,
  case
    when v_class.status = 'draft' then (
      v_assignments + v_submissions + v_sessions + v_attendance + v_leave
    ) = 0
    else (
      v_members + v_assignments + v_submissions + v_sessions + v_attendance
      + v_schedules + v_events + v_leave + v_subjects + v_invitations
    ) = 0
  end;
end;
$$;


COMMENT ON FUNCTION public.get_class_dependencies (uuid) IS 'Counts every dependent row and decides whether permanent deletion is allowed. Class manager or platform admin only.';


REVOKE ALL ON function public.get_class_dependencies (uuid)
FROM
  public,
  anon,
  authenticated;


GRANT
EXECUTE ON function public.get_class_dependencies (uuid) TO authenticated;


-- ---------------------------------------------------------------------------
-- delete_class: permanent deletion only when no academic history exists
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.delete_class (p_class_id uuid) returns boolean language plpgsql security definer
SET
  search_path = public,
  pg_temp AS $$
declare
  v_actor uuid := (
    select
      auth.uid ()
  );
  v_class public.classes;
  v_members bigint;
  v_assignments bigint;
  v_submissions bigint;
  v_sessions bigint;
  v_attendance bigint;
  v_schedules bigint;
  v_events bigint;
  v_leave bigint;
  v_subjects bigint;
  v_invitations bigint;
  v_has_academic boolean;
  v_can_delete boolean;
begin if v_actor is null then raise exception 'authentication required' using errcode = '42501';
end if;
if not public.can_manage_class (p_class_id) then raise exception 'class manager required' using errcode = '42501';
end if;
select
  * into v_class
from
  public.classes
where
  id = p_class_id for
update;
if not found then raise exception 'class not found' using errcode = 'P0002';
end if;
select count(*) into v_members
from
  public.class_members
where
  class_id = p_class_id;
select count(*) into v_assignments
from
  public.assignments
where
  class_id = p_class_id;
select count(distinct r.assignment_id) into v_submissions
from
  public.assignment_reviews r
  join public.assignments a on a.id = r.assignment_id
where
  a.class_id = p_class_id;
select count(*) into v_sessions
from
  public.discussion_sessions
where
  class_id = p_class_id;
select count(*) into v_attendance
from
  public.discussion_session_checkins c
  join public.discussion_sessions s on s.id = c.session_id
where
  s.class_id = p_class_id;
select count(*) into v_schedules
from
  public.class_course_schedules
where
  class_id = p_class_id;
select count(*) into v_events
from
  public.class_calendar_events
where
  class_id = p_class_id;
select count(*) into v_leave
from
  public.leave_requests
where
  class_id = p_class_id;
select count(*) into v_subjects
from
  public.class_subjects
where
  class_id = p_class_id;
select count(*) into v_invitations
from
  public.class_invitations
where
  class_id = p_class_id;
v_has_academic := (
  v_assignments + v_submissions + v_sessions + v_attendance + v_leave
) > 0;
v_can_delete := case
  when v_class.status = 'draft' then not v_has_academic
  else (
    v_members + v_assignments + v_submissions + v_sessions + v_attendance
    + v_schedules + v_events + v_leave + v_subjects + v_invitations
  ) = 0
end;
if not v_can_delete then raise exception 'class has related records; archive it instead' using errcode = 'P0001';
end if;
-- Audit metadata survives the delete because audit_logs.class_id is nulled by
-- the foreign key, so the identity is copied into the payload.
perform public.record_audit(
  'class_deleted',
  'class',
  p_class_id,
  null,
  jsonb_build_object(
    'slug',
    v_class.slug,
    'name',
    v_class.name,
    'class_code',
    v_class.class_code,
    'academic_year',
    v_class.academic_year,
    'semester',
    v_class.semester,
    'status',
    v_class.status,
    'members',
    v_members,
    'assignments',
    v_assignments,
    'submissions',
    v_submissions,
    'sessions',
    v_sessions,
    'attendance',
    v_attendance,
    'schedules',
    v_schedules,
    'leave_requests',
    v_leave
  )
);
delete from public.classes
where
  id = p_class_id;
return true;
end;
$$;


COMMENT ON FUNCTION public.delete_class (uuid) IS 'Permanently deletes an empty or draft class. Classes with academic history must be archived instead. Class manager or platform admin only.';


REVOKE ALL ON function public.delete_class (uuid)
FROM
  public,
  anon,
  authenticated;


GRANT
EXECUTE ON function public.delete_class (uuid) TO authenticated;


-- ---------------------------------------------------------------------------
-- update_class_metadata: add the class code, block edits on archived classes
-- ---------------------------------------------------------------------------
DROP FUNCTION if EXISTS public.update_class_metadata (uuid, text, text, text, text, text, text, text);


CREATE OR REPLACE FUNCTION public.update_class_metadata (
  p_class_id uuid,
  p_name text,
  p_description text,
  p_course_name text,
  p_semester text,
  p_academic_year text,
  p_institution text DEFAULT NULL,
  p_lecturer_name text DEFAULT NULL,
  p_class_code text DEFAULT NULL
) returns boolean language plpgsql security definer
SET
  search_path = public,
  pg_temp AS $$
declare
  v_course_id uuid;
  v_class public.classes;
  v_constraint text;
begin if not public.can_manage_class (p_class_id) then raise exception 'class manager required' using errcode = '42501';
end if;
select
  * into v_class
from
  public.classes
where
  id = p_class_id for
update;
if not found then raise exception 'class not found' using errcode = 'P0002';
end if;
if v_class.status = 'archived' then raise exception 'restore the class before editing its details' using errcode = '22023';
end if;
insert into public.courses (name)
values (btrim(p_course_name)) on conflict (normalized_name) do
update
set
  name = excluded.name returning id into v_course_id;
begin
update public.classes
set
  name = btrim(p_name),
  description = btrim(p_description),
  class_code = coalesce(
    nullif(upper(btrim(coalesce(p_class_code, ''))), ''),
    v_class.class_code
  ),
  course_id = v_course_id,
  course_name = btrim(p_course_name),
  institution = nullif(btrim(coalesce(p_institution, '')), ''),
  lecturer_name = nullif(btrim(coalesce(p_lecturer_name, '')), ''),
  semester = btrim(p_semester),
  academic_year = btrim(p_academic_year)
where
  id = p_class_id;
exception
  when unique_violation then get stacked diagnostics v_constraint = constraint_name;
  if v_constraint = 'classes_period_code_key' then raise exception 'class code already used in this academic period' using errcode = '23505';
  end if;
  raise;
end;
perform public.record_audit(
  'class_updated',
  'class',
  p_class_id,
  p_class_id,
  jsonb_build_object('class_code', p_class_code)
);
return true;
end;
$$;


REVOKE ALL ON function public.update_class_metadata (uuid, text, text, text, text, text, text, text, text)
FROM
  public,
  anon,
  authenticated;


GRANT
EXECUTE ON function public.update_class_metadata (uuid, text, text, text, text, text, text, text, text) TO authenticated;


-- ---------------------------------------------------------------------------
-- Public discovery: expose the class code and search it
-- ---------------------------------------------------------------------------
DROP FUNCTION if EXISTS public.list_classes (text, text, integer, integer);


CREATE OR REPLACE FUNCTION public.list_classes (
  p_search text DEFAULT NULL,
  p_semester text DEFAULT NULL,
  p_limit integer DEFAULT 12,
  p_offset integer DEFAULT 0
) returns TABLE (
  id uuid,
  slug text,
  name text,
  class_code text,
  description text,
  course_name text,
  institution text,
  lecturer_name text,
  semester text,
  academic_year text,
  created_at timestamptz,
  member_count bigint,
  total_count bigint
) language sql stable security definer
SET
  search_path = public,
  pg_temp AS $$
with filtered as (
  select
    c.id,
    c.slug,
    c.name,
    c.class_code,
    c.description,
    c.course_name,
    c.institution,
    c.lecturer_name,
    c.semester,
    c.academic_year,
    c.created_at,
    (
      select count(*)
      from public.class_members m
      where m.class_id = c.id
    ) as member_count
  from public.classes c
  where c.status = 'active'
    and (
      p_search is null
      or c.name ilike '%' || p_search || '%'
      or c.course_name ilike '%' || p_search || '%'
      or coalesce(c.class_code, '') ilike '%' || p_search || '%'
      or coalesce(c.lecturer_name, '') ilike '%' || p_search || '%'
    )
    and (p_semester is null or c.semester = p_semester)
)
select
  f.id,
  f.slug,
  f.name,
  f.class_code,
  f.description,
  f.course_name,
  f.institution,
  f.lecturer_name,
  f.semester,
  f.academic_year,
  f.created_at,
  f.member_count,
  count(*) over () as total_count
from filtered f
order by f.created_at desc
limit least(greatest(coalesce(p_limit, 12), 1), 24)
offset greatest(coalesce(p_offset, 0), 0);
$$;


COMMENT ON FUNCTION public.list_classes (text, text, integer, integer) IS 'Public class discovery: active classes only, bounded page, total count.';


REVOKE ALL ON function public.list_classes (text, text, integer, integer)
FROM
  public;


GRANT
EXECUTE ON function public.list_classes (text, text, integer, integer) TO anon,
authenticated;


-- ---------------------------------------------------------------------------
-- Platform admin listing: draft/archived filters and period filters
-- ---------------------------------------------------------------------------
DROP FUNCTION if EXISTS public.list_platform_classes (text, text, integer, integer);


CREATE OR REPLACE FUNCTION public.list_platform_classes (
  p_search text DEFAULT NULL,
  p_status text DEFAULT 'all',
  p_academic_year text DEFAULT NULL,
  p_semester text DEFAULT NULL,
  p_limit integer DEFAULT 20,
  p_offset integer DEFAULT 0
) returns TABLE (
  id uuid,
  slug text,
  name text,
  class_code text,
  description text,
  course_name text,
  institution text,
  lecturer_name text,
  semester text,
  academic_year text,
  status text,
  archived_at timestamptz,
  created_at timestamptz,
  member_count bigint,
  admin_count bigint,
  subject_count bigint,
  admin_names TEXT[],
  total_count bigint
) language plpgsql stable security definer
SET
  search_path = public,
  pg_temp AS $$
declare
  v_search text := nullif(btrim(coalesce(p_search, '')), '');
  v_year text := nullif(btrim(coalesce(p_academic_year, '')), '');
  v_semester text := nullif(btrim(coalesce(p_semester, '')), '');
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
begin
  if not public.is_platform_admin () then
    raise exception 'platform admin required' using errcode = '42501';
  end if;

  if p_status not in ('all', 'draft', 'active', 'archived') then
    raise exception 'invalid status filter' using errcode = '22023';
  end if;

  return query
  with filtered as (
    select
      c.*
    from
      public.classes c
    where
      (p_status = 'all' or c.status = p_status)
      and (v_year is null or c.academic_year = v_year)
      and (v_semester is null or c.semester = v_semester)
      and (
        v_search is null
        or c.name ilike '%' || v_search || '%'
        or c.course_name ilike '%' || v_search || '%'
        or c.slug ilike '%' || v_search || '%'
        or coalesce(c.class_code, '') ilike '%' || v_search || '%'
        or coalesce(c.institution, '') ilike '%' || v_search || '%'
      )
  ),
  page as (
    select
      f.*,
      count(*) over () as total_count
    from
      filtered f
    order by
      f.created_at desc,
      f.id
    limit v_limit
    offset v_offset
  )
  select
    p.id,
    p.slug,
    p.name,
    p.class_code,
    p.description,
    p.course_name,
    p.institution,
    p.lecturer_name,
    p.semester,
    p.academic_year,
    p.status,
    p.archived_at,
    p.created_at,
    (
      select
        count(*)
      from
        public.class_members cm
      where
        cm.class_id = p.id
    ),
    (
      select
        count(*)
      from
        public.class_admins ca
      where
        ca.class_id = p.id
    ),
    (
      select
        count(*)
      from
        public.class_subjects cs
      where
        cs.class_id = p.id
        and cs.status = 'active'
    ),
    coalesce(
      (
        select
          array_agg(pr.display_name order by pr.display_name)
        from
          public.class_admins ca
          join public.profiles pr on pr.id = ca.user_id
        where
          ca.class_id = p.id
      ),
      '{}'::text[]
    ),
    p.total_count
  from
    page p
  order by
    p.created_at desc,
    p.id;
end;
$$;


COMMENT ON FUNCTION public.list_platform_classes (text, text, text, text, integer, integer) IS 'Platform admin class directory with lifecycle and period filters.';


REVOKE ALL ON function public.list_platform_classes (text, text, text, text, integer, integer)
FROM
  public,
  anon,
  authenticated;


GRANT
EXECUTE ON function public.list_platform_classes (text, text, text, text, integer, integer) TO authenticated;

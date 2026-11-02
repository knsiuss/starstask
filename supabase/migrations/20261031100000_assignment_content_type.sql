-- ---------------------------------------------------------------------------
-- Assignment content types, Drive links, and personal completion tracking
-- ---------------------------------------------------------------------------
-- Two kinds of class content share one table:
--
--   lecturer_assignment  instructions the class admin recorded on behalf of a
--                        lecturer. `source_label` names the lecturer; the class
--                        admin remains only the recorder, never the author.
--   class_announcement   internal class information with no academic source.
--
-- The distinction is a real column with a check constraint, not a UI label, so
-- every list, filter, and policy can rely on it.
ALTER TABLE public.assignments
ADD COLUMN IF NOT EXISTS content_type text NOT NULL DEFAULT 'lecturer_assignment';


ALTER TABLE public.assignments
DROP CONSTRAINT if EXISTS assignments_content_type_allowed;


ALTER TABLE public.assignments
ADD CONSTRAINT assignments_content_type_allowed CHECK (
  content_type IN ('lecturer_assignment', 'class_announcement')
);


-- Who the instructions came from. Null for class announcements, and never
-- derived from the recording administrator's profile.
ALTER TABLE public.assignments
ADD COLUMN IF NOT EXISTS source_label text;


ALTER TABLE public.assignments
DROP CONSTRAINT if EXISTS assignments_source_label_length;


ALTER TABLE public.assignments
ADD CONSTRAINT assignments_source_label_length CHECK (
  source_label IS NULL
  OR char_length(btrim(source_label)) BETWEEN 1 AND 120
);


-- Optional Google Drive link. Only https URLs are stored; the app validates the
-- host, the database guarantees the scheme.
ALTER TABLE public.assignments
ADD COLUMN IF NOT EXISTS drive_url text;


ALTER TABLE public.assignments
DROP CONSTRAINT if EXISTS assignments_drive_url_https;


ALTER TABLE public.assignments
ADD CONSTRAINT assignments_drive_url_https CHECK (
  drive_url IS NULL
  OR drive_url ~ '^https://[^[:space:]]{8,2048}$'
);


ALTER TABLE public.assignments
ADD COLUMN IF NOT EXISTS archived_at timestamptz;


-- Keep `archived_at` truthful without touching every moderation path: a row is
-- archived exactly when its status says so.
CREATE OR REPLACE FUNCTION public.sync_assignment_archived_at () returns trigger language plpgsql
SET
  search_path = public,
  pg_temp AS $$
begin
  if new.status = 'archived' and (old.status is distinct from 'archived') then
    new.archived_at := coalesce(new.archived_at, now());
  elsif new.status <> 'archived' then
    new.archived_at := null;
  end if;

  return new;
end;
$$;


DROP TRIGGER if EXISTS assignments_sync_archived_at ON public.assignments;


CREATE TRIGGER assignments_sync_archived_at
BEFORE UPDATE OF status ON public.assignments FOR EACH ROW
EXECUTE FUNCTION public.sync_assignment_archived_at ();


-- ---------------------------------------------------------------------------
-- Personal completion tracking
-- ---------------------------------------------------------------------------
-- Per-student, per-assignment progress. It never modifies the assignment and
-- never claims the student submitted anything to a lecturer.
CREATE TABLE IF NOT EXISTS public.assignment_completions (
  assignment_id uuid NOT NULL REFERENCES public.assignments (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  completed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (assignment_id, user_id)
);


CREATE INDEX if NOT EXISTS assignment_completions_user_idx ON public.assignment_completions (user_id, completed_at DESC);


ALTER TABLE public.assignment_completions enable ROW level security;


DROP POLICY if EXISTS "assignment_completions_select_own" ON public.assignment_completions;


CREATE POLICY "assignment_completions_select_own" ON public.assignment_completions FOR
SELECT
  TO authenticated USING (
    user_id = (
      SELECT
        auth.uid ()
    )
  );


DROP POLICY if EXISTS "assignment_completions_insert_own" ON public.assignment_completions;


CREATE POLICY "assignment_completions_insert_own" ON public.assignment_completions FOR insert TO authenticated
WITH
  CHECK (
    user_id = (
      SELECT
        auth.uid ()
    )
    AND EXISTS (
      SELECT
        1
      FROM
        public.assignments a
      WHERE
        a.id = assignment_id
        AND a.status = 'published'
        AND a.class_id IS NOT NULL
        AND public.is_class_member (a.class_id)
    )
  );


DROP POLICY if EXISTS "assignment_completions_delete_own" ON public.assignment_completions;


CREATE POLICY "assignment_completions_delete_own" ON public.assignment_completions FOR delete TO authenticated USING (
  user_id = (
    SELECT
      auth.uid ()
  )
);


REVOKE ALL ON TABLE public.assignment_completions
FROM
  anon;


GRANT
SELECT
,
  insert,
  delete ON TABLE public.assignment_completions TO authenticated;


-- ---------------------------------------------------------------------------
-- Creation: carry the content type, source, and Drive link through
-- ---------------------------------------------------------------------------
-- The old signature is dropped first: adding parameters would otherwise leave
-- two overloads and make every existing call ambiguous.
DROP FUNCTION if EXISTS public.submit_class_assignment (uuid, text, text, timestamptz, text, TEXT[], jsonb);


CREATE OR REPLACE FUNCTION public.submit_class_assignment (
  p_class_id uuid,
  p_title text,
  p_description text,
  p_deadline timestamptz DEFAULT NULL,
  p_assignment_type text DEFAULT NULL,
  p_tags TEXT[] DEFAULT '{}',
  p_reference_urls jsonb DEFAULT '[]'::jsonb,
  p_content_type text DEFAULT 'lecturer_assignment',
  p_source_label text DEFAULT NULL,
  p_drive_url text DEFAULT NULL,
  p_subject_id uuid DEFAULT NULL
) returns uuid language plpgsql security definer
SET
  search_path = public,
  pg_temp AS $$
declare
  v_user uuid := (
    select
      auth.uid ()
  );
  v_class public.classes;
  v_id uuid;
begin if v_user is null then raise exception 'authentication required' using errcode = '42501';
end if;
select
  * into v_class
from
  public.classes
where
  id = p_class_id;
if not found then raise exception 'class not found' using errcode = 'P0002';
end if;
if v_class.status <> 'active' then raise exception 'class is not accepting submissions' using errcode = '22023';
end if;
if not public.is_class_member (p_class_id) then raise exception 'class membership required' using errcode = '42501';
end if;
-- A class announcement is an administrative post: only someone who can manage
-- the class may create one. Lecturer assignments stay open to members, who
-- submit them for review as before.
if p_content_type = 'class_announcement'
and not public.can_manage_class (p_class_id) then raise exception 'class admin required for announcements' using errcode = '42501';
end if;
if p_content_type not in ('lecturer_assignment', 'class_announcement') then raise exception 'unknown content type' using errcode = '22023';
end if;
-- A subject must belong to this class, never to a sibling class.
if p_subject_id is not null
and not exists (
  select
    1
  from
    public.class_subjects cs
  where
    cs.id = p_subject_id
    and cs.class_id = p_class_id
) then raise exception 'subject does not belong to this class' using errcode = '22023';
end if;
insert into public.assignments (
  title,
  description,
  course_id,
  user_id,
  class_id,
  subject_id,
  lecturer_name,
  semester,
  academic_year,
  assignment_type,
  content_type,
  source_label,
  drive_url,
  deadline,
  tags,
  reference_urls,
  status
)
values (
  btrim(p_title),
  btrim(p_description),
  v_class.course_id,
  v_user,
  p_class_id,
  p_subject_id,
  v_class.lecturer_name,
  v_class.semester,
  v_class.academic_year,
  p_assignment_type,
  p_content_type,
  nullif(btrim(coalesce(p_source_label, '')), ''),
  p_drive_url,
  p_deadline,
  coalesce(p_tags, '{}'),
  coalesce(p_reference_urls, '[]'::jsonb),
  'pending_review'
)
returning
  id into v_id;
insert into public.assignment_reviews (assignment_id, reviewer_id, decision)
values (v_id, v_user, 'submitted');
perform public.record_audit(
  'assignment_submitted',
  'assignment',
  v_id,
  p_class_id,
  jsonb_build_object(
    'content_type', p_content_type,
    'revision', 1
  )
);
return v_id;
end;
$$;


GRANT
EXECUTE ON function public.submit_class_assignment (
  uuid,
  text,
  text,
  timestamptz,
  text,
  TEXT[],
  jsonb,
  text,
  text,
  text,
  uuid
) TO authenticated;


-- ---------------------------------------------------------------------------
-- Public listing: expose the new columns
-- ---------------------------------------------------------------------------
-- The return type changes, so CREATE OR REPLACE is not enough.
DROP FUNCTION if EXISTS public.list_assignments (text, uuid, text, text, text, text, integer, integer, uuid);


CREATE FUNCTION public.list_assignments (
  p_search text DEFAULT NULL,
  p_course_id uuid DEFAULT NULL,
  p_semester text DEFAULT NULL,
  p_type text DEFAULT NULL,
  p_tag text DEFAULT NULL,
  p_sort text DEFAULT 'newest',
  p_limit integer DEFAULT 12,
  p_offset integer DEFAULT 0,
  p_class_id uuid DEFAULT NULL
) returns TABLE (
  id uuid,
  title text,
  description text,
  course_id uuid,
  class_id uuid,
  course_name text,
  course_code text,
  lecturer_name text,
  semester text,
  academic_year text,
  assignment_type text,
  content_type text,
  source_label text,
  drive_url text,
  deadline timestamptz,
  tags TEXT[],
  created_at timestamptz,
  updated_at timestamptz,
  author_display_name text,
  author_avatar_url text,
  attachment_count bigint,
  total_count bigint
) language sql stable security invoker
SET
  search_path = public,
  pg_temp AS $$ with filtered as (
    select a.id,
      a.title,
      a.description,
      a.course_id,
      a.class_id,
      c.name as course_name,
      c.code as course_code,
      a.lecturer_name,
      a.semester,
      a.academic_year,
      a.assignment_type,
      a.content_type,
      a.source_label,
      a.drive_url,
      a.deadline,
      a.tags,
      a.created_at,
      a.updated_at,
      coalesce(p.display_name, 'StarsTask member') as author_display_name,
      p.avatar_url as author_avatar_url,
      (
        select count(*)
        from public.assignment_attachments aa
        where aa.assignment_id = a.id
      ) as attachment_count
    from public.assignments a
      join public.courses c on c.id = a.course_id
      left join public.profiles p on p.id = a.user_id
    where a.status = 'published'
      and (
        p_search is null
        or a.search_vector @@ websearch_to_tsquery('simple', p_search)
        or a.title ilike '%' || p_search || '%'
        or a.description ilike '%' || p_search || '%'
      )
      and (
        p_course_id is null
        or a.course_id = p_course_id
      )
      and (
        p_semester is null
        or a.semester = p_semester
      )
      and (
        p_type is null
        or a.assignment_type = p_type
      )
      and (
        p_tag is null
        or p_tag = any(a.tags)
      )
      and (
        p_class_id is null
        or a.class_id = p_class_id
      )
  )
select f.id,
  f.title,
  f.description,
  f.course_id,
  f.class_id,
  f.course_name,
  f.course_code,
  f.lecturer_name,
  f.semester,
  f.academic_year,
  f.assignment_type,
  f.content_type,
  f.source_label,
  f.drive_url,
  f.deadline,
  f.tags,
  f.created_at,
  f.updated_at,
  f.author_display_name,
  f.author_avatar_url,
  f.attachment_count,
  count(*) over () as total_count
from filtered f
order by case
    when p_sort = 'deadline' then f.deadline
  end asc nulls last,
  case
    when p_sort = 'oldest' then f.created_at
  end asc,
  case
    when p_sort = 'newest' then f.created_at
  end desc,
  f.id desc
limit least(greatest(coalesce(p_limit, 12), 1), 50) offset greatest(coalesce(p_offset, 0), 0);
$$;


REVOKE ALL ON function public.list_assignments (text, uuid, text, text, text, text, integer, integer, uuid)
FROM
  public;


GRANT
EXECUTE ON function public.list_assignments (text, uuid, text, text, text, text, integer, integer, uuid) TO anon,
authenticated;

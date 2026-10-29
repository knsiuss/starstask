-- Public class filtering for assignment discovery.
--
-- `list_assignments` gains two things the class feature needs:
--   * p_class_id: "show only assignments approved for this class", which is
--     how public visitors filter by class without seeing class-private rows.
--   * class_id in the result, so a public assignment can link back to the class
--     it was reviewed in.
--
-- The function is dropped and recreated instead of overloaded, so PostgREST
-- exposes exactly one signature. The body is the original public listing,
-- unchanged except for the new filter; `status = 'published'` still decides
-- visibility.
DROP FUNCTION if EXISTS public.list_assignments (text, uuid, text, text, text, text, integer, integer);


CREATE OR REPLACE FUNCTION public.list_assignments (
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

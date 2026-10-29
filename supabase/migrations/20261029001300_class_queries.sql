-- Read paths that the class workflow needs but the original policies did not
-- cover, plus a public class discovery query.
--
-- 1. A class admin must be able to read submissions awaiting review. Before
--    this policy the only readers of an assignment row were its owner and
--    anonymous visitors of published rows, so the review queue was empty by
--    construction.
-- 2. `list_classes` mirrors `list_assignments`: one round trip, bounded page,
--    total count, and a search that never interpolates caller input into SQL.
--    It runs as the definer because the member count must include rows the
--    anonymous caller cannot read directly; it only ever returns active
--    classes, so nothing private can leak through it.
drop policy if exists assignments_class_reviewer_read ON public.assignments;


create policy assignments_class_reviewer_read ON public.assignments FOR
select
  TO authenticated USING (
    class_id is not null
    and (
      public.is_class_admin (class_id)
      or public.is_platform_admin ()
    )
  );


create or replace function public.list_classes (
  p_search text DEFAULT NULL,
  p_semester text DEFAULT NULL,
  p_limit integer DEFAULT 12,
  p_offset integer DEFAULT 0
) returns TABLE (
  id uuid,
  slug text,
  name text,
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
      or coalesce(c.lecturer_name, '') ilike '%' || p_search || '%'
    )
    and (p_semester is null or c.semester = p_semester)
)
select
  f.id,
  f.slug,
  f.name,
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


comment on function public.list_classes (text, text, integer, integer) IS 'Public class discovery: active classes only, bounded page, total count.';


revoke all on function public.list_classes (text, text, integer, integer)
from
  public;


grant
execute on function public.list_classes (text, text, integer, integer) to anon,
authenticated;


create index if not exists classes_semester_idx ON public.classes (semester)
where
  status = 'active';

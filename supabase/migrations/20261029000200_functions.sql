-- StarsTask database functions: profile provisioning, course lookup,
-- public search, storage path parsing, and rate limiting.
-- ---------------------------------------------------------------------------
-- Profile provisioning
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user () returns trigger language plpgsql security definer
SET
  search_path = '' AS $$
declare v_display_name text;
v_avatar_url text;
begin v_display_name := coalesce(
  nullif(
    btrim(new.raw_user_meta_data->>'full_name'),
    ''
  ),
  nullif(btrim(new.raw_user_meta_data->>'name'), ''),
  nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
  'StarsTask member'
);
v_avatar_url := coalesce(
  nullif(
    btrim(new.raw_user_meta_data->>'avatar_url'),
    ''
  ),
  nullif(btrim(new.raw_user_meta_data->>'picture'), '')
);
-- Only https avatars are accepted; anything else is dropped instead of
-- failing the signup transaction.
if v_avatar_url is not null
and v_avatar_url not like 'https://%' then v_avatar_url := null;
end if;
insert into public.profiles (id, display_name, avatar_url)
values (
    new.id,
    left(v_display_name, 80),
    left(v_avatar_url, 2048)
  ) on conflict (id) do nothing;
return new;
end;
$$;


DROP TRIGGER if EXISTS on_auth_user_created ON auth.users;


CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user ();


-- ---------------------------------------------------------------------------
-- Course lookup (controlled write path; clients cannot insert directly)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_or_get_course (
  p_name text,
  p_code text DEFAULT NULL,
  p_department text DEFAULT NULL
) returns public.courses language plpgsql security definer
SET
  search_path = public,
  pg_temp AS $$
declare v_course public.courses;
v_name text := nullif(btrim(p_name), '');
v_code text := nullif(btrim(coalesce(p_code, '')), '');
v_department text := nullif(btrim(coalesce(p_department, '')), '');
begin if auth.uid() is null then raise exception 'authentication required' using errcode = '42501';
end if;
if v_name is null
or char_length(v_name) < 2
or char_length(v_name) > 120 then raise exception 'invalid course name' using errcode = '22023';
end if;
insert into public.courses (name, code, department)
values (v_name, v_code, v_department) on conflict (normalized_name) do
update
set name = excluded.name,
  code = coalesce(public.courses.code, excluded.code),
  department = coalesce(public.courses.department, excluded.department)
returning * into v_course;
return v_course;
end;
$$;


-- ---------------------------------------------------------------------------
-- Public listing
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.list_assignments (
  p_search text DEFAULT NULL,
  p_course_id uuid DEFAULT NULL,
  p_semester text DEFAULT NULL,
  p_type text DEFAULT NULL,
  p_tag text DEFAULT NULL,
  p_sort text DEFAULT 'newest',
  p_limit integer DEFAULT 12,
  p_offset integer DEFAULT 0
) returns TABLE (
  id uuid,
  title text,
  description text,
  course_id uuid,
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
  )
select f.id,
  f.title,
  f.description,
  f.course_id,
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


-- ---------------------------------------------------------------------------
-- Storage path helper: {owner_id}/{assignment_id}/{object}
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.assignment_id_from_object_path (object_name text) returns uuid language plpgsql immutable
SET
  search_path = '' AS $$
declare parts text [];
candidate text;
begin parts := string_to_array(object_name, '/');
if array_length(parts, 1) < 2 then return null;
end if;
candidate := parts [2];
if candidate is null
or candidate !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then return null;
end if;
return candidate::uuid;
end;
$$;


-- ---------------------------------------------------------------------------
-- Fixed-window rate limiting (distributed because the counter lives in Postgres)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.consume_rate_limit (p_key text, p_limit integer, p_window_seconds integer) returns boolean language plpgsql security definer
SET
  search_path = public,
  pg_temp AS $$
declare v_now timestamptz := now();
v_hits integer;
begin if p_key is null
or char_length(p_key) < 8
or char_length(p_key) > 200 then raise exception 'invalid rate limit key' using errcode = '22023';
end if;
if p_limit < 1
or p_limit > 10000
or p_window_seconds < 1
or p_window_seconds > 86400 then raise exception 'invalid rate limit configuration' using errcode = '22023';
end if;
insert into public.rate_limits (key, window_started_at, hits)
values (p_key, v_now, 1) on conflict (key) do
update
set hits = case
    when public.rate_limits.window_started_at <= v_now - make_interval(secs => p_window_seconds) then 1
    else public.rate_limits.hits + 1
  end,
  window_started_at = case
    when public.rate_limits.window_started_at <= v_now - make_interval(secs => p_window_seconds) then v_now
    else public.rate_limits.window_started_at
  end
returning hits into v_hits;
-- Cheap opportunistic cleanup; no cron job required for a small deployment.
if random() < 0.01 then
delete from public.rate_limits
where window_started_at < v_now - interval '1 day';
end if;
return v_hits <= p_limit;
end;
$$;


-- ---------------------------------------------------------------------------
-- Function privileges
-- ---------------------------------------------------------------------------
REVOKE ALL ON function public.handle_new_user ()
FROM
  public,
  anon,
  authenticated;


REVOKE ALL ON function public.set_updated_at ()
FROM
  public,
  anon,
  authenticated;


REVOKE ALL ON function public.prevent_assignment_owner_change ()
FROM
  public,
  anon,
  authenticated;


REVOKE ALL ON function public.create_or_get_course (text, text, text)
FROM
  public;


GRANT
EXECUTE ON function public.create_or_get_course (text, text, text) TO authenticated;


REVOKE ALL ON function public.list_assignments (text, uuid, text, text, text, text, integer, integer)
FROM
  public;


GRANT
EXECUTE ON function public.list_assignments (text, uuid, text, text, text, text, integer, integer) TO anon,
authenticated;


REVOKE ALL ON function public.assignment_id_from_object_path (text)
FROM
  public;


GRANT
EXECUTE ON function public.assignment_id_from_object_path (text) TO anon,
authenticated;


REVOKE ALL ON function public.consume_rate_limit (text, integer, integer)
FROM
  public;


GRANT
EXECUTE ON function public.consume_rate_limit (text, integer, integer) TO anon,
authenticated;

-- Read models for the platform admin console.
--
-- Three concerns share one migration because they all answer the same
-- question: what may a verified platform admin read without widening any
-- table grant?
--
--   1. list_platform_users: a paginated directory of safe profile fields.
--      `profiles` only grants id/display_name/avatar_url to clients, so ordering
--      by sign-up date, onboarding state, and class counts needs a definer.
--      `full_name` and `nim` are never returned.
--   2. list_platform_classes: one page of classes with member/admin aggregates
--      and the admins' public display names, so the console never loads every
--      membership row to count it.
--   3. get_platform_admin_overview: one round trip for the dashboard counters.
--
-- Each function re-derives the caller from auth.uid() and raises unless
-- is_platform_admin() is true. They are not granted to anon.
CREATE OR REPLACE FUNCTION public.list_platform_users (
  p_search text DEFAULT NULL,
  p_role text DEFAULT 'all',
  p_onboarding text DEFAULT 'all',
  p_limit integer DEFAULT 20,
  p_offset integer DEFAULT 0
) returns TABLE (
  id uuid,
  display_name text,
  avatar_url text,
  created_at timestamptz,
  onboarded_at timestamptz,
  is_platform_admin boolean,
  class_count bigint,
  admin_class_count bigint,
  total_count bigint
) language plpgsql stable security definer
SET
  search_path = public,
  pg_temp AS $$
declare
  v_search text := nullif(btrim(coalesce(p_search, '')), '');
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
begin
  if not public.is_platform_admin () then
    raise exception 'platform admin required' using errcode = '42501';
  end if;

  if p_role not in ('all', 'platform_admin') then
    raise exception 'invalid role filter' using errcode = '22023';
  end if;

  if p_onboarding not in ('all', 'complete', 'pending') then
    raise exception 'invalid onboarding filter' using errcode = '22023';
  end if;

  return query
  select
    p.id,
    p.display_name,
    p.avatar_url,
    p.created_at,
    p.onboarded_at,
    exists (
      select
        1
      from
        public.platform_admins pa
      where
        pa.user_id = p.id
    ),
    (
      select
        count(*)
      from
        public.class_members cm
      where
        cm.user_id = p.id
    ),
    (
      select
        count(*)
      from
        public.class_admins ca
      where
        ca.user_id = p.id
    ),
    count(*) over ()
  from
    public.profiles p
  where
    (
      v_search is null
      or p.display_name ilike '%' || v_search || '%'
    )
    and (
      p_role = 'all'
      or exists (
        select
          1
        from
          public.platform_admins pa
        where
          pa.user_id = p.id
      )
    )
    and (
      p_onboarding = 'all'
      or (p_onboarding = 'complete' and p.onboarded_at is not null)
      or (p_onboarding = 'pending' and p.onboarded_at is null)
    )
  order by
    p.created_at desc,
    p.id
  limit v_limit
  offset v_offset;
end;
$$;


COMMENT ON function public.list_platform_users (text, text, text, integer, integer) IS 'Platform admin user directory. Safe profile fields only; gated by is_platform_admin().';


CREATE OR REPLACE FUNCTION public.list_platform_classes (
  p_search text DEFAULT NULL,
  p_status text DEFAULT 'all',
  p_limit integer DEFAULT 20,
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
  status text,
  created_at timestamptz,
  member_count bigint,
  admin_count bigint,
  admin_names TEXT[],
  total_count bigint
) language plpgsql stable security definer
SET
  search_path = public,
  pg_temp AS $$
declare
  v_search text := nullif(btrim(coalesce(p_search, '')), '');
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
begin
  if not public.is_platform_admin () then
    raise exception 'platform admin required' using errcode = '42501';
  end if;

  if p_status not in ('all', 'active', 'archived') then
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
      and (
        v_search is null
        or c.name ilike '%' || v_search || '%'
        or c.course_name ilike '%' || v_search || '%'
        or c.slug ilike '%' || v_search || '%'
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
    p.description,
    p.course_name,
    p.institution,
    p.lecturer_name,
    p.semester,
    p.academic_year,
    p.status,
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


COMMENT ON function public.list_platform_classes (text, text, integer, integer) IS 'Platform admin class directory with membership and admin aggregates.';


CREATE OR REPLACE FUNCTION public.get_platform_admin_overview () returns TABLE (
  total_users bigint,
  onboarded_users bigint,
  platform_admins bigint,
  pending_applications bigint,
  approved_applications bigint,
  rejected_applications bigint,
  active_classes bigint,
  archived_classes bigint,
  published_assignments bigint,
  unpublished_assignments bigint,
  pending_reviews bigint,
  pending_verifications bigint
) language plpgsql stable security definer
SET
  search_path = public,
  pg_temp AS $$
begin
  if not public.is_platform_admin () then
    raise exception 'platform admin required' using errcode = '42501';
  end if;

  return query
  select
    (select count(*) from public.profiles p),
    (
      select count(*)
      from public.profiles p
      where p.onboarded_at is not null
    ),
    (select count(*) from public.platform_admins pa),
    (
      select count(*)
      from public.class_applications a
      where a.status = 'pending'
    ),
    (
      select count(*)
      from public.class_applications a
      where a.status = 'approved'
    ),
    (
      select count(*)
      from public.class_applications a
      where a.status = 'rejected'
    ),
    (select count(*) from public.classes c where c.status = 'active'),
    (select count(*) from public.classes c where c.status = 'archived'),
    (select count(*) from public.assignments a where a.status = 'published'),
    (
      select count(*)
      from public.assignments a
      where a.status in ('unpublished', 'archived')
    ),
    (
      select count(*)
      from public.assignments a
      where a.class_id is not null
        and a.status = 'pending_review'
    ),
    (
      select count(*)
      from public.class_verification_requests r
      where r.submitted_at is not null
        and r.status = 'pending'
    );
end;
$$;


COMMENT ON function public.get_platform_admin_overview () IS 'Authoritative platform counters for the admin overview.';


REVOKE ALL ON function public.list_platform_users (text, text, text, integer, integer)
FROM
  public;


REVOKE ALL ON function public.list_platform_classes (text, text, integer, integer)
FROM
  public;


REVOKE ALL ON function public.get_platform_admin_overview ()
FROM
  public;


GRANT
EXECUTE ON function public.list_platform_users (text, text, text, integer, integer) TO authenticated;


GRANT
EXECUTE ON function public.list_platform_classes (text, text, integer, integer) TO authenticated;


GRANT
EXECUTE ON function public.get_platform_admin_overview () TO authenticated;

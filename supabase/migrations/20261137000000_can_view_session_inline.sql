-- can_view_session: inline the three SECURITY DEFINER helpers as direct
-- EXISTS checks. The helpers (is_platform_admin, is_class_member,
-- is_class_admin) are exactly these EXISTS against the same tables with the
-- same (SELECT auth.uid()) subplan, so the predicate is unchanged; only the
-- layered function calls per row are removed. RLS policies calling this
-- function (discussion_sessions_read) need no change.
CREATE OR REPLACE FUNCTION public.can_view_session (p_session_id uuid) returns boolean language sql stable security definer
SET
  search_path = '' AS $$
select
  exists (
    select
      1
    from
      public.discussion_sessions s
    where
      s.id = p_session_id
      and (
        s.visibility = 'public'
        or exists (
          select
            1
          from
            public.platform_admins pa
          where
            pa.user_id = (
              select
                auth.uid ()
            )
        )
        or exists (
          select
            1
          from
            public.class_members m
          where
            m.class_id = s.class_id
            and m.user_id = (
              select
                auth.uid ()
            )
        )
        or exists (
          select
            1
          from
            public.class_admins ca
          where
            ca.class_id = s.class_id
            and ca.user_id = (
              select
                auth.uid ()
            )
        )
        or exists (
          select
            1
          from
            public.discussion_session_rsvps r
          where
            r.session_id = s.id
            and r.user_id = (
              select
                auth.uid ()
            )
        )
      )
  );
$$;


COMMENT ON function public.can_view_session (uuid) IS 'Session readable by class members and managers, by anyone the session is public to, and by a participant who already RSVP''d (so a later visibility change cannot hide a session from someone who registered).';

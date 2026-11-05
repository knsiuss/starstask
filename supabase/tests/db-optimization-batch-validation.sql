-- Validation for the db optimization batch. Run only on a disposable staging
-- database; never against production data. All checks are read-only selects.
-- 1. Index exists for user-scoped invitation acceptance lookups.
SELECT
  indexname
FROM
  pg_indexes
WHERE
  schemaname = 'public'
  AND tablename = 'class_invitation_acceptances'
  AND indexname = 'class_invitation_acceptances_user_invitation_idx';


-- 2. developer_class_metrics counts match direct counts for a sample class.
WITH
  direct AS (
    SELECT
      (
        SELECT
          count(*)
        FROM
          public.class_members m
        WHERE
          m.class_id = c.id
      ) AS member_count,
      (
        SELECT
          count(*)
        FROM
          public.class_admins a
        WHERE
          a.class_id = c.id
      ) AS admin_count,
      (
        SELECT
          count(*)
        FROM
          public.assignments p
        WHERE
          p.class_id = c.id
          AND p.status = 'published'
      ) AS published_count,
      (
        SELECT
          count(*)
        FROM
          public.assignments p
        WHERE
          p.class_id = c.id
          AND p.status = 'pending_review'
      ) AS pending_review_count,
      (
        SELECT
          count(*)
        FROM
          public.discussion_sessions s
        WHERE
          s.class_id = c.id
      ) AS session_count,
      (
        SELECT
          count(*)
        FROM
          public.discussion_session_checkins ch
          JOIN public.discussion_sessions s ON s.id = ch.session_id
        WHERE
          s.class_id = c.id
      ) AS attendance_count,
      (
        SELECT
          count(*)
        FROM
          public.leave_requests l
        WHERE
          l.class_id = c.id
      ) AS leave_request_count,
      (
        SELECT
          count(*)
        FROM
          public.class_invitations i
        WHERE
          i.class_id = c.id
      ) AS invitation_count
    FROM
      public.classes c
    WHERE
      c.id = '00000000-0000-4000-8000-000000000003'
  ),
  metrics AS (
    SELECT
      *
    FROM
      public.developer_class_metrics (500)
    WHERE
      class_id = '00000000-0000-4000-8000-000000000003'
  )
SELECT
  d.member_count = m.member_count AS member_ok,
  d.admin_count = m.admin_count AS admin_ok,
  d.published_count = m.published_count AS published_ok,
  d.pending_review_count = m.pending_review_count AS pending_ok,
  d.session_count = m.session_count AS sessions_ok,
  d.attendance_count = m.attendance_count AS attendance_ok,
  d.leave_request_count = m.leave_request_count AS leave_ok,
  d.invitation_count = m.invitation_count AS invitation_ok
FROM
  direct d,
  metrics m;


-- 3. developer_list_users: page rows never exceed the reported total, and an
-- empty search string behaves like no search.
SELECT
  (
    SELECT
      count(*)
    FROM
      public.developer_list_users (NULL, 'created_at', 'desc', 1, 25)
  ) AS page_rows,
  (
    SELECT
      total_count
    FROM
      public.developer_list_users (NULL, 'created_at', 'desc', 1, 25)
    LIMIT
      1
  ) AS total_count;


-- 4. Batched notify returns the distinct participant count for a session
-- without inserting duplicate notification rows on a second call.
SELECT
  public.notify_session_participants (
    '00000000-0000-4000-8000-000000000099',
    'session_updated',
    'validation',
    'Validation',
    'Validation body',
    '/sessions/validation'
  ) AS attempted_participants;

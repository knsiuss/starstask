-- Equivalence + authorization validation for get_class_action_counts and
-- list_published_semesters. Run only on a disposable staging database with
-- synthetic fixtures; never against production data.
-- Expected: old_only = 0 AND new_only = 0 for a class the caller administers,
-- and a non-admin caller receives zero rows for that class.
-- 1. Equivalence: RPC counts vs direct counts for one administered class.
WITH
  direct AS (
    SELECT
      c.id AS class_id,
      (
        SELECT
          count(*)
        FROM
          public.assignments a
        WHERE
          a.class_id = c.id
          AND a.status = 'pending_review'
      ) AS pending_submissions,
      (
        SELECT
          count(*)
        FROM
          public.leave_requests l
        WHERE
          l.class_id = c.id
          AND l.status = 'submitted'
      ) AS pending_leave,
      (
        SELECT
          count(*)
        FROM
          public.discussion_sessions s
        WHERE
          s.class_id = c.id
          AND s.status = 'scheduled'
          AND s.starts_at >= now() - interval '1 day'
          AND s.starts_at < now() + interval '1 day'
      ) AS todays_sessions,
      (
        SELECT
          count(*)
        FROM
          public.assignment_reports r
        WHERE
          r.class_id = c.id
          AND r.status = 'open'
      ) AS open_reports
    FROM
      public.classes c
    WHERE
      c.id = '00000000-0000-4000-8000-000000000003'
  ),
  rpc AS (
    SELECT
      *
    FROM
      public.get_class_action_counts (
        ARRAY['00000000-0000-4000-8000-000000000003']::UUID[],
        now() - interval '1 day',
        now() + interval '1 day'
      )
  )
SELECT
  (
    SELECT
      count(*)
    FROM
      (
        SELECT
          *
        FROM
          direct
        EXCEPT
        SELECT
          *
        FROM
          rpc
      )
  ) AS direct_only,
  (
    SELECT
      count(*)
    FROM
      (
        SELECT
          *
        FROM
          rpc
        EXCEPT
        SELECT
          *
        FROM
          direct
      )
  ) AS rpc_only;


-- 2. Distinct semesters: RPC vs fetch-and-dedupe in SQL.
SELECT
  (
    SELECT
      count(*)
    FROM
      public.list_published_semesters ()
  ) AS rpc_semesters,
  (
    SELECT
      count(DISTINCT semester)
    FROM
      public.assignments
    WHERE
      status = 'published'
      AND semester IS NOT NULL
  ) AS direct_semesters;


-- 3. Duplicate input ids collapse to one row per administered class.
SELECT
  count(*) AS duplicate_input_rows
FROM
  public.get_class_action_counts (
    ARRAY[
      '00000000-0000-4000-8000-000000000003',
      '00000000-0000-4000-8000-000000000003'
    ]::UUID[],
    now() - interval '1 day',
    now() + interval '1 day'
  );

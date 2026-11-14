-- Validation for 20261119000002 (model duplication cleanup).
-- Read-only SELECTs against disposable local stack. Never writes.
-- Run: docker exec supabase_db_starstask psql -U postgres -f this file
-- Deprecation comments present
SELECT
  relname,
  left(coalesce(obj_description(c.oid), ''), 80) AS comment_head
FROM
  pg_class c
WHERE
  relname IN (
    'class_members',
    'class_admins',
    'discussion_sessions',
    'classes'
  );


-- Views exist and return sane columns
SELECT
  count(*) AS assignments_owner_grains
FROM
  public.assignments_owner_reporting;


SELECT
  count(*) AS classes_gap_rows
FROM
  public.classes_legacy_vs_fk_gap;


SELECT
  count(*) AS sessions_domain_rows
FROM
  public.discussion_sessions_domain_view;


-- CHECK present + validated
SELECT
  conname,
  convalidated
FROM
  pg_constraint
WHERE
  conname = 'assignments_status_archived_consistency';


-- No destructive change: all CHECKs/constraints added are additive (list on assignments)
SELECT
  conname
FROM
  pg_constraint
WHERE
  conrelid = 'public.assignments'::regclass
ORDER BY
  1;

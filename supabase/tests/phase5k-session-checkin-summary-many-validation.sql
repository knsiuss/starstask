-- Phase 5K equivalence + authorization validation.
-- Run only on the disposable staging database with the synthetic fixture.
-- The synthetic fixture uses synthetic UUIDs and no real student data.
SET request.jwt.claim.sub = '00000000-0000-4000-8000-000000000001';

WITH source_ids AS (
  SELECT id
  FROM public.discussion_sessions
  WHERE class_id = '00000000-0000-4000-8000-000000000003'
    AND meeting_number IS NULL
),
old_results AS (
  SELECT s.id, summary.has_location, summary.radius_m
  FROM source_ids s
  CROSS JOIN LATERAL public.session_checkin_summary(s.id) AS summary
),
new_results AS (
  SELECT session_id AS id, has_location, radius_m
  FROM public.session_checkin_summary_many((SELECT array_agg(id ORDER BY id) FROM source_ids))
)
SELECT
  (SELECT count(*) FROM old_results) AS old_rows,
  (SELECT count(*) FROM new_results) AS new_rows,
  (SELECT count(*) FROM (
     SELECT id, has_location, radius_m FROM old_results
     EXCEPT
     SELECT id, has_location, radius_m FROM new_results
   )) AS old_only,
  (SELECT count(*) FROM (
     SELECT id, has_location, radius_m FROM new_results
     EXCEPT
     SELECT id, has_location, radius_m FROM old_results
   )) AS new_only;

SELECT count(*) AS duplicate_input_rows
FROM public.session_checkin_summary_many(array[
  '00000000-0000-4000-8000-000000000101',
  '00000000-0000-4000-8000-000000000101',
  '00000000-0000-4000-8000-000000000102'
]::uuid[]);

SELECT count(*) AS invalid_input_rows
FROM public.session_checkin_summary_many(array[
  'ffffffff-ffff-4fff-8fff-ffffffffffff'::uuid
]);

-- Non-member must see no rows even if the IDs are known.
SET request.jwt.claim.sub = '00000000-0000-4000-8000-000000000099';

SELECT count(*) AS unauthorized_rows
FROM public.session_checkin_summary_many(array[
  '00000000-0000-4000-8000-000000000101',
  '00000000-0000-4000-8000-000000000102'
]::uuid[]);

-- Anonymous caller must also see no rows.
SET request.jwt.claim.sub = '';

SELECT count(*) AS anonymous_rows
FROM public.session_checkin_summary_many(array[
  '00000000-0000-4000-8000-000000000101',
  '00000000-0000-4000-8000-000000000102'
]::uuid[]);

-- Anonymous grant check (expect 0 rows): revoke already applied in migration.
SELECT count(*) AS anonymous_execute_grants
FROM information_schema.role_routine_grants
WHERE routine_schema = 'public'
  AND routine_name = 'session_checkin_summary_many'
  AND grantee = 'anon';

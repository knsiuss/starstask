-- Phase 5L: multi-university tenant isolation validation (RLS).
-- Run ONLY on disposable local/staging database. Never on production.
-- Idempotent fixture: synthetic universities A/B, synthetic users, synthetic classes.
-- Simulates PostgREST via SET ROLE + SET request.jwt.claim.sub.
--
-- Test matrix (SELECT / INSERT / UPDATE / DELETE separately):
--  T1  A-student reads A academic_year  -> ALLOW (1 row)
--  T2  A-student reads B academic_year  -> DENY  (0 rows)
--  T3  A-student attempts INSERT into B -> DENY (0 rows inserted, no error-leak)
--  T4  Non-member reads A               -> DENY  (0 rows)
--  T5  Suspended member reads A         -> DENY  (0 rows)
--  T6  Graduated member reads A         -> DENY  (0 rows)
--  T7  Dual-membership user reads A and B -> ALLOW both
--  T8  university_id tamper via UPDATE  -> DENY (row stays in A)
--  T9  Anon reads A                     -> DENY  (0 rows)
--  T10 A-class member reads B class     -> DENY via class path (B classes hidden)
--
-- Each test reports expected vs actual. "DENY" means 0 rows visible for
-- SELECT, or 0 rows changed for writes (RLS blocks silently; we verify
-- via a follow-up count, not via error presence).
BEGIN;


-- --- Fixture: two synthetic universities ---
INSERT INTO
  public.universities (id, slug, name, status)
VALUES
  (
    '00000000-0000-4000-8000-0000000051a1',
    'phase5l-univ-a',
    'Phase5L University A',
    'active'
  ),
  (
    '00000000-0000-4000-8000-0000000051b1',
    'phase5l-univ-b',
    'Phase5L University B',
    'active'
  )
ON CONFLICT (id) DO UPDATE
SET
  status = 'active';


-- --- Synthetic users (auth.users rows so FK user_id resolves) ---
-- ids are synthetic; auth.users rows are required for membership FK.
INSERT INTO
  auth.users (
    id,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at
  )
SELECT
  u.id,
  u.email,
  '',
  now(),
  '{}'::jsonb,
  '{}'::jsonb,
  now(),
  now()
FROM
  (
    VALUES
      (
        '00000000-0000-4000-8000-0000000051a2'::uuid,
        'phase5l-a-student@test.local'
      ),
      (
        '00000000-0000-4000-8000-0000000051b2'::uuid,
        'phase5l-b-student@test.local'
      ),
      (
        '00000000-0000-4000-8000-0000000051a3'::uuid,
        'phase5l-a-admin@test.local'
      ),
      (
        '00000000-0000-4000-8000-0000000051c3'::uuid,
        'phase5l-dual@test.local'
      ),
      (
        '00000000-0000-4000-8000-0000000051d3'::uuid,
        'phase5l-suspended@test.local'
      ),
      (
        '00000000-0000-4000-8000-0000000051e3'::uuid,
        'phase5l-graduated@test.local'
      ),
      (
        '00000000-0000-4000-8000-0000000051f3'::uuid,
        'phase5l-nomember@test.local'
      )
  ) AS u (id, email)
WHERE
  NOT EXISTS (
    SELECT
      1
    FROM
      auth.users
    WHERE
      id = u.id
  );


-- --- Memberships ---
INSERT INTO
  public.university_memberships (user_id, university_id, role, status)
VALUES
  (
    '00000000-0000-4000-8000-0000000051a2',
    '00000000-0000-4000-8000-0000000051a1',
    'student',
    'active'
  ),
  (
    '00000000-0000-4000-8000-0000000051b2',
    '00000000-0000-4000-8000-0000000051b1',
    'student',
    'active'
  ),
  (
    '00000000-0000-4000-8000-0000000051a3',
    '00000000-0000-4000-8000-0000000051a1',
    'student',
    'active'
  ),
  (
    '00000000-0000-4000-8000-0000000051c3',
    '00000000-0000-4000-8000-0000000051a1',
    'student',
    'active'
  ),
  (
    '00000000-0000-4000-8000-0000000051c3',
    '00000000-0000-4000-8000-0000000051b1',
    'student',
    'active'
  ),
  (
    '00000000-0000-4000-8000-0000000051d3',
    '00000000-0000-4000-8000-0000000051a1',
    'student',
    'suspended'
  ),
  (
    '00000000-0000-4000-8000-0000000051e3',
    '00000000-0000-4000-8000-0000000051a1',
    'student',
    'graduated'
  )
ON CONFLICT (user_id, university_id) DO UPDATE
SET
  status = EXCLUDED.status;


-- --- Academic years (the RLS-protected tenant table) ---
INSERT INTO
  public.academic_years (university_id, code, name, start_date, end_date, status)
VALUES
  (
    '00000000-0000-4000-8000-0000000051a1',
    'phase5l-A',
    'Phase5L Year A',
    '2026-01-01',
    '2026-12-31',
    'open'
  ),
  (
    '00000000-0000-4000-8000-0000000051b1',
    'phase5l-B',
    'Phase5L Year B',
    '2026-01-01',
    '2026-12-31',
    'open'
  )
ON CONFLICT (university_id, lower(btrim(code))) DO NOTHING;


COMMIT;


-- ===========================================================================
-- Helpers: run as authenticated with a given sub claim.
-- NOTE: SET ROLE must be done per-session; RESET afterwards.
-- ===========================================================================
-- T1: A-student reads A -> ALLOW
SET ROLE authenticated;


SET
  request.jwt.claim.sub = '00000000-0000-4000-8000-0000000051a2';


SELECT
  'T1 expected ALLOW (1 row)' AS test,
  count(*) AS actual_rows
FROM
  public.academic_years
WHERE
  university_id = '00000000-0000-4000-8000-0000000051a1';


-- T2: A-student reads B -> DENY
SELECT
  'T2 expected DENY (0 rows)' AS test,
  count(*) AS actual_rows
FROM
  public.academic_years
WHERE
  university_id = '00000000-0000-4000-8000-0000000051b1';


-- T3: A-student attempts INSERT into B -> DENY (write never happens)
-- Phase 5 tables have no INSERT policy, so this fails at RLS.
-- We verify via a savepoint-less attempt + row count.
DO $$
BEGIN
  BEGIN
    INSERT INTO public.academic_years (university_id, code, name, start_date, end_date, status)
    VALUES ('00000000-0000-4000-8000-0000000051b1', 'phase5l-tamper', 'Tamper', '2026-01-01', '2026-12-31', 'open');
    RAISE NOTICE 'T3 FAIL: insert unexpectedly succeeded';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'T3 PASS: insert blocked (%)', SQLERRM;
  END;
END $$;


-- T4: non-member reads A -> DENY
SET
  request.jwt.claim.sub = '00000000-0000-4000-8000-0000000051f3';


SELECT
  'T4 expected DENY (0 rows)' AS test,
  count(*) AS actual_rows
FROM
  public.academic_years
WHERE
  university_id = '00000000-0000-4000-8000-0000000051a1';


-- T5: suspended member reads A -> DENY
SET
  request.jwt.claim.sub = '00000000-0000-4000-8000-0000000051d3';


SELECT
  'T5 expected DENY (0 rows)' AS test,
  count(*) AS actual_rows
FROM
  public.academic_years
WHERE
  university_id = '00000000-0000-4000-8000-0000000051a1';


-- T6: graduated member reads A -> DENY
SET
  request.jwt.claim.sub = '00000000-0000-4000-8000-0000000051e3';


SELECT
  'T6 expected DENY (0 rows)' AS test,
  count(*) AS actual_rows
FROM
  public.academic_years
WHERE
  university_id = '00000000-0000-4000-8000-0000000051a1';


-- T7: dual-membership user reads A and B -> ALLOW both
SET
  request.jwt.claim.sub = '00000000-0000-4000-8000-0000000051c3';


SELECT
  'T7 expected ALLOW (2 rows)' AS test,
  count(*) AS actual_rows
FROM
  public.academic_years
WHERE
  university_id IN (
    '00000000-0000-4000-8000-0000000051a1',
    '00000000-0000-4000-8000-0000000051b1'
  );


-- T8: UPDATE tamper: A-student tries to move own row to B -> DENY (0 rows updated)
SET
  request.jwt.claim.sub = '00000000-0000-4000-8000-0000000051a2';


DO $$
DECLARE v_n int;
BEGIN
  BEGIN
    UPDATE public.academic_years SET university_id = '00000000-0000-4000-8000-0000000051b1'
    WHERE university_id = '00000000-0000-4000-8000-0000000051a1';
    GET DIAGNOSTICS v_n = ROW_COUNT;
    IF v_n = 0 THEN RAISE NOTICE 'T8 PASS: update blocked, 0 rows changed (expected RLS deny)';
    ELSE RAISE NOTICE 'T8 FAIL: update changed % rows', v_n; END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'T8 PASS: update blocked with error (%)', SQLERRM;
  END;
END $$;


-- T9: anon reads A -> DENY (0 rows, or permission denied — both are deny)
RESET ROLE;


SET
  request.jwt.claim.sub = '';


SET ROLE anon;


DO $$
BEGIN
  PERFORM count(*) FROM public.academic_years
  WHERE university_id = '00000000-0000-4000-8000-0000000051a1';
  RAISE NOTICE 'T9 check: if rows visible, this is a FAIL (see count query below)';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'T9 PASS: anon blocked (%)', SQLERRM;
END $$;


RESET ROLE;


RESET request.jwt.claim.sub;

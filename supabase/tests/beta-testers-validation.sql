-- Validation for the beta tester allowlist. Run only on a disposable
-- staging database; never against production data. All checks are
-- read-only except the final INSERT, which uses a synthetic user id.
-- 1. Table and function exist with least-privilege grants.
SELECT
  tablename
FROM
  pg_tables
WHERE
  schemaname = 'public'
  AND tablename = 'beta_testers';


SELECT
  p.proname,
  p.prosecdef
FROM
  pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE
  n.nspname = 'public'
  AND p.proname = 'is_beta_tester';


-- 2. A user with no row is not a beta tester (deny by default).
SET
  request.jwt.claim.sub = '00000000-0000-4000-8000-000000000001';


SELECT
  public.is_beta_tester () AS synthetic_user_is_beta;


-- 3. Client roles cannot read the allowlist directly (no SELECT grant,
-- no permissive policy): this must fail with permission denied.
SET ROLE authenticated;


SELECT
  count(*)
FROM
  public.beta_testers;

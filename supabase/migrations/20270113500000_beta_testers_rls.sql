-- beta_testers: close the RLS gap flagged by the security audit.
-- =====================================================================
-- The allowlist table was created without ENABLE ROW LEVEL SECURITY and
-- without explicit REVOKE. Supabase default privileges grant table access in
-- the public schema to anon/authenticated for newly created tables, which
-- makes the allowlist readable/writable through PostgREST. The app never
-- reads the table directly (only is_beta_tester(), SECURITY DEFINER, and the
-- workspace_context definer), so locking it down changes nothing for correct
-- callers — exactly the posture platform_admins has.
--
-- Rollback: ALTER TABLE public.beta_testers DISABLE ROW LEVEL SECURITY;
-- GRANT SELECT ON public.beta_testers TO authenticated;
-- =====================================================================
ALTER TABLE public.beta_testers ENABLE ROW LEVEL SECURITY;


REVOKE ALL ON TABLE public.beta_testers
FROM
  public,
  anon,
  authenticated;


COMMENT ON TABLE public.beta_testers IS 'Beta tester allowlist. No client policies and no client grants: reading goes through is_beta_tester() only. Writes are manual, audited operator operations.';

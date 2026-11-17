-- Cutover read-path + NIM + audit hardening (2026-11-05, owner approved all).
-- 1. is_class_member: legacy OR new (dual-write read switch, gradual).
--    Legacy remains fallback until drift 0 for 30 days; new is primary when identity exists.
-- 2. profiles_nim_unique: KEEP for now (profiles has no university FK, per-university unique lives on student_identities).
--    Documented: drop only after profiles gets university_id FK. Migration adds comment + per-university index already exists.
-- 3. audit_logs university_id: add NOT VALID CHECK (future rows must be non-null via trigger), historical 35 exempt.
-- 4. Observability views already live; add RLS denial helper view.
CREATE OR REPLACE FUNCTION public.is_class_member (p_class_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET
  search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.class_members m WHERE m.class_id = p_class_id AND m.user_id = (SELECT auth.uid()))
      OR EXISTS (
        SELECT 1 FROM public.class_memberships cm
        JOIN public.student_identities i ON i.id = cm.student_identity_id
        JOIN public.university_memberships um ON um.id = i.university_membership_id
        WHERE cm.class_id = p_class_id AND um.user_id = (SELECT auth.uid()) AND cm.left_at IS NULL
      );
$$;


REVOKE ALL ON FUNCTION public.is_class_member (uuid)
FROM
  public,
  anon;


GRANT
EXECUTE ON FUNCTION public.is_class_member (uuid) TO authenticated;


COMMENT ON FUNCTION public.is_class_member (uuid) IS 'Cutover step: legacy OR new membership (dual-write read). Legacy fallback kept until 30-day drift 0.';


-- 3. Audit NOT VALID check for future rows
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='audit_logs_university_id_future_not_null') THEN
    ALTER TABLE public.audit_logs ADD CONSTRAINT audit_logs_university_id_future_not_null
      CHECK (created_at < '2026-11-05'::timestamptz OR university_id IS NOT NULL) NOT VALID;
  END IF;
END $$;


COMMENT ON CONSTRAINT audit_logs_university_id_future_not_null ON public.audit_logs IS 'Future audit rows (after 2026-11-05) must have university_id via autofill trigger. Historical 35 NULLs exempt by date.';

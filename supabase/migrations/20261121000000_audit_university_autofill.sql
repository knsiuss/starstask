-- Audit writer-side enforcement (expand-contract step 2): auto-fill university_id on INSERT.
-- Backfill 2026-11-05: 256/291 filled via class_id -> classes.university_id, remainder via actor membership.
-- 35 historical rows remain NULL (no class, actor without UNPAM membership) — left unmapped, not invented.
-- This trigger fills NEW rows only; it does not UPDATE history.

CREATE OR REPLACE FUNCTION public.audit_logs_fill_university_id() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NEW.university_id IS NOT NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.class_id IS NOT NULL THEN
    SELECT c.university_id INTO NEW.university_id FROM public.classes c WHERE c.id = NEW.class_id;
    IF NEW.university_id IS NOT NULL THEN RETURN NEW; END IF;
  END IF;
  IF NEW.actor_id IS NOT NULL THEN
    SELECT um.university_id INTO NEW.university_id
    FROM public.university_memberships um
    WHERE um.user_id = NEW.actor_id AND um.status = 'active'
    ORDER BY um.created_at LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.audit_logs_fill_university_id() FROM public, anon, authenticated;

DROP TRIGGER IF EXISTS audit_logs_fill_university_trg ON public.audit_logs;
CREATE TRIGGER audit_logs_fill_university_trg
  BEFORE INSERT ON public.audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.audit_logs_fill_university_id();

COMMENT ON FUNCTION public.audit_logs_fill_university_id() IS 'Hardening A4 step 2: auto-fill tenant key on new audit rows from class or actor membership. Historical NULLs (35) left unmapped.';

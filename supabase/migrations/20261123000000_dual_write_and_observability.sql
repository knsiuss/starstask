-- Dual-write legacy -> new model + observability (2026-11-05, owner approved all except Brawijaya).
-- 1. class_members -> class_memberships mirror trigger (INSERT/DELETE)
-- 2. profiles.nim -> student_identities.student_id prefixed dual-write trigger
-- 3. Audit NULL decision: leave 35 historical NULLs, view for monitoring
-- 4. Observability views: RLS/tenant gaps, dual-write drift, NIM drift

-- 1. Dual-write: class_members INSERT -> class_memberships
CREATE OR REPLACE FUNCTION public.mirror_class_member_to_membership() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_identity uuid; v_uni uuid;
BEGIN
  SELECT i.id, i.university_id INTO v_identity, v_uni
  FROM public.student_identities i
  JOIN public.university_memberships um ON um.id = i.university_membership_id
  WHERE um.user_id = NEW.user_id LIMIT 1;
  IF v_identity IS NULL THEN RETURN NEW; END IF; -- no identity yet: skip, reconciliation will catch
  INSERT INTO public.class_memberships (university_id, class_id, student_identity_id, is_home, joined_via, joined_at)
  VALUES (v_uni, NEW.class_id, v_identity, true, 'admin_assignment', COALESCE(NEW.joined_at, now()))
  ON CONFLICT (class_id, student_identity_id) WHERE left_at IS NULL DO NOTHING;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.mirror_class_member_to_membership() FROM public, anon, authenticated;
DROP TRIGGER IF EXISTS class_members_mirror_membership ON public.class_members;
CREATE TRIGGER class_members_mirror_membership AFTER INSERT ON public.class_members FOR EACH ROW EXECUTE FUNCTION public.mirror_class_member_to_membership();

CREATE OR REPLACE FUNCTION public.mirror_class_member_leave() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_identity uuid;
BEGIN
  SELECT i.id INTO v_identity FROM public.student_identities i JOIN public.university_memberships um ON um.id=i.university_membership_id WHERE um.user_id=OLD.user_id LIMIT 1;
  IF v_identity IS NULL THEN RETURN OLD; END IF;
  UPDATE public.class_memberships SET left_at = now() WHERE class_id=OLD.class_id AND student_identity_id=v_identity AND left_at IS NULL;
  RETURN OLD;
END; $$;
REVOKE ALL ON FUNCTION public.mirror_class_member_leave() FROM public, anon, authenticated;
DROP TRIGGER IF EXISTS class_members_mirror_leave ON public.class_members;
CREATE TRIGGER class_members_mirror_leave AFTER DELETE ON public.class_members FOR EACH ROW EXECUTE FUNCTION public.mirror_class_member_leave();

CREATE OR REPLACE VIEW public.dual_write_drift AS
SELECT (SELECT count(*) FROM public.class_members) AS legacy_members,
       (SELECT count(*) FROM public.class_memberships WHERE left_at IS NULL) AS new_memberships,
       (SELECT count(*) FROM public.class_members m WHERE NOT EXISTS (
         SELECT 1 FROM public.class_memberships cm JOIN public.student_identities i ON i.id=cm.student_identity_id JOIN public.university_memberships um ON um.id=i.university_membership_id
         WHERE cm.class_id=m.class_id AND um.user_id=m.user_id AND cm.left_at IS NULL)) AS legacy_without_new;

-- 2. NIM dual-write: profiles.nim -> student_identities prefixed
CREATE OR REPLACE FUNCTION public.sync_nim_to_identity() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_prefix text;
BEGIN
  IF NEW.nim IS NULL OR btrim(NEW.nim)='' THEN RETURN NEW; END IF;
  FOR v_prefix IN SELECT u.nim_prefix FROM public.university_memberships um JOIN public.universities u ON u.id=um.university_id WHERE um.user_id=NEW.id AND um.status='active' AND u.nim_prefix IS NOT NULL LOOP
    UPDATE public.student_identities i SET student_id = v_prefix || '-' || btrim(NEW.nim)
    FROM public.university_memberships um WHERE um.id=i.university_membership_id AND um.user_id=NEW.id;
  END LOOP;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.sync_nim_to_identity() FROM public, anon, authenticated;
DROP TRIGGER IF EXISTS profiles_sync_nim_identity ON public.profiles;
CREATE TRIGGER profiles_sync_nim_identity AFTER UPDATE OF nim ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.sync_nim_to_identity();

CREATE OR REPLACE VIEW public.nim_drift AS
SELECT count(*) AS identities_total,
       count(*) FILTER (WHERE student_id LIKE '%-%') AS prefixed,
       count(*) FILTER (WHERE student_id NOT LIKE '%-%') AS unprefixed
FROM public.student_identities;

-- 3/4. Audit + observability (35 NULLs left unmapped by design)
COMMENT ON COLUMN public.audit_logs.university_id IS 'Tenant key. Historical 35 rows remain NULL (no class, actor without membership) by owner decision 2026-11-05 — not invented. New rows auto-filled by audit_logs_fill_university_trg.';

CREATE OR REPLACE VIEW public.observability_tenant_gap AS
SELECT 'audit_logs' AS source, count(*) AS null_university_rows FROM public.audit_logs WHERE university_id IS NULL
UNION ALL SELECT 'class_memberships', count(*) FROM public.class_memberships WHERE university_id IS NULL
UNION ALL SELECT 'enrollments', count(*) FROM public.enrollments WHERE university_id IS NULL;

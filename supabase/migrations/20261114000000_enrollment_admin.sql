-- Phase 5D: enrollment + admin. Additive only.
-- New: class_memberships (identity bridge, alongside legacy class_members),
-- course_invite_tokens/acceptances (hash-only), class_admin_assignments/
-- class_admin_permissions (normalized RBAC). Legacy class_members/class_admins untouched.
-- Invite usage policy: NO default invented (36#8 UNRESOLVED) — max_uses/expires
-- must be supplied explicitly at creation; columns nullable, status lifecycle enforced.

CREATE TABLE IF NOT EXISTS public.class_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id uuid NOT NULL REFERENCES public.universities (id) ON DELETE RESTRICT,
  class_id uuid NOT NULL,
  student_identity_id uuid NOT NULL,
  is_home boolean NOT NULL DEFAULT true,
  joined_via text NOT NULL DEFAULT 'admin_assignment',
  joined_at timestamptz NOT NULL DEFAULT now(),
  left_at timestamptz,
  transferred_from_class_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT class_memberships_joined_via_allowed CHECK (joined_via IN ('invitation','admin_assignment','platform_assignment','transfer','home_class')),
  CONSTRAINT class_memberships_left_after_join CHECK (left_at IS NULL OR left_at >= joined_at),
  CONSTRAINT class_memberships_class_same_university FOREIGN KEY (class_id, university_id) REFERENCES public.classes (id, university_id) ON DELETE CASCADE,
  CONSTRAINT class_memberships_identity_same_university FOREIGN KEY (student_identity_id, university_id) REFERENCES public.student_identities (id, university_id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS class_memberships_active_unique ON public.class_memberships (class_id, student_identity_id) WHERE left_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS class_memberships_one_home ON public.class_memberships (student_identity_id) WHERE is_home AND left_at IS NULL;
CREATE INDEX IF NOT EXISTS class_memberships_identity_idx ON public.class_memberships (student_identity_id, left_at);
CREATE INDEX IF NOT EXISTS class_memberships_class_idx ON public.class_memberships (class_id, left_at);
DROP TRIGGER IF EXISTS class_memberships_set_updated_at ON public.class_memberships;
CREATE TRIGGER class_memberships_set_updated_at BEFORE UPDATE ON public.class_memberships FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.course_invite_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id uuid NOT NULL REFERENCES public.universities (id) ON DELETE RESTRICT,
  offering_id uuid NOT NULL,
  token_hash text NOT NULL UNIQUE,
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  expires_at timestamptz,
  max_uses integer,
  use_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  revoked_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  CONSTRAINT course_invite_tokens_hash_length CHECK (char_length(token_hash)=64),
  CONSTRAINT course_invite_tokens_max_uses_range CHECK (max_uses IS NULL OR max_uses BETWEEN 1 AND 500),
  CONSTRAINT course_invite_tokens_use_within_max CHECK (use_count >= 0 AND (max_uses IS NULL OR use_count <= max_uses)),
  CONSTRAINT course_invite_tokens_expiry_after_creation CHECK (expires_at IS NULL OR expires_at > created_at),
  CONSTRAINT course_invite_tokens_status_allowed CHECK (status IN ('active','revoked','expired','exhausted')),
  CONSTRAINT course_invite_tokens_offering_same_university FOREIGN KEY (offering_id, university_id) REFERENCES public.course_offerings (id, university_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS course_invite_tokens_offering_idx ON public.course_invite_tokens (offering_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.course_invite_acceptances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id uuid NOT NULL REFERENCES public.universities (id) ON DELETE RESTRICT,
  token_id uuid NOT NULL REFERENCES public.course_invite_tokens (id) ON DELETE CASCADE,
  redeemed_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  redeemed_at timestamptz NOT NULL DEFAULT now(),
  enrollment_id uuid REFERENCES public.enrollments (id) ON DELETE SET NULL,
  CONSTRAINT course_invite_acceptances_unique UNIQUE (token_id, redeemed_by)
);
CREATE INDEX IF NOT EXISTS course_invite_acceptances_token_idx ON public.course_invite_acceptances (token_id, redeemed_at DESC);

-- Normalized RBAC. Presets are data-driven via permission codes; groups are
-- future extension (documented gate). Permission codes are the 8 from 26-I.
CREATE TABLE IF NOT EXISTS public.class_admin_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id uuid NOT NULL REFERENCES public.universities (id) ON DELETE RESTRICT,
  class_id uuid NOT NULL,
  student_identity_id uuid,
  user_id uuid REFERENCES auth.users (id) ON DELETE CASCADE,
  granted_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  granted_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  revoked_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  CONSTRAINT class_admin_assignments_class_same_university FOREIGN KEY (class_id, university_id) REFERENCES public.classes (id, university_id) ON DELETE CASCADE,
  CONSTRAINT class_admin_assignments_identity_same_university FOREIGN KEY (student_identity_id, university_id) REFERENCES public.student_identities (id, university_id) ON DELETE CASCADE,
  CONSTRAINT class_admin_assignments_subject CHECK (student_identity_id IS NOT NULL OR user_id IS NOT NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS class_admin_assignments_active_unique ON public.class_admin_assignments (class_id, COALESCE(user_id::text,''), COALESCE(student_identity_id::text,'')) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS class_admin_assignments_class_idx ON public.class_admin_assignments (class_id, revoked_at);

CREATE TABLE IF NOT EXISTS public.class_admin_permissions (
  assignment_id uuid NOT NULL REFERENCES public.class_admin_assignments (id) ON DELETE CASCADE,
  permission_code text NOT NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT class_admin_permissions_code_allowed CHECK (permission_code IN ('manage_admins','manage_attendance','manage_assignments','manage_announcements','manage_grades','manage_schedule','manage_materials','manage_leave_review')),
  PRIMARY KEY (assignment_id, permission_code)
);

CREATE OR REPLACE FUNCTION public.has_class_permission(p_class_id uuid, p_permission text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT public.is_platform_admin() OR EXISTS (
    SELECT 1 FROM public.class_admin_assignments a
    JOIN public.class_admin_permissions p ON p.assignment_id=a.id
    WHERE a.class_id=p_class_id AND a.revoked_at IS NULL AND p.permission_code=p_permission
      AND (a.user_id=(SELECT auth.uid()) OR EXISTS (
        SELECT 1 FROM public.student_identities si JOIN public.university_memberships m ON m.id=si.university_membership_id
        WHERE si.id=a.student_identity_id AND m.user_id=(SELECT auth.uid()))));
$$;
REVOKE ALL ON FUNCTION public.has_class_permission(uuid,text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_class_permission(uuid,text) TO authenticated;

-- Last-admin protection: revoking the final active assignment (any permission) is rejected.
CREATE OR REPLACE FUNCTION public.guard_last_class_admin() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF NEW.revoked_at IS NOT NULL AND OLD.revoked_at IS NULL THEN
    IF (SELECT count(*) FROM public.class_admin_assignments WHERE class_id=OLD.class_id AND revoked_at IS NULL) <= 1 THEN
      RAISE EXCEPTION 'class must keep at least one admin' USING ERRCODE='22023';
    END IF;
  END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.guard_last_class_admin() FROM public, anon, authenticated;
DROP TRIGGER IF EXISTS class_admin_assignments_guard_last ON public.class_admin_assignments;
CREATE TRIGGER class_admin_assignments_guard_last BEFORE UPDATE OF revoked_at ON public.class_admin_assignments FOR EACH ROW EXECUTE FUNCTION public.guard_last_class_admin();

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['class_memberships','course_invite_tokens','course_invite_acceptances','class_admin_assignments','class_admin_permissions'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM public, anon, authenticated', t);
    EXECUTE format('GRANT SELECT ON TABLE public.%I TO authenticated', t);
  END LOOP;
END $$;
DROP POLICY IF EXISTS class_memberships_member_read ON public.class_memberships;
CREATE POLICY class_memberships_member_read ON public.class_memberships FOR SELECT TO authenticated USING (public.is_university_member(university_id) OR public.is_platform_admin());
DROP POLICY IF EXISTS course_invite_tokens_member_read ON public.course_invite_tokens;
CREATE POLICY course_invite_tokens_member_read ON public.course_invite_tokens FOR SELECT TO authenticated USING (public.is_university_member(university_id) OR public.is_platform_admin());
DROP POLICY IF EXISTS course_invite_acceptances_member_read ON public.course_invite_acceptances;
CREATE POLICY course_invite_acceptances_member_read ON public.course_invite_acceptances FOR SELECT TO authenticated USING (public.is_university_member(university_id) OR public.is_platform_admin());
DROP POLICY IF EXISTS class_admin_assignments_member_read ON public.class_admin_assignments;
CREATE POLICY class_admin_assignments_member_read ON public.class_admin_assignments FOR SELECT TO authenticated USING (public.is_class_member(class_id) OR public.is_university_member(university_id) OR public.is_platform_admin());
DROP POLICY IF EXISTS class_admin_permissions_member_read ON public.class_admin_permissions;
CREATE POLICY class_admin_permissions_member_read ON public.class_admin_permissions FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.class_admin_assignments a WHERE a.id=class_admin_permissions.assignment_id AND (public.is_university_member(a.university_id) OR public.is_platform_admin())));
-- Cross-class denial is inherent: policies key on row's own class/university, never caller's other class.

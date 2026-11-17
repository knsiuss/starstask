-- Academic class management.
--
-- Tables added here:
--   platform_admins             trusted platform operators (no client access)
--   classes                     an approved, active academic class
--   class_applications          user requests to create a class
--   class_application_reviews   append-only decision history
--   class_members               membership (one row per user per class)
--   class_admins                admin assignment; always a subset of members
--   class_invitations           hashed, expiring, usage-limited invite links
--   class_invitation_acceptances  who used which invitation
--   assignment_reviews          append-only submission/moderation history
--   audit_logs                  platform and class level audit trail
--
-- `assignments` gains a nullable `class_id` plus the review/publication columns
-- the approval workflow needs. Existing rows keep their current status.
CREATE EXTENSION if NOT EXISTS pgcrypto;


-- ---------------------------------------------------------------------------
-- platform_admins: written only through SQL or the service role
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.platform_admins (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  granted_at timestamptz NOT NULL DEFAULT now(),
  granted_by uuid REFERENCES auth.users (id) ON DELETE SET NULL
);


COMMENT ON TABLE public.platform_admins IS 'Trusted platform administrators. No client policies: granting is a manual, audited operation.';


-- ---------------------------------------------------------------------------
-- classes
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL,
  name text NOT NULL,
  description text NOT NULL,
  -- NOT NULL: every submission needs a course, and the approval workflow
  -- creates the course row before the class.
  course_id uuid NOT NULL REFERENCES public.courses (id) ON DELETE RESTRICT,
  course_name text NOT NULL,
  institution text,
  lecturer_name text,
  semester text NOT NULL,
  academic_year text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT classes_slug_format CHECK (
    slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    AND char_length(slug) BETWEEN 3 AND 80
  ),
  CONSTRAINT classes_name_length CHECK (char_length(btrim(name)) BETWEEN 3 AND 120),
  CONSTRAINT classes_description_length CHECK (char_length(btrim(description)) BETWEEN 10 AND 5000),
  CONSTRAINT classes_course_name_length CHECK (char_length(btrim(course_name)) BETWEEN 2 AND 120),
  CONSTRAINT classes_institution_length CHECK (
    institution IS NULL
    OR char_length(btrim(institution)) BETWEEN 2 AND 120
  ),
  CONSTRAINT classes_lecturer_length CHECK (
    lecturer_name IS NULL
    OR char_length(btrim(lecturer_name)) BETWEEN 1 AND 120
  ),
  CONSTRAINT classes_semester_length CHECK (char_length(btrim(semester)) BETWEEN 1 AND 20),
  CONSTRAINT classes_academic_year_format CHECK (academic_year ~ '^\d{4}/\d{4}$'),
  CONSTRAINT classes_status_allowed CHECK (status IN ('active', 'archived'))
);


COMMENT ON TABLE public.classes IS 'Approved academic classes. Created only by the platform approval workflow, never by direct client insert.';


CREATE UNIQUE INDEX if NOT EXISTS classes_slug_key ON public.classes (slug);


CREATE INDEX if NOT EXISTS classes_course_idx ON public.classes (course_id)
WHERE
  status = 'active';


CREATE INDEX if NOT EXISTS classes_active_recent_idx ON public.classes (created_at DESC)
WHERE
  status = 'active';


CREATE TRIGGER classes_set_updated_at
BEFORE UPDATE ON public.classes FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at ();


-- ---------------------------------------------------------------------------
-- class_applications
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.class_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  proposed_slug text NOT NULL,
  proposed_name text NOT NULL,
  course_name text NOT NULL,
  institution text,
  lecturer_name text,
  semester text NOT NULL,
  academic_year text NOT NULL,
  description text NOT NULL,
  reason text NOT NULL,
  supporting_info text,
  status text NOT NULL DEFAULT 'pending',
  reviewed_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  decision_note text,
  created_class_id uuid REFERENCES public.classes (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT class_applications_slug_format CHECK (
    proposed_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    AND char_length(proposed_slug) BETWEEN 3 AND 80
  ),
  CONSTRAINT class_applications_name_length CHECK (char_length(btrim(proposed_name)) BETWEEN 3 AND 120),
  CONSTRAINT class_applications_course_length CHECK (char_length(btrim(course_name)) BETWEEN 2 AND 120),
  CONSTRAINT class_applications_institution_length CHECK (
    institution IS NULL
    OR char_length(btrim(institution)) BETWEEN 2 AND 120
  ),
  CONSTRAINT class_applications_lecturer_length CHECK (
    lecturer_name IS NULL
    OR char_length(btrim(lecturer_name)) BETWEEN 1 AND 120
  ),
  CONSTRAINT class_applications_semester_length CHECK (char_length(btrim(semester)) BETWEEN 1 AND 20),
  CONSTRAINT class_applications_academic_year_format CHECK (academic_year ~ '^\d{4}/\d{4}$'),
  CONSTRAINT class_applications_description_length CHECK (char_length(btrim(description)) BETWEEN 10 AND 5000),
  CONSTRAINT class_applications_reason_length CHECK (char_length(btrim(reason)) BETWEEN 10 AND 2000),
  CONSTRAINT class_applications_supporting_length CHECK (
    supporting_info IS NULL
    OR char_length(btrim(supporting_info)) <= 2000
  ),
  CONSTRAINT class_applications_decision_note_length CHECK (
    decision_note IS NULL
    OR char_length(btrim(decision_note)) BETWEEN 3 AND 2000
  ),
  CONSTRAINT class_applications_status_allowed CHECK (status IN ('pending', 'approved', 'rejected', 'withdrawn')),
  -- A rejection always carries a reason; an approval always records a reviewer
  -- and the class it produced. The database enforces it so a bug in the
  -- application layer cannot create an unexplained decision.
  CONSTRAINT class_applications_decision_consistency CHECK (
    (
      status = 'pending'
      AND reviewed_by IS NULL
      AND reviewed_at IS NULL
      AND created_class_id IS NULL
    )
    OR (
      status = 'approved'
      AND reviewed_by IS NOT NULL
      AND reviewed_at IS NOT NULL
      AND created_class_id IS NOT NULL
    )
    OR (
      status = 'rejected'
      AND reviewed_by IS NOT NULL
      AND reviewed_at IS NOT NULL
      AND decision_note IS NOT NULL
    )
    OR (
      status = 'withdrawn'
      AND reviewed_by IS NULL
      AND reviewed_at IS NULL
      AND created_class_id IS NULL
    )
  )
);


COMMENT ON TABLE public.class_applications IS 'User requests to create a class. Status changes happen only inside SECURITY DEFINER functions.';


CREATE INDEX if NOT EXISTS class_applications_applicant_idx ON public.class_applications (applicant_id, created_at DESC);


CREATE INDEX if NOT EXISTS class_applications_status_idx ON public.class_applications (status, created_at DESC);


-- One open application per applicant per slug: a second applicant may propose
-- the same class, but nobody can spam duplicates of their own.
CREATE UNIQUE INDEX if NOT EXISTS class_applications_open_applicant_key ON public.class_applications (applicant_id, proposed_slug)
WHERE
  status IN ('pending', 'approved');


CREATE TRIGGER class_applications_set_updated_at
BEFORE UPDATE ON public.class_applications FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at ();


-- ---------------------------------------------------------------------------
-- class_application_reviews: append-only decision history
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.class_application_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.class_applications (id) ON DELETE CASCADE,
  reviewer_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE RESTRICT,
  decision text NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT class_application_reviews_decision_allowed CHECK (decision IN ('approved', 'rejected')),
  CONSTRAINT class_application_reviews_note_length CHECK (
    note IS NULL
    OR char_length(btrim(note)) BETWEEN 3 AND 2000
  )
);


CREATE INDEX if NOT EXISTS class_application_reviews_application_idx ON public.class_application_reviews (application_id, created_at DESC);


-- ---------------------------------------------------------------------------
-- class_members / class_admins
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.class_members (
  class_id uuid NOT NULL REFERENCES public.classes (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  joined_via text NOT NULL DEFAULT 'invitation',
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (class_id, user_id),
  CONSTRAINT class_members_joined_via_allowed CHECK (
    joined_via IN ('invitation', 'admin_assignment', 'platform_assignment')
  )
);


COMMENT ON TABLE public.class_members IS 'Class membership. Invitation links grant this row and nothing else.';


CREATE INDEX if NOT EXISTS class_members_user_idx ON public.class_members (user_id, joined_at DESC);


CREATE TABLE IF NOT EXISTS public.class_admins (
  class_id uuid NOT NULL,
  user_id uuid NOT NULL,
  assigned_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (class_id, user_id),
  -- An admin is always a member. Removing the membership removes the admin
  -- role in the same statement, so the two tables cannot drift apart.
  FOREIGN key (class_id, user_id) REFERENCES public.class_members (class_id, user_id) ON DELETE CASCADE
);


COMMENT ON TABLE public.class_admins IS 'Class administrator assignments. Always a subset of class_members.';


CREATE INDEX if NOT EXISTS class_admins_user_idx ON public.class_admins (user_id, assigned_at DESC);


-- ---------------------------------------------------------------------------
-- class_invitations
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.class_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.classes (id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  -- Only the SHA-256 hex digest is stored; the raw token exists in the link the
  -- admin shares and is never persisted or logged.
  token_hash text NOT NULL,
  email_restriction text,
  expires_at timestamptz NOT NULL,
  max_uses integer NOT NULL DEFAULT 1,
  used_count integer NOT NULL DEFAULT 0,
  revoked_at timestamptz,
  revoked_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT class_invitations_token_hash_key UNIQUE (token_hash),
  CONSTRAINT class_invitations_token_hash_length CHECK (char_length(token_hash) = 64),
  CONSTRAINT class_invitations_email_format CHECK (
    email_restriction IS NULL
    OR email_restriction ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  ),
  CONSTRAINT class_invitations_max_uses_range CHECK (max_uses BETWEEN 1 AND 500),
  CONSTRAINT class_invitations_used_within_max CHECK (used_count BETWEEN 0 AND max_uses),
  CONSTRAINT class_invitations_expiry_after_creation CHECK (expires_at > created_at)
);


COMMENT ON TABLE public.class_invitations IS 'Invitation links. token_hash only; expires_at, revocation, and max_uses are checked server-side on acceptance.';


CREATE INDEX if NOT EXISTS class_invitations_class_idx ON public.class_invitations (class_id, created_at DESC);


CREATE TABLE IF NOT EXISTS public.class_invitation_acceptances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invitation_id uuid NOT NULL REFERENCES public.class_invitations (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  accepted_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT class_invitation_acceptances_key UNIQUE (invitation_id, user_id)
);


-- ---------------------------------------------------------------------------
-- assignment_reviews: submission, approval, rejection, moderation history
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.assignment_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES public.assignments (id) ON DELETE CASCADE,
  reviewer_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  decision text NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT assignment_reviews_decision_allowed CHECK (
    decision IN (
      'submitted',
      'approved',
      'rejected',
      'unpublished',
      'restored',
      'archived'
    )
  ),
  CONSTRAINT assignment_reviews_reason_required CHECK (
    decision NOT IN ('rejected', 'unpublished', 'archived')
    OR (
      reason IS NOT NULL
      AND char_length(btrim(reason)) >= 3
    )
  ),
  CONSTRAINT assignment_reviews_reason_length CHECK (
    reason IS NULL
    OR char_length(btrim(reason)) <= 2000
  )
);


CREATE INDEX if NOT EXISTS assignment_reviews_assignment_idx ON public.assignment_reviews (assignment_id, created_at DESC);


-- ---------------------------------------------------------------------------
-- audit_logs: append-only
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  class_id uuid REFERENCES public.classes (id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT audit_logs_action_format CHECK (action ~ '^[a-z][a-z0-9_]{2,63}$'),
  CONSTRAINT audit_logs_entity_type_format CHECK (entity_type ~ '^[a-z][a-z0-9_]{2,63}$'),
  CONSTRAINT audit_logs_metadata_object CHECK (jsonb_typeof(metadata) = 'object')
);


COMMENT ON TABLE public.audit_logs IS 'Append-only audit trail. Metadata never contains tokens, emails, or credentials.';


CREATE INDEX if NOT EXISTS audit_logs_created_idx ON public.audit_logs (created_at DESC);


CREATE INDEX if NOT EXISTS audit_logs_class_idx ON public.audit_logs (class_id, created_at DESC);


CREATE INDEX if NOT EXISTS audit_logs_actor_idx ON public.audit_logs (actor_id, created_at DESC);


-- ---------------------------------------------------------------------------
-- assignments: class link and review state
-- ---------------------------------------------------------------------------
ALTER TABLE public.assignments
ADD COLUMN IF NOT EXISTS class_id uuid REFERENCES public.classes (id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
ADD COLUMN IF NOT EXISTS rejection_reason text,
ADD COLUMN IF NOT EXISTS published_at timestamptz,
ADD COLUMN IF NOT EXISTS revision integer NOT NULL DEFAULT 1;


ALTER TABLE public.assignments
DROP CONSTRAINT if EXISTS assignments_status_allowed;


-- 'pending' is the legacy pre-review state and is kept so existing rows and the
-- current submit flow keep working until the UI moves to the review queue.
ALTER TABLE public.assignments
ADD CONSTRAINT assignments_status_allowed CHECK (
  status IN (
    'draft',
    'pending_review',
    'pending',
    'published',
    'rejected',
    'unpublished',
    'archived'
  )
);


ALTER TABLE public.assignments
DROP CONSTRAINT if EXISTS assignments_rejection_reason_length;


ALTER TABLE public.assignments
ADD CONSTRAINT assignments_rejection_reason_length CHECK (
  rejection_reason IS NULL
  OR char_length(btrim(rejection_reason)) BETWEEN 3 AND 2000
);


ALTER TABLE public.assignments
DROP CONSTRAINT if EXISTS assignments_revision_positive;


ALTER TABLE public.assignments
ADD CONSTRAINT assignments_revision_positive CHECK (revision BETWEEN 1 AND 100);


COMMENT ON COLUMN public.assignments.status IS 'draft/pending_review = submitter only; published = public; rejected/unpublished/archived = hidden from public discovery.';


CREATE INDEX if NOT EXISTS assignments_class_idx ON public.assignments (class_id, status);


CREATE INDEX if NOT EXISTS assignments_review_queue_idx ON public.assignments (class_id, created_at)
WHERE
  status = 'pending_review';

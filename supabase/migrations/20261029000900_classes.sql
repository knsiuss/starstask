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
create extension if not exists pgcrypto;


-- ---------------------------------------------------------------------------
-- platform_admins: written only through SQL or the service role
-- ---------------------------------------------------------------------------
create table if not exists public.platform_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  granted_at timestamptz not null default now(),
  granted_by uuid references auth.users (id) on delete set null
);


comment on table public.platform_admins IS 'Trusted platform administrators. No client policies: granting is a manual, audited operation.';


-- ---------------------------------------------------------------------------
-- classes
-- ---------------------------------------------------------------------------
create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  name text not null,
  description text not null,
  -- NOT NULL: every submission needs a course, and the approval workflow
  -- creates the course row before the class.
  course_id uuid not null references public.courses (id) on delete restrict,
  course_name text not null,
  institution text,
  lecturer_name text,
  semester text not null,
  academic_year text not null,
  status text not null default 'active',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint classes_slug_format check (
    slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    and char_length(slug) between 3 and 80
  ),
  constraint classes_name_length check (char_length(btrim(name)) between 3 and 120),
  constraint classes_description_length check (char_length(btrim(description)) between 10 and 5000),
  constraint classes_course_name_length check (char_length(btrim(course_name)) between 2 and 120),
  constraint classes_institution_length check (
    institution is null
    or char_length(btrim(institution)) between 2 and 120
  ),
  constraint classes_lecturer_length check (
    lecturer_name is null
    or char_length(btrim(lecturer_name)) between 1 and 120
  ),
  constraint classes_semester_length check (char_length(btrim(semester)) between 1 and 20),
  constraint classes_academic_year_format check (academic_year ~ '^\d{4}/\d{4}$'),
  constraint classes_status_allowed check (status in ('active', 'archived'))
);


comment on table public.classes IS 'Approved academic classes. Created only by the platform approval workflow, never by direct client insert.';


create unique index if not exists classes_slug_key ON public.classes (slug);


create index if not exists classes_course_idx ON public.classes (course_id)
where
  status = 'active';


create index if not exists classes_active_recent_idx ON public.classes (created_at DESC)
where
  status = 'active';


create trigger classes_set_updated_at BEFORE
update ON public.classes FOR EACH ROW
execute function public.set_updated_at ();


-- ---------------------------------------------------------------------------
-- class_applications
-- ---------------------------------------------------------------------------
create table if not exists public.class_applications (
  id uuid primary key default gen_random_uuid(),
  applicant_id uuid not null references auth.users (id) on delete cascade,
  proposed_slug text not null,
  proposed_name text not null,
  course_name text not null,
  institution text,
  lecturer_name text,
  semester text not null,
  academic_year text not null,
  description text not null,
  reason text not null,
  supporting_info text,
  status text not null default 'pending',
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  decision_note text,
  created_class_id uuid references public.classes (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint class_applications_slug_format check (
    proposed_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    and char_length(proposed_slug) between 3 and 80
  ),
  constraint class_applications_name_length check (char_length(btrim(proposed_name)) between 3 and 120),
  constraint class_applications_course_length check (char_length(btrim(course_name)) between 2 and 120),
  constraint class_applications_institution_length check (
    institution is null
    or char_length(btrim(institution)) between 2 and 120
  ),
  constraint class_applications_lecturer_length check (
    lecturer_name is null
    or char_length(btrim(lecturer_name)) between 1 and 120
  ),
  constraint class_applications_semester_length check (char_length(btrim(semester)) between 1 and 20),
  constraint class_applications_academic_year_format check (academic_year ~ '^\d{4}/\d{4}$'),
  constraint class_applications_description_length check (char_length(btrim(description)) between 10 and 5000),
  constraint class_applications_reason_length check (char_length(btrim(reason)) between 10 and 2000),
  constraint class_applications_supporting_length check (
    supporting_info is null
    or char_length(btrim(supporting_info)) <= 2000
  ),
  constraint class_applications_decision_note_length check (
    decision_note is null
    or char_length(btrim(decision_note)) between 3 and 2000
  ),
  constraint class_applications_status_allowed check (
    status in ('pending', 'approved', 'rejected', 'withdrawn')
  ),
  -- A rejection always carries a reason; an approval always records a reviewer
  -- and the class it produced. The database enforces it so a bug in the
  -- application layer cannot create an unexplained decision.
  constraint class_applications_decision_consistency check (
    (
      status = 'pending'
      and reviewed_by is null
      and reviewed_at is null
      and created_class_id is null
    )
    or (
      status = 'approved'
      and reviewed_by is not null
      and reviewed_at is not null
      and created_class_id is not null
    )
    or (
      status = 'rejected'
      and reviewed_by is not null
      and reviewed_at is not null
      and decision_note is not null
    )
    or (
      status = 'withdrawn'
      and reviewed_by is null
      and reviewed_at is null
      and created_class_id is null
    )
  )
);


comment on table public.class_applications IS 'User requests to create a class. Status changes happen only inside SECURITY DEFINER functions.';


create index if not exists class_applications_applicant_idx ON public.class_applications (applicant_id, created_at DESC);


create index if not exists class_applications_status_idx ON public.class_applications (status, created_at DESC);


-- One open application per applicant per slug: a second applicant may propose
-- the same class, but nobody can spam duplicates of their own.
create unique index if not exists class_applications_open_applicant_key ON public.class_applications (applicant_id, proposed_slug)
where
  status in ('pending', 'approved');


create trigger class_applications_set_updated_at BEFORE
update ON public.class_applications FOR EACH ROW
execute function public.set_updated_at ();


-- ---------------------------------------------------------------------------
-- class_application_reviews: append-only decision history
-- ---------------------------------------------------------------------------
create table if not exists public.class_application_reviews (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.class_applications (id) on delete cascade,
  reviewer_id uuid not null references auth.users (id) on delete restrict,
  decision text not null,
  note text,
  created_at timestamptz not null default now(),
  constraint class_application_reviews_decision_allowed check (decision in ('approved', 'rejected')),
  constraint class_application_reviews_note_length check (
    note is null
    or char_length(btrim(note)) between 3 and 2000
  )
);


create index if not exists class_application_reviews_application_idx ON public.class_application_reviews (application_id, created_at DESC);


-- ---------------------------------------------------------------------------
-- class_members / class_admins
-- ---------------------------------------------------------------------------
create table if not exists public.class_members (
  class_id uuid not null references public.classes (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  joined_via text not null default 'invitation',
  joined_at timestamptz not null default now(),
  primary key (class_id, user_id),
  constraint class_members_joined_via_allowed check (
    joined_via in ('invitation', 'admin_assignment', 'platform_assignment')
  )
);


comment on table public.class_members IS 'Class membership. Invitation links grant this row and nothing else.';


create index if not exists class_members_user_idx ON public.class_members (user_id, joined_at DESC);


create table if not exists public.class_admins (
  class_id uuid not null,
  user_id uuid not null,
  assigned_by uuid references auth.users (id) on delete set null,
  assigned_at timestamptz not null default now(),
  primary key (class_id, user_id),
  -- An admin is always a member. Removing the membership removes the admin
  -- role in the same statement, so the two tables cannot drift apart.
  foreign key (class_id, user_id) references public.class_members (class_id, user_id) on delete cascade
);


comment on table public.class_admins IS 'Class administrator assignments. Always a subset of class_members.';


create index if not exists class_admins_user_idx ON public.class_admins (user_id, assigned_at DESC);


-- ---------------------------------------------------------------------------
-- class_invitations
-- ---------------------------------------------------------------------------
create table if not exists public.class_invitations (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  created_by uuid not null references auth.users (id) on delete cascade,
  -- Only the SHA-256 hex digest is stored; the raw token exists in the link the
  -- admin shares and is never persisted or logged.
  token_hash text not null,
  email_restriction text,
  expires_at timestamptz not null,
  max_uses integer not null default 1,
  used_count integer not null default 0,
  revoked_at timestamptz,
  revoked_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint class_invitations_token_hash_key unique (token_hash),
  constraint class_invitations_token_hash_length check (char_length(token_hash) = 64),
  constraint class_invitations_email_format check (
    email_restriction is null
    or email_restriction ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  ),
  constraint class_invitations_max_uses_range check (max_uses between 1 and 500),
  constraint class_invitations_used_within_max check (used_count between 0 and max_uses),
  constraint class_invitations_expiry_after_creation check (expires_at > created_at)
);


comment on table public.class_invitations IS 'Invitation links. token_hash only; expires_at, revocation, and max_uses are checked server-side on acceptance.';


create index if not exists class_invitations_class_idx ON public.class_invitations (class_id, created_at DESC);


create table if not exists public.class_invitation_acceptances (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null references public.class_invitations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  accepted_at timestamptz not null default now(),
  constraint class_invitation_acceptances_key unique (invitation_id, user_id)
);


-- ---------------------------------------------------------------------------
-- assignment_reviews: submission, approval, rejection, moderation history
-- ---------------------------------------------------------------------------
create table if not exists public.assignment_reviews (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments (id) on delete cascade,
  reviewer_id uuid references auth.users (id) on delete set null,
  decision text not null,
  reason text,
  created_at timestamptz not null default now(),
  constraint assignment_reviews_decision_allowed check (
    decision in ('submitted', 'approved', 'rejected', 'unpublished', 'restored', 'archived')
  ),
  constraint assignment_reviews_reason_required check (
    decision not in ('rejected', 'unpublished', 'archived')
    or (reason is not null and char_length(btrim(reason)) >= 3)
  ),
  constraint assignment_reviews_reason_length check (
    reason is null
    or char_length(btrim(reason)) <= 2000
  )
);


create index if not exists assignment_reviews_assignment_idx ON public.assignment_reviews (assignment_id, created_at DESC);


-- ---------------------------------------------------------------------------
-- audit_logs: append-only
-- ---------------------------------------------------------------------------
create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  class_id uuid references public.classes (id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint audit_logs_action_format check (action ~ '^[a-z][a-z0-9_]{2,63}$'),
  constraint audit_logs_entity_type_format check (entity_type ~ '^[a-z][a-z0-9_]{2,63}$'),
  constraint audit_logs_metadata_object check (jsonb_typeof(metadata) = 'object')
);


comment on table public.audit_logs IS 'Append-only audit trail. Metadata never contains tokens, emails, or credentials.';


create index if not exists audit_logs_created_idx ON public.audit_logs (created_at DESC);


create index if not exists audit_logs_class_idx ON public.audit_logs (class_id, created_at DESC);


create index if not exists audit_logs_actor_idx ON public.audit_logs (actor_id, created_at DESC);


-- ---------------------------------------------------------------------------
-- assignments: class link and review state
-- ---------------------------------------------------------------------------
alter table public.assignments
add column if not exists class_id uuid references public.classes (id) on delete set null,
add column if not exists reviewed_by uuid references auth.users (id) on delete set null,
add column if not exists reviewed_at timestamptz,
add column if not exists rejection_reason text,
add column if not exists published_at timestamptz,
add column if not exists revision integer not null default 1;


alter table public.assignments drop constraint if exists assignments_status_allowed;


-- 'pending' is the legacy pre-review state and is kept so existing rows and the
-- current submit flow keep working until the UI moves to the review queue.
alter table public.assignments
add constraint assignments_status_allowed check (
  status in (
    'draft',
    'pending_review',
    'pending',
    'published',
    'rejected',
    'unpublished',
    'archived'
  )
);


alter table public.assignments drop constraint if exists assignments_rejection_reason_length;


alter table public.assignments
add constraint assignments_rejection_reason_length check (
  rejection_reason is null
  or char_length(btrim(rejection_reason)) between 3 and 2000
);


alter table public.assignments drop constraint if exists assignments_revision_positive;


alter table public.assignments
add constraint assignments_revision_positive check (revision between 1 and 100);


comment on column public.assignments.status IS 'draft/pending_review = submitter only; published = public; rejected/unpublished/archived = hidden from public discovery.';


create index if not exists assignments_class_idx ON public.assignments (class_id, status);


create index if not exists assignments_review_queue_idx ON public.assignments (class_id, created_at)
where
  status = 'pending_review';

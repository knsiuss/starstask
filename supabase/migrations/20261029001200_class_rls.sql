-- Row Level Security for the class, review, and audit tables.
--
-- Reading is scoped: public visitors only see active classes; members see their
-- own class; class admins see their class's operational data; platform admins
-- see everything. Writing goes through the SECURITY DEFINER functions in
-- 20261029001100_class_functions.sql, so most tables get no write grants at all.
alter table public.platform_admins enable row level security;


alter table public.classes enable row level security;


alter table public.class_applications enable row level security;


alter table public.class_application_reviews enable row level security;


alter table public.class_members enable row level security;


alter table public.class_admins enable row level security;


alter table public.class_invitations enable row level security;


alter table public.class_invitation_acceptances enable row level security;


alter table public.assignment_reviews enable row level security;


alter table public.audit_logs enable row level security;


alter table public.notification_events enable row level security;


-- ---------------------------------------------------------------------------
-- platform_admins: no client access whatsoever
-- ---------------------------------------------------------------------------
revoke all on public.platform_admins
from
  anon,
  authenticated;


-- ---------------------------------------------------------------------------
-- classes: public metadata for active classes, managed updates only
-- ---------------------------------------------------------------------------
revoke all on public.classes
from
  anon,
  authenticated;


grant
select (id, slug, name, description, course_id, course_name, institution, lecturer_name, semester, academic_year, status, created_at, updated_at) on public.classes to anon,
authenticated;


drop policy if exists classes_read on public.classes;


create policy classes_read ON public.classes FOR
select
  TO anon,
  authenticated USING (
    status = 'active'
    or public.is_class_member (id)
    or public.can_manage_class (id)
  );


-- ---------------------------------------------------------------------------
-- class_applications: applicant and platform admins only
-- ---------------------------------------------------------------------------
revoke all on public.class_applications
from
  anon,
  authenticated;


grant
select (id, applicant_id, proposed_slug, proposed_name, course_name, institution, lecturer_name, semester, academic_year, description, reason, supporting_info, status, reviewed_by, reviewed_at, decision_note, created_class_id, created_at, updated_at) on public.class_applications to authenticated;


drop policy if exists class_applications_read on public.class_applications;


create policy class_applications_read ON public.class_applications FOR
select
  TO authenticated USING (
    applicant_id = (
      select
        auth.uid ()
    )
    or public.is_platform_admin ()
  );


-- ---------------------------------------------------------------------------
-- class_application_reviews: decision history, reviewer identity withheld
-- ---------------------------------------------------------------------------
revoke all on public.class_application_reviews
from
  anon,
  authenticated;


grant
select (id, application_id, decision, note, created_at) on public.class_application_reviews to authenticated;


drop policy if exists class_application_reviews_read on public.class_application_reviews;


create policy class_application_reviews_read ON public.class_application_reviews FOR
select
  TO authenticated USING (
    public.is_platform_admin ()
    or exists (
      select
        1
      from
        public.class_applications a
      where
        a.id = application_id
        and a.applicant_id = (
          select
            auth.uid ()
        )
    )
  );


-- ---------------------------------------------------------------------------
-- class_members: members of the class, plus platform admins
-- ---------------------------------------------------------------------------
revoke all on public.class_members
from
  anon,
  authenticated;


grant
select (class_id, user_id, joined_via, joined_at) on public.class_members to authenticated;


drop policy if exists class_members_read on public.class_members;


create policy class_members_read ON public.class_members FOR
select
  TO authenticated USING (
    public.is_class_member (class_id)
    or public.is_platform_admin ()
  );


-- ---------------------------------------------------------------------------
-- class_admins: visible to the class and to platform admins
-- ---------------------------------------------------------------------------
revoke all on public.class_admins
from
  anon,
  authenticated;


grant
select (class_id, user_id, assigned_at) on public.class_admins to authenticated;


drop policy if exists class_admins_read on public.class_admins;


create policy class_admins_read ON public.class_admins FOR
select
  TO authenticated USING (
    public.is_class_member (class_id)
    or public.is_platform_admin ()
  );


-- ---------------------------------------------------------------------------
-- class_invitations: managers only, token_hash never granted
-- ---------------------------------------------------------------------------
revoke all on public.class_invitations
from
  anon,
  authenticated;


grant
select (id, class_id, created_by, email_restriction, expires_at, max_uses, used_count, revoked_at, revoked_by, created_at) on public.class_invitations to authenticated;


drop policy if exists class_invitations_read on public.class_invitations;


create policy class_invitations_read ON public.class_invitations FOR
select
  TO authenticated USING (public.can_manage_class (class_id));


-- ---------------------------------------------------------------------------
-- class_invitation_acceptances
-- ---------------------------------------------------------------------------
revoke all on public.class_invitation_acceptances
from
  anon,
  authenticated;


grant
select (id, invitation_id, user_id, accepted_at) on public.class_invitation_acceptances to authenticated;


drop policy if exists class_invitation_acceptances_read on public.class_invitation_acceptances;


create policy class_invitation_acceptances_read ON public.class_invitation_acceptances FOR
select
  TO authenticated USING (
    user_id = (
      select
        auth.uid ()
    )
    or exists (
      select
        1
      from
        public.class_invitations i
      where
        i.id = invitation_id
        and public.can_manage_class (i.class_id)
    )
  );


-- ---------------------------------------------------------------------------
-- assignment_reviews: submitter, class admins, platform admins
-- ---------------------------------------------------------------------------
revoke all on public.assignment_reviews
from
  anon,
  authenticated;


grant
select (id, assignment_id, decision, reason, created_at) on public.assignment_reviews to authenticated;


drop policy if exists assignment_reviews_read on public.assignment_reviews;


create policy assignment_reviews_read ON public.assignment_reviews FOR
select
  TO authenticated USING (
    public.is_platform_admin ()
    or exists (
      select
        1
      from
        public.assignments a
      where
        a.id = assignment_id
        and (
          a.user_id = (
            select
              auth.uid ()
          )
          or (
            a.class_id is not null
            and public.is_class_admin (a.class_id)
          )
        )
    )
  );


-- ---------------------------------------------------------------------------
-- audit_logs: append-only, readable by the class admin or platform admin
-- ---------------------------------------------------------------------------
revoke all on public.audit_logs
from
  anon,
  authenticated;


grant
select (id, actor_id, action, entity_type, entity_id, class_id, metadata, created_at) on public.audit_logs to authenticated;


drop policy if exists audit_logs_read on public.audit_logs;


create policy audit_logs_read ON public.audit_logs FOR
select
  TO authenticated USING (
    public.is_platform_admin ()
    or (
      class_id is not null
      and public.is_class_admin (class_id)
    )
  );


-- ---------------------------------------------------------------------------
-- notification_events: a user sees their own queue, never anyone else's
-- ---------------------------------------------------------------------------
revoke all on public.notification_events
from
  anon,
  authenticated;


grant
select (id, kind, payload, status, created_at, sent_at) on public.notification_events to authenticated;


drop policy if exists notification_events_read on public.notification_events;


create policy notification_events_read ON public.notification_events FOR
select
  TO authenticated USING (
    user_id = (
      select
        auth.uid ()
    )
  );


-- ---------------------------------------------------------------------------
-- assignment_attachments: reviewers must be able to read pending attachments
-- ---------------------------------------------------------------------------
drop policy if exists assignment_attachments_reviewer_read ON public.assignment_attachments;


create policy assignment_attachments_reviewer_read ON public.assignment_attachments FOR
select
  TO authenticated USING (
    exists (
      select
        1
      from
        public.assignments a
      where
        a.id = assignment_id
        and (
          public.is_platform_admin ()
          or (
            a.class_id is not null
            and public.is_class_admin (a.class_id)
          )
        )
    )
  );


-- Signed URLs for review use the reviewer's own session, so the storage policy
-- must allow the same reviewers to read the underlying object.
drop policy if exists assignment_attachments_storage_review_read ON storage.objects;


create policy assignment_attachments_storage_review_read ON storage.objects FOR
select
  TO authenticated USING (
    bucket_id = 'assignment-attachments'
    and exists (
      select
        1
      from
        public.assignments a
      where
        a.id = public.assignment_id_from_object_path (name)
        and a.class_id is not null
        and (
          public.is_class_admin (a.class_id)
          or public.is_platform_admin ()
        )
    )
  );

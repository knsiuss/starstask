-- Row Level Security for the class, review, and audit tables.
--
-- Reading is scoped: public visitors only see active classes; members see their
-- own class; class admins see their class's operational data; platform admins
-- see everything. Writing goes through the SECURITY DEFINER functions in
-- 20261029001100_class_functions.sql, so most tables get no write grants at all.
ALTER TABLE public.platform_admins enable ROW level security;


ALTER TABLE public.classes enable ROW level security;


ALTER TABLE public.class_applications enable ROW level security;


ALTER TABLE public.class_application_reviews enable ROW level security;


ALTER TABLE public.class_members enable ROW level security;


ALTER TABLE public.class_admins enable ROW level security;


ALTER TABLE public.class_invitations enable ROW level security;


ALTER TABLE public.class_invitation_acceptances enable ROW level security;


ALTER TABLE public.assignment_reviews enable ROW level security;


ALTER TABLE public.audit_logs enable ROW level security;


ALTER TABLE public.notification_events enable ROW level security;


-- ---------------------------------------------------------------------------
-- platform_admins: no client access whatsoever
-- ---------------------------------------------------------------------------
REVOKE ALL ON public.platform_admins
FROM
  anon,
  authenticated;


-- ---------------------------------------------------------------------------
-- classes: public metadata for active classes, managed updates only
-- ---------------------------------------------------------------------------
REVOKE ALL ON public.classes
FROM
  anon,
  authenticated;


GRANT
SELECT
  (
    id,
    slug,
    name,
    description,
    course_id,
    course_name,
    institution,
    lecturer_name,
    semester,
    academic_year,
    status,
    created_at,
    updated_at
  ) ON public.classes TO anon,
  authenticated;


DROP POLICY if EXISTS classes_read ON public.classes;


CREATE POLICY classes_read ON public.classes FOR
SELECT
  TO anon,
  authenticated USING (
    status = 'active'
    OR public.is_class_member (id)
    OR public.can_manage_class (id)
  );


-- ---------------------------------------------------------------------------
-- class_applications: applicant and platform admins only
-- ---------------------------------------------------------------------------
REVOKE ALL ON public.class_applications
FROM
  anon,
  authenticated;


GRANT
SELECT
  (
    id,
    applicant_id,
    proposed_slug,
    proposed_name,
    course_name,
    institution,
    lecturer_name,
    semester,
    academic_year,
    description,
    reason,
    supporting_info,
    status,
    reviewed_by,
    reviewed_at,
    decision_note,
    created_class_id,
    created_at,
    updated_at
  ) ON public.class_applications TO authenticated;


DROP POLICY if EXISTS class_applications_read ON public.class_applications;


CREATE POLICY class_applications_read ON public.class_applications FOR
SELECT
  TO authenticated USING (
    applicant_id = (
      SELECT
        auth.uid ()
    )
    OR public.is_platform_admin ()
  );


-- ---------------------------------------------------------------------------
-- class_application_reviews: decision history, reviewer identity withheld
-- ---------------------------------------------------------------------------
REVOKE ALL ON public.class_application_reviews
FROM
  anon,
  authenticated;


GRANT
SELECT
  (id, application_id, decision, note, created_at) ON public.class_application_reviews TO authenticated;


DROP POLICY if EXISTS class_application_reviews_read ON public.class_application_reviews;


CREATE POLICY class_application_reviews_read ON public.class_application_reviews FOR
SELECT
  TO authenticated USING (
    public.is_platform_admin ()
    OR EXISTS (
      SELECT
        1
      FROM
        public.class_applications a
      WHERE
        a.id = application_id
        AND a.applicant_id = (
          SELECT
            auth.uid ()
        )
    )
  );


-- ---------------------------------------------------------------------------
-- class_members: members of the class, plus platform admins
-- ---------------------------------------------------------------------------
REVOKE ALL ON public.class_members
FROM
  anon,
  authenticated;


GRANT
SELECT
  (class_id, user_id, joined_via, joined_at) ON public.class_members TO authenticated;


DROP POLICY if EXISTS class_members_read ON public.class_members;


CREATE POLICY class_members_read ON public.class_members FOR
SELECT
  TO authenticated USING (
    public.is_class_member (class_id)
    OR public.is_platform_admin ()
  );


-- ---------------------------------------------------------------------------
-- class_admins: visible to the class and to platform admins
-- ---------------------------------------------------------------------------
REVOKE ALL ON public.class_admins
FROM
  anon,
  authenticated;


GRANT
SELECT
  (class_id, user_id, assigned_at) ON public.class_admins TO authenticated;


DROP POLICY if EXISTS class_admins_read ON public.class_admins;


CREATE POLICY class_admins_read ON public.class_admins FOR
SELECT
  TO authenticated USING (
    public.is_class_member (class_id)
    OR public.is_platform_admin ()
  );


-- ---------------------------------------------------------------------------
-- class_invitations: managers only, token_hash never granted
-- ---------------------------------------------------------------------------
REVOKE ALL ON public.class_invitations
FROM
  anon,
  authenticated;


GRANT
SELECT
  (
    id,
    class_id,
    created_by,
    email_restriction,
    expires_at,
    max_uses,
    used_count,
    revoked_at,
    revoked_by,
    created_at
  ) ON public.class_invitations TO authenticated;


DROP POLICY if EXISTS class_invitations_read ON public.class_invitations;


CREATE POLICY class_invitations_read ON public.class_invitations FOR
SELECT
  TO authenticated USING (public.can_manage_class (class_id));


-- ---------------------------------------------------------------------------
-- class_invitation_acceptances
-- ---------------------------------------------------------------------------
REVOKE ALL ON public.class_invitation_acceptances
FROM
  anon,
  authenticated;


GRANT
SELECT
  (id, invitation_id, user_id, accepted_at) ON public.class_invitation_acceptances TO authenticated;


DROP POLICY if EXISTS class_invitation_acceptances_read ON public.class_invitation_acceptances;


CREATE POLICY class_invitation_acceptances_read ON public.class_invitation_acceptances FOR
SELECT
  TO authenticated USING (
    user_id = (
      SELECT
        auth.uid ()
    )
    OR EXISTS (
      SELECT
        1
      FROM
        public.class_invitations i
      WHERE
        i.id = invitation_id
        AND public.can_manage_class (i.class_id)
    )
  );


-- ---------------------------------------------------------------------------
-- assignment_reviews: submitter, class admins, platform admins
-- ---------------------------------------------------------------------------
REVOKE ALL ON public.assignment_reviews
FROM
  anon,
  authenticated;


GRANT
SELECT
  (id, assignment_id, decision, reason, created_at) ON public.assignment_reviews TO authenticated;


DROP POLICY if EXISTS assignment_reviews_read ON public.assignment_reviews;


CREATE POLICY assignment_reviews_read ON public.assignment_reviews FOR
SELECT
  TO authenticated USING (
    public.is_platform_admin ()
    OR EXISTS (
      SELECT
        1
      FROM
        public.assignments a
      WHERE
        a.id = assignment_id
        AND (
          a.user_id = (
            SELECT
              auth.uid ()
          )
          OR (
            a.class_id IS NOT NULL
            AND public.is_class_admin (a.class_id)
          )
        )
    )
  );


-- ---------------------------------------------------------------------------
-- audit_logs: append-only, readable by the class admin or platform admin
-- ---------------------------------------------------------------------------
REVOKE ALL ON public.audit_logs
FROM
  anon,
  authenticated;


GRANT
SELECT
  (
    id,
    actor_id,
    action,
    entity_type,
    entity_id,
    class_id,
    metadata,
    created_at
  ) ON public.audit_logs TO authenticated;


DROP POLICY if EXISTS audit_logs_read ON public.audit_logs;


CREATE POLICY audit_logs_read ON public.audit_logs FOR
SELECT
  TO authenticated USING (
    public.is_platform_admin ()
    OR (
      class_id IS NOT NULL
      AND public.is_class_admin (class_id)
    )
  );


-- ---------------------------------------------------------------------------
-- notification_events: a user sees their own queue, never anyone else's
-- ---------------------------------------------------------------------------
REVOKE ALL ON public.notification_events
FROM
  anon,
  authenticated;


GRANT
SELECT
  (id, kind, payload, status, created_at, sent_at) ON public.notification_events TO authenticated;


DROP POLICY if EXISTS notification_events_read ON public.notification_events;


CREATE POLICY notification_events_read ON public.notification_events FOR
SELECT
  TO authenticated USING (
    user_id = (
      SELECT
        auth.uid ()
    )
  );


-- ---------------------------------------------------------------------------
-- assignment_attachments: reviewers must be able to read pending attachments
-- ---------------------------------------------------------------------------
DROP POLICY if EXISTS assignment_attachments_reviewer_read ON public.assignment_attachments;


CREATE POLICY assignment_attachments_reviewer_read ON public.assignment_attachments FOR
SELECT
  TO authenticated USING (
    EXISTS (
      SELECT
        1
      FROM
        public.assignments a
      WHERE
        a.id = assignment_id
        AND (
          public.is_platform_admin ()
          OR (
            a.class_id IS NOT NULL
            AND public.is_class_admin (a.class_id)
          )
        )
    )
  );


-- Signed URLs for review use the reviewer's own session, so the storage policy
-- must allow the same reviewers to read the underlying object.
DROP POLICY if EXISTS assignment_attachments_storage_review_read ON storage.objects;


CREATE POLICY assignment_attachments_storage_review_read ON storage.objects FOR
SELECT
  TO authenticated USING (
    bucket_id = 'assignment-attachments'
    AND EXISTS (
      SELECT
        1
      FROM
        public.assignments a
      WHERE
        a.id = public.assignment_id_from_object_path (name)
        AND a.class_id IS NOT NULL
        AND (
          public.is_class_admin (a.class_id)
          OR public.is_platform_admin ()
        )
    )
  );

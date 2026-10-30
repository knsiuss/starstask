-- Class posts by the class representative, and class deletion.
--
-- Two owner decisions (2026-10-30):
--   1. There is no lecturer account. A class assignment posted by a class admin
--      (ketua kelas) is the class announcement, so it must publish without a
--      second reviewer and reach every member immediately.
--   2. A class admin may delete the class they run, not only archive it.
--
-- Both transitions stay inside SECURITY DEFINER functions; no table gains a
-- direct INSERT/UPDATE/DELETE grant.
-- ---------------------------------------------------------------------------
-- Notification kinds
-- ---------------------------------------------------------------------------
ALTER TABLE public.notification_events
DROP CONSTRAINT if EXISTS notification_events_kind_allowed;


ALTER TABLE public.notification_events
ADD CONSTRAINT notification_events_kind_allowed CHECK (
  kind IN (
    'class_application_approved',
    'class_application_rejected',
    'class_admin_assigned',
    'class_invitation',
    'assignment_approved',
    'assignment_rejected',
    'submission_received',
    'moderation_required',
    'session_updated',
    'session_cancelled',
    'session_rsvp',
    'leave_request_submitted',
    'leave_request_revision_requested',
    'leave_request_forwarded',
    'verification_submitted',
    'verification_approved',
    'verification_rejected',
    'verification_revision_requested',
    'class_admin_revoked',
    'class_assignment_published'
  )
);


-- ---------------------------------------------------------------------------
-- submit_class_assignment: a class admin's own post skips review
-- ---------------------------------------------------------------------------
-- A class admin cannot review their own submission (review_class_assignment
-- refuses it), so leaving the row in `pending_review` would strand it forever.
-- Their post starts as `draft` instead: nothing is public until the attachments
-- have landed, then `publish_class_assignment` publishes it and notifies the
-- class. Ordinary members keep the existing review queue.
CREATE OR REPLACE FUNCTION public.submit_class_assignment (
  p_class_id uuid,
  p_title text,
  p_description text,
  p_deadline timestamptz DEFAULT NULL,
  p_assignment_type text DEFAULT NULL,
  p_tags TEXT[] DEFAULT '{}',
  p_reference_urls jsonb DEFAULT '[]'::jsonb
) returns uuid language plpgsql security definer
SET
  search_path = public,
  pg_temp AS $$
declare
  v_user uuid := (
    select
      auth.uid ()
  );
  v_class public.classes;
  v_id uuid;
  v_status text;
begin
  if v_user is null then raise exception 'authentication required' using errcode = '42501';
  end if;

  select
    * into v_class
  from
    public.classes
  where
    id = p_class_id;

  if not found then raise exception 'class not found' using errcode = 'P0002';
  end if;

  if v_class.status <> 'active' then raise exception 'class is not accepting submissions' using errcode = '22023';
  end if;

  if not public.is_class_member (p_class_id) then raise exception 'class membership required' using errcode = '42501';
  end if;

  v_status := case
    when public.can_manage_class (p_class_id) then 'draft'
    else 'pending_review'
  end;

  insert into public.assignments (
    title,
    description,
    course_id,
    user_id,
    class_id,
    lecturer_name,
    semester,
    academic_year,
    assignment_type,
    deadline,
    tags,
    reference_urls,
    status
  )
values (
    btrim(p_title),
    btrim(p_description),
    v_class.course_id,
    v_user,
    p_class_id,
    v_class.lecturer_name,
    v_class.semester,
    v_class.academic_year,
    p_assignment_type,
    p_deadline,
    coalesce(p_tags, '{}'),
    coalesce(p_reference_urls, '[]'::jsonb),
    v_status
  )
returning
  id into v_id;

  insert into public.assignment_reviews (assignment_id, reviewer_id, decision)
values (v_id, v_user, 'submitted');

  perform public.record_audit(
    'assignment_submitted',
    'assignment',
    v_id,
    p_class_id,
    jsonb_build_object('status', v_status)
  );

  -- A pending submission needs a reviewer. A class post needs nobody.
  if v_status = 'pending_review' then
    perform public.enqueue_notification_event(
      ca.user_id,
      'submission_received',
      'submission:' || v_id || ':' || ca.user_id,
      jsonb_build_object(
        'title',
        'New submission to review',
        'body',
        'A class member submitted an assignment for review.',
        'url',
        '/dashboard/review'
      )
    )
    from
      public.class_admins ca
    where
      ca.class_id = p_class_id
      and ca.user_id <> v_user;
  end if;

  return v_id;
end;
$$;


-- ---------------------------------------------------------------------------
-- publish_class_assignment
-- ---------------------------------------------------------------------------
-- Publishes the caller's own class assignment. Author and class-manager are
-- both required, so this can never bypass review for somebody else's work.
-- The caller decides when: the web service calls it after the attachments are
-- uploaded, so a published post is always complete.
CREATE OR REPLACE FUNCTION public.publish_class_assignment (p_assignment_id uuid) returns boolean language plpgsql security definer
SET
  search_path = public,
  pg_temp AS $$
declare
  v_actor uuid := (
    select
      auth.uid ()
  );
  v_assignment public.assignments;
  v_class_name text;
begin
  if v_actor is null then raise exception 'authentication required' using errcode = '42501';
  end if;

  select
    * into v_assignment
  from
    public.assignments
  where
    id = p_assignment_id for
  update;

  if not found then raise exception 'assignment not found' using errcode = 'P0002';
  end if;

  if v_assignment.class_id is null then raise exception 'assignment does not belong to a class' using errcode = '22023';
  end if;

  if v_assignment.user_id <> v_actor then raise exception 'not your assignment' using errcode = '42501';
  end if;

  if not public.can_manage_class (v_assignment.class_id) then raise exception 'class admin required' using errcode = '42501';
  end if;

  if v_assignment.status not in ('draft', 'pending_review') then raise exception 'assignment is not awaiting publication' using errcode = '22023';
  end if;

  select
    c.name into v_class_name
  from
    public.classes c
  where
    c.id = v_assignment.class_id;

  update public.assignments
  set
    status = 'published',
    reviewed_by = v_actor,
    reviewed_at = now(),
    rejection_reason = null,
    published_at = now()
  where
    id = p_assignment_id;

  insert into public.assignment_reviews (assignment_id, reviewer_id, decision)
values (p_assignment_id, v_actor, 'approved');

  perform public.record_audit(
    'assignment_published_by_class_admin',
    'assignment',
    p_assignment_id,
    v_assignment.class_id,
    jsonb_build_object('revision', v_assignment.revision)
  );

  -- Every member except the author, once per revision. The payload carries no
  -- assignment content, only the class name and a link.
  perform public.enqueue_notification_event(
    cm.user_id,
    'class_assignment_published',
    'class_assignment:' || p_assignment_id || ':' || v_assignment.revision || ':' || cm.user_id,
    jsonb_build_object(
      'title',
      'New assignment in ' || coalesce(v_class_name, 'your class'),
      'body',
      'Your class admin posted an assignment. Open StarsTask to read it.',
      'url',
      '/assignments/' || p_assignment_id
    )
  )
  from
    public.class_members cm
  where
    cm.class_id = v_assignment.class_id
    and cm.user_id <> v_actor;

  return true;
end;
$$;


COMMENT ON FUNCTION public.publish_class_assignment (uuid) IS 'Publishes the caller''s own class assignment and notifies the class. Class manager only.';


-- ---------------------------------------------------------------------------
-- delete_class
-- ---------------------------------------------------------------------------
-- A class admin may delete the class they run; a platform admin may delete any.
-- Published assignments are archived first: their class_id is nulled by the
-- foreign key, so leaving them published would keep class content public with
-- no owning class.
CREATE OR REPLACE FUNCTION public.delete_class (p_class_id uuid) returns boolean language plpgsql security definer
SET
  search_path = public,
  pg_temp AS $$
declare
  v_actor uuid := (
    select
      auth.uid ()
  );
  v_class public.classes;
  v_archived integer := 0;
begin
  if v_actor is null then raise exception 'authentication required' using errcode = '42501';
  end if;

  select
    * into v_class
  from
    public.classes
  where
    id = p_class_id for
  update;

  if not found then raise exception 'class not found' using errcode = 'P0002';
  end if;

  if not public.can_manage_class (p_class_id) then raise exception 'class admin required' using errcode = '42501';
  end if;

  update public.assignments
  set
    status = 'archived'
  where
    class_id = p_class_id
    and status = 'published';

  get diagnostics v_archived = row_count;

  -- audit_logs.class_id is nulled by the foreign key on delete, so the slug and
  -- name are copied into the metadata to keep the entry meaningful.
  perform public.record_audit(
    'class_deleted',
    'class',
    p_class_id,
    null,
    jsonb_build_object(
      'slug',
      v_class.slug,
      'name',
      v_class.name,
      'archived_assignments',
      v_archived
    )
  );

  delete from public.classes
  where
    id = p_class_id;

  return true;
end;
$$;


COMMENT ON FUNCTION public.delete_class (uuid) IS 'Deletes a class and cascades its membership, sessions, leave, schedule and verification rows. Class manager or platform admin only.';


-- ---------------------------------------------------------------------------
-- Function privileges
-- ---------------------------------------------------------------------------
REVOKE ALL ON function public.submit_class_assignment (uuid, text, text, timestamptz, text, TEXT[], jsonb)
FROM
  public,
  anon,
  authenticated;


GRANT
EXECUTE ON function public.submit_class_assignment (uuid, text, text, timestamptz, text, TEXT[], jsonb) TO authenticated;


REVOKE ALL ON function public.publish_class_assignment (uuid)
FROM
  public,
  anon,
  authenticated;


GRANT
EXECUTE ON function public.publish_class_assignment (uuid) TO authenticated;


REVOKE ALL ON function public.delete_class (uuid)
FROM
  public,
  anon,
  authenticated;


GRANT
EXECUTE ON function public.delete_class (uuid) TO authenticated;

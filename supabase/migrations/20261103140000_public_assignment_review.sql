-- Public (class-less) assignment submissions are requests until approved.
--
-- A member's "Submit assignment" now inserts the row as `pending`. Only a
-- platform admin can move it to `published` or `rejected`, and the decision is
-- recorded in `assignment_reviews` with the same audit and notification trail
-- as the class review flow. The reviewer needs read access to pending rows and
-- their attachments, so both policies are widened for platform admins only.
DROP POLICY if EXISTS assignments_platform_review_read ON public.assignments;


CREATE POLICY assignments_platform_review_read ON public.assignments FOR
SELECT
  TO authenticated USING (
    class_id IS NULL
    AND public.is_platform_admin ()
  );


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
        AND (
          public.is_platform_admin ()
          OR (
            a.class_id IS NOT NULL
            AND public.is_class_admin (a.class_id)
          )
        )
    )
  );


CREATE OR REPLACE FUNCTION public.review_public_assignment (
  p_assignment_id uuid,
  p_decision text,
  p_reason text DEFAULT NULL
) returns text language plpgsql security definer
SET
  search_path = public,
  pg_temp AS $$
DECLARE
  v_actor uuid := (
    SELECT
      auth.uid ()
  );
  v_assignment public.assignments;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_status text;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING errcode = '42501';
  END IF;

  IF NOT public.is_platform_admin () THEN
    RAISE EXCEPTION 'platform admin required' USING errcode = '42501';
  END IF;

  IF p_decision NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'invalid review decision' USING errcode = '22023';
  END IF;

  SELECT
    * INTO v_assignment
  FROM
    public.assignments
  WHERE
    id = p_assignment_id FOR
  UPDATE;

  IF NOT found THEN
    RAISE EXCEPTION 'assignment not found' USING errcode = 'P0002';
  END IF;

  IF v_assignment.class_id IS NOT NULL THEN
    RAISE EXCEPTION 'class assignments use the class review queue' USING errcode = '22023';
  END IF;

  IF v_assignment.status <> 'pending' THEN
    RAISE EXCEPTION 'only pending assignments can be reviewed' USING errcode = '22023';
  END IF;

  IF p_decision = 'rejected'
  AND (v_reason IS NULL OR char_length(v_reason) < 3) THEN
    RAISE EXCEPTION 'rejection reason required' USING errcode = '22023';
  END IF;

  v_status := CASE
    WHEN p_decision = 'approved' THEN 'published'
    ELSE 'rejected'
  END;

  UPDATE public.assignments
  SET
    status = v_status,
    reviewed_by = v_actor,
    reviewed_at = now(),
    rejection_reason = CASE
      WHEN v_status = 'rejected' THEN v_reason
      ELSE NULL
    END,
    published_at = CASE
      WHEN v_status = 'published' THEN coalesce(published_at, now())
      ELSE published_at
    END
  WHERE
    id = p_assignment_id;

  INSERT INTO public.assignment_reviews (assignment_id, reviewer_id, decision, reason)
  VALUES (p_assignment_id, v_actor, p_decision, v_reason);

  PERFORM public.record_audit (
    'assignment_' || p_decision,
    'assignment',
    p_assignment_id,
    NULL,
    '{}'::jsonb
  );

  PERFORM public.enqueue_notification_event (
    v_assignment.user_id,
    CASE
      WHEN p_decision = 'approved' THEN 'assignment_approved'
      ELSE 'assignment_rejected'
    END,
    'assignment_public_review:' || p_assignment_id || ':' || v_status || ':' || extract(epoch FROM now()),
    jsonb_build_object(
      'title',
      CASE
        WHEN p_decision = 'approved' THEN 'Assignment approved'
        ELSE 'Assignment needs changes'
      END,
      'body',
      CASE
        WHEN p_decision = 'approved' THEN 'Your assignment was approved and is now public.'
        ELSE 'Your assignment was not approved. Open it to read the note and update it.'
      END,
      'url', '/assignments/' || p_assignment_id
    )
  );

  RETURN v_status;
END;

$$;


COMMENT ON FUNCTION public.review_public_assignment (uuid, text, text) IS 'Approves or rejects a class-less assignment request. Platform admins only.';


REVOKE ALL ON FUNCTION public.review_public_assignment (uuid, text, text)
FROM
  public;


GRANT
EXECUTE ON FUNCTION public.review_public_assignment (uuid, text, text) TO authenticated;


-- Ping platform admins when a new request arrives or a rejected one is
-- resubmitted. The trigger never blocks the write: the helper only enqueues
-- events for admins whose push subscription is active.
CREATE OR REPLACE FUNCTION public.notify_platform_admins_public_assignment () returns trigger language plpgsql security definer
SET
  search_path = public,
  pg_temp AS $$
DECLARE
  v_admin uuid;
BEGIN
  IF NEW.class_id IS NOT NULL OR NEW.status <> 'pending' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status = 'pending' THEN
    RETURN NEW;
  END IF;

  FOR v_admin IN
  SELECT
    pa.user_id
  FROM
    public.platform_admins pa
  WHERE
    pa.user_id <> NEW.user_id LOOP
    PERFORM public.enqueue_notification_event (
      v_admin,
      'submission_received',
      'assignment_public_submitted:' || NEW.id || ':' || v_admin || ':' || extract(epoch FROM now()),
      jsonb_build_object(
        'title', 'New assignment request',
        'body', 'A member submitted an assignment for review.',
        'url', '/admin/assignments/' || NEW.id
      )
    );
  END LOOP;

  RETURN NEW;
END;

$$;


DROP TRIGGER if EXISTS assignments_public_review_notify ON public.assignments;


CREATE TRIGGER assignments_public_review_notify
AFTER INSERT OR UPDATE OF status ON public.assignments FOR EACH ROW
EXECUTE FUNCTION public.notify_platform_admins_public_assignment ();

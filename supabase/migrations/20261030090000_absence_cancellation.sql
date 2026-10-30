-- Absence requests: Submitted, Forwarded, Cancelled.
--
-- Owner decision (2026-10-30): there is no approval step inside StarsTask. The
-- class admin checks a request and forwards it to the lecturer; whether the
-- absence is granted is decided outside this system. The retired
-- `needs_revision` state belonged to the old review loop, so it is folded back
-- into `submitted` before the status constraint is narrowed.
--
-- Transition graph after this migration:
--
--   draft ──submit──> submitted ──forward──> forwarded
--     │                   │
--     └──cancel──> cancelled <──cancel──┘
--
-- `cancelled` is reachable from `draft` and `submitted` only. `forwarded` is
-- terminal: once a request is in a package, StarsTask no longer changes it.

-- ---------------------------------------------------------------------------
-- 1. Fold the retired revision state into submitted
-- ---------------------------------------------------------------------------
-- The reviewer note stays in leave_request_history; only the live status moves.
UPDATE public.leave_requests
SET
  status = 'submitted'
WHERE
  status = 'needs_revision';


-- ---------------------------------------------------------------------------
-- 2. Cancellation columns
-- ---------------------------------------------------------------------------
ALTER TABLE public.leave_requests
ADD COLUMN if NOT EXISTS cancelled_at timestamptz,
ADD COLUMN if NOT EXISTS cancelled_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
ADD COLUMN if NOT EXISTS cancellation_note text;


-- ---------------------------------------------------------------------------
-- 3. Status and completeness rules
-- ---------------------------------------------------------------------------
ALTER TABLE public.leave_requests
DROP CONSTRAINT if EXISTS leave_requests_status_allowed;


ALTER TABLE public.leave_requests
DROP CONSTRAINT if EXISTS leave_requests_complete;


ALTER TABLE public.leave_requests
DROP CONSTRAINT if EXISTS leave_requests_note_length;


ALTER TABLE public.leave_requests
DROP CONSTRAINT if EXISTS leave_requests_revision_count_range;


ALTER TABLE public.leave_requests
ADD CONSTRAINT leave_requests_status_allowed CHECK (
  status IN ('draft', 'submitted', 'forwarded', 'cancelled')
);


-- A cancelled draft was never completed, so the completeness rule only applies
-- to a request that is still in the pipeline. `forwarded_at` and `cancelled_at`
-- stay mutually exclusive with the status that owns them.
ALTER TABLE public.leave_requests
ADD CONSTRAINT leave_requests_complete CHECK (
  status IN ('draft', 'cancelled')
  OR (
    leave_start_date IS NOT NULL
    AND leave_end_date IS NOT NULL
    AND reason_category IS NOT NULL
    AND explanation IS NOT NULL
    AND submitted_at IS NOT NULL
  )
);


ALTER TABLE public.leave_requests
ADD CONSTRAINT leave_requests_cancel_consistency CHECK (
  (status = 'cancelled') = (cancelled_at IS NOT NULL)
);


ALTER TABLE public.leave_requests
ADD CONSTRAINT leave_requests_cancel_not_forwarded CHECK (
  cancelled_at IS NULL
  OR forwarded_at IS NULL
);


ALTER TABLE public.leave_requests
ADD CONSTRAINT leave_requests_cancellation_note_length CHECK (
  cancellation_note IS NULL
  OR char_length(btrim(cancellation_note)) BETWEEN 1 AND 2000
);


-- ---------------------------------------------------------------------------
-- 4. Retired revision bookkeeping
-- ---------------------------------------------------------------------------
ALTER TABLE public.leave_requests
DROP COLUMN if EXISTS revision_count,
DROP COLUMN if EXISTS last_review_note;


-- ---------------------------------------------------------------------------
-- 5. Indexes
-- ---------------------------------------------------------------------------
DROP INDEX if EXISTS public.leave_requests_review_queue_idx;


-- The forward page only lists submitted requests, so cancelled and forwarded
-- rows never need to appear in it.
CREATE INDEX if NOT EXISTS leave_requests_forwardable_idx ON public.leave_requests (class_id, submitted_at DESC)
WHERE
  status = 'submitted';


-- ---------------------------------------------------------------------------
-- 6. History actions
-- ---------------------------------------------------------------------------
ALTER TABLE public.leave_request_history
DROP CONSTRAINT if EXISTS leave_request_history_action_allowed;


-- The two revision actions are kept so rows written before this migration still
-- render readably; nothing writes them any more.
ALTER TABLE public.leave_request_history
ADD CONSTRAINT leave_request_history_action_allowed CHECK (
  action IN (
    'created',
    'updated',
    'submitted',
    'revision_requested',
    'resubmitted',
    'forwarded',
    'cancelled',
    'evidence_added',
    'evidence_removed',
    'ocr_recorded'
  )
);


-- ---------------------------------------------------------------------------
-- 7. Notification kinds
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
    'leave_request_cancelled',
    'verification_submitted',
    'verification_approved',
    'verification_rejected',
    'verification_revision_requested',
    'class_admin_revoked',
    'class_assignment_published'
  )
);


-- ---------------------------------------------------------------------------
-- 8. Student edits happen on a draft only
-- ---------------------------------------------------------------------------
CREATE OR REPLACE function public.update_leave_request (
  p_request_id uuid,
  p_leave_start_date date,
  p_leave_end_date date,
  p_reason_category text,
  p_explanation text,
  p_document_issue_date date
) returns void language plpgsql security definer
SET
  search_path = public,
  pg_temp AS $$
declare
  v_user_id uuid := auth.uid ();
  v_request public.leave_requests;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select
    * into v_request
  from
    public.leave_requests r
  where
    r.id = p_request_id
  for
    update;

  if not found then
    raise exception 'absence request not found' using errcode = 'P0002';
  end if;

  if v_request.student_id <> v_user_id then
    raise exception 'only the owner may edit this request' using errcode = '42501';
  end if;

  -- A submitted request is already with the class admin. The only way out is a
  -- cancellation; there is no correction loop.
  if v_request.status <> 'draft' then
    raise exception 'this request can no longer be edited' using errcode = 'SS011';
  end if;

  update public.leave_requests r
  set
    leave_start_date = p_leave_start_date,
    leave_end_date = p_leave_end_date,
    reason_category = p_reason_category,
    explanation = p_explanation,
    document_issue_date = p_document_issue_date
  where
    r.id = p_request_id;

  insert into public.leave_request_history (request_id, actor_id, action)
values (p_request_id, v_user_id, 'updated');
end;
$$;


CREATE OR REPLACE function public.record_leave_request_ocr (
  p_request_id uuid,
  p_provider text,
  p_status text,
  p_result jsonb
) returns void language plpgsql security definer
SET
  search_path = public,
  pg_temp AS $$
declare
  v_user_id uuid := auth.uid ();
  v_request public.leave_requests;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select
    * into v_request
  from
    public.leave_requests r
  where
    r.id = p_request_id
  for
    update;

  if not found then
    raise exception 'absence request not found' using errcode = 'P0002';
  end if;

  if v_request.student_id <> v_user_id then
    raise exception 'only the owner may attach OCR results' using errcode = '42501';
  end if;

  if v_request.status <> 'draft' then
    raise exception 'this request can no longer be edited' using errcode = 'SS011';
  end if;

  update public.leave_requests r
  set
    ocr_status = p_status,
    ocr_provider = p_provider,
    ocr_result = p_result,
    ocr_extracted_at = now(),
    -- A new extraction invalidates the previous confirmation.
    ocr_confirmed_at = null
  where
    r.id = p_request_id;

  -- Only the provider name and outcome are recorded; raw text stays out of the
  -- audit trail.
  insert into public.leave_request_history (request_id, actor_id, action, metadata)
values (
    p_request_id,
    v_user_id,
    'ocr_recorded',
    jsonb_build_object('provider', p_provider, 'status', p_status)
  );
end;
$$;


CREATE OR REPLACE function public.confirm_leave_request_ocr (
  p_request_id uuid,
  p_field_sources jsonb
) returns void language plpgsql security definer
SET
  search_path = public,
  pg_temp AS $$
declare
  v_user_id uuid := auth.uid ();
  v_request public.leave_requests;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if p_field_sources is null or jsonb_typeof (p_field_sources) <> 'object' then
    raise exception 'field sources must be an object' using errcode = '22023';
  end if;

  select
    * into v_request
  from
    public.leave_requests r
  where
    r.id = p_request_id
  for
    update;

  if not found then
    raise exception 'absence request not found' using errcode = 'P0002';
  end if;

  if v_request.student_id <> v_user_id then
    raise exception 'only the owner may confirm extracted values' using errcode = '42501';
  end if;

  if v_request.status <> 'draft' then
    raise exception 'this request can no longer be edited' using errcode = 'SS011';
  end if;

  update public.leave_requests r
  set
    field_sources = p_field_sources,
    ocr_confirmed_at = now()
  where
    r.id = p_request_id;

  insert into public.leave_request_history (request_id, actor_id, action, metadata)
values (
    p_request_id,
    v_user_id,
    'updated',
    jsonb_build_object('ocr_confirmed', true)
  );
end;
$$;


CREATE OR REPLACE function public.add_leave_request_evidence (
  p_request_id uuid,
  p_storage_path text,
  p_original_filename text,
  p_mime_type text,
  p_file_size integer
) returns uuid language plpgsql security definer
SET
  search_path = public,
  pg_temp AS $$
declare
  v_user_id uuid := auth.uid ();
  v_request public.leave_requests;
  v_evidence_id uuid;
  v_active_count integer;
  v_next_order integer;
  v_prefix text;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select
    * into v_request
  from
    public.leave_requests r
  where
    r.id = p_request_id
  for
    update;

  if not found then
    raise exception 'absence request not found' using errcode = 'P0002';
  end if;

  if v_request.student_id <> v_user_id then
    raise exception 'only the owner may attach evidence' using errcode = '42501';
  end if;

  if v_request.status <> 'draft' then
    raise exception 'this request can no longer be edited' using errcode = 'SS011';
  end if;

  -- The key must sit inside this student's folder for this request, so a
  -- crafted path cannot point at somebody else's object. The null check comes
  -- first: `null <> prefix` evaluates to null, which would let a null path
  -- through to a confusing NOT NULL violation instead of a clear error.
  if p_storage_path is null then
    raise exception 'invalid storage path' using errcode = '22023';
  end if;

  v_prefix := v_user_id::text || '/' || p_request_id::text || '/';

  if left(p_storage_path, char_length(v_prefix)) <> v_prefix then
    raise exception 'invalid storage path' using errcode = '22023';
  end if;

  select
    count(*) into v_active_count
  from
    public.leave_request_evidence e
  where
    e.request_id = p_request_id
    and e.removed_at is null;

  if v_active_count >= 10 then
    raise exception 'at most 10 evidence files per request' using errcode = '23514';
  end if;

  select
    coalesce(max(e.sort_order), -1) + 1 into v_next_order
  from
    public.leave_request_evidence e
  where
    e.request_id = p_request_id;

  insert into public.leave_request_evidence (
    request_id,
    storage_path,
    original_filename,
    mime_type,
    file_size,
    sort_order,
    uploaded_by
  )
values (
    p_request_id,
    p_storage_path,
    p_original_filename,
    p_mime_type,
    p_file_size,
    v_next_order,
    v_user_id
  )
returning
  leave_request_evidence.id into v_evidence_id;

  -- The filename is intentionally not copied into the audit trail: it often
  -- names a clinic or a diagnosis.
  insert into public.leave_request_history (request_id, actor_id, action, metadata)
values (
    p_request_id,
    v_user_id,
    'evidence_added',
    jsonb_build_object('evidence_id', v_evidence_id)
  );

  return v_evidence_id;
end;
$$;


CREATE OR REPLACE function public.remove_leave_request_evidence (p_evidence_id uuid) returns text language plpgsql security definer
SET
  search_path = public,
  pg_temp AS $$
declare
  v_user_id uuid := auth.uid ();
  v_evidence public.leave_request_evidence;
  v_request public.leave_requests;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select
    * into v_evidence
  from
    public.leave_request_evidence e
  where
    e.id = p_evidence_id
  for
    update;

  if not found or v_evidence.removed_at is not null then
    raise exception 'evidence not found' using errcode = 'P0002';
  end if;

  select
    * into v_request
  from
    public.leave_requests r
  where
    r.id = v_evidence.request_id
  for
    update;

  if v_request.student_id <> v_user_id then
    raise exception 'only the owner may remove evidence' using errcode = '42501';
  end if;

  if v_request.status <> 'draft' then
    raise exception 'this request can no longer be edited' using errcode = 'SS011';
  end if;

  update public.leave_request_evidence e
  set
    removed_at = now(),
    removed_by = v_user_id
  where
    e.id = p_evidence_id;

  insert into public.leave_request_history (request_id, actor_id, action, metadata)
values (
    v_request.id,
    v_user_id,
    'evidence_removed',
    jsonb_build_object('evidence_id', p_evidence_id)
  );

  return v_evidence.storage_path;
end;
$$;


-- ---------------------------------------------------------------------------
-- 9. Submit is a one-way step out of draft
-- ---------------------------------------------------------------------------
CREATE OR REPLACE function public.submit_leave_request (p_request_id uuid) returns void language plpgsql security definer
SET
  search_path = public,
  pg_temp AS $$
declare
  v_user_id uuid := auth.uid ();
  v_request public.leave_requests;
  v_evidence_count integer;
  v_display_name text;
  v_class_slug text;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select
    * into v_request
  from
    public.leave_requests r
  where
    r.id = p_request_id
  for
    update;

  if not found then
    raise exception 'absence request not found' using errcode = 'P0002';
  end if;

  if v_request.student_id <> v_user_id then
    raise exception 'only the owner may submit this request' using errcode = '42501';
  end if;

  if v_request.status <> 'draft' then
    raise exception 'this request has already been submitted' using errcode = 'SS012';
  end if;

  -- Completeness is re-checked here rather than trusted from the client. The
  -- table constraint enforces the same rule, this just produces a clearer error.
  if v_request.leave_start_date is null
  or v_request.leave_end_date is null
  or v_request.reason_category is null
  or v_request.explanation is null
  or char_length(btrim(v_request.explanation)) < 10 then
    raise exception 'the request is incomplete' using errcode = 'SS014';
  end if;

  select
    count(*) into v_evidence_count
  from
    public.leave_request_evidence e
  where
    e.request_id = p_request_id
    and e.removed_at is null;

  if v_evidence_count = 0 then
    raise exception 'at least one evidence file is required' using errcode = 'SS014';
  end if;

  update public.leave_requests r
  set
    status = 'submitted',
    submitted_at = now()
  where
    r.id = p_request_id;

  insert into public.leave_request_history (request_id, actor_id, action)
values (p_request_id, v_user_id, 'submitted');

  perform public.record_audit(
    'leave_request_submitted',
    'leave_request',
    p_request_id,
    v_request.class_id,
    '{}'::jsonb
  );

  -- Scalar subqueries keep this null-safe: a student without a profile row still
  -- produces a usable notification instead of a null body.
  v_display_name := coalesce(
    (
      select
        p.display_name
      from
        public.profiles p
      where
        p.id = v_user_id
    ),
    'A student'
  );
  v_class_slug := (
    select
      c.slug
    from
      public.classes c
    where
      c.id = v_request.class_id
  );

  perform public.notify_class_leave_reviewers(
    v_request.class_id,
    'leave_request_submitted',
    'New absence request',
    v_display_name || ' submitted an absence request.',
    '/dashboard/classes/' || v_class_slug || '/leave-requests',
    p_request_id::text || ':' || to_char(now(), 'YYYYMMDDHH24MISS')
  );
end;
$$;


-- ---------------------------------------------------------------------------
-- 10. Cancel: the only exit before forwarding
-- ---------------------------------------------------------------------------
/**
 * Cancels an absence request that has not been forwarded.
 *
 * A student may cancel their own draft or submitted request. A class admin may
 * cancel a submitted request in a class they manage, but not a draft: drafts are
 * invisible to them and still belong entirely to the student.
 *
 * The reason is optional and is kept for the audit trail only. It is never put
 * into a push payload, because it can describe medical circumstances.
 */
CREATE OR REPLACE FUNCTION public.cancel_leave_request (
  p_request_id uuid,
  p_note text DEFAULT NULL
) returns void language plpgsql security definer
SET
  search_path = public,
  pg_temp AS $$
declare
  v_user_id uuid := auth.uid ();
  v_request public.leave_requests;
  v_is_owner boolean;
  v_is_admin boolean;
  v_note text;
  v_display_name text;
  v_class_slug text;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select
    * into v_request
  from
    public.leave_requests r
  where
    r.id = p_request_id
  for
    update;

  if not found then
    raise exception 'absence request not found' using errcode = 'P0002';
  end if;

  v_is_owner := v_request.student_id = v_user_id;
  v_is_admin := public.can_manage_class (v_request.class_id);

  if not (v_is_owner or v_is_admin) then
    raise exception 'not allowed to cancel this request' using errcode = '42501';
  end if;

  if v_is_owner then
    if v_request.status not in ('draft', 'submitted') then
      raise exception 'this request can no longer be cancelled' using errcode = 'SS012';
    end if;
  elsif v_request.status <> 'submitted' then
    -- A forwarded request belongs to the lecturer's process; a draft is not the
    -- admin's to cancel.
    raise exception 'this request can no longer be cancelled' using errcode = 'SS012';
  end if;

  if p_note is not null and char_length(btrim(p_note)) > 2000 then
    raise exception 'the cancellation note is too long' using errcode = '22023';
  end if;

  v_note := nullif(btrim(coalesce(p_note, '')), '');

  update public.leave_requests r
  set
    status = 'cancelled',
    cancelled_at = now(),
    cancelled_by = v_user_id,
    cancellation_note = v_note
  where
    r.id = p_request_id;

  insert into public.leave_request_history (request_id, actor_id, action, note)
values (p_request_id, v_user_id, 'cancelled', v_note);

  perform public.record_audit(
    'leave_request_cancelled',
    'leave_request',
    p_request_id,
    v_request.class_id,
    jsonb_build_object(
      'actor_role',
      case when v_is_owner then 'student' else 'class_admin' end
    )
  );

  v_class_slug := (
    select
      c.slug
    from
      public.classes c
    where
      c.id = v_request.class_id
  );

  if v_is_owner then
    -- The student cancelled, so the class admins hear about it. The helper
    -- skips the actor, which also covers an admin cancelling their own request.
    v_display_name := coalesce(
      (
        select
          p.display_name
        from
          public.profiles p
        where
          p.id = v_request.student_id
      ),
      'A student'
    );

    perform public.notify_class_leave_reviewers(
      v_request.class_id,
      'leave_request_cancelled',
      'Absence request cancelled',
      v_display_name || ' cancelled an absence request.',
      '/dashboard/classes/' || v_class_slug || '/leave-requests',
      p_request_id::text || ':' || to_char(now(), 'YYYYMMDDHH24MISS')
    );
  else
    -- A class admin cancelled a student's request, so the student is told. The
    -- note itself stays out of the push payload.
    v_display_name := coalesce(
      (
        select
          p.display_name
        from
          public.profiles p
        where
          p.id = v_user_id
      ),
      'Your class admin'
    );

    perform public.enqueue_notification_event(
      v_request.student_id,
      'leave_request_cancelled',
      'leave_request_cancelled:' || p_request_id || ':' || v_request.student_id || ':' || to_char(now(), 'YYYYMMDDHH24MISS'),
      jsonb_build_object(
        'title',
        'Absence request cancelled',
        'body',
        v_display_name || ' cancelled your absence request. Open StarsTask for details.',
        'url',
        '/leave-requests/' || p_request_id::text
      )
    );
  end if;
end;
$$;


-- The revision loop is gone, not disabled.
DROP FUNCTION if EXISTS public.request_leave_revision (uuid, text);


-- ---------------------------------------------------------------------------
-- 11. Grants
-- ---------------------------------------------------------------------------
-- Dropping revision_count and last_review_note removed them from the existing
-- column-level grant; the new columns need their own.
GRANT
SELECT
  (
    cancelled_at,
    cancelled_by,
    cancellation_note
  ) ON public.leave_requests TO authenticated;


REVOKE ALL ON function public.cancel_leave_request (uuid, text)
FROM
  public,
  anon;


GRANT
execute ON function public.cancel_leave_request (uuid, text) TO authenticated;

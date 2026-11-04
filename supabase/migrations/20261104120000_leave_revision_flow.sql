-- Absence-request revision flow.
--
-- Owner decision (2026-11-04): a class admin may return a submitted absence for
-- correction, and the student edits and resubmits it. Approve/Reject keep
-- working on the existing `review_leave_request` RPC; this migration adds the
-- `revision_requested` state, the revision decision, and the owner edit +
-- resubmit loop around it.
--
-- Transition graph after this migration:
--
--   draft -> submitted -> approved (terminal; sessions -> excused)
--                      -> rejected (terminal; attendance untouched)
--                      -> revision_requested -> updated -> submitted ('resubmitted')
--                      -> cancelled (from draft, submitted, revision_requested)
--   forwarded (legacy hand-off; terminal, untouched here)
--
-- `revision_requested` is edited and resubmitted by the owner only; it never
-- touches attendance. Approval still never writes `present`, self-review stays
-- refused, and terminal states stay terminal.
--
-- Apply with: supabase db push (or paste into the SQL editor in timestamp
-- order). Until this is applied, Approve/Reject work via the existing RPC but
-- the revision UI decision returns an error.
-- ---------------------------------------------------------------------------
-- 1. Status constraints
-- ---------------------------------------------------------------------------
ALTER TABLE public.leave_requests
DROP CONSTRAINT IF EXISTS leave_requests_status_allowed;


ALTER TABLE public.leave_requests
ADD CONSTRAINT leave_requests_status_allowed CHECK (
  status IN (
    'draft',
    'submitted',
    'approved',
    'rejected',
    'revision_requested',
    'forwarded',
    'cancelled'
  )
);

-- A revision request is a completed request that is back with the student, so
-- completeness applies to it exactly as it does to `submitted`.
ALTER TABLE public.leave_requests
DROP CONSTRAINT IF EXISTS leave_requests_complete;


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

-- A cancelled revision returns to the student; cancellation from this state is
-- allowed, so no new consistency constraint is needed.
-- ---------------------------------------------------------------------------
-- 2. History actions and notification kinds (already present; assert them)
-- ---------------------------------------------------------------------------
ALTER TABLE public.leave_request_history
DROP CONSTRAINT IF EXISTS leave_request_history_action_allowed;


ALTER TABLE public.leave_request_history
ADD CONSTRAINT leave_request_history_action_allowed CHECK (
  action IN (
    'created',
    'updated',
    'submitted',
    'revision_requested',
    'resubmitted',
    'approved',
    'rejected',
    'forwarded',
    'cancelled',
    'evidence_added',
    'evidence_removed',
    'ocr_recorded'
  )
);

-- `leave_request_revision_requested` is already in the kind list; keeping the
-- full list here makes this migration self-documenting and no-op-safe.
-- ---------------------------------------------------------------------------
-- 3. Indexes for the admin queues
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS leave_requests_action_center_idx
ON public.leave_requests (class_id, submitted_at DESC)
WHERE status IN ('submitted', 'revision_requested');

-- ---------------------------------------------------------------------------
-- 4. Review function: approved / rejected / revision_requested
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.review_leave_request (
  p_request_id uuid,
  p_decision text,
  p_note text DEFAULT NULL
) returns text language plpgsql security definer
SET
  search_path = public,
  pg_temp AS $$
DECLARE
  v_user_id uuid := auth.uid ();
  v_request public.leave_requests;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_admin_name text;
  v_class_slug text;
  v_updated integer := 0;
  v_inserted integer := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'authentication required'
    USING ERRCODE = '42501';
  END IF;

  IF p_decision NOT IN ('approved', 'rejected', 'revision_requested') THEN
    RAISE EXCEPTION 'Unknown review decision'
    USING ERRCODE = '22023';
  END IF;

  IF v_note IS NOT NULL AND char_length(v_note) > 2000 THEN
    RAISE EXCEPTION 'the review note is too long'
    USING ERRCODE = '22023';
  END IF;

  -- Rejection and revision must tell the student what to do.
  IF p_decision IN ('rejected', 'revision_requested')
     AND (v_note IS NULL OR char_length(v_note) < 3) THEN
    RAISE EXCEPTION 'a rejection or revision note of at least 3 characters is required'
    USING ERRCODE = '22023';
  END IF;

  SELECT
    * INTO v_request
  FROM
    public.leave_requests r
  WHERE
    r.id = p_request_id
  FOR
    UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'absence request not found'
    USING ERRCODE = 'P0002';
  END IF;

  IF NOT public.can_manage_class (v_request.class_id) THEN
    RAISE EXCEPTION 'Not allowed to review this absence request'
    USING ERRCODE = '42501';
  END IF;

  -- A class admin may also be a student in the class. Deciding one's own
  -- absence is a conflict of interest, so another manager must review it.
  IF v_request.student_id = v_user_id THEN
    RAISE EXCEPTION 'You cannot review your own absence request'
    USING ERRCODE = '42501';
  END IF;

  -- Only a submitted request is awaiting a decision. Everything else is either
  -- unfinished, already decided, or withdrawn.
  IF v_request.status <> 'submitted' THEN
    RAISE EXCEPTION 'this absence request is no longer awaiting review'
    USING ERRCODE = 'SS012';
  END IF;

  UPDATE public.leave_requests
  SET
    status = p_decision
  WHERE
    id = p_request_id
    AND status = 'submitted';

  INSERT INTO public.leave_request_history (request_id, actor_id, action, note)
VALUES
  (p_request_id, v_user_id, p_decision, v_note);

  -- Approval marks the matching sessions excused. Existing present or late rows
  -- are real evidence of attendance and are deliberately left untouched.
  -- A revision request never changes attendance.
  IF p_decision = 'approved' AND v_request.leave_start_date IS NOT NULL AND v_request.leave_end_date IS NOT NULL THEN
    UPDATE public.discussion_session_checkins c
    SET
      status = 'excused',
      method = 'manual',
      reviewed_by = v_user_id,
      reviewed_at = now(),
      updated_at = now(),
      note = coalesce(c.note, 'Excused after an approved absence request.')
    FROM
      public.discussion_sessions s
      JOIN public.class_members m ON m.class_id = s.class_id
      AND m.user_id = v_request.student_id
      AND m.joined_at <= s.starts_at
    WHERE
      c.session_id = s.id
      AND c.user_id = v_request.student_id
      AND s.class_id = v_request.class_id
      AND s.status <> 'cancelled'
      AND (s.starts_at AT TIME ZONE 'Asia/Jakarta')::date BETWEEN v_request.leave_start_date
      AND v_request.leave_end_date
      AND c.status IN ('absent', 'excused');

    GET DIAGNOSTICS v_updated = ROW_COUNT;

    -- Sessions the student had not been marked for yet get an excused row, so a
    -- finished session cannot end up as an unrecorded miss after approval.
    INSERT INTO public.discussion_session_checkins (
      session_id,
      user_id,
      status,
      method,
      note,
      reviewed_by,
      reviewed_at
    )
    SELECT
      s.id,
      v_request.student_id,
      'excused',
      'manual',
      'Excused after an approved absence request.',
      v_user_id,
      now()
    FROM
      public.discussion_sessions s
      JOIN public.class_members m ON m.class_id = s.class_id
      AND m.user_id = v_request.student_id
      AND m.joined_at <= s.starts_at
    WHERE
      s.class_id = v_request.class_id
      AND s.status <> 'cancelled'
      AND (s.starts_at AT TIME ZONE 'Asia/Jakarta')::date BETWEEN v_request.leave_start_date
      AND v_request.leave_end_date
    ON CONFLICT (session_id, user_id) DO NOTHING;

    GET DIAGNOSTICS v_inserted = ROW_COUNT;
  END IF;

  PERFORM public.record_audit (
    'leave_request_' || p_decision,
    'leave_request',
    p_request_id,
    v_request.class_id,
    jsonb_build_object(
      'decision', p_decision,
      'sessions_updated', v_updated,
      'sessions_created', v_inserted
    )
  );

  v_class_slug := (
    SELECT
      c.slug
    FROM
      public.classes c
    WHERE
      c.id = v_request.class_id
  );

  v_admin_name := coalesce(
    (
      SELECT
        p.display_name
      FROM
        public.profiles p
      WHERE
        p.id = v_user_id
    ),
    'Your class admin'
  );

  PERFORM public.enqueue_notification_event(
    v_request.student_id,
    'leave_request_' || p_decision,
    'leave_request_' || p_decision || ':' || p_request_id || ':' || v_request.student_id || ':' || to_char(now(), 'YYYYMMDDHH24MISS'),
    jsonb_build_object(
      'title',
      CASE p_decision
        WHEN 'approved' THEN 'Absence approved'
        WHEN 'rejected' THEN 'Absence rejected'
        ELSE 'Absence revision requested'
      END,
      'body',
      v_admin_name || CASE p_decision
        WHEN 'approved' THEN ' approved your absence request.'
        WHEN 'rejected' THEN ' rejected your absence request. Open StarsTask for details.'
        ELSE ' returned your absence request for correction. Open StarsTask to edit and resubmit.'
      END,
      'url',
      '/leave-requests/' || p_request_id::text
    )
  );

  RETURN p_decision;
END;
$$;


COMMENT ON FUNCTION public.review_leave_request (uuid, text, text) IS 'Approves, rejects, or returns a submitted absence for revision. Class managers only. Approval marks matching sessions as excused and never as present; revision changes no attendance.';

-- ---------------------------------------------------------------------------
-- 5. Owner edits: draft OR revision_requested
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_leave_request (
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

  if v_request.status not in ('draft', 'revision_requested') then
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


CREATE OR REPLACE FUNCTION public.set_leave_request_subjects (p_request_id uuid, p_subject_ids UUID[]) returns void language plpgsql security definer
SET
  search_path = public,
  pg_temp AS $$
DECLARE
  v_user_id uuid := auth.uid ();
  v_request public.leave_requests;
  v_ids uuid[] := coalesce(p_subject_ids, '{}'::uuid[]);
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'authentication required'
    USING ERRCODE = '42501';
  END IF;

  SELECT
    * INTO v_request
  FROM
    public.leave_requests r
  WHERE
    r.id = p_request_id
  FOR
    UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'absence request not found'
    USING ERRCODE = 'P0002';
  END IF;

  IF v_request.student_id <> v_user_id THEN
    RAISE EXCEPTION 'only the owner may change the covered courses'
    USING ERRCODE = '42501';
  END IF;

  IF v_request.status NOT IN ('draft', 'revision_requested') THEN
    RAISE EXCEPTION 'this request can no longer be edited'
    USING ERRCODE = 'SS011';
  END IF;

  UPDATE public.leave_requests r
  SET
    subject_ids = v_ids
  WHERE
    r.id = p_request_id;
END;
$$;


COMMENT ON FUNCTION public.set_leave_request_subjects (uuid, UUID[]) IS 'Replaces the courses one draft or returned absence request covers. Owner only.';

-- OCR stays advisory and editable in the same states as the request body.
CREATE OR REPLACE FUNCTION public.record_leave_request_ocr (
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

  if v_request.status not in ('draft', 'revision_requested') then
    raise exception 'this request can no longer be edited' using errcode = 'SS011';
  end if;

  update public.leave_requests r
  set
    ocr_status = p_status,
    ocr_provider = p_provider,
    ocr_result = p_result,
    ocr_extracted_at = now(),
    ocr_confirmed_at = null
  where
    r.id = p_request_id;

  insert into public.leave_request_history (request_id, actor_id, action, metadata)
values (
    p_request_id,
    v_user_id,
    'ocr_recorded',
    jsonb_build_object('provider', p_provider, 'status', p_status)
  );
end;
$$;


CREATE OR REPLACE FUNCTION public.confirm_leave_request_ocr (
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

  if v_request.status not in ('draft', 'revision_requested') then
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

-- ---------------------------------------------------------------------------
-- 6. Resubmit: revision_requested -> submitted ('resubmitted')
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_leave_request (p_request_id uuid) returns void language plpgsql security definer
SET
  search_path = public,
  pg_temp AS $$
declare
  v_user_id uuid := auth.uid ();
  v_request public.leave_requests;
  v_evidence_count integer;
  v_action text;
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

  if v_request.status not in ('draft', 'revision_requested') then
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

  v_action := case
    when v_request.status = 'revision_requested' then 'resubmitted'
    else 'submitted'
  end;

  update public.leave_requests r
  set
    status = 'submitted',
    submitted_at = now()
  where
    r.id = p_request_id;

  insert into public.leave_request_history (request_id, actor_id, action)
values (p_request_id, v_user_id, v_action);

  perform public.record_audit(
    'leave_request_' || v_action,
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

  perform public.notify_class_leave_reviewers (
    v_request.class_id,
    'leave_request_submitted',
    'Absence request submitted',
    v_display_name || ' submitted an absence request for review.',
    '/dashboard/classes/' || coalesce(v_class_slug, '') || '/leave-requests',
    to_char(now(), 'YYYYMMDDHH24MISS')
  );
end;
$$;


COMMENT ON FUNCTION public.submit_leave_request (uuid) IS 'Submits a draft or resubmits a returned request. Revision resubmits record `resubmitted` in history.';

-- ---------------------------------------------------------------------------
-- 7. Evidence: owner may manage it while the request is a draft or returned
-- ---------------------------------------------------------------------------
-- Needed so an "additional documentation required" revision can actually be
-- fixed: the student must be able to add or remove evidence before resubmitting.
CREATE OR REPLACE FUNCTION public.add_leave_request_evidence (
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

  if v_request.status not in ('draft', 'revision_requested') then
    raise exception 'this request can no longer be edited' using errcode = 'SS011';
  end if;

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


CREATE OR REPLACE FUNCTION public.remove_leave_request_evidence (p_evidence_id uuid) returns text language plpgsql security definer
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

  if v_request.status not in ('draft', 'revision_requested') then
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


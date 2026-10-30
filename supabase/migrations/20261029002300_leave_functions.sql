-- Leave-request workflow.
--
-- Every write goes through a SECURITY DEFINER function. The tables themselves
-- grant no INSERT/UPDATE/DELETE to clients, so a status transition cannot be
-- performed by sending a different value from the browser.
--
-- Transition graph (the only edges that exist):
--
--   draft ──submit──> submitted ──forward──> forwarded
--     ▲                   │
--     │                   └──request_revision──> needs_revision
--     └─────────────────── resubmit ───────────────┘
--
-- There is no edge into `approved` or `rejected`; those statuses do not exist.

-- ---------------------------------------------------------------------------
-- Read helpers used by RLS policies and by the app
-- ---------------------------------------------------------------------------
CREATE OR REPLACE function public.leave_request_class_id (p_request_id uuid) returns uuid language sql stable security definer
SET
  search_path = public,
  pg_temp AS $$
select
  r.class_id
from
  public.leave_requests r
where
  r.id = p_request_id;
$$;


CREATE OR REPLACE function public.is_leave_request_owner (p_request_id uuid) returns boolean language sql stable security definer
SET
  search_path = public,
  pg_temp AS $$
select
  exists (
    select
      1
    from
      public.leave_requests r
    where
      r.id = p_request_id
      and r.student_id = (
        select
          auth.uid ()
      )
  );
$$;


/** True when the caller owns the request or administers its class. */
CREATE OR REPLACE function public.can_view_leave_request (p_request_id uuid) returns boolean language sql stable security definer
SET
  search_path = public,
  pg_temp AS $$
select
  exists (
    select
      1
    from
      public.leave_requests r
    where
      r.id = p_request_id
      and (
        r.student_id = (
          select
            auth.uid ()
        )
        or public.can_manage_class (r.class_id)
      )
  );
$$;


/** Reviewing is a class-admin capability; a student can never review. */
CREATE OR REPLACE function public.can_review_leave_request (p_request_id uuid) returns boolean language sql stable security definer
SET
  search_path = public,
  pg_temp AS $$
select
  exists (
    select
      1
    from
      public.leave_requests r
    where
      r.id = p_request_id
      and public.can_manage_class (r.class_id)
  );
$$;


/**
 * Extracts the request id from an evidence object key.
 *
 * Keys are `{student_id}/{request_id}/{uuid}-{filename}`, so segment two is the
 * request. A malformed key returns null and the storage policy then denies
 * access instead of raising.
 */
CREATE OR REPLACE function public.leave_request_id_from_object_path (p_name text) returns uuid language plpgsql stable
SET
  search_path = public,
  pg_temp AS $$
declare
  v_segment text;
begin
  v_segment := split_part(p_name, '/', 2);

  if v_segment is null
  or v_segment = ''
  or v_segment !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then
    return null;
  end if;

  return v_segment::uuid;
exception
  when others then return null;
end;
$$;


-- ---------------------------------------------------------------------------
-- Notification helper
-- ---------------------------------------------------------------------------
/**
 * Queues one notification per class admin.
 *
 * Only a title, a body, and an internal URL are queued. No explanation text, no
 * OCR output, and no evidence link ever reaches a notification, because the
 * push payload is visible on a lock screen.
 */
CREATE OR REPLACE function public.notify_class_leave_reviewers (
  p_class_id uuid,
  p_kind text,
  p_title text,
  p_body text,
  p_url text,
  p_dedupe_suffix text
) returns void language plpgsql security definer
SET
  search_path = public,
  pg_temp AS $$
declare
  v_admin record;
  v_actor uuid := auth.uid ();
begin
  for v_admin in
  select
    a.user_id
  from
    public.class_admins a
  where
    a.class_id = p_class_id
    and (v_actor is null or a.user_id <> v_actor)
  loop
    perform public.enqueue_notification_event(
      v_admin.user_id,
      p_kind,
      p_kind || ':' || p_class_id || ':' || v_admin.user_id || ':' || p_dedupe_suffix,
      jsonb_build_object('title', p_title, 'body', p_body, 'url', p_url)
    );
  end loop;
end;
$$;


-- ---------------------------------------------------------------------------
-- Student: create and edit
-- ---------------------------------------------------------------------------
CREATE OR REPLACE function public.create_leave_request (
  p_class_id uuid,
  p_leave_start_date date DEFAULT null,
  p_leave_end_date date DEFAULT null,
  p_reason_category text DEFAULT null,
  p_explanation text DEFAULT null,
  p_document_issue_date date DEFAULT null
) returns TABLE (id uuid, reference text) language plpgsql security definer
SET
  search_path = public,
  pg_temp AS $$
declare
  v_user_id uuid := auth.uid ();
  v_request_id uuid;
  v_reference text;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  -- Class membership, not a client-supplied flag, decides who may apply.
  if p_class_id is null or not public.is_class_member (p_class_id) then
    raise exception 'not a member of this class' using errcode = '42501';
  end if;

  insert into public.leave_requests (
    student_id,
    class_id,
    leave_start_date,
    leave_end_date,
    reason_category,
    explanation,
    document_issue_date
  )
values (
    v_user_id,
    p_class_id,
    p_leave_start_date,
    p_leave_end_date,
    p_reason_category,
    p_explanation,
    p_document_issue_date
  )
returning
  leave_requests.id,
  leave_requests.reference into v_request_id,
  v_reference;

  insert into public.leave_request_history (request_id, actor_id, action)
values (v_request_id, v_user_id, 'created');

  perform public.record_audit(
    'leave_request_created',
    'leave_request',
    v_request_id,
    p_class_id,
    '{}'::jsonb
  );

  return query
select
  v_request_id,
  v_reference;
end;
$$;


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
    raise exception 'leave request not found' using errcode = 'P0002';
  end if;

  if v_request.student_id <> v_user_id then
    raise exception 'only the owner may edit this request' using errcode = '42501';
  end if;

  -- Submitted and forwarded requests are immutable; a revision goes through
  -- needs_revision first so the reviewer sees what changed.
  if v_request.status not in ('draft', 'needs_revision') then
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


-- ---------------------------------------------------------------------------
-- OCR: advisory only
-- ---------------------------------------------------------------------------
/**
 * Stores what the OCR provider suggested.
 *
 * This deliberately touches no authoritative column. OCR output is a
 * suggestion the student must confirm; it can never submit, forward, or
 * otherwise advance a request.
 */
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
    raise exception 'leave request not found' using errcode = 'P0002';
  end if;

  if v_request.student_id <> v_user_id then
    raise exception 'only the owner may attach OCR results' using errcode = '42501';
  end if;

  if v_request.status not in ('draft', 'needs_revision') then
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


/** Marks which fields the student confirmed or corrected after extraction. */
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
    raise exception 'leave request not found' using errcode = 'P0002';
  end if;

  if v_request.student_id <> v_user_id then
    raise exception 'only the owner may confirm extracted values' using errcode = '42501';
  end if;

  if v_request.status not in ('draft', 'needs_revision') then
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
-- Evidence registration
-- ---------------------------------------------------------------------------
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
    raise exception 'leave request not found' using errcode = 'P0002';
  end if;

  if v_request.student_id <> v_user_id then
    raise exception 'only the owner may attach evidence' using errcode = '42501';
  end if;

  if v_request.status not in ('draft', 'needs_revision') then
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


/** Soft-deletes one evidence row and returns its object key for cleanup. */
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

  if v_request.status not in ('draft', 'needs_revision') then
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
-- Student: submit and resubmit
-- ---------------------------------------------------------------------------
CREATE OR REPLACE function public.submit_leave_request (p_request_id uuid) returns void language plpgsql security definer
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
    raise exception 'leave request not found' using errcode = 'P0002';
  end if;

  if v_request.student_id <> v_user_id then
    raise exception 'only the owner may submit this request' using errcode = '42501';
  end if;

  if v_request.status not in ('draft', 'needs_revision') then
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
    when v_request.status = 'needs_revision' then 'resubmitted'
    else 'submitted'
  end;

  update public.leave_requests r
  set
    status = 'submitted',
    submitted_at = now(),
    -- The previous note is preserved in history, not left on the live row.
    last_review_note = null
  where
    r.id = p_request_id;

  insert into public.leave_request_history (request_id, actor_id, action)
values (p_request_id, v_user_id, v_action);

  perform public.record_audit(
    'leave_request_' || v_action,
    'leave_request',
    p_request_id,
    v_request.class_id,
    jsonb_build_object('revision_count', v_request.revision_count)
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
    'New leave request',
    v_display_name || ' submitted a leave request for review.',
    '/dashboard/classes/' || v_class_slug || '/leave-requests',
    p_request_id::text || ':' || to_char(now(), 'YYYYMMDDHH24MISS')
  );
end;
$$;


-- ---------------------------------------------------------------------------
-- Class admin: request a revision
-- ---------------------------------------------------------------------------
CREATE OR REPLACE function public.request_leave_revision (
  p_request_id uuid,
  p_note text
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
    raise exception 'leave request not found' using errcode = 'P0002';
  end if;

  if not public.can_manage_class (v_request.class_id) then
    raise exception 'not allowed to review this request' using errcode = '42501';
  end if;

  if v_request.status <> 'submitted' then
    raise exception 'only a submitted request can be returned for revision' using errcode = 'SS012';
  end if;

  if p_note is null or char_length(btrim(p_note)) < 5 then
    raise exception 'a revision reason is required' using errcode = '22023';
  end if;

  update public.leave_requests r
  set
    status = 'needs_revision',
    last_review_note = btrim(p_note),
    revision_count = r.revision_count + 1
  where
    r.id = p_request_id;

  insert into public.leave_request_history (request_id, actor_id, action, note)
values (p_request_id, v_user_id, 'revision_requested', btrim(p_note));

  perform public.record_audit(
    'leave_request_revision_requested',
    'leave_request',
    p_request_id,
    v_request.class_id,
    '{}'::jsonb
  );

  -- The note itself is not pushed: it may describe medical details. The student
  -- reads it in the app.
  perform public.enqueue_notification_event(
    v_request.student_id,
    'leave_request_revision_requested',
    'leave_request_revision_requested:' || p_request_id || ':' || v_request.student_id || ':' || (v_request.revision_count + 1)::text,
    jsonb_build_object(
      'title',
      'Leave request needs changes',
      'body',
      'Open StarsTask to read the reviewer note and resubmit.',
      'url',
      '/leave-requests/' || p_request_id::text
    )
  );
end;
$$;


-- ---------------------------------------------------------------------------
-- Class admin: complete a forwarding operation
-- ---------------------------------------------------------------------------
/**
 * Records a forwarding package and marks its requests `forwarded`.
 *
 * The caller must already have produced the report bytes. This function is the
 * commit point: if it raises, nothing is recorded and no status changes, so a
 * failed generation can never leave a request falsely marked as forwarded.
 *
 * Replaying the same `p_idempotency_key` returns the original record, so a
 * client retry cannot create a second package or a second set of status
 * changes. UNIQUE (request_id) on the items table makes double forwarding of a
 * single request structurally impossible.
 */
CREATE OR REPLACE function public.complete_leave_forwarding (
  p_class_id uuid,
  p_request_ids uuid[],
  p_recipient_name text,
  p_recipient_email text,
  p_report_reference text,
  p_report_format text,
  p_idempotency_key text
) returns TABLE (id uuid, reference text, request_count integer) language plpgsql security definer
SET
  search_path = public,
  pg_temp AS $$
declare
  v_user_id uuid := auth.uid ();
  v_existing public.leave_request_forwardings;
  v_forwarding_id uuid;
  v_reference text;
  v_count integer;
  v_selected integer;
  v_eligible integer;
  v_request record;
  v_slug text;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if not public.can_manage_class (p_class_id) then
    raise exception 'not allowed to forward for this class' using errcode = '42501';
  end if;

  -- Idempotent replay: return the original record untouched.
  select
    * into v_existing
  from
    public.leave_request_forwardings f
  where
    f.idempotency_key = p_idempotency_key;

  if found then
    return query
    select
      v_existing.id,
      v_existing.reference,
      v_existing.request_count;

    return;
  end if;

  if p_request_ids is null or array_length(p_request_ids, 1) is null then
    raise exception 'select at least one request' using errcode = '22023';
  end if;

  if array_length(p_request_ids, 1) > 200 then
    raise exception 'at most 200 requests per forwarding' using errcode = '22023';
  end if;

  select
    count(distinct x) into v_count
  from
    unnest(p_request_ids) as x;

  if v_count <> array_length(p_request_ids, 1) then
    raise exception 'the selection contains duplicates' using errcode = 'SS015';
  end if;

  if p_recipient_name is null or char_length(btrim(p_recipient_name)) < 1 then
    raise exception 'a recipient is required' using errcode = '22023';
  end if;

  -- Lock the selection so two admins cannot forward the same request at once.
  -- The count is taken outside the locking subquery: Postgres rejects
  -- `FOR UPDATE` combined with an aggregate.
  select
    count(*) into v_selected
  from
    (
      select
        r.id
      from
        public.leave_requests r
      where
        r.id = any (p_request_ids)
      for
        update
    ) locked;

  if v_selected <> v_count then
    raise exception 'some selected requests no longer exist' using errcode = 'SS015';
  end if;

  select
    count(*) into v_eligible
  from
    public.leave_requests r
  where
    r.id = any (p_request_ids)
    and r.class_id = p_class_id
    and r.status = 'submitted';

  if v_eligible <> v_count then
    raise exception 'every selected request must belong to this class and be awaiting forwarding' using errcode = 'SS013';
  end if;

  insert into public.leave_request_forwardings (
    class_id,
    forwarded_by,
    recipient_name,
    recipient_email,
    report_reference,
    report_format,
    request_count,
    idempotency_key
  )
values (
    p_class_id,
    v_user_id,
    btrim(p_recipient_name),
    nullif(btrim(coalesce(p_recipient_email, '')), ''),
    btrim(p_report_reference),
    p_report_format,
    v_count,
    p_idempotency_key
  )
returning
  leave_request_forwardings.id,
  leave_request_forwardings.reference into v_forwarding_id,
  v_reference;

  -- Snapshot the student name and leave dates so a later edit cannot rewrite
  -- what a past package said.
  insert into public.leave_request_forwarding_items (
    forwarding_id,
    request_id,
    student_display_name,
    leave_start_date,
    leave_end_date
  )
select
  v_forwarding_id,
  r.id,
  coalesce(p.display_name, 'Student'),
  r.leave_start_date,
  r.leave_end_date
from
  public.leave_requests r
  left join public.profiles p on p.id = r.student_id
where
  r.id = any (p_request_ids);

  update public.leave_requests r
  set
    status = 'forwarded',
    forwarded_at = now()
  where
    r.id = any (p_request_ids);

  insert into public.leave_request_history (request_id, actor_id, action, metadata)
select
  r.id,
  v_user_id,
  'forwarded',
  jsonb_build_object('forwarding_reference', v_reference)
from
  public.leave_requests r
where
  r.id = any (p_request_ids);

  perform public.record_audit(
    'leave_request_forwarded',
    'leave_request_forwarding',
    v_forwarding_id,
    p_class_id,
    jsonb_build_object('request_count', v_count, 'report_format', p_report_format)
  );

  select
    c.slug into v_slug
  from
    public.classes c
  where
    c.id = p_class_id;

  -- One notification per student, keyed to this forwarding so a retry with the
  -- same idempotency key cannot notify twice.
  for v_request in
  select
    r.id,
    r.student_id
  from
    public.leave_requests r
  where
    r.id = any (p_request_ids)
  loop
    perform public.enqueue_notification_event(
      v_request.student_id,
      'leave_request_forwarded',
      'leave_request_forwarded:' || v_request.id || ':' || v_request.student_id || ':' || v_forwarding_id::text,
      jsonb_build_object(
        'title',
        'Leave request forwarded',
        'body',
        'Your leave request was included in a package sent to the lecturer.',
        'url',
        '/leave-requests/' || v_request.id::text
      )
    );
  end loop;

  return query
select
  v_forwarding_id,
  v_reference,
  v_count;
end;
$$;


-- ---------------------------------------------------------------------------
-- Notification kinds for the leave workflow
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
    'leave_request_forwarded'
  )
);


-- Internal helpers that must never be callable as RPC.
--
-- `leave_request_class_id` is the only one that leaks anything (it maps a
-- request id to a class id), and nothing outside this migration needs it.
-- `is_leave_request_owner` and `leave_request_id_from_object_path` are
-- deliberately NOT revoked here: RLS policies run as the querying role, so a
-- policy that calls them fails with "permission denied for function" unless
-- that role holds EXECUTE. Both are safe to expose — one answers a yes/no
-- question about the caller's own row, the other just parses a path string.
REVOKE ALL ON function public.leave_request_class_id (uuid)
FROM
  public,
  anon,
  authenticated;


REVOKE ALL ON function public.notify_class_leave_reviewers (uuid, text, text, text, text, text)
FROM
  public,
  anon,
  authenticated;

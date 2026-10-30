-- Class representative verification and automatic class admin assignment.
--
-- A student may declare the position "Class Representative / Ketua Kelas" on
-- their profile. That declaration is a claim, never a permission: it grants no
-- access and is deliberately not readable through any authorization check.
--
-- The only path to class admin rights runs through this table set:
--
--   student submits evidence
--     -> platform admin reviews
--       -> approve: membership and class admin row for that one class
--       -> reject / request revision: no access of any kind
--
-- A verified request is scoped to exactly one class. There is no status that
-- means "verified everywhere".
-- ---------------------------------------------------------------------------
-- Profile position: a claim the student makes about themselves
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS declared_position text NOT NULL DEFAULT 'student';


ALTER TABLE public.profiles
DROP CONSTRAINT if EXISTS profiles_declared_position_allowed;


ALTER TABLE public.profiles
ADD CONSTRAINT profiles_declared_position_allowed CHECK (declared_position IN ('student', 'class_representative'));


COMMENT ON COLUMN public.profiles.declared_position IS 'Self-declared position. Documentation of intent only; never read by an authorization check.';


-- ---------------------------------------------------------------------------
-- class_verification_requests
-- ---------------------------------------------------------------------------
-- `submitted_at IS NULL` marks a request that is still being prepared. Such a
-- row is invisible to reviewers and cannot be reviewed or approved; it exists so
-- evidence can be uploaded before the submission is final.
CREATE TABLE IF NOT EXISTS public.class_verification_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES public.classes (id) ON DELETE CASCADE,
  -- Stored explicitly so a future position can use the same workflow without
  -- changing the meaning of rows created today.
  declared_position text NOT NULL DEFAULT 'class_representative',
  statement text,
  status text NOT NULL DEFAULT 'pending',
  submitted_at timestamptz,
  reviewed_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  review_note text,
  revision_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT class_verification_requests_position_allowed CHECK (declared_position = 'class_representative'),
  CONSTRAINT class_verification_requests_status_allowed CHECK (
    status IN ('pending', 'needs_revision', 'verified', 'rejected')
  ),
  CONSTRAINT class_verification_requests_statement_length CHECK (
    statement IS NULL
    OR char_length(btrim(statement)) BETWEEN 10 AND 2000
  ),
  CONSTRAINT class_verification_requests_note_length CHECK (
    review_note IS NULL
    OR char_length(btrim(review_note)) BETWEEN 3 AND 2000
  ),
  CONSTRAINT class_verification_requests_revision_range CHECK (revision_count BETWEEN 0 AND 100),
  -- A decision is either entirely present or entirely absent. Pending means no
  -- reviewer has touched the current submission.
  CONSTRAINT class_verification_requests_decision_consistency CHECK (
    (
      status = 'pending'
      AND reviewed_by IS NULL
      AND reviewed_at IS NULL
      AND review_note IS NULL
    )
    OR (
      status IN ('needs_revision', 'rejected')
      AND reviewed_by IS NOT NULL
      AND reviewed_at IS NOT NULL
      AND review_note IS NOT NULL
    )
    OR (
      status = 'verified'
      AND reviewed_by IS NOT NULL
      AND reviewed_at IS NOT NULL
    )
  ),
  CONSTRAINT class_verification_requests_submitted_consistency CHECK (
    status = 'pending'
    OR submitted_at IS NOT NULL
  ),
  -- Nobody reviews their own request, no matter which path created the row.
  CONSTRAINT class_verification_requests_no_self_review CHECK (
    reviewed_by IS NULL
    OR reviewed_by <> student_id
  )
);


COMMENT ON TABLE public.class_verification_requests IS 'Class representative verification requests. A verified row grants class admin access to exactly one class, and only through decide_class_verification.';


CREATE INDEX if NOT EXISTS class_verification_requests_student_idx ON public.class_verification_requests (student_id, created_at DESC);


CREATE INDEX if NOT EXISTS class_verification_requests_class_idx ON public.class_verification_requests (class_id, created_at DESC);


CREATE INDEX if NOT EXISTS class_verification_requests_queue_idx ON public.class_verification_requests (status, submitted_at DESC)
WHERE
  submitted_at IS NOT NULL;


-- One live request per student per class. Rejected requests are excluded, so a
-- student may try again after a rejection with fresh evidence.
CREATE UNIQUE INDEX if NOT EXISTS class_verification_requests_active_key ON public.class_verification_requests (student_id, class_id)
WHERE
  status IN ('pending', 'needs_revision', 'verified');


CREATE TRIGGER class_verification_requests_set_updated_at
BEFORE UPDATE ON public.class_verification_requests FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at ();


-- ---------------------------------------------------------------------------
-- class_verification_evidence
-- ---------------------------------------------------------------------------
-- Removal is soft so a replaced document remains auditable. Only rows with
-- `removed_at IS NULL` count as evidence for submission.
CREATE TABLE IF NOT EXISTS public.class_verification_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.class_verification_requests (id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  original_filename text NOT NULL,
  mime_type text NOT NULL,
  file_size integer NOT NULL,
  uploaded_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  removed_at timestamptz,
  removed_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  CONSTRAINT class_verification_evidence_path_key UNIQUE (storage_path),
  CONSTRAINT class_verification_evidence_mime_allowed CHECK (mime_type IN ('application/pdf', 'image/jpeg', 'image/png')),
  CONSTRAINT class_verification_evidence_size_range CHECK (file_size BETWEEN 1 AND 10485760),
  CONSTRAINT class_verification_evidence_filename_length CHECK (char_length(btrim(original_filename)) BETWEEN 1 AND 200),
  CONSTRAINT class_verification_evidence_path_length CHECK (char_length(storage_path) BETWEEN 10 AND 500),
  CONSTRAINT class_verification_evidence_removal_pair CHECK ((removed_at IS NULL) = (removed_by IS NULL))
);


CREATE INDEX if NOT EXISTS class_verification_evidence_request_idx ON public.class_verification_evidence (request_id)
WHERE
  removed_at IS NULL;


-- ---------------------------------------------------------------------------
-- class_verification_reviews: append-only history
-- ---------------------------------------------------------------------------
-- Actor identity is intentionally not granted to clients; a student learns the
-- decision and its note, not which platform admin made it.
CREATE TABLE IF NOT EXISTS public.class_verification_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.class_verification_requests (id) ON DELETE CASCADE,
  actor_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  action text NOT NULL,
  previous_status text,
  new_status text,
  note text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT class_verification_reviews_action_allowed CHECK (
    action IN (
      'created',
      'updated',
      'submitted',
      'resubmitted',
      'evidence_added',
      'evidence_removed',
      'revision_requested',
      'approved',
      'rejected',
      'access_revoked'
    )
  ),
  CONSTRAINT class_verification_reviews_status_allowed CHECK (
    (
      previous_status IS NULL
      OR previous_status IN ('pending', 'needs_revision', 'verified', 'rejected')
    )
    AND (
      new_status IS NULL
      OR new_status IN ('pending', 'needs_revision', 'verified', 'rejected')
    )
  ),
  CONSTRAINT class_verification_reviews_note_length CHECK (
    note IS NULL
    OR char_length(btrim(note)) BETWEEN 1 AND 2000
  ),
  CONSTRAINT class_verification_reviews_metadata_object CHECK (jsonb_typeof(metadata) = 'object')
);


CREATE INDEX if NOT EXISTS class_verification_reviews_request_idx ON public.class_verification_reviews (request_id, created_at);


-- ---------------------------------------------------------------------------
-- Read helpers used by RLS policies and storage policies
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.verification_request_id_from_object_path (p_name text) returns uuid language plpgsql stable
SET
  search_path = public,
  pg_temp AS $$
DECLARE
  v_segment text;
BEGIN
  v_segment := split_part(p_name, '/', 2);

  IF v_segment IS NULL
  OR v_segment = ''
  OR v_segment !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN
    RETURN NULL;
  END IF;

  RETURN v_segment::uuid;
EXCEPTION
  WHEN others THEN RETURN NULL;
END;
$$;


/** True when the caller owns the request. */
CREATE OR REPLACE FUNCTION public.is_class_verification_owner (p_request_id uuid) returns boolean language sql stable security definer
SET
  search_path = public,
  pg_temp AS $$
SELECT
  EXISTS (
    SELECT
      1
    FROM
      public.class_verification_requests r
    WHERE
      r.id = p_request_id
      AND r.student_id = (
        SELECT
          auth.uid ()
      )
  );
$$;


/**
 * The owner may always read their own request, including a draft. A platform
 * admin may only read requests that were actually submitted, so a half-finished
 * upload never appears in a reviewer's view.
 */
CREATE OR REPLACE FUNCTION public.can_view_class_verification (p_request_id uuid) returns boolean language sql stable security definer
SET
  search_path = public,
  pg_temp AS $$
SELECT
  EXISTS (
    SELECT
      1
    FROM
      public.class_verification_requests r
    WHERE
      r.id = p_request_id
      AND (
        r.student_id = (
          SELECT
            auth.uid ()
        )
        OR (
          r.submitted_at IS NOT NULL
          AND public.is_platform_admin ()
        )
      )
  );
$$;


/** Evidence may be added or removed only while the student can still edit. */
CREATE OR REPLACE FUNCTION public.can_edit_class_verification (p_request_id uuid) returns boolean language sql stable security definer
SET
  search_path = public,
  pg_temp AS $$
SELECT
  EXISTS (
    SELECT
      1
    FROM
      public.class_verification_requests r
    WHERE
      r.id = p_request_id
      AND r.student_id = (
        SELECT
          auth.uid ()
      )
      AND (
        r.status = 'needs_revision'
        OR (r.status = 'pending' AND r.submitted_at IS NULL)
      )
  );
$$;


-- ---------------------------------------------------------------------------
-- Profile position
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_my_declared_position () returns text language sql stable security definer
SET
  search_path = public,
  pg_temp AS $$
SELECT
  coalesce(
    (
      SELECT
        p.declared_position
      FROM
        public.profiles p
      WHERE
        p.id = (
          SELECT
            auth.uid ()
        )
    ),
    'student'
  );
$$;


/**
 * Records the student's own claim. It changes a profile field and nothing else:
 * no membership, no class admin row, no notification.
 */
CREATE OR REPLACE FUNCTION public.set_my_declared_position (p_position text) returns text language plpgsql security definer
SET
  search_path = public,
  pg_temp AS $$
DECLARE
  v_user uuid := (
    SELECT
      auth.uid ()
  );
  v_position text := btrim(coalesce(p_position, ''));
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING errcode = '42501';
  END IF;

  IF v_position NOT IN ('student', 'class_representative') THEN
    RAISE EXCEPTION 'invalid position' USING errcode = '22023';
  END IF;

  UPDATE public.profiles p
  SET
    declared_position = v_position
  WHERE
    p.id = v_user;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile not found' USING errcode = 'P0002';
  END IF;

  PERFORM public.record_audit(
    'declared_position_updated',
    'profile',
    v_user,
    NULL,
    jsonb_build_object('position', v_position)
  );

  RETURN v_position;
END;
$$;


-- ---------------------------------------------------------------------------
-- Student: create, edit, evidence, submit, discard
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.begin_class_verification (p_class_id uuid, p_statement text DEFAULT NULL) returns uuid language plpgsql security definer
SET
  search_path = public,
  pg_temp AS $$
DECLARE
  v_user uuid := (
    SELECT
      auth.uid ()
  );
  v_statement text := nullif(btrim(coalesce(p_statement, '')), '');
  v_existing public.class_verification_requests;
  v_id uuid;
  v_open integer;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING errcode = '42501';
  END IF;

  IF p_class_id IS NULL THEN
    RAISE EXCEPTION 'class is required' USING errcode = '22023';
  END IF;

  IF v_statement IS NOT NULL
  AND char_length(v_statement) < 10 THEN
    RAISE EXCEPTION 'the explanation is too short' USING errcode = '22023';
  END IF;

  IF v_statement IS NOT NULL
  AND char_length(v_statement) > 2000 THEN
    RAISE EXCEPTION 'the explanation is too long' USING errcode = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT
      1
    FROM
      public.classes c
    WHERE
      c.id = p_class_id
      AND c.status = 'active'
  ) THEN
    RAISE EXCEPTION 'class is not accepting verification requests' USING errcode = '22023';
  END IF;

  SELECT
    * INTO v_existing
  FROM
    public.class_verification_requests r
  WHERE
    r.student_id = v_user
    AND r.class_id = p_class_id
    AND r.status IN ('pending', 'needs_revision', 'verified')
  FOR
    UPDATE;

  IF FOUND THEN
    IF v_existing.status = 'verified' THEN
      RAISE EXCEPTION 'this class is already verified for you' USING errcode = '23505';
    END IF;

    -- Resuming an unfinished upload is not an error; it returns the same row so
    -- a retried request cannot create a second draft.
    IF v_existing.submitted_at IS NULL THEN
      RETURN v_existing.id;
    END IF;

    RAISE EXCEPTION 'a verification request for this class is already open' USING errcode = '23505';
  END IF;

  SELECT
    count(*) INTO v_open
  FROM
    public.class_verification_requests r
  WHERE
    r.student_id = v_user
    AND r.status IN ('pending', 'needs_revision');

  IF v_open >= 5 THEN
    RAISE EXCEPTION 'too many open verification requests' USING errcode = '22023';
  END IF;

  BEGIN
    INSERT INTO public.class_verification_requests (
      student_id,
      class_id,
      declared_position,
      statement,
      status
    )
    VALUES (
      v_user,
      p_class_id,
      'class_representative',
      v_statement,
      'pending'
    )
    RETURNING
      id INTO v_id;
  EXCEPTION
    WHEN unique_violation THEN RAISE EXCEPTION 'a verification request for this class is already open' USING errcode = '23505';
  END;

  INSERT INTO public.class_verification_reviews (request_id, actor_id, action, new_status)
  VALUES (v_id, v_user, 'created', 'pending');

  PERFORM public.record_audit(
    'verification_request_created',
    'class_verification_request',
    v_id,
    p_class_id,
    '{}'::jsonb
  );

  RETURN v_id;
END;
$$;


CREATE OR REPLACE FUNCTION public.revise_class_verification (p_request_id uuid, p_statement text DEFAULT NULL) returns boolean language plpgsql security definer
SET
  search_path = public,
  pg_temp AS $$
DECLARE
  v_user uuid := (
    SELECT
      auth.uid ()
  );
  v_request public.class_verification_requests;
  v_statement text := nullif(btrim(coalesce(p_statement, '')), '');
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING errcode = '42501';
  END IF;

  SELECT
    * INTO v_request
  FROM
    public.class_verification_requests r
  WHERE
    r.id = p_request_id
  FOR
    UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'verification request not found' USING errcode = 'P0002';
  END IF;

  IF v_request.student_id <> v_user THEN
    RAISE EXCEPTION 'only the owner may edit this request' USING errcode = '42501';
  END IF;

  IF NOT (
    v_request.status = 'needs_revision'
    OR (v_request.status = 'pending' AND v_request.submitted_at IS NULL)
  ) THEN
    RAISE EXCEPTION 'this request can no longer be edited' USING errcode = '22023';
  END IF;

  IF v_statement IS NOT NULL
  AND char_length(v_statement) < 10 THEN
    RAISE EXCEPTION 'the explanation is too short' USING errcode = '22023';
  END IF;

  IF v_statement IS NOT NULL
  AND char_length(v_statement) > 2000 THEN
    RAISE EXCEPTION 'the explanation is too long' USING errcode = '22023';
  END IF;

  UPDATE public.class_verification_requests r
  SET
    statement = v_statement
  WHERE
    r.id = p_request_id;

  INSERT INTO public.class_verification_reviews (request_id, actor_id, action, previous_status, new_status)
  VALUES (p_request_id, v_user, 'updated', v_request.status, v_request.status);

  PERFORM public.record_audit(
    'verification_request_updated',
    'class_verification_request',
    p_request_id,
    v_request.class_id,
    '{}'::jsonb
  );

  RETURN TRUE;
END;
$$;


CREATE OR REPLACE FUNCTION public.add_class_verification_evidence (
  p_request_id uuid,
  p_storage_path text,
  p_original_filename text,
  p_mime_type text,
  p_file_size integer
) returns uuid language plpgsql security definer
SET
  search_path = public,
  pg_temp AS $$
DECLARE
  v_user uuid := (
    SELECT
      auth.uid ()
  );
  v_request public.class_verification_requests;
  v_evidence_id uuid;
  v_active_count integer;
  v_prefix text;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING errcode = '42501';
  END IF;

  SELECT
    * INTO v_request
  FROM
    public.class_verification_requests r
  WHERE
    r.id = p_request_id
  FOR
    UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'verification request not found' USING errcode = 'P0002';
  END IF;

  IF v_request.student_id <> v_user THEN
    RAISE EXCEPTION 'only the owner may attach evidence' USING errcode = '42501';
  END IF;

  IF NOT (
    v_request.status = 'needs_revision'
    OR (v_request.status = 'pending' AND v_request.submitted_at IS NULL)
  ) THEN
    RAISE EXCEPTION 'this request can no longer be edited' USING errcode = '22023';
  END IF;

  -- The key must sit inside this student's folder for this request. A crafted
  -- path cannot point at another person's object. The null check comes first
  -- because `null <> prefix` is null, which would slip past the comparison.
  IF p_storage_path IS NULL THEN
    RAISE EXCEPTION 'invalid storage path' USING errcode = '22023';
  END IF;

  v_prefix := v_user::text || '/' || p_request_id::text || '/';

  IF left(p_storage_path, char_length(v_prefix)) <> v_prefix THEN
    RAISE EXCEPTION 'invalid storage path' USING errcode = '22023';
  END IF;

  IF p_mime_type NOT IN ('application/pdf', 'image/jpeg', 'image/png') THEN
    RAISE EXCEPTION 'unsupported file type' USING errcode = '22023';
  END IF;

  IF p_file_size IS NULL
  OR p_file_size NOT BETWEEN 1 AND 10485760 THEN
    RAISE EXCEPTION 'invalid file size' USING errcode = '22023';
  END IF;

  IF p_original_filename IS NULL
  OR char_length(btrim(p_original_filename)) NOT BETWEEN 1 AND 200 THEN
    RAISE EXCEPTION 'invalid file name' USING errcode = '22023';
  END IF;

  SELECT
    count(*) INTO v_active_count
  FROM
    public.class_verification_evidence e
  WHERE
    e.request_id = p_request_id
    AND e.removed_at IS NULL;

  IF v_active_count >= 5 THEN
    RAISE EXCEPTION 'at most 5 evidence files per request' USING errcode = '23514';
  END IF;

  INSERT INTO public.class_verification_evidence (
    request_id,
    storage_path,
    original_filename,
    mime_type,
    file_size,
    uploaded_by
  )
  VALUES (
    p_request_id,
    p_storage_path,
    btrim(p_original_filename),
    p_mime_type,
    p_file_size,
    v_user
  )
  RETURNING
    id INTO v_evidence_id;

  INSERT INTO public.class_verification_reviews (
    request_id,
    actor_id,
    action,
    previous_status,
    new_status,
    metadata
  )
  VALUES (
    p_request_id,
    v_user,
    'evidence_added',
    v_request.status,
    v_request.status,
    jsonb_build_object('evidence_id', v_evidence_id)
  );

  PERFORM public.record_audit(
    'verification_evidence_added',
    'class_verification_request',
    p_request_id,
    v_request.class_id,
    jsonb_build_object('evidence_id', v_evidence_id)
  );

  RETURN v_evidence_id;
END;
$$;


/** Soft-deletes one evidence row and returns its object key for cleanup. */
CREATE OR REPLACE FUNCTION public.remove_class_verification_evidence (p_evidence_id uuid) returns text language plpgsql security definer
SET
  search_path = public,
  pg_temp AS $$
DECLARE
  v_user uuid := (
    SELECT
      auth.uid ()
  );
  v_evidence public.class_verification_evidence;
  v_request public.class_verification_requests;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING errcode = '42501';
  END IF;

  SELECT
    * INTO v_evidence
  FROM
    public.class_verification_evidence e
  WHERE
    e.id = p_evidence_id
  FOR
    UPDATE;

  IF NOT FOUND
  OR v_evidence.removed_at IS NOT NULL THEN
    RAISE EXCEPTION 'evidence not found' USING errcode = 'P0002';
  END IF;

  SELECT
    * INTO v_request
  FROM
    public.class_verification_requests r
  WHERE
    r.id = v_evidence.request_id
  FOR
    UPDATE;

  IF v_request.student_id <> v_user THEN
    RAISE EXCEPTION 'only the owner may remove evidence' USING errcode = '42501';
  END IF;

  IF NOT (
    v_request.status = 'needs_revision'
    OR (v_request.status = 'pending' AND v_request.submitted_at IS NULL)
  ) THEN
    RAISE EXCEPTION 'this request can no longer be edited' USING errcode = '22023';
  END IF;

  UPDATE public.class_verification_evidence e
  SET
    removed_at = now(),
    removed_by = v_user
  WHERE
    e.id = p_evidence_id;

  INSERT INTO public.class_verification_reviews (
    request_id,
    actor_id,
    action,
    previous_status,
    new_status,
    metadata
  )
  VALUES (
    v_request.id,
    v_user,
    'evidence_removed',
    v_request.status,
    v_request.status,
    jsonb_build_object('evidence_id', p_evidence_id)
  );

  PERFORM public.record_audit(
    'verification_evidence_removed',
    'class_verification_request',
    v_request.id,
    v_request.class_id,
    jsonb_build_object('evidence_id', p_evidence_id)
  );

  RETURN v_evidence.storage_path;
END;
$$;


CREATE OR REPLACE FUNCTION public.submit_class_verification (p_request_id uuid) returns void language plpgsql security definer
SET
  search_path = public,
  pg_temp AS $$
DECLARE
  v_user uuid := (
    SELECT
      auth.uid ()
  );
  v_request public.class_verification_requests;
  v_evidence_count integer;
  v_action text;
  v_new_revision integer;
  v_admin record;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING errcode = '42501';
  END IF;

  SELECT
    * INTO v_request
  FROM
    public.class_verification_requests r
  WHERE
    r.id = p_request_id
  FOR
    UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'verification request not found' USING errcode = 'P0002';
  END IF;

  IF v_request.student_id <> v_user THEN
    RAISE EXCEPTION 'only the owner may submit this request' USING errcode = '42501';
  END IF;

  IF v_request.status = 'pending'
  AND v_request.submitted_at IS NOT NULL THEN
    RAISE EXCEPTION 'this request has already been submitted' USING errcode = '22023';
  END IF;

  IF v_request.status NOT IN ('pending', 'needs_revision') THEN
    RAISE EXCEPTION 'this request can no longer be submitted' USING errcode = '22023';
  END IF;

  SELECT
    count(*) INTO v_evidence_count
  FROM
    public.class_verification_evidence e
  WHERE
    e.request_id = p_request_id
    AND e.removed_at IS NULL;

  IF v_evidence_count = 0 THEN
    RAISE EXCEPTION 'at least one evidence file is required' USING errcode = '23514';
  END IF;

  v_action := CASE
    WHEN v_request.status = 'needs_revision' THEN 'resubmitted'
    ELSE 'submitted'
  END;

  v_new_revision := v_request.revision_count + CASE
    WHEN v_request.status = 'needs_revision' THEN 1
    ELSE 0
  END;

  UPDATE public.class_verification_requests r
  SET
    status = 'pending',
    submitted_at = now(),
    reviewed_by = NULL,
    reviewed_at = NULL,
    review_note = NULL,
    revision_count = v_new_revision
  WHERE
    r.id = p_request_id;

  INSERT INTO public.class_verification_reviews (
    request_id,
    actor_id,
    action,
    previous_status,
    new_status,
    metadata
  )
  VALUES (
    p_request_id,
    v_user,
    v_action,
    v_request.status,
    'pending',
    jsonb_build_object(
      'evidence_count', v_evidence_count,
      'revision_count', v_new_revision
    )
  );

  PERFORM public.record_audit(
    'verification_request_' || v_action,
    'class_verification_request',
    p_request_id,
    v_request.class_id,
    jsonb_build_object(
      'evidence_count', v_evidence_count,
      'revision_count', v_new_revision
    )
  );

  -- Reviewers learn that something is waiting, never what the evidence shows.
  FOR v_admin IN
  SELECT
    pa.user_id
  FROM
    public.platform_admins pa
  LOOP
    IF v_admin.user_id <> v_user THEN
      PERFORM public.enqueue_notification_event(
        v_admin.user_id,
        'verification_submitted',
        'verification_submitted:' || p_request_id || ':' || v_new_revision,
        jsonb_build_object(
          'title',
          'Class representative request',
          'body',
          'A student submitted proof for class representative verification.',
          'url',
          '/admin/verifications'
        )
      );
    END IF;
  END LOOP;
END;
$$;


/** Deletes an unfinished draft and returns its object keys for storage cleanup. */
CREATE OR REPLACE FUNCTION public.discard_class_verification (p_request_id uuid) returns TEXT[] language plpgsql security definer
SET
  search_path = public,
  pg_temp AS $$
DECLARE
  v_user uuid := (
    SELECT
      auth.uid ()
  );
  v_request public.class_verification_requests;
  v_paths text[];
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING errcode = '42501';
  END IF;

  SELECT
    * INTO v_request
  FROM
    public.class_verification_requests r
  WHERE
    r.id = p_request_id
  FOR
    UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'verification request not found' USING errcode = 'P0002';
  END IF;

  IF v_request.student_id <> v_user THEN
    RAISE EXCEPTION 'only the owner may discard this request' USING errcode = '42501';
  END IF;

  IF v_request.submitted_at IS NOT NULL
  OR v_request.status <> 'pending' THEN
    RAISE EXCEPTION 'a submitted request cannot be discarded' USING errcode = '22023';
  END IF;

  SELECT
    coalesce(array_agg(e.storage_path), '{}') INTO v_paths
  FROM
    public.class_verification_evidence e
  WHERE
    e.request_id = p_request_id;

  DELETE FROM public.class_verification_requests r
  WHERE
    r.id = p_request_id;

  PERFORM public.record_audit(
    'verification_request_discarded',
    'class_verification_request',
    p_request_id,
    v_request.class_id,
    jsonb_build_object('file_count', coalesce(array_length(v_paths, 1), 0))
  );

  RETURN v_paths;
END;
$$;


-- ---------------------------------------------------------------------------
-- Platform admin: decision
-- ---------------------------------------------------------------------------
/**
 * Records a decision and, only for an approval, creates the class admin
 * assignment for the request's class.
 *
 * Every insert is idempotent. Repeating an approval for the same row is still
 * refused, because the status is no longer awaiting review; a retried HTTP call
 * therefore cannot produce a second assignment.
 */
CREATE OR REPLACE FUNCTION public.decide_class_verification (
  p_request_id uuid,
  p_decision text,
  p_note text DEFAULT NULL
) returns text language plpgsql security definer
SET
  search_path = public,
  pg_temp AS $$
DECLARE
  v_reviewer uuid := (
    SELECT
      auth.uid ()
  );
  v_request public.class_verification_requests;
  v_class public.classes;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_status text;
  v_action text;
  v_evidence_count integer;
BEGIN
  IF NOT public.is_platform_admin () THEN
    RAISE EXCEPTION 'platform admin required' USING errcode = '42501';
  END IF;

  IF p_decision NOT IN ('approve', 'reject', 'request_revision') THEN
    RAISE EXCEPTION 'invalid decision' USING errcode = '22023';
  END IF;

  SELECT
    * INTO v_request
  FROM
    public.class_verification_requests r
  WHERE
    r.id = p_request_id
  FOR
    UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'verification request not found' USING errcode = 'P0002';
  END IF;

  IF v_request.student_id = v_reviewer THEN
    RAISE EXCEPTION 'you cannot review your own verification request' USING errcode = '42501';
  END IF;

  IF v_request.submitted_at IS NULL THEN
    RAISE EXCEPTION 'this request has not been submitted' USING errcode = '22023';
  END IF;

  IF v_request.status NOT IN ('pending', 'needs_revision') THEN
    RAISE EXCEPTION 'this request is not awaiting review' USING errcode = '22023';
  END IF;

  IF v_note IS NOT NULL
  AND char_length(v_note) < 3 THEN
    RAISE EXCEPTION 'the note is too short' USING errcode = '22023';
  END IF;

  IF p_decision <> 'approve'
  AND v_note IS NULL THEN
    RAISE EXCEPTION 'a note is required for this decision' USING errcode = '22023';
  END IF;

  IF p_decision = 'approve' THEN
    SELECT
      count(*) INTO v_evidence_count
    FROM
      public.class_verification_evidence e
    WHERE
      e.request_id = p_request_id
      AND e.removed_at IS NULL;

    IF v_evidence_count = 0 THEN
      RAISE EXCEPTION 'verification cannot be approved without evidence' USING errcode = '23514';
    END IF;

    SELECT
      * INTO v_class
    FROM
      public.classes c
    WHERE
      c.id = v_request.class_id;

    IF NOT FOUND
    OR v_class.status <> 'active' THEN
      RAISE EXCEPTION 'the class is not active' USING errcode = '22023';
    END IF;

    -- Membership first: class_admins has a composite foreign key to it.
    INSERT INTO public.class_members (class_id, user_id, joined_via)
    VALUES (v_request.class_id, v_request.student_id, 'admin_assignment') ON CONFLICT (class_id, user_id) DO NOTHING;

    INSERT INTO public.class_admins (class_id, user_id, assigned_by)
    VALUES (v_request.class_id, v_request.student_id, v_reviewer) ON CONFLICT (class_id, user_id) DO NOTHING;

    v_status := 'verified';
    v_action := 'approved';
  ELSIF p_decision = 'reject' THEN
    v_status := 'rejected';
    v_action := 'rejected';
  ELSE
    v_status := 'needs_revision';
    v_action := 'revision_requested';
  END IF;

  UPDATE public.class_verification_requests r
  SET
    status = v_status,
    reviewed_by = v_reviewer,
    reviewed_at = now(),
    review_note = v_note
  WHERE
    r.id = p_request_id;

  INSERT INTO public.class_verification_reviews (
    request_id,
    actor_id,
    action,
    previous_status,
    new_status,
    note,
    metadata
  )
  VALUES (
    p_request_id,
    v_reviewer,
    v_action,
    v_request.status,
    v_status,
    v_note,
    jsonb_build_object(
      'class_id', v_request.class_id,
      'evidence_count', (
        SELECT
          count(*)
        FROM
          public.class_verification_evidence e
        WHERE
          e.request_id = p_request_id
          AND e.removed_at IS NULL
      )
    )
  );

  PERFORM public.record_audit(
    'verification_' || v_action,
    'class_verification_request',
    p_request_id,
    v_request.class_id,
    jsonb_build_object(
      'decision', p_decision,
      'status', v_status,
      'class_id', v_request.class_id
    )
  );

  -- The notification is queued inside the same transaction as the decision and
  -- the role assignment, so it cannot announce access that was never granted.
  PERFORM public.enqueue_notification_event(
    v_request.student_id,
    'verification_' || v_action,
    'verification_decision:' || p_request_id || ':' || v_status || ':' || v_request.revision_count,
    CASE
      WHEN v_status = 'verified' THEN jsonb_build_object(
        'title',
        'Class representative verified',
        'body',
        'Your verification was approved. You can now manage your class on StarsTask.',
        'url',
        '/settings/profile'
      )
      WHEN v_status = 'rejected' THEN jsonb_build_object(
        'title',
        'Verification rejected',
        'body',
        'Open StarsTask to read the reviewer note.',
        'url',
        '/settings/profile'
      )
      ELSE jsonb_build_object(
        'title',
        'Verification needs revision',
        'body',
        'Open StarsTask to update your evidence and resubmit.',
        'url',
        '/settings/profile'
      )
    END
  );

  RETURN v_status;
END;
$$;


-- ---------------------------------------------------------------------------
-- Platform admin: revoke the access a verification granted
-- ---------------------------------------------------------------------------
-- Revocation removes the class admin row for the verified class only. The
-- verification itself stays `verified`, because the decision did happen; the UI
-- distinguishes "verified" from "currently has access" by the class_admins row.
CREATE OR REPLACE FUNCTION public.revoke_verified_class_admin (p_request_id uuid, p_note text) returns boolean language plpgsql security definer
SET
  search_path = public,
  pg_temp AS $$
DECLARE
  v_actor uuid := (
    SELECT
      auth.uid ()
  );
  v_request public.class_verification_requests;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
BEGIN
  IF NOT public.is_platform_admin () THEN
    RAISE EXCEPTION 'platform admin required' USING errcode = '42501';
  END IF;

  IF v_note IS NULL
  OR char_length(v_note) < 3 THEN
    RAISE EXCEPTION 'a revocation reason is required' USING errcode = '22023';
  END IF;

  SELECT
    * INTO v_request
  FROM
    public.class_verification_requests r
  WHERE
    r.id = p_request_id
  FOR
    UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'verification request not found' USING errcode = 'P0002';
  END IF;

  IF v_request.status <> 'verified' THEN
    RAISE EXCEPTION 'only a verified request can be revoked' USING errcode = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT
      1
    FROM
      public.class_admins ca
    WHERE
      ca.class_id = v_request.class_id
      AND ca.user_id = v_request.student_id
  ) THEN
    RAISE EXCEPTION 'no active class admin assignment to revoke' USING errcode = 'P0002';
  END IF;

  IF (
    SELECT
      count(*)
    FROM
      public.class_admins ca
    WHERE
      ca.class_id = v_request.class_id
  ) <= 1 THEN
    RAISE EXCEPTION 'class must keep at least one admin' USING errcode = '22023';
  END IF;

  DELETE FROM public.class_admins ca
  WHERE
    ca.class_id = v_request.class_id
    AND ca.user_id = v_request.student_id;

  INSERT INTO public.class_verification_reviews (
    request_id,
    actor_id,
    action,
    previous_status,
    new_status,
    note,
    metadata
  )
  VALUES (
    p_request_id,
    v_actor,
    'access_revoked',
    'verified',
    'verified',
    v_note,
    jsonb_build_object('class_id', v_request.class_id)
  );

  PERFORM public.record_audit(
    'class_admin_revoked',
    'class_verification_request',
    p_request_id,
    v_request.class_id,
    jsonb_build_object(
      'user_id', v_request.student_id,
      'source', 'verification_revocation'
    )
  );

  PERFORM public.enqueue_notification_event(
    v_request.student_id,
    'class_admin_revoked',
    'verification_access_revoked:' || p_request_id,
    jsonb_build_object(
      'title',
      'Class admin access removed',
      'body',
      'Your class admin access for a class was removed. Open StarsTask for details.',
      'url',
      '/settings/profile'
    )
  );

  RETURN TRUE;
END;
$$;


-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
ALTER TABLE public.class_verification_requests enable ROW LEVEL SECURITY;


ALTER TABLE public.class_verification_evidence enable ROW LEVEL SECURITY;


ALTER TABLE public.class_verification_reviews enable ROW LEVEL SECURITY;


-- No client INSERT/UPDATE/DELETE anywhere: every mutation is a definer function.
REVOKE ALL ON public.class_verification_requests
FROM
  anon,
  authenticated;


REVOKE ALL ON public.class_verification_evidence
FROM
  anon,
  authenticated;


REVOKE ALL ON public.class_verification_reviews
FROM
  anon,
  authenticated;


-- `reviewed_by` is deliberately absent: the reviewer's identity is withheld from
-- the student, matching the class application review policy.
GRANT
SELECT
  (
    id,
    student_id,
    class_id,
    declared_position,
    statement,
    status,
    submitted_at,
    reviewed_at,
    review_note,
    revision_count,
    created_at,
    updated_at
  ) ON public.class_verification_requests TO authenticated;


-- `storage_path` is granted because the server needs it to mint signed URLs; it
-- is never serialized to a client response.
GRANT
SELECT
  (
    id,
    request_id,
    storage_path,
    original_filename,
    mime_type,
    file_size,
    uploaded_by,
    created_at,
    removed_at,
    removed_by
  ) ON public.class_verification_evidence TO authenticated;


-- `actor_id` is absent for the same reason as `reviewed_by`.
GRANT
SELECT
  (
    id,
    request_id,
    action,
    previous_status,
    new_status,
    note,
    metadata,
    created_at
  ) ON public.class_verification_reviews TO authenticated;


DROP POLICY if EXISTS class_verification_requests_select ON public.class_verification_requests;


CREATE POLICY class_verification_requests_select ON public.class_verification_requests FOR
SELECT
  TO authenticated USING (public.can_view_class_verification (id));


DROP POLICY if EXISTS class_verification_evidence_select ON public.class_verification_evidence;


CREATE POLICY class_verification_evidence_select ON public.class_verification_evidence FOR
SELECT
  TO authenticated USING (public.can_view_class_verification (request_id));


DROP POLICY if EXISTS class_verification_reviews_select ON public.class_verification_reviews;


CREATE POLICY class_verification_reviews_select ON public.class_verification_reviews FOR
SELECT
  TO authenticated USING (public.can_view_class_verification (request_id));


-- ---------------------------------------------------------------------------
-- Private evidence storage
-- ---------------------------------------------------------------------------
-- Object keys are {student_id}/{request_id}/{uuid}-{filename}, built on the
-- server. There are no public URLs; the app issues five-minute signed links.
INSERT INTO
  storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  (
    'verification-evidence',
    'verification-evidence',
    FALSE,
    10485760,
    ARRAY['application/pdf', 'image/jpeg', 'image/png']
  )
ON CONFLICT (id) DO UPDATE
SET
  public = FALSE,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;


-- The owner reads only their own folder. A platform admin reads an object only
-- when its request was submitted, resolved through the database rather than
-- from a path segment the caller supplied.
DROP POLICY if EXISTS verification_evidence_storage_read ON storage.objects;


CREATE POLICY verification_evidence_storage_read ON storage.objects FOR
SELECT
  TO authenticated USING (
    bucket_id = 'verification-evidence'
    AND (
      (
        SELECT
          auth.uid ()
      )::text = (storage.foldername (name)) [1]
      OR public.can_view_class_verification (public.verification_request_id_from_object_path (name))
    )
  );


DROP POLICY if EXISTS verification_evidence_storage_insert ON storage.objects;


CREATE POLICY verification_evidence_storage_insert ON storage.objects FOR insert TO authenticated
WITH
  CHECK (
    bucket_id = 'verification-evidence'
    AND (
      SELECT
        auth.uid ()
    )::text = (storage.foldername (name)) [1]
    AND public.can_edit_class_verification (public.verification_request_id_from_object_path (name))
  );


-- Delete stays owner-folder only so the service can clean up objects after a
-- failed upload or after discarding a draft; the database still decides whether
-- the evidence row exists.
DROP POLICY if EXISTS verification_evidence_storage_delete ON storage.objects;


CREATE POLICY verification_evidence_storage_delete ON storage.objects FOR delete TO authenticated USING (
  bucket_id = 'verification-evidence'
  AND (
    SELECT
      auth.uid ()
  )::text = (storage.foldername (name)) [1]
);


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
    'class_admin_revoked'
  )
);


-- ---------------------------------------------------------------------------
-- Function privileges
-- ---------------------------------------------------------------------------
REVOKE ALL ON function public.verification_request_id_from_object_path (text)
FROM
  public,
  anon,
  authenticated;


REVOKE ALL ON function public.is_class_verification_owner (uuid)
FROM
  public,
  anon,
  authenticated;


REVOKE ALL ON function public.can_view_class_verification (uuid)
FROM
  public,
  anon,
  authenticated;


REVOKE ALL ON function public.can_edit_class_verification (uuid)
FROM
  public,
  anon,
  authenticated;


GRANT
EXECUTE ON function public.verification_request_id_from_object_path (text) TO authenticated;


GRANT
EXECUTE ON function public.is_class_verification_owner (uuid) TO authenticated;


GRANT
EXECUTE ON function public.can_view_class_verification (uuid) TO authenticated;


GRANT
EXECUTE ON function public.can_edit_class_verification (uuid) TO authenticated;


REVOKE ALL ON function public.get_my_declared_position ()
FROM
  public,
  anon,
  authenticated;


REVOKE ALL ON function public.set_my_declared_position (text)
FROM
  public,
  anon,
  authenticated;


REVOKE ALL ON function public.begin_class_verification (uuid, text)
FROM
  public,
  anon,
  authenticated;


REVOKE ALL ON function public.revise_class_verification (uuid, text)
FROM
  public,
  anon,
  authenticated;


REVOKE ALL ON function public.add_class_verification_evidence (uuid, text, text, text, integer)
FROM
  public,
  anon,
  authenticated;


REVOKE ALL ON function public.remove_class_verification_evidence (uuid)
FROM
  public,
  anon,
  authenticated;


REVOKE ALL ON function public.submit_class_verification (uuid)
FROM
  public,
  anon,
  authenticated;


REVOKE ALL ON function public.discard_class_verification (uuid)
FROM
  public,
  anon,
  authenticated;


REVOKE ALL ON function public.decide_class_verification (uuid, text, text)
FROM
  public,
  anon,
  authenticated;


REVOKE ALL ON function public.revoke_verified_class_admin (uuid, text)
FROM
  public,
  anon,
  authenticated;


GRANT
EXECUTE ON function public.get_my_declared_position () TO authenticated;


GRANT
EXECUTE ON function public.set_my_declared_position (text) TO authenticated;


GRANT
EXECUTE ON function public.begin_class_verification (uuid, text) TO authenticated;


GRANT
EXECUTE ON function public.revise_class_verification (uuid, text) TO authenticated;


GRANT
EXECUTE ON function public.add_class_verification_evidence (uuid, text, text, text, integer) TO authenticated;


GRANT
EXECUTE ON function public.remove_class_verification_evidence (uuid) TO authenticated;


GRANT
EXECUTE ON function public.submit_class_verification (uuid) TO authenticated;


GRANT
EXECUTE ON function public.discard_class_verification (uuid) TO authenticated;


GRANT
EXECUTE ON function public.decide_class_verification (uuid, text, text) TO authenticated;


GRANT
EXECUTE ON function public.revoke_verified_class_admin (uuid, text) TO authenticated;

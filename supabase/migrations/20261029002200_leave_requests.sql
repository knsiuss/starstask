-- Leave requests: collection, review, and forwarding.
--
-- Product boundary (deliberate): this schema has no `approved` or `rejected`
-- status and no lecturer decision table. StarsTask collects leave requests and
-- forwards them; it never decides whether leave is granted. `forwarded` means
-- "included in a completed forwarding package", not "approved" and not
-- "received by the lecturer".
--
-- Three distinct dates are kept apart on purpose:
--   document_issue_date  when the supporting document was issued
--   submitted_at         when the student submitted the request
--   leave_start_date /
--   leave_end_date       the period the student is asking to be excused from
-- Nothing here infers one from another.

-- ---------------------------------------------------------------------------
-- leave_requests
-- ---------------------------------------------------------------------------
CREATE TABLE if NOT EXISTS public.leave_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Stable, human-quotable identifier used in reports, evidence labels, and
  -- forwarding records. Derived from a fresh uuid so it never leaks row order
  -- and cannot be guessed from a neighbour's reference.
  reference text NOT NULL DEFAULT (
    'LR-' || upper(substr(replace(gen_random_uuid ()::text, '-', ''), 1, 12))
  ),
  student_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES public.classes (id) ON DELETE CASCADE,
  -- Nullable while drafting: a student may save a half-filled draft. Every
  -- column below is enforced at submit time by leave_requests_complete.
  leave_start_date date,
  leave_end_date date,
  reason_category text,
  explanation text,
  document_issue_date date,
  status text NOT NULL DEFAULT 'draft',
  submitted_at timestamptz,
  forwarded_at timestamptz,
  revision_count integer NOT NULL DEFAULT 0,
  -- Most recent reviewer note. The full history lives in leave_request_history.
  last_review_note text,
  -- OCR is advisory. `ocr_result` keeps what the provider suggested, and
  -- `field_sources` records per-field provenance so a reviewer can tell an
  -- extracted value from a value the student typed or corrected.
  ocr_status text NOT NULL DEFAULT 'not_run',
  ocr_provider text,
  ocr_result jsonb,
  ocr_extracted_at timestamptz,
  ocr_confirmed_at timestamptz,
  field_sources jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT leave_requests_reference_key UNIQUE (reference),
  CONSTRAINT leave_requests_reference_format CHECK (reference ~ '^LR-[0-9A-F]{12}$'),
  CONSTRAINT leave_requests_reason_allowed CHECK (
    reason_category IS NULL
    OR reason_category IN ('illness', 'family_matter', 'other')
  ),
  CONSTRAINT leave_requests_status_allowed CHECK (
    status IN ('draft', 'submitted', 'needs_revision', 'forwarded')
  ),
  CONSTRAINT leave_requests_ocr_status_allowed CHECK (
    ocr_status IN ('not_run', 'pending', 'succeeded', 'failed', 'unsupported')
  ),
  CONSTRAINT leave_requests_date_order CHECK (
    leave_start_date IS NULL
    OR leave_end_date IS NULL
    OR leave_end_date >= leave_start_date
  ),
  CONSTRAINT leave_requests_range_days CHECK (
    leave_start_date IS NULL
    OR leave_end_date IS NULL
    OR leave_end_date - leave_start_date <= 365
  ),
  CONSTRAINT leave_requests_explanation_length CHECK (
    explanation IS NULL
    OR char_length(btrim(explanation)) BETWEEN 10 AND 4000
  ),
  CONSTRAINT leave_requests_note_length CHECK (
    last_review_note IS NULL
    OR char_length(btrim(last_review_note)) BETWEEN 1 AND 2000
  ),
  -- A request that has left `draft` must be complete and internally consistent.
  -- This is the database's own guarantee, independent of any client check.
  CONSTRAINT leave_requests_complete CHECK (
    status = 'draft'
    OR (
      leave_start_date IS NOT NULL
      AND leave_end_date IS NOT NULL
      AND reason_category IS NOT NULL
      AND explanation IS NOT NULL
      AND submitted_at IS NOT NULL
    )
  ),
  CONSTRAINT leave_requests_forwarded_at_consistency CHECK (
    (status = 'forwarded') = (forwarded_at IS NOT NULL)
  ),
  CONSTRAINT leave_requests_draft_never_submitted CHECK (
    status <> 'draft'
    OR (submitted_at IS NULL AND forwarded_at IS NULL)
  ),
  CONSTRAINT leave_requests_revision_count_range CHECK (revision_count BETWEEN 0 AND 100),
  CONSTRAINT leave_requests_field_sources_object CHECK (jsonb_typeof(field_sources) = 'object'),
  CONSTRAINT leave_requests_ocr_result_object CHECK (
    ocr_result IS NULL
    OR jsonb_typeof(ocr_result) = 'object'
  )
);


CREATE INDEX if NOT EXISTS leave_requests_class_status_idx ON public.leave_requests (
  class_id,
  status,
  created_at DESC
);


CREATE INDEX if NOT EXISTS leave_requests_student_idx ON public.leave_requests (student_id, created_at DESC);


-- Reviewer queues skip drafts entirely, so keep them out of the index.
CREATE INDEX if NOT EXISTS leave_requests_review_queue_idx ON public.leave_requests (class_id, submitted_at DESC)
WHERE
  status IN ('submitted', 'needs_revision');


CREATE INDEX if NOT EXISTS leave_requests_leave_date_idx ON public.leave_requests (class_id, leave_start_date)
WHERE
  status <> 'draft';


CREATE TRIGGER leave_requests_set_updated_at BEFORE
UPDATE ON public.leave_requests FOR each ROW
EXECUTE function public.set_updated_at ();


-- ---------------------------------------------------------------------------
-- leave_request_evidence
-- ---------------------------------------------------------------------------
-- Removal is soft (`removed_at`) so a replaced or deleted document stays
-- auditable and the storage object is never silently orphaned. Only rows with
-- `removed_at IS NULL` count as evidence for submission and export.
CREATE TABLE if NOT EXISTS public.leave_request_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.leave_requests (id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  original_filename text NOT NULL,
  mime_type text NOT NULL,
  file_size integer NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  uploaded_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  removed_at timestamptz,
  removed_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  CONSTRAINT leave_request_evidence_path_key UNIQUE (storage_path),
  CONSTRAINT leave_request_evidence_mime_allowed CHECK (
    mime_type IN ('application/pdf', 'image/jpeg', 'image/png')
  ),
  CONSTRAINT leave_request_evidence_size_range CHECK (file_size BETWEEN 1 AND 10485760),
  CONSTRAINT leave_request_evidence_filename_length CHECK (
    char_length(btrim(original_filename)) BETWEEN 1 AND 200
  ),
  CONSTRAINT leave_request_evidence_path_length CHECK (
    char_length(storage_path) BETWEEN 10 AND 500
  ),
  CONSTRAINT leave_request_evidence_sort_range CHECK (sort_order BETWEEN 0 AND 50),
  CONSTRAINT leave_request_evidence_removal_pair CHECK (
    (removed_at IS NULL) = (removed_by IS NULL)
  )
);


CREATE INDEX if NOT EXISTS leave_request_evidence_request_idx ON public.leave_request_evidence (request_id, sort_order)
WHERE
  removed_at IS NULL;


-- ---------------------------------------------------------------------------
-- leave_request_history
-- ---------------------------------------------------------------------------
-- Append-only. There is no UPDATE or DELETE grant or policy anywhere, so a
-- revision cannot erase the submission it replaced.
CREATE TABLE if NOT EXISTS public.leave_request_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.leave_requests (id) ON DELETE CASCADE,
  actor_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  action text NOT NULL,
  note text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT leave_request_history_action_allowed CHECK (
    action IN (
      'created',
      'updated',
      'submitted',
      'revision_requested',
      'resubmitted',
      'forwarded',
      'evidence_added',
      'evidence_removed',
      'ocr_recorded'
    )
  ),
  CONSTRAINT leave_request_history_note_length CHECK (
    note IS NULL
    OR char_length(btrim(note)) BETWEEN 1 AND 2000
  ),
  CONSTRAINT leave_request_history_metadata_object CHECK (jsonb_typeof(metadata) = 'object')
);


CREATE INDEX if NOT EXISTS leave_request_history_request_idx ON public.leave_request_history (request_id, created_at);


-- ---------------------------------------------------------------------------
-- leave_request_forwardings
-- ---------------------------------------------------------------------------
-- A row exists only if the forwarding operation completed: the report bytes are
-- produced first, then `complete_leave_forwarding` writes this record and the
-- status changes in one transaction. A failed attempt rolls back, so nothing is
-- recorded and nothing is marked `forwarded`.
--
-- This table records that a package was generated and handed to a person. It
-- does not and must not claim the lecturer received, opened, or approved it.
CREATE TABLE if NOT EXISTS public.leave_request_forwardings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference text NOT NULL DEFAULT (
    'LF-' || upper(substr(replace(gen_random_uuid ()::text, '-', ''), 1, 12))
  ),
  class_id uuid NOT NULL REFERENCES public.classes (id) ON DELETE CASCADE,
  forwarded_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  recipient_name text NOT NULL,
  recipient_email text,
  -- Filename of the generated package, so the record points at a reproducible
  -- artifact without storing the artifact or a public URL.
  report_reference text NOT NULL,
  report_format text NOT NULL,
  request_count integer NOT NULL,
  -- Client-supplied (or derived) key that makes a retried operation return the
  -- original record instead of creating a second one.
  idempotency_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT leave_request_forwardings_reference_key UNIQUE (reference),
  CONSTRAINT leave_request_forwardings_reference_format CHECK (reference ~ '^LF-[0-9A-F]{12}$'),
  CONSTRAINT leave_request_forwardings_idempotency_key UNIQUE (idempotency_key),
  CONSTRAINT leave_request_forwardings_format_allowed CHECK (report_format IN ('summary', 'complete')),
  CONSTRAINT leave_request_forwardings_count_range CHECK (request_count BETWEEN 1 AND 200),
  CONSTRAINT leave_request_forwardings_recipient_length CHECK (
    char_length(btrim(recipient_name)) BETWEEN 1 AND 160
  ),
  CONSTRAINT leave_request_forwardings_email_length CHECK (
    recipient_email IS NULL
    OR char_length(btrim(recipient_email)) BETWEEN 3 AND 254
  ),
  CONSTRAINT leave_request_forwardings_report_ref_length CHECK (
    char_length(btrim(report_reference)) BETWEEN 1 AND 160
  ),
  CONSTRAINT leave_request_forwardings_idempotency_length CHECK (
    char_length(idempotency_key) BETWEEN 8 AND 200
  )
);


CREATE INDEX if NOT EXISTS leave_request_forwardings_class_idx ON public.leave_request_forwardings (class_id, created_at DESC);


-- ---------------------------------------------------------------------------
-- leave_request_forwarding_items
-- ---------------------------------------------------------------------------
-- UNIQUE (request_id) is the structural guarantee against duplicate forwarding:
-- a request can belong to at most one forwarding package, forever. Retrying a
-- completed operation reuses the existing record through idempotency_key.
--
-- student_display_name and leave dates are snapshotted so a later nickname or
-- date edit cannot rewrite what a past report said.
CREATE TABLE if NOT EXISTS public.leave_request_forwarding_items (
  forwarding_id uuid NOT NULL REFERENCES public.leave_request_forwardings (id) ON DELETE CASCADE,
  request_id uuid NOT NULL REFERENCES public.leave_requests (id) ON DELETE RESTRICT,
  student_display_name text NOT NULL,
  leave_start_date date NOT NULL,
  leave_end_date date NOT NULL,
  PRIMARY KEY (forwarding_id, request_id),
  CONSTRAINT leave_request_forwarding_items_request_key UNIQUE (request_id),
  CONSTRAINT leave_request_forwarding_items_name_length CHECK (
    char_length(btrim(student_display_name)) BETWEEN 1 AND 120
  ),
  CONSTRAINT leave_request_forwarding_items_date_order CHECK (leave_end_date >= leave_start_date)
);


CREATE INDEX if NOT EXISTS leave_request_forwarding_items_forwarding_idx ON public.leave_request_forwarding_items (forwarding_id);

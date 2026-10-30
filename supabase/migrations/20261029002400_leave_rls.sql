-- Row-level security and the private evidence bucket.
--
-- Read access is the only thing granted here. There is no INSERT, UPDATE, or
-- DELETE policy or grant on any leave table: every mutation goes through a
-- SECURITY DEFINER function that re-checks ownership, class role, and the
-- current status. That is what stops a client from submitting `status:
-- 'forwarded'` and having it stick.

ALTER TABLE public.leave_requests enable ROW LEVEL SECURITY;


ALTER TABLE public.leave_request_evidence enable ROW LEVEL SECURITY;


ALTER TABLE public.leave_request_history enable ROW LEVEL SECURITY;


ALTER TABLE public.leave_request_forwardings enable ROW LEVEL SECURITY;


ALTER TABLE public.leave_request_forwarding_items enable ROW LEVEL SECURITY;


-- A student sees their own requests; a class admin sees the requests of the
-- classes they administer. Platform admins inherit through can_manage_class.
DROP POLICY if EXISTS leave_requests_select ON public.leave_requests;


CREATE POLICY leave_requests_select ON public.leave_requests FOR
SELECT
  TO authenticated USING (
    student_id = (
      SELECT
        auth.uid ()
    )
    OR public.can_manage_class (class_id)
  );


DROP POLICY if EXISTS leave_request_evidence_select ON public.leave_request_evidence;


CREATE POLICY leave_request_evidence_select ON public.leave_request_evidence FOR
SELECT
  TO authenticated USING (public.can_view_leave_request (request_id));


-- History is readable by the same audience but never writable from a client.
DROP POLICY if EXISTS leave_request_history_select ON public.leave_request_history;


CREATE POLICY leave_request_history_select ON public.leave_request_history FOR
SELECT
  TO authenticated USING (public.can_view_leave_request (request_id));


-- Forwarding records are reviewer-facing: a student learns that their request
-- was forwarded from the request status, not from the batch record.
DROP POLICY if EXISTS leave_request_forwardings_select ON public.leave_request_forwardings;


CREATE POLICY leave_request_forwardings_select ON public.leave_request_forwardings FOR
SELECT
  TO authenticated USING (public.can_manage_class (class_id));


DROP POLICY if EXISTS leave_request_forwarding_items_select ON public.leave_request_forwarding_items;


CREATE POLICY leave_request_forwarding_items_select ON public.leave_request_forwarding_items FOR
SELECT
  TO authenticated USING (public.can_review_leave_request (request_id));


-- ---------------------------------------------------------------------------
-- Evidence storage
-- ---------------------------------------------------------------------------
-- Private bucket, PDF/JPG/PNG only, 10 MB per object. The application enforces
-- the same limit from LEAVE_EVIDENCE_MAX_BYTES; this is the backstop.
INSERT INTO
  storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  (
    'leave-evidence',
    'leave-evidence',
    FALSE,
    10485760,
    ARRAY['application/pdf', 'image/jpeg', 'image/png']
  )
ON CONFLICT (id) DO UPDATE
SET
  public = FALSE,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;


-- Object keys are {student_id}/{request_id}/{uuid}-{filename}.
--
-- A student reads only their own folder. A class admin reads evidence whose
-- request belongs to a class they administer — resolved through the database,
-- never from a path segment or a request id the caller supplied.
DROP POLICY if EXISTS leave_evidence_storage_read ON storage.objects;


CREATE POLICY leave_evidence_storage_read ON storage.objects FOR
SELECT
  TO authenticated USING (
    bucket_id = 'leave-evidence'
    AND (
      (
        SELECT
          auth.uid ()
      )::text = (storage.foldername (name)) [1]
      OR public.can_review_leave_request (public.leave_request_id_from_object_path (name))
    )
  );


DROP POLICY if EXISTS leave_evidence_storage_insert ON storage.objects;


CREATE POLICY leave_evidence_storage_insert ON storage.objects FOR insert TO authenticated
WITH
  CHECK (
    bucket_id = 'leave-evidence'
    AND (
      SELECT
        auth.uid ()
    )::text = (storage.foldername (name)) [1]
    AND public.is_leave_request_owner (public.leave_request_id_from_object_path (name))
  );


DROP POLICY if EXISTS leave_evidence_storage_delete ON storage.objects;


CREATE POLICY leave_evidence_storage_delete ON storage.objects FOR delete TO authenticated USING (
  bucket_id = 'leave-evidence'
  AND (
    SELECT
      auth.uid ()
  )::text = (storage.foldername (name)) [1]
);

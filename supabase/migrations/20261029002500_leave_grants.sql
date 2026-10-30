-- Grants for the leave workflow.
--
-- The pattern matches the rest of the schema: revoke everything, then grant the
-- minimum. Read access is column-level on the tables and role-level on the
-- functions. No table receives INSERT, UPDATE, or DELETE.

REVOKE ALL ON public.leave_requests
FROM
  anon,
  authenticated;


REVOKE ALL ON public.leave_request_evidence
FROM
  anon,
  authenticated;


REVOKE ALL ON public.leave_request_history
FROM
  anon,
  authenticated;


REVOKE ALL ON public.leave_request_forwardings
FROM
  anon,
  authenticated;


REVOKE ALL ON public.leave_request_forwarding_items
FROM
  anon,
  authenticated;


-- `storage_path` is granted because the server needs it to mint signed URLs, but
-- it is never serialized to a client response: the UI receives a signed URL and
-- the display filename only.
GRANT
SELECT
  (
    id,
    reference,
    student_id,
    class_id,
    leave_start_date,
    leave_end_date,
    reason_category,
    explanation,
    document_issue_date,
    status,
    submitted_at,
    forwarded_at,
    revision_count,
    last_review_note,
    ocr_status,
    ocr_provider,
    ocr_result,
    ocr_extracted_at,
    ocr_confirmed_at,
    field_sources,
    created_at,
    updated_at
  ) ON public.leave_requests TO authenticated;


GRANT
SELECT
  (
    id,
    request_id,
    storage_path,
    original_filename,
    mime_type,
    file_size,
    sort_order,
    uploaded_by,
    created_at,
    removed_at,
    removed_by
  ) ON public.leave_request_evidence TO authenticated;


GRANT
SELECT
  (
    id,
    request_id,
    actor_id,
    action,
    note,
    metadata,
    created_at
  ) ON public.leave_request_history TO authenticated;


GRANT
SELECT
  (
    id,
    reference,
    class_id,
    forwarded_by,
    recipient_name,
    recipient_email,
    report_reference,
    report_format,
    request_count,
    created_at
  ) ON public.leave_request_forwardings TO authenticated;


GRANT
SELECT
  (
    forwarding_id,
    request_id,
    student_display_name,
    leave_start_date,
    leave_end_date
  ) ON public.leave_request_forwarding_items TO authenticated;


-- Policy helpers. RLS policies are evaluated as the querying role, so these
-- must be executable by `authenticated` or every policy that calls them fails
-- with "permission denied for function".
GRANT
execute ON function public.can_view_leave_request (uuid) TO authenticated;


GRANT
execute ON function public.can_review_leave_request (uuid) TO authenticated;


GRANT
execute ON function public.is_leave_request_owner (uuid) TO authenticated;


-- Also needed by the storage read policy when Supabase evaluates it for a
-- signed URL request; harmless because it only parses a string.
GRANT
execute ON function public.leave_request_id_from_object_path (text) TO authenticated;


-- Workflow RPCs.
GRANT
execute ON function public.create_leave_request (uuid, date, date, text, text, date) TO authenticated;


GRANT
execute ON function public.update_leave_request (uuid, date, date, text, text, date) TO authenticated;


GRANT
execute ON function public.record_leave_request_ocr (uuid, text, text, jsonb) TO authenticated;


GRANT
execute ON function public.confirm_leave_request_ocr (uuid, jsonb) TO authenticated;


GRANT
execute ON function public.add_leave_request_evidence (uuid, text, text, text, integer) TO authenticated;


GRANT
execute ON function public.remove_leave_request_evidence (uuid) TO authenticated;


GRANT
execute ON function public.submit_leave_request (uuid) TO authenticated;


GRANT
execute ON function public.request_leave_revision (uuid, text) TO authenticated;


GRANT
execute ON function public.complete_leave_forwarding (uuid, uuid[], text, text, text, text, text) TO authenticated;

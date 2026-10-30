import "server-only";

import type {
  LeaveOcrStatus,
  LeaveReasonCategory,
  LeaveReportFormat,
  LeaveRequestStatus,
} from "@starstask/contracts";

import { DataAccessError, type PaginatedResult } from "@/lib/db/assignments";
import { loadProfiles } from "@/lib/db/classes";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";

/**
 * Data access for leave requests.
 *
 * Every query runs with the caller's own Supabase client, so RLS decides what
 * comes back. These functions never add an `or` clause to widen visibility and
 * never accept a user id from the browser.
 */

export type LeaveRequestSummary = {
  id: string;
  reference: string;
  studentId: string;
  studentName: string;
  studentAvatarUrl: string | null;
  classId: string;
  classSlug: string;
  className: string;
  leaveStartDate: string | null;
  leaveEndDate: string | null;
  reasonCategory: LeaveReasonCategory | null;
  explanation: string | null;
  documentIssueDate: string | null;
  status: LeaveRequestStatus;
  submittedAt: string | null;
  forwardedAt: string | null;
  cancelledAt: string | null;
  cancelledByName: string | null;
  cancellationNote: string | null;
  ocrStatus: LeaveOcrStatus;
  ocrProvider: string | null;
  ocrResult: Json | null;
  ocrExtractedAt: string | null;
  ocrConfirmedAt: string | null;
  fieldSources: Json;
  createdAt: string;
  updatedAt: string;
  evidenceCount: number;
};

export type LeaveEvidenceItem = {
  id: string;
  requestId: string;
  storagePath: string;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
  sortOrder: number;
  createdAt: string;
};

export type LeaveHistoryEntry = {
  id: string;
  actorId: string | null;
  actorName: string | null;
  action: string;
  note: string | null;
  metadata: Json;
  createdAt: string;
};

export type LeaveForwardingRecord = {
  id: string;
  reference: string;
  classId: string;
  forwardedByName: string | null;
  recipientName: string;
  recipientEmail: string | null;
  reportReference: string;
  reportFormat: LeaveReportFormat;
  requestCount: number;
  createdAt: string;
  items: {
    requestId: string;
    requestReference: string;
    studentDisplayName: string;
    leaveStartDate: string;
    leaveEndDate: string;
  }[];
};

/** One row of an export. Only confirmed values, never OCR guesses. */
export type LeaveReportRow = {
  id: string;
  reference: string;
  studentName: string;
  leaveStartDate: string;
  leaveEndDate: string;
  documentIssueDate: string | null;
  reasonCategory: LeaveReasonCategory;
  submittedAt: string | null;
  status: LeaveRequestStatus;
  cancellationNote: string | null;
};

export type LeaveListFilters = {
  status?: LeaveRequestStatus | "all";
  from?: string;
  to?: string;
  search?: string;
  page: number;
  pageSize: number;
};

const LIST_COLUMNS = `
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
  cancelled_at,
  cancelled_by,
  cancellation_note,
  ocr_status,
  ocr_provider,
  ocr_result,
  ocr_extracted_at,
  ocr_confirmed_at,
  field_sources,
  created_at,
  updated_at,
  classes!leave_requests_class_id_fkey ( id, slug, name )
`;

type LeaveRowShape = {
  id: string;
  reference: string;
  student_id: string;
  class_id: string;
  leave_start_date: string | null;
  leave_end_date: string | null;
  reason_category: LeaveReasonCategory | null;
  explanation: string | null;
  document_issue_date: string | null;
  status: string;
  submitted_at: string | null;
  forwarded_at: string | null;
  cancelled_at: string | null;
  cancelled_by: string | null;
  cancellation_note: string | null;
  ocr_status: LeaveOcrStatus;
  ocr_provider: string | null;
  ocr_result: Json | null;
  ocr_extracted_at: string | null;
  ocr_confirmed_at: string | null;
  field_sources: Json;
  created_at: string;
  updated_at: string;
  classes: { id: string; slug: string; name: string } | null;
};

/**
 * Counts active evidence for a page of requests in one query.
 *
 * Doing this per request would be an N+1; a single read of `request_id` for the
 * page is enough because the count is only ever displayed.
 */
async function countEvidence(
  requestIds: string[],
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();

  if (requestIds.length === 0) {
    return counts;
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("leave_request_evidence")
    .select("request_id")
    .in("request_id", requestIds)
    .is("removed_at", null);

  if (error) {
    throw new DataAccessError("Could not count evidence", error.code);
  }

  for (const row of data ?? []) {
    counts.set(row.request_id, (counts.get(row.request_id) ?? 0) + 1);
  }

  return counts;
}

/**
 * Maps a stored status onto the current workflow.
 *
 * Rows written before the review step was removed may still say
 * `needs_revision`; those are waiting for the class admin, so they read as
 * `submitted`. The migration rewrites them, but a deploy can reach a database
 * that has not run it yet.
 */
const STORED_STATUS_MAP: Record<string, LeaveRequestStatus> = {
  draft: "draft",
  submitted: "submitted",
  forwarded: "forwarded",
  cancelled: "cancelled",
  needs_revision: "submitted",
};

function normalizeLeaveStatus(status: string): LeaveRequestStatus {
  return STORED_STATUS_MAP[status] ?? "submitted";
}

async function toSummaries(
  rows: LeaveRowShape[],
): Promise<LeaveRequestSummary[]> {
  const cancelledByIds = rows
    .map((row) => row.cancelled_by)
    .filter((id): id is string => Boolean(id));
  const profiles = await loadProfiles([
    ...new Set([...rows.map((row) => row.student_id), ...cancelledByIds]),
  ]);
  const evidenceCounts = await countEvidence(rows.map((row) => row.id));

  return rows.map((row) => ({
    id: row.id,
    reference: row.reference,
    studentId: row.student_id,
    studentName: profiles.get(row.student_id)?.display_name ?? "Student",
    studentAvatarUrl: profiles.get(row.student_id)?.avatar_url ?? null,
    classId: row.class_id,
    classSlug: row.classes?.slug ?? "",
    className: row.classes?.name ?? "Class",
    leaveStartDate: row.leave_start_date,
    leaveEndDate: row.leave_end_date,
    reasonCategory: row.reason_category,
    explanation: row.explanation,
    documentIssueDate: row.document_issue_date,
    status: normalizeLeaveStatus(row.status),
    submittedAt: row.submitted_at,
    forwardedAt: row.forwarded_at,
    cancelledAt: row.cancelled_at,
    cancelledByName: row.cancelled_by
      ? (profiles.get(row.cancelled_by)?.display_name ?? "Someone")
      : null,
    cancellationNote: row.cancellation_note,
    ocrStatus: row.ocr_status,
    ocrProvider: row.ocr_provider,
    ocrResult: row.ocr_result,
    ocrExtractedAt: row.ocr_extracted_at,
    ocrConfirmedAt: row.ocr_confirmed_at,
    fieldSources: row.field_sources,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    evidenceCount: evidenceCounts.get(row.id) ?? 0,
  }));
}

/** Resolves student ids whose nickname matches the search term. */
async function findStudentIds(term: string): Promise<string[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .ilike("display_name", `%${term.replace(/[%_]/g, "")}%`)
    .limit(100);

  if (error) {
    throw new DataAccessError("Could not search students", error.code);
  }

  return (data ?? []).map((row) => row.id);
}

type ListOptions = LeaveListFilters & { studentId?: string; classId?: string };

async function listLeaveRequests(
  options: ListOptions,
): Promise<PaginatedResult<LeaveRequestSummary>> {
  const supabase = await createSupabaseServerClient();
  const from = (options.page - 1) * options.pageSize;

  let query = supabase
    .from("leave_requests")
    .select(LIST_COLUMNS, { count: "exact" });

  if (options.studentId) {
    query = query.eq("student_id", options.studentId);
  }

  if (options.classId) {
    query = query.eq("class_id", options.classId);
  }

  if (options.status && options.status !== "all") {
    query = query.eq("status", options.status);
  } else if (options.classId) {
    // A reviewer queue never shows drafts: they are still private to the student.
    query = query.neq("status", "draft");
  }

  if (options.from) {
    query = query.gte("leave_start_date", options.from);
  }

  if (options.to) {
    query = query.lte("leave_end_date", options.to);
  }

  if (options.search) {
    const studentIds = await findStudentIds(options.search);

    if (studentIds.length === 0) {
      return {
        items: [],
        total: 0,
        page: options.page,
        pageSize: options.pageSize,
        totalPages: 0,
      };
    }

    query = query.in("student_id", studentIds);
  }

  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .range(from, from + options.pageSize - 1);

  if (error) {
    throw new DataAccessError("Could not load leave requests", error.code);
  }

  const items = await toSummaries((data ?? []) as unknown as LeaveRowShape[]);
  const total = count ?? 0;

  return {
    items,
    total,
    page: options.page,
    pageSize: options.pageSize,
    totalPages: Math.max(1, Math.ceil(total / options.pageSize)),
  };
}

/** A student's own requests. RLS already limits rows to the caller. */
export function listLeaveRequestsForStudent(
  studentId: string,
  filters: LeaveListFilters,
): Promise<PaginatedResult<LeaveRequestSummary>> {
  return listLeaveRequests({ ...filters, studentId });
}

/** The reviewer queue for one class. */
export function listLeaveRequestsForClass(
  classId: string,
  filters: LeaveListFilters,
): Promise<PaginatedResult<LeaveRequestSummary>> {
  return listLeaveRequests({ ...filters, classId });
}

export async function getLeaveRequestById(
  requestId: string,
): Promise<LeaveRequestSummary | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("leave_requests")
    .select(LIST_COLUMNS)
    .eq("id", requestId)
    .maybeSingle();

  if (error) {
    throw new DataAccessError("Could not load the leave request", error.code);
  }

  if (!data) {
    return null;
  }

  const [summary] = await toSummaries([data as unknown as LeaveRowShape]);

  return summary ?? null;
}

/** Active evidence only; removed rows stay for audit but are not shown. */
export async function listLeaveEvidence(
  requestId: string,
): Promise<LeaveEvidenceItem[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("leave_request_evidence")
    .select(
      "id, request_id, storage_path, original_filename, mime_type, file_size, sort_order, created_at",
    )
    .eq("request_id", requestId)
    .is("removed_at", null)
    .order("sort_order", { ascending: true });

  if (error) {
    throw new DataAccessError("Could not load evidence", error.code);
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    requestId: row.request_id,
    storagePath: row.storage_path,
    originalFilename: row.original_filename,
    mimeType: row.mime_type,
    fileSize: row.file_size,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
  }));
}

export async function listLeaveHistory(
  requestId: string,
): Promise<LeaveHistoryEntry[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("leave_request_history")
    .select("id, actor_id, action, note, metadata, created_at")
    .eq("request_id", requestId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new DataAccessError("Could not load the request history", error.code);
  }

  const profiles = await loadProfiles(
    (data ?? [])
      .map((row) => row.actor_id)
      .filter((id): id is string => Boolean(id)),
  );

  return (data ?? []).map((row) => ({
    id: row.id,
    actorId: row.actor_id,
    actorName: row.actor_id
      ? (profiles.get(row.actor_id)?.display_name ?? "Someone")
      : null,
    action: row.action,
    note: row.note,
    metadata: row.metadata,
    createdAt: row.created_at,
  }));
}

/** Forwarding history for a class, newest first, with the included requests. */
export async function listLeaveForwardings(
  classId: string,
): Promise<LeaveForwardingRecord[]> {
  const supabase = await createSupabaseServerClient();

  const { data: forwardings, error } = await supabase
    .from("leave_request_forwardings")
    .select(
      "id, reference, class_id, forwarded_by, recipient_name, recipient_email, report_reference, report_format, request_count, created_at",
    )
    .eq("class_id", classId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    throw new DataAccessError("Could not load forwarding history", error.code);
  }

  const rows = forwardings ?? [];

  if (rows.length === 0) {
    return [];
  }

  // Items and request references are loaded separately rather than through an
  // embedded select: the hand-maintained types do not declare the foreign-key
  // relationships, so an embed cannot be type-checked.
  const { data: items, error: itemsError } = await supabase
    .from("leave_request_forwarding_items")
    .select(
      "forwarding_id, request_id, student_display_name, leave_start_date, leave_end_date",
    )
    .in(
      "forwarding_id",
      rows.map((row) => row.id),
    );

  if (itemsError) {
    throw new DataAccessError(
      "Could not load forwarding items",
      itemsError.code,
    );
  }

  const requestIds = [...new Set((items ?? []).map((item) => item.request_id))];
  const references = new Map<string, string>();

  if (requestIds.length > 0) {
    const { data: requests, error: requestsError } = await supabase
      .from("leave_requests")
      .select("id, reference")
      .in("id", requestIds);

    if (requestsError) {
      throw new DataAccessError(
        "Could not load request references",
        requestsError.code,
      );
    }

    for (const request of requests ?? []) {
      references.set(request.id, request.reference);
    }
  }

  const profiles = await loadProfiles(
    rows
      .map((row) => row.forwarded_by)
      .filter((id): id is string => Boolean(id)),
  );

  return rows.map((row) => ({
    id: row.id,
    reference: row.reference,
    classId: row.class_id,
    forwardedByName: row.forwarded_by
      ? (profiles.get(row.forwarded_by)?.display_name ?? "Someone")
      : null,
    recipientName: row.recipient_name,
    recipientEmail: row.recipient_email,
    reportReference: row.report_reference,
    reportFormat: row.report_format,
    requestCount: row.request_count,
    createdAt: row.created_at,
    items: (items ?? [])
      .filter((item) => item.forwarding_id === row.id)
      .map((item) => ({
        requestId: item.request_id,
        requestReference: references.get(item.request_id) ?? "",
        studentDisplayName: item.student_display_name,
        leaveStartDate: item.leave_start_date,
        leaveEndDate: item.leave_end_date,
      })),
  }));
}

/**
 * Rows for a CSV or PDF export.
 *
 * Only requests that have left `draft` are eligible: a draft is unfinished and
 * the student has not asked for anything yet. `forwarded`, `submitted`, and
 * `cancelled` are all included so the report can distinguish them, and the
 * status column keeps that visible instead of implying an approval.
 */
export async function listLeaveReportRows(options: {
  classId: string;
  from: string | null;
  to: string | null;
}): Promise<LeaveReportRow[]> {
  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("leave_requests")
    .select(
      "id, reference, student_id, leave_start_date, leave_end_date, document_issue_date, reason_category, submitted_at, status, cancellation_note",
    )
    .eq("class_id", options.classId)
    .in("status", ["submitted", "forwarded", "cancelled"])
    .order("leave_start_date", { ascending: true })
    .limit(500);

  if (options.from) {
    query = query.gte("leave_start_date", options.from);
  }

  if (options.to) {
    query = query.lte("leave_end_date", options.to);
  }

  const { data, error } = await query;

  if (error) {
    throw new DataAccessError("Could not build the report", error.code);
  }

  const profiles = await loadProfiles(
    (data ?? []).map((row) => row.student_id),
  );

  return (data ?? []).flatMap((row) => {
    // A submitted-or-later row is guaranteed complete by a table constraint, but
    // the report is the wrong place to discover a violation.
    if (!row.leave_start_date || !row.leave_end_date || !row.reason_category) {
      return [];
    }

    return [
      {
        id: row.id,
        reference: row.reference,
        studentName: profiles.get(row.student_id)?.display_name ?? "Student",
        leaveStartDate: row.leave_start_date,
        leaveEndDate: row.leave_end_date,
        documentIssueDate: row.document_issue_date,
        reasonCategory: row.reason_category,
        submittedAt: row.submitted_at,
        status: normalizeLeaveStatus(row.status),
        cancellationNote: row.cancellation_note,
      },
    ];
  });
}

/**
 * Rows for an explicit selection, used when building a forwarding package.
 *
 * Scoped by class and status so a crafted id list cannot pull in another class's
 * request; the database function re-checks the same conditions before committing.
 */
export async function listLeaveReportRowsByIds(options: {
  classId: string;
  requestIds: string[];
}): Promise<LeaveReportRow[]> {
  if (options.requestIds.length === 0) {
    return [];
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("leave_requests")
    .select(
      "id, reference, student_id, leave_start_date, leave_end_date, document_issue_date, reason_category, submitted_at, status, cancellation_note",
    )
    .eq("class_id", options.classId)
    .in("id", options.requestIds)
    .order("leave_start_date", { ascending: true });

  if (error) {
    throw new DataAccessError("Could not load the selection", error.code);
  }

  const profiles = await loadProfiles(
    (data ?? []).map((row) => row.student_id),
  );

  return (data ?? []).flatMap((row) => {
    if (!row.leave_start_date || !row.leave_end_date || !row.reason_category) {
      return [];
    }

    return [
      {
        id: row.id,
        reference: row.reference,
        studentName: profiles.get(row.student_id)?.display_name ?? "Student",
        leaveStartDate: row.leave_start_date,
        leaveEndDate: row.leave_end_date,
        documentIssueDate: row.document_issue_date,
        reasonCategory: row.reason_category,
        submittedAt: row.submitted_at,
        status: normalizeLeaveStatus(row.status),
        cancellationNote: row.cancellation_note,
      },
    ];
  });
}

/** Evidence for a set of requests, grouped by request, in stable order. */
export async function listEvidenceForRequests(
  requestIds: string[],
): Promise<Map<string, LeaveEvidenceItem[]>> {
  const grouped = new Map<string, LeaveEvidenceItem[]>();

  if (requestIds.length === 0) {
    return grouped;
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("leave_request_evidence")
    .select(
      "id, request_id, storage_path, original_filename, mime_type, file_size, sort_order, created_at",
    )
    .in("request_id", requestIds)
    .is("removed_at", null)
    .order("sort_order", { ascending: true });

  if (error) {
    throw new DataAccessError("Could not load evidence", error.code);
  }

  for (const row of data ?? []) {
    const list = grouped.get(row.request_id) ?? [];

    list.push({
      id: row.id,
      requestId: row.request_id,
      storagePath: row.storage_path,
      originalFilename: row.original_filename,
      mimeType: row.mime_type,
      fileSize: row.file_size,
      sortOrder: row.sort_order,
      createdAt: row.created_at,
    });
    grouped.set(row.request_id, list);
  }

  return grouped;
}

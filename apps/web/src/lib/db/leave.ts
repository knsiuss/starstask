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
  /** Courses the absence covers. Empty means the whole class. */
  subjectIds: string[];
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
  subject_ids,
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
  subject_ids: string[];
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
  approved: "approved",
  rejected: "rejected",
  revision_requested: "revision_requested",
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
    subjectIds: row.subject_ids ?? [],
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

  // The generated DB types predate `revision_requested`; the cast keeps the
  // request contracts as the source of truth until types are regenerated after
  // the migration is applied. The value is passed through unchanged.
  if (options.status && options.status !== "all") {
    query = query.eq("status", options.status as "submitted");
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
    const term = options.search.replace(/[%_]/g, "");

    if (options.studentId) {
      // A student's own search matches their reference numbers; the
      // nickname lookup below is for reviewer queues.
      query = query.ilike("reference", `%${term}%`);
    } else {
      const studentIds = await findStudentIds(term);

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

/** Requests still waiting for a class admin's decision. */
export async function countPendingLeaveRequests(
  studentId: string,
): Promise<number> {
  const supabase = await createSupabaseServerClient();
  const { count, error } = await supabase
    .from("leave_requests")
    .select("id", { count: "exact", head: true })
    .eq("student_id", studentId)
    .eq("status", "submitted");

  if (error) {
    throw new DataAccessError("Could not count pending absences", error.code);
  }

  return count ?? 0;
}

export type LeaveRequestStatusCounts = Pick<
  Record<LeaveRequestStatus, number>,
  "submitted" | "approved" | "rejected" | "draft"
>;

/** Headline counts for the student's own requests, per status. */
export async function countLeaveRequestsByStatus(
  studentId: string,
): Promise<LeaveRequestStatusCounts> {
  const statuses = ["submitted", "approved", "rejected", "draft"] as const;
  const supabase = await createSupabaseServerClient();

  const results = await Promise.all(
    statuses.map((status) =>
      supabase
        .from("leave_requests")
        .select("id", { count: "exact", head: true })
        .eq("student_id", studentId)
        .eq("status", status),
    ),
  );

  const counts = {} as LeaveRequestStatusCounts;

  for (const [index, result] of results.entries()) {
    if (result.error) {
      throw new DataAccessError("Could not count absences", result.error.code);
    }

    const status = statuses[index];

    if (!status) {
      continue;
    }

    counts[status] = result.count ?? 0;
  }

  return counts;
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
 * the student has not asked for anything yet. Every status after `draft` is
 * included so the report can distinguish them, and the status column keeps a
 * decision separate from a forwarding hand-off.
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
    .in("status", [
      "submitted",
      "approved",
      "rejected",
      "forwarded",
      "cancelled",
    ])
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

export type ManagedLeaveListOptions = {
  classId?: string;
  subjectId?: string;
  status?: LeaveRequestStatus | "all";
  from?: string;
  to?: string;
  search?: string;
  sort?: "newest" | "oldest" | "upcoming";
  page: number;
  pageSize: number;
};

/**
 * Cross-class reviewer queue for the Action Center absence tab.
 *
 * Scoped to the managed class ids only; the query never widens beyond them and
 * never includes drafts. Empty managed list returns an empty page without
 * querying, so a non-admin caller sees nothing rather than an error.
 */
export async function listManagedLeaveRequests(
  managedClassIds: string[],
  options: ManagedLeaveListOptions,
): Promise<PaginatedResult<LeaveRequestSummary>> {
  const emptyPage = {
    items: [],
    total: 0,
    page: options.page,
    pageSize: options.pageSize,
    totalPages: 1,
  } as PaginatedResult<LeaveRequestSummary>;

  if (managedClassIds.length === 0) {
    return emptyPage;
  }

  const supabase = await createSupabaseServerClient();
  const from = (options.page - 1) * options.pageSize;

  let query = supabase
    .from("leave_requests")
    .select(LIST_COLUMNS, { count: "exact" })
    .in("class_id", managedClassIds)
    .neq("status", "draft");

  if (options.classId && managedClassIds.includes(options.classId)) {
    query = query.eq("class_id", options.classId);
  }

  // Covered-course filter. An empty `subject_ids` means the request covers the
  // whole class, so it stays visible under no course filter; once a course is
  // picked, only requests that explicitly cover it match.
  if (options.subjectId) {
    query = query.contains("subject_ids", [options.subjectId]);
  }

  if (options.status && options.status !== "all") {
    query = query.eq("status", options.status as "submitted");
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
      return emptyPage;
    }

    query = query.in("student_id", studentIds);
  }

  // Sort maps to a server column; "upcoming" is the soonest absence start that
  // is still ahead of today, approximated by leave_start_date ascending with
  // nulls last (Postgres puts nulls last by default for ascending).
  if (options.sort === "oldest") {
    query = query.order("created_at", { ascending: true });
  } else if (options.sort === "upcoming") {
    query = query.order("leave_start_date", { ascending: true });
  } else {
    query = query.order("created_at", { ascending: false });
  }

  const { data, error, count } = await query.range(
    from,
    from + options.pageSize - 1,
  );

  if (error) {
    throw new DataAccessError("Could not load absence requests", error.code);
  }

  return {
    items: await toSummaries((data ?? []) as unknown as LeaveRowShape[]),
    total: count ?? 0,
    page: options.page,
    pageSize: options.pageSize,
    totalPages: Math.max(1, Math.ceil((count ?? 0) / options.pageSize)),
  };
}

export type AffectedSession = {
  id: string;
  subjectId: string | null;
  courseName: string;
  courseCode: string | null;
  meetingNumber: number | null;
  meetingDate: string | null;
  title: string;
  startsAt: string;
  endsAt: string;
  status: string;
};

/**
 * Sessions the absence actually covers, derived server-side from the request's
 * class, date range, and covered courses.
 *
 * This mirrors the attendance consequence of approval (`review_leave_request`):
 * sessions in the class within the Jakarta date range, starting after the
 * student joined, skipping cancelled ones, filtered to the covered courses
 * when the request names them. Meeting numbers are per course, so callers must
 * group by course rather than assuming one number means one date.
 */
export async function listAffectedSessions(
  request: LeaveRequestSummary,
): Promise<AffectedSession[]> {
  if (!request.leaveStartDate || !request.leaveEndDate) {
    return [];
  }

  const supabase = await createSupabaseServerClient();

  const { data: membership, error: membershipError } = await supabase
    .from("class_members")
    .select("joined_at")
    .eq("class_id", request.classId)
    .eq("user_id", request.studentId)
    .maybeSingle();

  if (membershipError) {
    throw new DataAccessError(
      "Could not load class membership",
      membershipError.code,
    );
  }

  const joinedAt = membership?.joined_at ?? null;

  let query = supabase
    .from("discussion_sessions")
    .select(
      "id, subject_id, meeting_number, meeting_date, title, starts_at, ends_at, status",
    )
    .eq("class_id", request.classId)
    .neq("status", "cancelled")
    .order("starts_at", { ascending: true })
    .limit(500);

  if (request.subjectIds.length > 0) {
    query = query.in("subject_id", request.subjectIds);
  }

  if (joinedAt) {
    query = query.gte("starts_at", joinedAt);
  }

  const { data, error } = await query;

  if (error) {
    throw new DataAccessError("Could not load affected sessions", error.code);
  }

  // Date-window check happens in code because the Jakarta calendar date of a
  // timestamptz cannot be expressed as a simple gte/lte filter on starts_at.
  return (data ?? []).flatMap((row) => {
    const startDate = jakartaDateKey(row.starts_at);

    if (
      startDate < request.leaveStartDate! ||
      startDate > request.leaveEndDate!
    ) {
      return [];
    }

    return [
      {
        id: row.id,
        subjectId: row.subject_id,
        courseName: "",
        courseCode: null,
        meetingNumber: row.meeting_number,
        meetingDate: row.meeting_date,
        title: row.title,
        startsAt: row.starts_at,
        endsAt: row.ends_at,
        status: row.status,
      },
    ];
  });
}

/**
 * Fills in course names/codes for affected sessions from the class catalog.
 */
export async function enrichAffectedSessions(
  classId: string,
  sessions: AffectedSession[],
): Promise<AffectedSession[]> {
  const subjectIds = [
    ...new Set(
      sessions
        .map((session) => session.subjectId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  if (subjectIds.length === 0) {
    return sessions;
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("class_subjects")
    .select("id, name, code")
    .eq("class_id", classId)
    .in("id", subjectIds);

  if (error) {
    throw new DataAccessError("Could not load courses", error.code);
  }

  const catalog = new Map(
    (data ?? []).map((row) => [row.id, { name: row.name, code: row.code }]),
  );

  return sessions.map((session) => {
    const course = session.subjectId
      ? catalog.get(session.subjectId)
      : undefined;

    return {
      ...session,
      courseName: course?.name ?? "Whole class",
      courseCode: course?.code ?? null,
    };
  });
}

function jakartaDateKey(timestamp: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(timestamp));
}

/**
 * Count of requests returned for revision across the managed classes.
 *
 * Used by the Action Center summary cards next to the pending counts, so the
 * number always comes from the same rows the absence tab lists.
 */
export async function countRevisionLeaveRequests(
  managedClassIds: string[],
): Promise<number> {
  if (managedClassIds.length === 0) {
    return 0;
  }

  const supabase = await createSupabaseServerClient();
  const { count, error } = await supabase
    .from("leave_requests")
    .select("id", { count: "exact", head: true })
    .in("class_id", managedClassIds)
    // Generated DB types are regenerated after the revision migration is
    // applied; the cast passes the new status through unchanged.
    .eq("status", "revision_requested" as "submitted");

  if (error) {
    throw new DataAccessError("Could not count revision requests", error.code);
  }

  return count ?? 0;
}

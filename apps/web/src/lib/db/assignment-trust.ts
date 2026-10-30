import "server-only";

import type {
  AssignmentReportCreateInput,
  AssignmentReportReason,
  AssignmentReportReviewInput,
  AssignmentReportStatus,
} from "@starstask/contracts";

import { DataAccessError } from "@/lib/db/assignments";
import { loadProfiles } from "@/lib/db/classes";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";

export type AssignmentReport = {
  id: string;
  assignmentId: string;
  assignmentTitle: string;
  classId: string;
  className: string;
  classSlug: string;
  reporterId: string;
  reporterName: string;
  reason: AssignmentReportReason;
  note: string | null;
  status: AssignmentReportStatus;
  resolvedAt: string | null;
  resolutionNote: string | null;
  createdAt: string;
};

export type AssignmentReportQueue = {
  items: AssignmentReport[];
  openCount: number;
};

export type AssignmentRevisionSnapshot = {
  title: string | null;
  description: string | null;
  deadline: string | null;
  status: string | null;
  course_id: string | null;
};

export type AssignmentRevision = {
  id: string;
  revision: number;
  changeKind: "created" | "updated" | "moderated";
  changedFields: string[];
  snapshot: AssignmentRevisionSnapshot;
  editorName: string;
  createdAt: string;
};

export type MyAssignmentReport = {
  id: string;
  reason: AssignmentReportReason;
  status: AssignmentReportStatus;
  note: string | null;
  resolutionNote: string | null;
  createdAt: string;
  resolvedAt: string | null;
};

const REPORT_QUEUE_LIMIT = 100;

function readSnapshot(value: Json): AssignmentRevisionSnapshot {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
      title: null,
      description: null,
      deadline: null,
      status: null,
      course_id: null,
    };
  }

  const record = value as Record<string, Json | undefined>;
  const readString = (key: string) => {
    const field = record[key];

    return typeof field === "string" ? field : null;
  };

  return {
    title: readString("title"),
    description: readString("description"),
    deadline: readString("deadline"),
    status: readString("status"),
    course_id: readString("course_id"),
  };
}

/**
 * Files a report for the signed-in reader.
 *
 * The database function re-checks that the assignment is published and that
 * the caller is signed in, so a forged request cannot report a draft.
 */
export async function createAssignmentReport(
  assignmentId: string,
  input: AssignmentReportCreateInput,
): Promise<string> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("report_assignment", {
    p_assignment_id: assignmentId,
    p_reason: input.reason,
    p_note: input.note ?? null,
  });

  if (error || !data) {
    throw new DataAccessError("Could not file this report", error?.code);
  }

  return data;
}

/**
 * Review queue for platform admins.
 *
 * RLS already limits rows to classes the caller manages; the explicit status
 * filter is what turns the table into a queue.
 */ export async function listAssignmentReports(
  status: AssignmentReportStatus | "all" = "open",
): Promise<AssignmentReportQueue> {
  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("assignment_reports")
    .select(
      "id, assignment_id, class_id, reporter_id, reason, note, status, resolved_at, resolution_note, created_at, assignments!assignment_reports_assignment_id_fkey ( title ), classes!assignment_reports_class_id_fkey ( name, slug )",
    )
    .order("created_at", { ascending: false })
    .limit(REPORT_QUEUE_LIMIT);

  if (status !== "all") {
    query = query.eq("status", status);
  }

  const [reportsResult, openCountResult] = await Promise.all([
    query,
    supabase
      .from("assignment_reports")
      .select("id", { count: "exact", head: true })
      .eq("status", "open"),
  ]);

  if (reportsResult.error) {
    throw new DataAccessError(
      "Could not load the report queue",
      reportsResult.error.code,
    );
  }

  if (openCountResult.error) {
    throw new DataAccessError(
      "Could not count open reports",
      openCountResult.error.code,
    );
  }

  const rows = reportsResult.data ?? [];
  const profiles = await loadProfiles(rows.map((row) => row.reporter_id));

  return {
    items: rows.map((row) => ({
      id: row.id,
      assignmentId: row.assignment_id,
      assignmentTitle: row.assignments?.title ?? "Deleted assignment",
      classId: row.class_id,
      className: row.classes?.name ?? "Unknown class",
      classSlug: row.classes?.slug ?? "",
      reporterId: row.reporter_id,
      reporterName:
        profiles.get(row.reporter_id)?.display_name ?? "StarsTask member",
      reason: row.reason,
      note: row.note,
      status: row.status,
      resolvedAt: row.resolved_at,
      resolutionNote: row.resolution_note,
      createdAt: row.created_at,
    })),
    openCount: openCountResult.count ?? 0,
  };
}

/**
 * Closes an open report. The database function enforces class-admin or
 * platform-admin access and refuses to re-review a closed report.
 */
export async function reviewAssignmentReport(
  reportId: string,
  input: AssignmentReportReviewInput,
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("review_assignment_report", {
    p_report_id: reportId,
    p_status: input.status,
    p_note: input.note ?? null,
  });

  if (error) {
    throw new DataAccessError("Could not update this report", error.code);
  }
}

/** Newest first. Returns an empty list when the caller cannot see history. */
export async function listAssignmentRevisions(
  assignmentId: string,
): Promise<AssignmentRevision[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("assignment_revisions")
    .select(
      "id, editor_id, revision, change_kind, snapshot, changed_fields, created_at",
    )
    .eq("assignment_id", assignmentId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    throw new DataAccessError(
      "Could not load the revision history",
      error.code,
    );
  }

  const rows = data ?? [];
  const editorIds = rows.flatMap((row) =>
    row.editor_id ? [row.editor_id] : [],
  );
  const profiles = await loadProfiles(editorIds);

  return rows.map((row) => ({
    id: row.id,
    revision: row.revision,
    changeKind: row.change_kind,
    changedFields: row.changed_fields,
    snapshot: readSnapshot(row.snapshot),
    editorName: row.editor_id
      ? (profiles.get(row.editor_id)?.display_name ?? "StarsTask member")
      : "System",
    createdAt: row.created_at,
  }));
}

/**
 * The caller's latest report for one assignment.
 *
 * RLS already limits the rows to reports the caller filed, so the explicit
 * reporter filter only makes the intent readable. Returns null when the reader
 * has never reported this brief.
 */
export async function getMyAssignmentReport(
  assignmentId: string,
  reporterId: string,
): Promise<MyAssignmentReport | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("assignment_reports")
    .select(
      "id, reason, status, note, resolution_note, created_at, resolved_at",
    )
    .eq("assignment_id", assignmentId)
    .eq("reporter_id", reporterId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new DataAccessError("Could not load your report", error.code);
  }

  if (!data) {
    return null;
  }

  return {
    id: data.id,
    reason: data.reason,
    status: data.status,
    note: data.note,
    resolutionNote: data.resolution_note,
    createdAt: data.created_at,
    resolvedAt: data.resolved_at,
  };
}

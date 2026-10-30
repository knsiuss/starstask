import "server-only";

import type { LeaveReportFormat } from "@starstask/contracts";

import { ApiError, forbidden, notFound } from "@/lib/api/errors";
import { getSessionUser } from "@/lib/auth/session";
import { getClassBySlug, getClassRole } from "@/lib/db/classes";
import {
  listEvidenceForRequests,
  listLeaveReportRowsByIds,
  type LeaveReportRow,
} from "@/lib/db/leave";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { toLeaveApiError } from "@/features/leave/errors";
import { downloadEvidenceBytes } from "@/features/leave/evidence-service";
import {
  buildCompletePdf,
  buildSummaryPdf,
  reportFilename,
  type EvidenceSource,
  type MissingAttachment,
  type ReportClassInfo,
  type ReportInput,
} from "@/features/leave/reports/pdf";

export type ForwardingResult = {
  forwardingId: string;
  forwardingReference: string;
  requestCount: number;
  filename: string;
  bytes: Uint8Array;
  missing: MissingAttachment[];
};

/**
 * Builds the package, then commits the forwarding record.
 *
 * The order is the whole point: the PDF is generated first, and the database
 * function is called only once bytes exist. If generation throws, nothing is
 * recorded and no request moves to `forwarded`. If the function throws, the same
 * is true — the caller gets an error and the requests stay `submitted`.
 *
 * The response returns the bytes for immediate download. StarsTask does not
 * claim the report was emailed or that the lecturer received it.
 */
export async function forwardLeaveRequests(options: {
  classSlug: string;
  requestIds: string[];
  recipientName: string;
  recipientEmail: string | null;
  reportFormat: LeaveReportFormat;
  idempotencyKey: string;
}): Promise<ForwardingResult> {
  const session = await getSessionUser();

  if (!session) {
    throw new ApiError(401, "unauthorized", "Sign in to continue.");
  }

  const classRecord = await getClassBySlug(options.classSlug);

  if (!classRecord) {
    throw notFound();
  }

  const role = await getClassRole(classRecord.id);

  if (!role.canManage) {
    throw forbidden();
  }

  const rows = await listLeaveReportRowsByIds({
    classId: classRecord.id,
    requestIds: options.requestIds,
  });

  if (rows.length !== options.requestIds.length) {
    throw new ApiError(
      409,
      "not_eligible",
      "Every selected request must belong to this class and still exist.",
    );
  }

  const ineligible = rows.filter((row) => row.status !== "submitted");

  if (ineligible.length > 0) {
    throw new ApiError(
      409,
      "not_eligible",
      `These requests are not awaiting forwarding: ${ineligible
        .map((row) => row.reference)
        .join(", ")}.`,
    );
  }

  const classInfo: ReportClassInfo = {
    name: classRecord.name,
    slug: classRecord.slug,
    courseName: classRecord.course_name,
    semester: classRecord.semester,
    academicYear: classRecord.academic_year,
    lecturerName: classRecord.lecturer_name,
  };

  const reportInput: ReportInput = {
    classInfo,
    from: null,
    to: null,
    rows,
    generatedAt: new Date(),
    generatedBy: session.profile?.display_name ?? "A class admin",
  };

  const evidenceByRequest =
    options.reportFormat === "complete"
      ? await loadEvidence(rows)
      : new Map<string, EvidenceSource[]>();

  let bytes: Uint8Array;
  let missing: MissingAttachment[] = [];

  if (options.reportFormat === "complete") {
    const built = await buildCompletePdf(reportInput, evidenceByRequest, {
      load: downloadEvidenceBytes,
    });

    bytes = built.bytes;
    missing = built.missing;
  } else {
    bytes = await buildSummaryPdf(reportInput);
  }

  const filename = reportFilename(
    classRecord.slug,
    options.reportFormat,
    null,
    null,
  );

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("complete_leave_forwarding", {
    p_class_id: classRecord.id,
    p_request_ids: options.requestIds,
    p_recipient_name: options.recipientName,
    p_recipient_email: options.recipientEmail,
    p_report_reference: filename,
    p_report_format: options.reportFormat,
    p_idempotency_key: options.idempotencyKey,
  });

  if (error) {
    throw toLeaveApiError(error, "Could not record the forwarding.");
  }

  const record = data?.[0];

  if (!record) {
    throw new ApiError(
      500,
      "internal_error",
      "Could not record the forwarding.",
    );
  }

  return {
    forwardingId: record.id,
    forwardingReference: record.reference,
    requestCount: record.request_count,
    filename,
    bytes,
    missing,
  };
}

async function loadEvidence(
  rows: LeaveReportRow[],
): Promise<Map<string, EvidenceSource[]>> {
  const grouped = await listEvidenceForRequests(rows.map((row) => row.id));
  const mapped = new Map<string, EvidenceSource[]>();

  for (const [requestId, items] of grouped) {
    mapped.set(
      requestId,
      items.map((item) => ({
        requestId: item.requestId,
        storagePath: item.storagePath,
        originalFilename: item.originalFilename,
        mimeType: item.mimeType,
      })),
    );
  }

  return mapped;
}

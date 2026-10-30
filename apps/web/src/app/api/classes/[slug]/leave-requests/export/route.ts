import { isoDateSchema } from "@starstask/contracts";
import { CSV_MIME_TYPE } from "@starstask/shared";

import { ApiError, serviceUnavailable } from "@/lib/api/errors";
import { fileDownload, handleRouteError } from "@/lib/api/responses";
import { isSupabaseConfigured } from "@/lib/env/public";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { requireClassManager } from "@/features/classes/class-access";
import { listEvidenceForRequests, listLeaveReportRows } from "@/lib/db/leave";
import { buildLeaveCsv, leaveCsvFilename } from "@/features/leave/reports/csv";
import {
  buildCompletePdf,
  buildSummaryPdf,
  reportFilename,
  type EvidenceSource,
  type ReportClassInfo,
  type ReportInput,
} from "@/features/leave/reports/pdf";
import { buildLeaveZip } from "@/features/leave/reports/zip";
import { downloadEvidenceBytes } from "@/features/leave/evidence-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = { params: Promise<{ slug: string }> };

const PDF_MIME_TYPE = "application/pdf";
const ZIP_MIME_TYPE = "application/zip";

/** Parses an optional `YYYY-MM-DD` query value. */
function readDate(value: string | null, field: string): string | null {
  if (!value) {
    return null;
  }

  const parsed = isoDateSchema.safeParse(value);

  if (!parsed.success) {
    throw new ApiError(400, "invalid_input", `The ${field} date is not valid.`);
  }

  return parsed.data;
}

/**
 * Exports a class's absence requests as CSV, Summary PDF, Complete PDF, or ZIP.
 *
 * Every variant is scoped by the class the caller administers, and rows come
 * from `listLeaveReportRows`, which never returns drafts or another class's
 * requests. Evidence is only attached for requests already in the report.
 */
export async function GET(request: Request, context: RouteContext) {
  try {
    if (!isSupabaseConfigured()) {
      throw serviceUnavailable();
    }

    const { slug } = await context.params;
    const { session, class: classRecord } = await requireClassManager(slug);

    await enforceRateLimit({
      action: "leave-requests:export",
      identifier: session.user.id,
      limit: 20,
      windowSeconds: 60,
    });

    const url = new URL(request.url);
    const requestedFormat = url.searchParams.get("format") ?? "csv";
    const from = readDate(url.searchParams.get("from"), "from");
    const to = readDate(url.searchParams.get("to"), "to");

    const allowed = ["csv", "summary", "complete", "zip"] as const;
    const format = allowed.find((value) => value === requestedFormat);

    if (!format) {
      throw new ApiError(
        400,
        "invalid_input",
        "Choose csv, summary, complete, or zip.",
      );
    }

    const rows = await listLeaveReportRows({
      classId: classRecord.id,
      from,
      to,
    });

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
      from,
      to,
      rows,
      generatedAt: new Date(),
      generatedBy: session.profile?.display_name ?? "A class admin",
    };

    if (format === "csv") {
      return fileDownload(
        new TextEncoder().encode(buildLeaveCsv(rows, classInfo)),
        leaveCsvFilename(classRecord.slug, from, to),
        CSV_MIME_TYPE,
      );
    }

    if (format === "summary") {
      const bytes = await buildSummaryPdf(reportInput);

      return fileDownload(
        bytes,
        reportFilename(classRecord.slug, "summary", from, to),
        PDF_MIME_TYPE,
      );
    }

    const evidenceByRequest = await loadEvidence(rows.map((row) => row.id));

    if (format === "complete") {
      const built = await buildCompletePdf(reportInput, evidenceByRequest, {
        load: downloadEvidenceBytes,
      });

      // Missing attachments are listed inside the PDF, so the download still
      // succeeds and the reader can see exactly what was excluded.
      return fileDownload(
        built.bytes,
        reportFilename(classRecord.slug, "complete", from, to),
        PDF_MIME_TYPE,
      );
    }

    const summary = await buildSummaryPdf(reportInput);
    const built = await buildLeaveZip({
      summaryPdf: summary,
      rows,
      evidenceByRequest,
      load: downloadEvidenceBytes,
      manifestCsv: buildLeaveCsv(rows, classInfo),
    });

    return fileDownload(
      built.bytes,
      reportFilename(classRecord.slug, "summary", from, to).replace(
        /\.pdf$/,
        "-evidence.zip",
      ),
      ZIP_MIME_TYPE,
    );
  } catch (error) {
    return handleRouteError(error);
  }
}

async function loadEvidence(
  requestIds: string[],
): Promise<Map<string, EvidenceSource[]>> {
  const grouped = await listEvidenceForRequests(requestIds);
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

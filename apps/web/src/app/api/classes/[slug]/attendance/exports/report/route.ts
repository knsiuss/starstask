import { z } from "zod";

import { ApiError, notFound, serviceUnavailable } from "@/lib/api/errors";
import { fileDownload, handleRouteError } from "@/lib/api/responses";
import {
  getClassAttendanceRecap,
  getClassAttendanceSubject,
  listCorrectionAudit,
} from "@/lib/db/attendance-meetings";
import { isSupabaseConfigured } from "@/lib/env/public";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import type { AttendanceExportContext } from "@/features/attendance-meetings/excel";
import { buildAttendanceReportPdf } from "@/features/attendance-meetings/pdf";
import { resolveRecapYear } from "@/features/attendance-meetings/filenames";
import { logAttendanceExport } from "@/features/attendance-meetings/meeting-service";
import { requireClassManager } from "@/features/classes/class-access";

export const dynamic = "force-dynamic";

const PDF_MIME = "application/pdf";
const subjectIdSchema = z.uuid();

/** Formal PDF attendance report for one subject. */
export async function GET(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  try {
    if (!isSupabaseConfigured()) {
      throw serviceUnavailable();
    }

    const { slug } = await context.params;
    const { session, class: found } = await requireClassManager(slug);

    await enforceRateLimit({
      action: "attendance:exports:report",
      identifier: session.user.id,
      limit: 60,
      windowSeconds: 3_600,
    });

    const subjectId = new URL(request.url).searchParams.get("subjectId");
    const parsed = subjectIdSchema.safeParse(subjectId);

    if (!parsed.success) {
      throw new ApiError(400, "invalid_input", "Choose a subject to export.");
    }

    const subject = await getClassAttendanceSubject(found.id, parsed.data);

    if (!subject) {
      throw notFound();
    }

    const [recap, audits] = await Promise.all([
      getClassAttendanceRecap(found.id, subject.id),
      listCorrectionAudit(found.id, subject.id),
    ]);
    const generatedAt = new Date();
    const exportContext: AttendanceExportContext = {
      classInfo: found,
      subject: {
        ...subject,
        semester: found.semester,
        academicYear: found.academic_year,
      },
      generatedAt,
    };

    const bytes = await buildAttendanceReportPdf(
      recap,
      exportContext,
      audits,
    );
    const subjectToken = (subject.code ?? subject.name)
      .replace(/[^A-Za-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .toUpperCase();
    const filename = `StarsTask_Attendance_${subjectToken || "SUBJECT"}_${resolveRecapYear(found.academic_year, generatedAt)}.pdf`;

    await logAttendanceExport({
      classId: found.id,
      subjectId: subject.id,
      sessionId: null,
      kind: "report",
    });

    return fileDownload(bytes, filename, PDF_MIME);
  } catch (error) {
    return handleRouteError(error);
  }
}

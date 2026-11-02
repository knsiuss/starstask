import { z } from "zod";

import { ApiError, notFound, serviceUnavailable } from "@/lib/api/errors";
import { fileDownload, handleRouteError } from "@/lib/api/responses";
import {
  getClassAttendanceRecap,
  getClassAttendanceSubject,
} from "@/lib/db/attendance-meetings";
import { isSupabaseConfigured } from "@/lib/env/public";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import {
  buildRecapWorkbook,
  type AttendanceExportContext,
} from "@/features/attendance-meetings/excel";
import {
  buildRecapFilename,
  resolveRecapYear,
} from "@/features/attendance-meetings/filenames";
import { logAttendanceExport } from "@/features/attendance-meetings/meeting-service";
import { requireClassManager } from "@/features/classes/class-access";

export const dynamic = "force-dynamic";

const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const subjectIdSchema = z.uuid();

/** Semester recap matrix for one subject. */
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
      action: "attendance:exports:recap",
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

    const recap = await getClassAttendanceRecap(found.id, subject.id);
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

    const bytes = await buildRecapWorkbook(recap, exportContext);
    const filename = buildRecapFilename({
      classCode: found.class_code,
      className: found.name,
      subjectCode: subject.code,
      subjectName: subject.name,
      year: resolveRecapYear(found.academic_year, generatedAt),
    });

    await logAttendanceExport({
      classId: found.id,
      subjectId: subject.id,
      sessionId: null,
      kind: "recap",
    });

    return fileDownload(bytes, filename, XLSX_MIME);
  } catch (error) {
    return handleRouteError(error);
  }
}

import { notFound, serviceUnavailable } from "@/lib/api/errors";
import {
  apiSuccess,
  fileDownload,
  handleRouteError,
} from "@/lib/api/responses";
import { createExportJob } from "@/lib/db/export-jobs";
import { EXPORT_KIND_ATTENDANCE_MEETING } from "@/lib/queue/export-runner";
import {
  enqueueExport,
  isAsyncExportConfigured,
} from "@/lib/queue/export-queue";
import {
  getAttendanceMeetingDetail,
  getClassAttendanceSubject,
  listCorrectionAudit,
} from "@/lib/db/attendance-meetings";
import { isSupabaseConfigured } from "@/lib/env/public";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import {
  buildMeetingWorkbook,
  type AttendanceExportContext,
} from "@/features/attendance-meetings/excel";
import { buildMeetingFilename } from "@/features/attendance-meetings/filenames";
import { assertMeetingInClass } from "@/features/attendance-meetings/meeting-access";
import { logAttendanceExport } from "@/features/attendance-meetings/meeting-service";
import { requireClassManager } from "@/features/classes/class-access";

export const dynamic = "force-dynamic";

const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** One-meeting Excel report, including students who did not check in. */
export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string; id: string }> },
) {
  try {
    if (!isSupabaseConfigured()) {
      throw serviceUnavailable();
    }

    const { slug, id } = await context.params;
    const { session, class: found } = await requireClassManager(slug);

    await enforceRateLimit({
      action: "attendance:exports:meeting",
      identifier: session.user.id,
      limit: 60,
      windowSeconds: 3_600,
    });

    await assertMeetingInClass(id, found.id);

    const detail = await getAttendanceMeetingDetail(id, found.id);

    if (!detail) {
      throw notFound();
    }

    const subject = await getClassAttendanceSubject(found.id, detail.subjectId);

    if (!subject) {
      throw notFound();
    }

    const wantsAsync = new URL(_request.url).searchParams.get("async") === "1";

    if (wantsAsync && isAsyncExportConfigured()) {
      const job = await createExportJob({
        userId: session.user.id,
        kind: EXPORT_KIND_ATTENDANCE_MEETING,
        params: { classId: found.id, meetingId: id },
      });

      await enqueueExport(job.id);

      return apiSuccess({ jobId: job.id, status: "pending" }, 202);
    }

    const audits = await listCorrectionAudit(found.id, subject.id);

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

    const bytes = await buildMeetingWorkbook(detail, exportContext, audits);
    const filename = buildMeetingFilename({
      classCode: found.class_code,
      className: found.name,
      subjectCode: subject.code,
      subjectName: subject.name,
      meetingNumber: detail.meetingNumber,
    });

    await logAttendanceExport({
      classId: found.id,
      subjectId: detail.subjectId,
      sessionId: id,
      kind: "meeting",
    });

    return fileDownload(bytes, filename, XLSX_MIME);
  } catch (error) {
    return handleRouteError(error);
  }
}

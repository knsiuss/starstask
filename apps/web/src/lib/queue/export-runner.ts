"server-only";

/**
 * Async export runners. Each runner mirrors one existing sync export route
 * (same data access, same builders) but returns bytes + filename so the
 * worker can upload them; the sync routes stay untouched as fallback.
 *
 * Adding a new async kind = one entry here + one trigger branch in its route.
 */

import {
  getClassAttendanceRecap,
  getClassAttendanceSubject,
  getAttendanceMeetingDetail,
  listCorrectionAudit,
} from "@/lib/db/attendance-meetings";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { ExportJob } from "@/lib/db/export-jobs";
import {
  buildChecklistWorkbook,
  buildMeetingWorkbook,
  buildRecapWorkbook,
  type AttendanceExportContext,
} from "@/features/attendance-meetings/excel";
import { buildAttendanceReportPdf } from "@/features/attendance-meetings/pdf";
import {
  buildChecklistFilename,
  buildMeetingFilename,
  buildRecapFilename,
  resolveRecapYear,
} from "@/features/attendance-meetings/filenames";
import { logAttendanceExport } from "@/features/attendance-meetings/meeting-service";

export const EXPORT_KIND_ATTENDANCE_RECAP = "attendance-recap";
export const EXPORT_KIND_ATTENDANCE_CHECKLIST = "attendance-checklist";
export const EXPORT_KIND_ATTENDANCE_MEETING = "attendance-meeting";
export const EXPORT_KIND_ATTENDANCE_REPORT = "attendance-report";

const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const PDF_MIME = "application/pdf";

export type ExportResult = {
  bytes: Uint8Array;
  filename: string;
  mimeType: string;
};

async function runAttendanceRecap(job: ExportJob): Promise<ExportResult> {
  const classId = String(job.params.classId ?? "");
  const subjectId = String(job.params.subjectId ?? "");

  if (!classId || !subjectId) {
    throw new Error("Missing export parameters.");
  }

  const supabase = createSupabaseAdminClient();
  const { data: found } = await supabase
    .from("classes")
    .select("*")
    .eq("id", classId)
    .maybeSingle();

  if (!found) {
    throw new Error("Class not found.");
  }

  const subject = await getClassAttendanceSubject(classId, subjectId);

  if (!subject) {
    throw new Error("Subject not found.");
  }

  const recap = await getClassAttendanceRecap(classId, subject.id);
  const audits = await listCorrectionAudit(classId, subject.id);
  const generatedAt = new Date();
  const classRow = found as {
    name?: string;
    class_code?: string;
    course_name?: string | null;
    lecturer_name?: string | null;
    semester?: string;
    academic_year?: string;
  };
  const exportContext: AttendanceExportContext = {
    classInfo: classRow as never,
    subject: {
      ...subject,
      semester: classRow.semester ?? "",
      academicYear: classRow.academic_year ?? "",
    },
    generatedAt,
  };

  const bytes = await buildRecapWorkbook(recap, exportContext, audits);
  const filename = buildRecapFilename({
    classCode: classRow.class_code ?? "CLASS",
    className: classRow.name ?? "Class",
    subjectCode: subject.code ?? "",
    subjectName: subject.name ?? "",
    year: resolveRecapYear(classRow.academic_year ?? "", generatedAt),
  });

  await logAttendanceExport({
    classId,
    subjectId: subject.id,
    sessionId: null,
    kind: "recap",
  });

  return {
    bytes,
    filename,
    mimeType: XLSX_MIME,
  };
}

/** Shared context builder for subject-scoped attendance exports. */
async function buildSubjectContext(
  classId: string,
  subjectId: string,
): Promise<{
  found: {
    id: string;
    class_code?: string;
    name?: string;
    semester?: string;
    academic_year?: string;
  };
  subject: NonNullable<Awaited<ReturnType<typeof getClassAttendanceSubject>>>;
  context: AttendanceExportContext;
  generatedAt: Date;
}> {
  const supabase = createSupabaseAdminClient();
  const { data: found } = await supabase
    .from("classes")
    .select("*")
    .eq("id", classId)
    .maybeSingle();

  if (!found) {
    throw new Error("Class not found.");
  }

  const subject = await getClassAttendanceSubject(classId, subjectId);

  if (!subject) {
    throw new Error("Subject not found.");
  }

  const generatedAt = new Date();
  const classRow = found as {
    id: string;
    name?: string;
    class_code?: string;
    semester?: string;
    academic_year?: string;
  };
  const context: AttendanceExportContext = {
    classInfo: classRow as never,
    subject: {
      ...subject,
      semester: classRow.semester ?? "",
      academicYear: classRow.academic_year ?? "",
    },
    generatedAt,
  };

  return { found: classRow, subject, context, generatedAt };
}

async function runAttendanceChecklist(job: ExportJob): Promise<ExportResult> {
  const classId = String(job.params.classId ?? "");
  const subjectId = String(job.params.subjectId ?? "");
  const { found, subject, context, generatedAt } = await buildSubjectContext(
    classId,
    subjectId,
  );
  const recap = await getClassAttendanceRecap(classId, subject.id);

  const bytes = await buildChecklistWorkbook(recap, context);
  const filename = buildChecklistFilename({
    classCode: found.class_code ?? "CLASS",
    className: found.name ?? "Class",
    subjectCode: subject.code ?? "",
    subjectName: subject.name ?? "",
  });

  await logAttendanceExport({
    classId,
    subjectId: subject.id,
    sessionId: null,
    kind: "template",
  });

  void generatedAt;

  return { bytes, filename, mimeType: XLSX_MIME };
}

async function runAttendanceMeeting(job: ExportJob): Promise<ExportResult> {
  const classId = String(job.params.classId ?? "");
  const meetingId = String(job.params.meetingId ?? "");

  if (!meetingId) {
    throw new Error("Missing meeting.");
  }

  const detail = await getAttendanceMeetingDetail(meetingId, classId);

  if (!detail) {
    throw new Error("Meeting not found.");
  }

  const { found, subject, context } = await buildSubjectContext(
    classId,
    detail.subjectId,
  );
  const audits = await listCorrectionAudit(classId, subject.id);

  const bytes = await buildMeetingWorkbook(detail, context, audits);
  const filename = buildMeetingFilename({
    classCode: found.class_code ?? "CLASS",
    className: found.name ?? "Class",
    subjectCode: subject.code ?? "",
    subjectName: subject.name ?? "",
    meetingNumber: detail.meetingNumber,
  });

  await logAttendanceExport({
    classId,
    subjectId: subject.id,
    sessionId: meetingId,
    kind: "meeting",
  });

  return { bytes, filename, mimeType: XLSX_MIME };
}

async function runAttendanceReport(job: ExportJob): Promise<ExportResult> {
  const classId = String(job.params.classId ?? "");
  const subjectId = String(job.params.subjectId ?? "");
  const { found, subject, context, generatedAt } = await buildSubjectContext(
    classId,
    subjectId,
  );
  const [recap, audits] = await Promise.all([
    getClassAttendanceRecap(classId, subject.id),
    listCorrectionAudit(classId, subject.id),
  ]);

  const bytes = await buildAttendanceReportPdf(recap, context, audits);
  const subjectToken = (subject.code ?? subject.name ?? "SUBJECT")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase();
  const filename = `StarsTask_Attendance_${subjectToken || "SUBJECT"}_${resolveRecapYear(
    found.academic_year ?? "",
    generatedAt,
  )}.pdf`;

  await logAttendanceExport({
    classId,
    subjectId: subject.id,
    sessionId: null,
    kind: "report",
  });

  return { bytes, filename, mimeType: PDF_MIME };
}

const RUNNERS: Record<string, (job: ExportJob) => Promise<ExportResult>> = {
  [EXPORT_KIND_ATTENDANCE_RECAP]: runAttendanceRecap,
  [EXPORT_KIND_ATTENDANCE_CHECKLIST]: runAttendanceChecklist,
  [EXPORT_KIND_ATTENDANCE_MEETING]: runAttendanceMeeting,
  [EXPORT_KIND_ATTENDANCE_REPORT]: runAttendanceReport,
};

/** Uploads the generated file to the owner's private exports folder. */
export async function storeExportResult(
  job: ExportJob,
  result: ExportResult,
): Promise<string> {
  const supabase = createSupabaseAdminClient();
  const path = `${job.user_id}/${job.id}-${result.filename}`;

  const { error } = await supabase.storage
    .from("exports")
    .upload(path, result.bytes, {
      contentType: result.mimeType,
      upsert: true,
    });

  if (error) {
    throw error;
  }

  return path;
}

/** Runs the matching runner; throws with a sanitized category on failure. */
export async function runExportJob(job: ExportJob): Promise<ExportResult> {
  const runner = RUNNERS[job.kind];

  if (!runner) {
    throw new Error(`UNKNOWN_EXPORT_KIND:${job.kind}`);
  }

  return runner(job);
}

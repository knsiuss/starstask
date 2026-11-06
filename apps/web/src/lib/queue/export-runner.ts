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
  listCorrectionAudit,
} from "@/lib/db/attendance-meetings";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { ExportJob } from "@/lib/db/export-jobs";
import {
  buildRecapWorkbook,
  type AttendanceExportContext,
} from "@/features/attendance-meetings/excel";
import {
  buildRecapFilename,
  resolveRecapYear,
} from "@/features/attendance-meetings/filenames";
import { logAttendanceExport } from "@/features/attendance-meetings/meeting-service";

export const EXPORT_KIND_ATTENDANCE_RECAP = "attendance-recap";

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
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  };
}

const RUNNERS: Record<string, (job: ExportJob) => Promise<ExportResult>> = {
  [EXPORT_KIND_ATTENDANCE_RECAP]: runAttendanceRecap,
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

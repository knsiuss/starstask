import { z } from "zod";

import { ApiError, notFound, serviceUnavailable } from "@/lib/api/errors";
import { apiSuccess, handleRouteError } from "@/lib/api/responses";
import {
  getClassAttendanceRecap,
  getClassAttendanceSubject,
} from "@/lib/db/attendance-meetings";
import { isSupabaseConfigured } from "@/lib/env/public";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { requireClassManager } from "@/features/classes/class-access";

export const dynamic = "force-dynamic";

const subjectIdSchema = z.uuid();

/**
 * Machine-readable recap matrix for one subject.
 *
 * Consumed by the StarsTask SIS autofill browser extension, never by public
 * clients. Visibility matches the downloadable export exactly: class manager
 * only, one subject per call, no student PII beyond NIM/full name/attendance.
 */
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
      action: "attendance:recap-json",
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

    return apiSuccess({
      subject: {
        id: subject.id,
        name: subject.name,
        code: subject.code,
        semester: found.semester,
        academicYear: found.academic_year,
      },
      class: {
        id: found.id,
        slug: found.slug,
        name: found.name,
        classCode: found.class_code,
      },
      generatedAt: new Date().toISOString(),
      meetings: recap.meetings.map((meeting) => ({
        meetingNumber: meeting.meetingNumber,
        meetingDate: meeting.meetingDate,
        phase: meeting.phase,
        opened: meeting.opened,
      })),
      students: recap.students.map((student) => ({
        nim: student.nim,
        fullName: student.fullName,
        cells: student.cells,
        totals: student.totals,
      })),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

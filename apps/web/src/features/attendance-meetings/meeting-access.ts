import "server-only";

import { notFound } from "@/lib/api/errors";
import { getAttendanceMeetingClassId } from "@/lib/db/attendance-meetings";

/** Ensures the meeting id in the URL belongs to the class in the URL. */
export async function assertMeetingInClass(
  sessionId: string,
  classId: string,
): Promise<void> {
  const ownerClassId = await getAttendanceMeetingClassId(sessionId);

  if (ownerClassId !== classId) {
    throw notFound();
  }
}

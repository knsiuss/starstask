import { CalendarDays } from "lucide-react";

import { AttendanceCheckInPanel } from "@/components/attendance/attendance-check-in-panel";
import { StudentMeetingList } from "@/components/attendance/student-meeting-list";
import type { StudentAttendanceMeeting } from "@/lib/attendance/meeting-types";
import type { ActiveAttendanceSession } from "@/lib/attendance/types";

/**
 * Attendance meetings a student can check in to now, plus upcoming meetings
 * that still explain where the check-in button will appear.
 *
 * Course meetings use the identity-verified flow; older, non-meeting sessions
 * keep the original geolocation panel so both remain usable.
 */
export function ActiveAttendanceSection({
  meetings,
  identity,
  legacySessions,
}: {
  meetings: StudentAttendanceMeeting[];
  identity: { fullName: string | null; nim: string | null };
  legacySessions: ActiveAttendanceSession[];
}) {
  const hasMeetings = meetings.length > 0;
  const hasLegacySessions = legacySessions.length > 0;

  if (hasMeetings || hasLegacySessions) {
    const hasOpenMeeting = meetings.some((meeting) => meeting.phase === "open");

    return (
      <div className="grid gap-6">
        {hasMeetings ? (
          <StudentMeetingList
            meetings={meetings}
            identity={identity}
            heading={
              hasOpenMeeting ? "Active Attendance" : "Upcoming Attendance"
            }
          />
        ) : null}
        {hasLegacySessions ? (
          <AttendanceCheckInPanel
            sessions={legacySessions}
            recentEntries={[]}
          />
        ) : null}
      </div>
    );
  }

  return (
    <section aria-labelledby="active-attendance">
      <h2
        id="active-attendance"
        className="text-lg font-semibold tracking-tight"
      >
        Active Attendance
      </h2>
      <div className="border-border bg-subtle mt-4 rounded-xl border border-dashed px-5 py-10 text-center">
        <CalendarDays
          aria-hidden="true"
          className="text-muted-foreground mx-auto h-6 w-6"
        />
        <p className="mt-2 text-sm font-medium">
          No active attendance sessions
        </p>
        <p className="text-muted-foreground mx-auto mt-1 max-w-sm text-xs">
          Your instructors have not opened an attendance session yet.
        </p>
      </div>
    </section>
  );
}

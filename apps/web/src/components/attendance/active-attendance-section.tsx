import { CalendarDays } from "lucide-react";

import { AttendanceCheckInPanel } from "@/components/attendance/attendance-check-in-panel";
import { StudentMeetingList } from "@/components/attendance/student-meeting-list";
import type { StudentAttendanceMeeting } from "@/lib/attendance/meeting-types";
import type { ActiveAttendanceSession } from "@/lib/attendance/types";

/**
 * Sessions a student may check in to right now.
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
  const openMeetings = meetings.filter((meeting) => meeting.phase === "open");

  if (openMeetings.length > 0) {
    return (
      <StudentMeetingList
        meetings={openMeetings}
        identity={identity}
        heading="Active Attendance"
      />
    );
  }

  if (legacySessions.length > 0) {
    return (
      <AttendanceCheckInPanel
        sessions={legacySessions}
        recentEntries={[]}
      />
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

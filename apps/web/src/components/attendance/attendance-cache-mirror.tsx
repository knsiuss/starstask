"use client";

import * as React from "react";

import type { StudentAttendanceMeeting } from "@/lib/attendance/meeting-types";
import type { ActiveAttendanceSession } from "@/lib/attendance/types";
import { saveLastView } from "@/lib/offline/checkin-cache";
import type { OfflineCheckInView } from "@/lib/offline/types";

type Identity = { fullName: string | null; nim: string | null };

function checkInStateFromProps(
  meetings: StudentAttendanceMeeting[],
  activeSessions: ActiveAttendanceSession[],
): OfflineCheckInView["checkInState"] {
  const meetingSlots: OfflineCheckInView["checkInState"]["meetings"] = {};
  const sessionSlots: OfflineCheckInView["checkInState"]["sessions"] = {};

  for (const meeting of meetings) {
    meetingSlots[meeting.sessionId] = meeting.checkIn;
  }

  for (const session of activeSessions) {
    sessionSlots[session.sessionId] = session.checkIn;
  }

  return { meetings: meetingSlots, sessions: sessionSlots };
}

/**
 * Persists the exact props the /attendance page renders for this user so the
 * offline fallback can re-render them from IndexedDB. SSR output itself is
 * never cached (L4) — this stores only data already visible on this device.
 * The check-in slots are rebuilt (not merged) because this page is the sole
 * writer for the mirrored section; merging could resurrect slots for sessions
 * that already left the screen.
 */
export function AttendanceCacheMirror({
  meetings,
  identity,
  activeSessions,
}: {
  meetings: StudentAttendanceMeeting[];
  identity: Identity;
  activeSessions: ActiveAttendanceSession[];
}) {
  React.useEffect(() => {
    void saveLastView({
      meetings,
      identity,
      activeSessions,
      checkInState: checkInStateFromProps(meetings, activeSessions),
    });
  }, [meetings, identity, activeSessions]);

  return null;
}

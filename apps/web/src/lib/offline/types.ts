import type {
  ActiveAttendanceSession,
  AttendanceCheckInStatus,
} from "@/lib/attendance/types";
import type { StudentAttendanceMeeting } from "@/lib/attendance/meeting-types";

/**
 * Durable, on-device state for offline check-ins.
 *
 * `capturedAt` lives only inside the outbox record: it is audit metadata for
 * the replay payload's provenance, NEVER transmitted. The server owns the
 * window/lateness decision on replay (see L1 in tasks/OFFLINE_ATTENDANCE.md).
 */
export type CheckinOutboxKind = "attendance-meeting" | "session";

export type CheckinOutboxStatus =
  "pending_sync" | "syncing" | "sent" | "failed";

export type CheckinOutboxBody = {
  fullName?: string;
  nim?: string;
  latitude: number;
  longitude: number;
  accuracy: number;
};

export type CheckinOutboxEntry = {
  /** uuid generated per tap; id === clientRequestId. */
  id: string;
  kind: CheckinOutboxKind;
  /** Fixed by kind; never free-form, never interpolable from user input. */
  endpoint: string;
  sessionId: string;
  body: CheckinOutboxBody;
  /** Date.now() at capture; audit metadata only, never sent on replay. */
  capturedAt: number;
  status: CheckinOutboxStatus;
  attempts: number;
  lastError: string | null;
  /** Date.now() at enqueue. FIFO is by createdAt. */
  createdAt: number;
  /** Server status returned once replay succeeds. */
  serverStatus?: AttendanceCheckInStatus;
  alreadyCheckedIn?: boolean;
};

export type OfflineCheckInStateSlot = {
  status: AttendanceCheckInStatus;
  checkedInAt: string;
  distanceM: number | null;
} | null;

/**
 * Last successful server payload the attendance pages rendered for this user.
 * Mirrors exactly what StudentMeetingList / ActiveAttendanceSessionCard
 * consume — nothing more is stored.
 */
export type OfflineCheckInView = {
  meetings: StudentAttendanceMeeting[];
  identity: { fullName: string | null; nim: string | null };
  activeSessions: ActiveAttendanceSession[];
  checkInState: {
    meetings: Record<string, OfflineCheckInStateSlot>;
    sessions: Record<string, OfflineCheckInStateSlot>;
  };
};

export type FlushEntryOutcome =
  | {
      kind: "sent";
      id: string;
      serverStatus: AttendanceCheckInStatus;
      alreadyCheckedIn: boolean;
    }
  | { kind: "failed"; id: string; code: string }
  | { kind: "deferred"; id: string }
  | { kind: "retry"; id: string; error: string };

export type FlushResult = {
  outcomes: FlushEntryOutcome[];
  sent: number;
  failed: number;
  deferred: number;
  retried: number;
  /** True when at least one replay came back HTTP 401. */
  sessionExpired: boolean;
};

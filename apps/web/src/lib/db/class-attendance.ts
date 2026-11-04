import "server-only";

import type { SessionType } from "@starstask/contracts";
import {
  summarizeAttendanceCounts,
  type AttendanceCountsInput,
  type AttendanceSummaryCounts,
} from "@starstask/shared";

import { DataAccessError } from "@/lib/db/assignments";
import { listClassMembers } from "@/lib/db/classes";
import type { AttendanceGroupSummary } from "@/lib/db/attendance";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { SessionStatusRow } from "@/types/database";

type MemberSummaryRow = {
  user_id: string;
  joined_at: string;
  present_count: number;
  late_count: number;
  excused_count: number;
  absent_count: number;
  unrecorded_count: number;
  pending_count: number;
};

type SessionSummaryRow = {
  session_id: string;
  expected_count: number;
  present_count: number;
  late_count: number;
  excused_count: number;
  absent_count: number;
  unrecorded_count: number;
  pending_count: number;
};

type SessionMetaRow = {
  id: string;
  assignment_id: string | null;
  subject_id: string | null;
  title: string;
  session_type: SessionType;
  starts_at: string;
  ends_at: string;
  time_zone: string;
  status: SessionStatusRow;
};

export type ClassAttendanceMember = {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  isAdmin: boolean;
  joinedAt: string;
  counts: AttendanceSummaryCounts;
};

export type ClassAttendanceSession = {
  id: string;
  title: string;
  /** Course the session belongs to, when it carries one. */
  subjectId: string | null;
  subjectName: string | null;
  sessionType: SessionType;
  startsAt: string;
  endsAt: string;
  timeZone: string;
  expected: number;
  counts: AttendanceSummaryCounts;
};

export type ClassAttendanceView = {
  summary: AttendanceSummaryCounts;
  members: ClassAttendanceMember[];
  sessions: ClassAttendanceSession[];
  bySubject: AttendanceGroupSummary[];
};

const EMPTY_COUNTS: AttendanceCountsInput = {
  present: 0,
  late: 0,
  excused: 0,
  sick: 0,
  absent: 0,
  unrecorded: 0,
  pending: 0,
};

function toCounts(row: {
  present_count: number;
  late_count: number;
  excused_count: number;
  absent_count: number;
  unrecorded_count: number;
  pending_count: number;
}): AttendanceCountsInput {
  return {
    present: Number(row.present_count),
    late: Number(row.late_count),
    excused: Number(row.excused_count),
    sick: 0,
    absent: Number(row.absent_count),
    unrecorded: Number(row.unrecorded_count),
    pending: Number(row.pending_count),
  };
}

function addCounts(
  target: AttendanceCountsInput,
  source: AttendanceCountsInput,
): void {
  target.present += source.present;
  target.late += source.late;
  target.excused += source.excused;
  target.sick += source.sick;
  target.absent += source.absent;
  target.unrecorded += source.unrecorded;
  target.pending += source.pending;
}

/**
 * Class-wide attendance for its managers.
 *
 * Both aggregates are computed by Postgres functions that re-check
 * `can_manage_class`, so a class id from another class returns a permission
 * error instead of numbers. The web layer never derives these from a student's
 * view.
 */
export async function getClassAttendance(
  classId: string,
): Promise<ClassAttendanceView> {
  const supabase = await createSupabaseServerClient();

  const [members, memberSummaryResult, sessionSummaryResult] =
    await Promise.all([
      listClassMembers(classId),
      supabase.rpc("class_attendance_member_summary", {
        p_class_id: classId,
      }),
      supabase.rpc("class_attendance_session_summary", {
        p_class_id: classId,
      }),
    ]);

  if (memberSummaryResult.error) {
    throw new DataAccessError(
      "Could not load the class attendance summary",
      memberSummaryResult.error.code,
    );
  }

  if (sessionSummaryResult.error) {
    throw new DataAccessError(
      "Could not load the session attendance summary",
      sessionSummaryResult.error.code,
    );
  }

  const memberSummary = new Map<string, AttendanceCountsInput>(
    (memberSummaryResult.data ?? []).map(
      (row) => [row.user_id, toCounts(row as MemberSummaryRow)] as const,
    ),
  );
  const sessionSummaryRows = (sessionSummaryResult.data ??
    []) as SessionSummaryRow[];

  const overall = { ...EMPTY_COUNTS };

  const memberRows: ClassAttendanceMember[] = members
    .map((member) => {
      const counts = memberSummary.get(member.user_id) ?? { ...EMPTY_COUNTS };
      addCounts(overall, counts);

      return {
        userId: member.user_id,
        displayName: member.display_name,
        avatarUrl: member.avatar_url,
        isAdmin: member.is_admin,
        joinedAt: member.joined_at,
        counts: summarizeAttendanceCounts(counts),
      };
    })
    .sort((left, right) => left.displayName.localeCompare(right.displayName));

  const sessionIds = sessionSummaryRows.map((row) => row.session_id);
  let sessions: ClassAttendanceSession[] = [];
  const subjectCounts = new Map<
    string,
    { label: string; counts: AttendanceCountsInput }
  >();

  if (sessionIds.length > 0) {
    const { data: sessionRows, error: sessionError } = await supabase
      .from("discussion_sessions")
      .select(
        "id, assignment_id, subject_id, title, session_type, starts_at, ends_at, time_zone, status",
      )
      .in("id", sessionIds)
      .limit(1_000);

    if (sessionError) {
      throw new DataAccessError(
        "Could not load class sessions",
        sessionError.code,
      );
    }

    const metaById = new Map(
      ((sessionRows ?? []) as SessionMetaRow[]).map((row) => [row.id, row]),
    );
    const assignmentIds = [
      ...new Set(
        (sessionRows ?? []).flatMap((row) =>
          row.assignment_id ? [row.assignment_id] : [],
        ),
      ),
    ];

    const subjectIdByAssignment = new Map<string, string>();

    if (assignmentIds.length > 0) {
      const { data: assignments, error: assignmentError } = await supabase
        .from("assignments")
        .select("id, subject_id")
        .in("id", assignmentIds)
        .limit(1_000);

      if (assignmentError) {
        throw new DataAccessError(
          "Could not load the linked subjects",
          assignmentError.code,
        );
      }

      for (const row of assignments ?? []) {
        if (row.subject_id) {
          subjectIdByAssignment.set(row.id, row.subject_id);
        }
      }
    }

    const subjectIds = [
      ...new Set([
        ...sessionRows.flatMap((row) =>
          row.subject_id ? [row.subject_id] : [],
        ),
        ...subjectIdByAssignment.values(),
      ]),
    ];
    const subjectNames = new Map<string, string>();

    if (subjectIds.length > 0) {
      const { data: subjects, error: subjectError } = await supabase
        .from("class_subjects")
        .select("id, name")
        .in("id", subjectIds)
        .limit(1_000);

      if (subjectError) {
        throw new DataAccessError(
          "Could not load class subjects",
          subjectError.code,
        );
      }

      for (const row of subjects ?? []) {
        subjectNames.set(row.id, row.name);
      }
    }

    sessions = sessionSummaryRows.flatMap((row) => {
      const meta = metaById.get(row.session_id);

      if (!meta) {
        return [];
      }

      const counts = toCounts(row);
      // Attendance meetings carry their course directly; only older sessions
      // reach a course through the assignment they were tied to.
      const subjectId =
        meta.subject_id ??
        (meta.assignment_id
          ? (subjectIdByAssignment.get(meta.assignment_id) ?? null)
          : null);
      const subjectKey = subjectId ?? "none";
      const subjectGroup = subjectCounts.get(subjectKey) ?? {
        label: subjectId
          ? (subjectNames.get(subjectId) ?? "Subject")
          : "No linked subject",
        counts: { ...EMPTY_COUNTS },
      };

      addCounts(subjectGroup.counts, counts);
      subjectCounts.set(subjectKey, subjectGroup);

      return [
        {
          id: meta.id,
          title: meta.title,
          subjectId,
          subjectName: subjectId ? (subjectNames.get(subjectId) ?? null) : null,
          sessionType: meta.session_type,
          startsAt: meta.starts_at,
          endsAt: meta.ends_at,
          timeZone: meta.time_zone,
          expected: Number(row.expected_count),
          counts: summarizeAttendanceCounts(counts),
        },
      ];
    });

    sessions.sort(
      (left, right) => Date.parse(right.startsAt) - Date.parse(left.startsAt),
    );
  }

  return {
    summary: summarizeAttendanceCounts(overall),
    members: memberRows,
    sessions,
    bySubject: [...subjectCounts.entries()]
      .map(([key, group]) => ({
        key,
        label: group.label,
        secondaryLabel: null,
        counts: summarizeAttendanceCounts(group.counts),
      }))
      .sort((left, right) => left.label.localeCompare(right.label)),
  };
}

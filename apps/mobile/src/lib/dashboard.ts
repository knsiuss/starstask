import { getSupabase } from "./supabase";

/**
 * Read-only dashboard for the mobile shell (Fase 2, first slice):
 * today's sessions with check-in status, plus the nearest upcoming
 * assignments. Writes (check-in, upload) land in later slices; this stays
 * a pure read so failures degrade to an empty dashboard, never a crash.
 *
 * Timezone is Asia/Jakarta everywhere, matching the web app.
 */

export type DashboardSession = {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  subjectName: string | null;
  checkInStatus: string | null;
};

export type DashboardAssignment = {
  id: string;
  title: string;
  deadline: string | null;
  subjectName: string | null;
};

export type DashboardData = {
  todaySessions: DashboardSession[];
  upcomingAssignments: DashboardAssignment[];
};

const DAY_IN_MS = 24 * 60 * 60 * 1_000;

function jakartaDate(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

export async function loadDashboard(
  userId: string,
  now: Date = new Date(),
): Promise<DashboardData> {
  const supabase = getSupabase();

  if (!supabase) {
    return { todaySessions: [], upcomingAssignments: [] };
  }

  const { data: memberships } = await supabase
    .from("class_members")
    .select("class_id")
    .eq("user_id", userId);

  const classIds = [
    ...new Set((memberships ?? []).map((row) => row.class_id as string)),
  ];

  if (classIds.length === 0) {
    return { todaySessions: [], upcomingAssignments: [] };
  }

  const windowStart = new Date(now.getTime() - DAY_IN_MS).toISOString();
  const windowEnd = new Date(now.getTime() + 7 * DAY_IN_MS).toISOString();

  const [{ data: sessions }, { data: assignments }] = await Promise.all([
    supabase
      .from("discussion_sessions")
      .select("id, title, starts_at, ends_at, subject_id")
      .in("class_id", classIds)
      .eq("status", "scheduled")
      .not("meeting_number", "is", null)
      .gte("starts_at", windowStart)
      .lte("starts_at", windowEnd)
      .order("starts_at", { ascending: true })
      .limit(50),
    supabase
      .from("assignments")
      .select("id, title, deadline, subject_id")
      .eq("status", "published")
      .gte("deadline", windowStart)
      .order("deadline", { ascending: true })
      .limit(5),
  ]);

  const sessionRows = (sessions ?? []) as Array<{
    id: string;
    title: string;
    starts_at: string;
    ends_at: string;
    subject_id: string | null;
  }>;
  const assignmentRows = (assignments ?? []) as Array<{
    id: string;
    title: string;
    deadline: string | null;
    subject_id: string | null;
  }>;

  const subjectIds = [
    ...new Set(
      [...sessionRows, ...assignmentRows]
        .map((row) => row.subject_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const subjectNameById = new Map<string, string>();

  if (subjectIds.length > 0) {
    const { data: subjects } = await supabase
      .from("class_subjects")
      .select("id, name")
      .in("id", subjectIds);

    for (const subject of (subjects ?? []) as Array<{
      id: string;
      name: string;
    }>) {
      subjectNameById.set(subject.id, subject.name);
    }
  }

  const today = jakartaDate(now.toISOString());
  const todayRows = sessionRows.filter(
    (row) => jakartaDate(row.starts_at) === today,
  );

  const checkInBySession = new Map<string, string>();

  if (todayRows.length > 0) {
    const { data: checkIns } = await supabase
      .from("discussion_session_checkins")
      .select("session_id, status")
      .eq("user_id", userId)
      .in(
        "session_id",
        todayRows.map((row) => row.id),
      );

    for (const row of (checkIns ?? []) as Array<{
      session_id: string;
      status: string;
    }>) {
      checkInBySession.set(row.session_id, row.status);
    }
  }

  return {
    todaySessions: todayRows.map((row) => ({
      id: row.id,
      title: row.title,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      subjectName: row.subject_id
        ? (subjectNameById.get(row.subject_id) ?? null)
        : null,
      checkInStatus: checkInBySession.get(row.id) ?? null,
    })),
    upcomingAssignments: assignmentRows.map((row) => ({
      id: row.id,
      title: row.title,
      deadline: row.deadline,
      subjectName: row.subject_id
        ? (subjectNameById.get(row.subject_id) ?? null)
        : null,
    })),
  };
}

export function formatTime(iso: string): string {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { ActiveAttendanceSection } from "@/components/attendance/active-attendance-section";
import { AttendanceHistorySection } from "@/components/attendance/attendance-history-section";
import { AttendanceOverviewMetrics } from "@/components/attendance/attendance-overview-metrics";
import { CourseAttendanceTable } from "@/components/attendance/course-attendance-table";
import { SetupNotice } from "@/components/layout/setup-notice";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { getSessionUser } from "@/lib/auth/session";
import { buildCourseRows } from "@/lib/attendance/course-rows";
import {
  getAttendanceCheckInView,
  getStudentAttendance,
} from "@/lib/db/attendance";
import { getStudentAttendanceMeetingView } from "@/lib/db/attendance-meetings";
import { isSupabaseConfigured } from "@/lib/env/public";
import { buildLoginPath } from "@/lib/security/redirect";
import { flattenSearchParams } from "@/lib/utils/search-params";
import { attendanceQuerySchema } from "@starstask/contracts";

export const metadata: Metadata = {
  title: "Attendance",
  description:
    "Track your attendance across your enrolled courses and check in to open sessions.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const pageContainer = "mx-auto w-full max-w-6xl px-5 py-8 sm:px-8 lg:px-10";

type AttendancePageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function parsePage(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? "", 10);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

function periodLabel({
  semesters,
  academicYears,
}: {
  semesters: string[];
  academicYears: string[];
}): string | null {
  if (semesters.length !== 1) {
    return null;
  }

  return academicYears.length === 1
    ? `Semester ${semesters[0]} · ${academicYears[0]}`
    : `Semester ${semesters[0]}`;
}

export default async function AttendancePage({
  searchParams,
}: AttendancePageProps) {
  const flat = flattenSearchParams(await searchParams);
  const parsed = attendanceQuerySchema.safeParse(flat);

  if (!parsed.success) {
    return (
      <div className={pageContainer}>
        <Alert variant="error">
          <p className="font-medium">Those filters are not valid.</p>
          <p className="mt-1">
            <Link
              href="/attendance"
              className="underline"
            >
              Reset the filters
            </Link>{" "}
            and try again.
          </p>
        </Alert>
      </div>
    );
  }

  if (!isSupabaseConfigured()) {
    return (
      <div className={pageContainer}>
        <AttendanceHeader />
        <div className="mt-6">
          <SetupNotice />
        </div>
      </div>
    );
  }

  const session = await getSessionUser();

  if (!session) {
    redirect(buildLoginPath("/attendance"));
  }

  const query = parsed.data;
  const [historyView, checkInView, meetingView] = await Promise.all([
    getStudentAttendance(session.user.id, query),
    getAttendanceCheckInView(session.user.id),
    getStudentAttendanceMeetingView(session.user.id),
  ]);

  const hasActiveFilters =
    Boolean(
      query.class ||
      query.subject ||
      query.year ||
      query.semester ||
      query.from ||
      query.to,
    ) || query.status !== "all";

  const summary = historyView.summary;
  const courseRows = buildCourseRows({
    subjects: historyView.options.subjects,
    bySubject: historyView.bySubject,
    byClass: historyView.byClass,
  });
  const period = periodLabel({
    semesters: historyView.options.semesters,
    academicYears: historyView.options.academicYears,
  });

  return (
    <div className={pageContainer}>
      <AttendanceHeader period={period} />

      <div className="mt-6">
        <AttendanceOverviewMetrics
          totalSessions={summary.eligible}
          present={summary.present}
          late={summary.late}
          absent={summary.absent + summary.unrecorded}
        />
      </div>

      {!checkInView.hasClasses ? (
        <div className="border-border bg-subtle mt-6 rounded-xl border border-dashed px-5 py-12 text-center">
          <p className="text-sm font-medium">You have no classes yet</p>
          <p className="text-muted-foreground mx-auto mt-1 max-w-sm text-xs">
            Attendance is recorded per course session. Join a class first, then
            your courses and sessions appear here.
          </p>
          <Link
            href="/classes"
            className="text-accent mt-3 inline-block text-sm hover:underline"
          >
            Browse classes
          </Link>
        </div>
      ) : (
        <>
          <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <section aria-labelledby="course-attendance">
              <h2
                id="course-attendance"
                className="text-lg font-semibold tracking-tight"
              >
                Course Attendance
              </h2>
              <div className="mt-4">
                <CourseAttendanceTable rows={courseRows} />
              </div>
            </section>

            <ActiveAttendanceSection
              meetings={meetingView.meetings}
              identity={meetingView.identity}
              legacySessions={checkInView.activeSessions}
            />
          </div>

          <div className="mt-10">
            <AttendanceHistorySection
              view={historyView}
              query={query}
              hasActiveFilters={hasActiveFilters}
              page={parsePage(flat.page)}
            />
          </div>
        </>
      )}
    </div>
  );
}

function AttendanceHeader({ period }: { period?: string | null }) {
  return (
    <header>
      <h1 className="text-3xl font-semibold tracking-tight sm:text-[2rem]">
        Attendance
      </h1>
      <p className="text-muted-foreground mt-1.5 max-w-2xl text-sm">
        Track your attendance across your enrolled courses.
      </p>
      {period ? (
        <Badge
          variant="neutral"
          className="mt-3"
        >
          {period}
        </Badge>
      ) : null}
    </header>
  );
}

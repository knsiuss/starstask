import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AttendanceHistory } from "@/components/attendance/attendance-history";
import { AttendanceOverviewMetrics } from "@/components/attendance/attendance-overview-metrics";
import { AttendanceSummary } from "@/components/attendance/attendance-summary";
import { getSessionUser } from "@/lib/auth/session";
import { DataAccessError } from "@/lib/db/assignments";
import { getStudentAttendance } from "@/lib/db/attendance";
import { listMyClasses } from "@/lib/db/classes";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { buildLoginPath } from "@/lib/security/redirect";

export const metadata: Metadata = {
  title: "Course attendance",
  description:
    "One course's attendance percentage and session-by-session record.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type CourseAttendancePageProps = {
  params: Promise<{ courseId: string }>;
};

export default async function CourseAttendancePage({
  params,
}: CourseAttendancePageProps) {
  const { courseId } = await params;
  const session = await getSessionUser();

  if (!session) {
    redirect(buildLoginPath(`/attendance/courses/${courseId}`));
  }

  const classes = await listMyClasses(session.user.id);
  const classIds = new Set(classes.map((classItem) => classItem.id));
  const supabase = await createSupabaseServerClient();
  const { data: course, error } = await supabase
    .from("class_subjects")
    .select("id, class_id, name, code")
    .eq("id", courseId)
    .maybeSingle();

  if (error) {
    throw new DataAccessError("Could not load the course", error.code);
  }

  // Membership is checked against the parent class; the subject id alone is
  // never enough to read another class's record.
  if (!course || !classIds.has(course.class_id)) {
    notFound();
  }

  const className =
    classes.find((classItem) => classItem.id === course.class_id)?.name ??
    "Class";
  const view = await getStudentAttendance(session.user.id, {
    status: "all",
    subject: course.id,
  });
  const summary = view.summary;

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-8 sm:px-8 lg:px-10">
      <Link
        href="/attendance"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm"
      >
        <ArrowLeft
          aria-hidden="true"
          className="h-4 w-4"
        />
        Attendance
      </Link>

      <header className="mt-3">
        {course.code ? (
          <p className="text-muted-foreground text-xs font-medium">
            {course.code}
          </p>
        ) : null}
        <h1 className="text-3xl font-semibold tracking-tight sm:text-[2rem]">
          {course.name}
        </h1>
        <p className="text-muted-foreground mt-1.5 text-sm">{className}</p>
      </header>

      <div className="mt-6">
        <AttendanceOverviewMetrics
          totalSessions={summary.eligible}
          present={summary.present}
          late={summary.late}
          absent={summary.absent + summary.unrecorded}
        />
      </div>

      <div className="mt-6">
        <AttendanceSummary
          summary={summary}
          pending={summary.pending}
        />
      </div>

      <section
        aria-labelledby="course-attendance-history"
        className="mt-8"
      >
        <h2
          id="course-attendance-history"
          className="text-lg font-semibold tracking-tight"
        >
          Session history
        </h2>
        <div className="mt-4">
          <AttendanceHistory entries={view.entries} />
        </div>
      </section>
    </div>
  );
}

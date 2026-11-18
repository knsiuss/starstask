import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";

import { AttendanceHistory } from "@/components/attendance/attendance-history";
import { AttendanceSummary } from "@/components/attendance/attendance-summary";
import { CourseGradesCard } from "@/components/attendance/course-grades-card";
import { getSessionUser } from "@/lib/auth/session";
import { DataAccessError } from "@/lib/db/assignments";
import { getStudentAttendance } from "@/lib/db/attendance";
import { listMyClasses } from "@/lib/db/classes";
import {
  courseGradeKey,
  listCourseComponentGrades,
  type CourseComponentGrades,
} from "@/lib/db/course-grades";
import { buildLoginPath } from "@/lib/security/redirect";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Course attendance",
  description:
    "Course attendance percentage, Tugas/UTS/UAS grades, and session record.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const uuidSchema = z.string().uuid();

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

  if (!uuidSchema.safeParse(courseId).success) {
    notFound();
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

  const [view, allGrades] = await Promise.all([
    getStudentAttendance(session.user.id, {
      status: "all",
      subject: course.id,
    }),
    listCourseComponentGrades(course.class_id, course.id).catch(
      (): CourseComponentGrades => ({}),
    ),
  ]);

  const summary = view.summary;
  const tugas = allGrades[courseGradeKey(session.user.id, "tugas")] ?? null;
  const uts = allGrades[courseGradeKey(session.user.id, "uts")] ?? null;
  const uas = allGrades[courseGradeKey(session.user.id, "uas")] ?? null;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pt-6 pb-24 sm:px-8 sm:py-8 lg:px-10">
      <Link
        href="/attendance"
        className="text-muted-foreground hover:text-foreground focus-visible:outline-accent inline-flex min-h-[44px] items-center gap-1.5 rounded-sm text-sm focus-visible:outline-2 focus-visible:outline-offset-2 sm:min-h-0"
      >
        <ArrowLeft
          aria-hidden="true"
          className="h-4 w-4"
        />
        Attendance
      </Link>

      <header className="mt-3">
        <div className="flex flex-wrap items-center gap-2">
          {course.code ? (
            <span className="border-border bg-subtle text-muted-foreground rounded-md border px-2 py-0.5 text-xs font-medium">
              {course.code}
            </span>
          ) : null}
          <span className="text-muted-foreground text-xs font-medium">
            {className}
          </span>
        </div>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
          {course.name}
        </h1>
      </header>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <AttendanceSummary
          summary={summary}
          pending={summary.pending}
        />
        <CourseGradesCard
          tugas={tugas}
          uts={uts}
          uas={uas}
          attendedCount={summary.attended}
          totalMeetings={summary.eligible}
        />
      </div>

      <section
        aria-labelledby="course-attendance-history"
        className="mt-8"
      >
        <div className="flex items-baseline justify-between gap-2">
          <h2
            id="course-attendance-history"
            className="text-lg font-semibold tracking-tight"
          >
            Session history
          </h2>
          <span className="text-muted-foreground text-xs tabular-nums">
            {view.entries.length}{" "}
            {view.entries.length === 1 ? "session" : "sessions"}
          </span>
        </div>
        <div className="mt-3">
          <AttendanceHistory entries={view.entries} />
        </div>
      </section>
    </div>
  );
}

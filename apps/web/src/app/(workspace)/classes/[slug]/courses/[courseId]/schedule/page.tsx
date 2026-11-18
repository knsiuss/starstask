import { CalendarDays } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { CourseWorkspaceHeader } from "@/components/classes/course-workspace-header";
import { ScheduleManager } from "@/components/schedule/schedule-manager";
import { Alert } from "@/components/ui/alert";
import { requireCourseContext } from "@/features/classes/course-access";
import { listClassSchedule } from "@/lib/db/class-schedule";

const DAY_LABELS: Record<number, string> = {
  1: "Monday",
  2: "Tuesday",
  3: "Wednesday",
  4: "Thursday",
  5: "Friday",
  6: "Saturday",
  7: "Sunday",
};

export const metadata: Metadata = {
  title: "Course schedule",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type CourseSchedulePageProps = {
  params: Promise<{ slug: string; courseId: string }>;
};

export default async function CourseSchedulePage({
  params,
}: CourseSchedulePageProps) {
  const { slug, courseId } = await params;
  const {
    class: found,
    course,
    role,
  } = await requireCourseContext(slug, courseId);

  const entries = (await listClassSchedule(found.id)).filter(
    (entry) => entry.subject_id === course.id,
  );

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pt-5 pb-8 sm:px-6 sm:py-8 lg:px-8">
      <CourseWorkspaceHeader
        classSlug={found.slug}
        className={found.name}
        semester={found.semester}
        academicYear={found.academic_year}
        course={course}
        activeTab="schedule"
        canManage={role.canManage}
        classActive={found.status === "active"}
      />

      <div className="mt-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">
            Weekly schedule
          </h2>
          <p className="text-muted-foreground mt-1 max-w-2xl text-sm">
            The recurring meeting slots of this course. Every entry is stored
            with this course, never with the class group.
          </p>
        </div>
        <Link
          href="/schedule"
          className="text-accent inline-flex items-center gap-1.5 text-sm font-medium hover:underline"
        >
          <CalendarDays
            aria-hidden="true"
            className="h-4 w-4"
          />
          Open calendar
        </Link>
      </div>

      {course.status === "archived" ? (
        <Alert
          variant="warning"
          className="mt-5"
        >
          This course is archived. Its schedule stays visible but cannot be
          changed.
        </Alert>
      ) : null}

      <div className="mt-4">
        {course.status === "active" ? (
          <ScheduleManager
            classSlug={found.slug}
            subjects={[
              {
                id: course.id,
                name: course.name,
                lecturer_name: course.lecturer_name,
              },
            ]}
            entries={entries}
          />
        ) : entries.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No weekly slot was saved for this course.
          </p>
        ) : (
          <ul className="divide-border border-border divide-y border-y">
            {entries.map((entry) => (
              <li
                key={entry.id}
                className="flex flex-wrap items-center gap-2 py-3 text-sm"
              >
                <span className="font-medium">
                  {DAY_LABELS[entry.day_of_week] ?? "Day"}
                </span>
                <span className="text-muted-foreground">
                  {entry.start_time.slice(0, 5)}–{entry.end_time.slice(0, 5)}
                </span>
                {entry.room ? (
                  <span className="text-muted-foreground">· {entry.room}</span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

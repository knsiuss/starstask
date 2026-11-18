import { Archive, BookOpen, CircleCheck, ClipboardList } from "lucide-react";

import { CourseBoard } from "@/components/classes/course-board";
import { CreateSubjectForm } from "@/components/classes/create-subject-form";
import { listClassSubjects } from "@/lib/db/classes";

type ManageCoursesTabProps = {
  classId: string;
  classSlug: string;
};

/**
 * Course administration for one class group.
 *
 * Courses are the only place academic content can live, so adding one here is
 * the prerequisite for every assignment, meeting, and schedule entry.
 */
export async function ManageCoursesTab({
  classId,
  classSlug,
}: ManageCoursesTabProps) {
  const all = await listClassSubjects(classId, { includeArchived: true });
  const courses = all.filter((course) => course.id !== classId);
  const activeCount = courses.filter(
    (course) => course.status === "active",
  ).length;
  const archivedCount = courses.length - activeCount;
  const totalAssignments = courses.reduce(
    (sum, course) => sum + course.task_count,
    0,
  );

  const stats = [
    {
      icon: BookOpen,
      label: "Total Courses",
      value: courses.length,
      chip: "bg-accent-soft text-accent",
    },
    {
      icon: CircleCheck,
      label: "Active",
      value: activeCount,
      chip: "bg-success-soft text-success",
    },
    {
      icon: Archive,
      label: "Archived",
      value: archivedCount,
      chip: "bg-muted text-muted-foreground",
    },
    {
      icon: ClipboardList,
      label: "Total Assignments",
      value: totalAssignments,
      chip: "bg-accent-soft text-accent",
    },
  ];

  return (
    <section
      aria-labelledby="manage-courses"
      className="mt-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2
            id="manage-courses"
            className="inline-flex items-center gap-2 text-lg font-semibold tracking-tight"
          >
            <BookOpen
              aria-hidden="true"
              className="text-accent h-5 w-5"
            />
            Courses
          </h2>
          <p className="text-muted-foreground mt-1 max-w-2xl text-sm">
            Manage the courses in this class and their assignments.
          </p>
        </div>
        <CreateSubjectForm classSlug={classSlug} />
      </div>

      <ul className="mt-5 grid grid-cols-4 gap-1.5 sm:gap-3">
        {stats.map((stat) => (
          <li
            key={stat.label}
            className="border-border bg-surface flex min-w-0 flex-col items-center gap-1.5 rounded-xl border px-1.5 py-2.5 text-center sm:flex-row sm:gap-3.5 sm:px-4 sm:py-3.5 sm:text-left"
          >
            <span
              aria-hidden="true"
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg sm:h-10 sm:w-10 ${stat.chip}`}
            >
              <stat.icon className="h-3.5 w-3.5 sm:h-5 sm:w-5" />
            </span>
            <span className="min-w-0 max-w-full">
              <span className="text-foreground block text-lg font-semibold tracking-tight tabular-nums sm:text-xl">
                {stat.value}
              </span>
              <span className="text-muted-foreground block truncate text-[11px] sm:text-xs">
                {stat.label}
              </span>
            </span>
          </li>
        ))}
      </ul>

      <CourseBoard
        classSlug={classSlug}
        courses={courses}
      />

      <p className="text-muted-foreground mt-6 rounded-xl border border-border bg-surface px-4 py-3 text-xs leading-relaxed">
        Archive a course to stop new content while keeping its assignments,
        submissions, materials, and attendance history. Courses with academic
        records cannot be deleted; archive them instead.
      </p>
    </section>
  );
}

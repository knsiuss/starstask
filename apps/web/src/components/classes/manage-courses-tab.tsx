import { CourseManager } from "@/components/classes/course-manager";
import { CreateSubjectForm } from "@/components/classes/create-subject-form";
import { listClassSubjects } from "@/lib/db/classes";
import { formatCount, pluralize } from "@starstask/shared";

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

  return (
    <section
      aria-labelledby="manage-courses"
      className="mt-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2
            id="manage-courses"
            className="text-lg font-semibold tracking-tight"
          >
            Courses
          </h2>
          <p className="text-muted-foreground mt-1 max-w-2xl text-sm">
            {formatCount(activeCount)} active {pluralize(activeCount, "course")}{" "}
            of {courses.length}. Members of this class group reach every course
            without joining each one.
          </p>
        </div>
        <CreateSubjectForm classSlug={classSlug} />
      </div>

      <CourseManager
        classSlug={classSlug}
        courses={courses}
      />

      <p className="text-muted-foreground mt-6 text-xs leading-relaxed">
        Archive a course to stop new content while keeping its assignments,
        submissions, materials, and attendance history. Courses with academic
        records cannot be deleted; archive them instead.
      </p>
    </section>
  );
}

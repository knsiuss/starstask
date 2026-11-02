import { BookOpen, ChevronRight, PlusCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { CreateSubjectForm } from "@/components/classes/create-subject-form";
import { StatusBadge } from "@/components/classes/status-badge";
import { ClassWorkspaceTabs } from "@/components/classes/class-workspace-tabs";
import {
  countPublishedAssignmentsBySubject,
  getClassRole,
  listClassSubjects,
} from "@/lib/db/classes";
import { requireClassMember } from "@/features/classes/class-access";
import { formatCount, pluralize } from "@starstask/shared";

export const metadata: Metadata = {
  title: "Courses",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type CoursesPageProps = {
  params: Promise<{ slug: string }>;
};

/**
 * Every course inside one class group.
 *
 * Membership of the class group is the only access rule: `requireClassMember`
 * rejects anyone outside it, so a course can never be reached by guessing its
 * id from another group.
 */
export default async function ClassCoursesPage({ params }: CoursesPageProps) {
  const { slug } = await params;
  const { class: found } = await requireClassMember(slug);

  // Role first: archived courses are only listed for people who can manage them.
  const role = await getClassRole(found.id);
  const [courses, assignmentCounts] = await Promise.all([
    listClassSubjects(found.id, { includeArchived: role.canManage }),
    countPublishedAssignmentsBySubject(found.id),
  ]);

  // `listClassSubjects` falls back to a synthetic entry built from the class row
  // when a class has no subjects yet. That entry is not a course, so it is
  // dropped here rather than rendered as a broken link.
  const realCourses = courses.filter((course) => course.id !== found.id);
  const activeCount = realCourses.filter(
    (course) => course.status === "active",
  ).length;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <ClassWorkspaceTabs
        slug={found.slug}
        activeTab="courses"
      />

      <header className="mt-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Courses</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {formatCount(activeCount)} {pluralize(activeCount, "active course")}{" "}
            in {found.name}
            {role.canManage
              ? ". Members of this class group get access to every course automatically."
              : ". You have access to every course here because you are a member of this class group."}
          </p>
        </div>

        {role.canManage && found.status === "active" ? (
          <CreateSubjectForm classSlug={found.slug} />
        ) : null}
      </header>

      {realCourses.length === 0 ? (
        <div className="px-2 py-16 text-center">
          <p className="text-foreground text-sm font-medium">No courses yet</p>
          <p className="text-muted-foreground mx-auto mt-1 max-w-sm text-sm leading-relaxed">
            {role.canManage
              ? "Add the first course to this class group. Its assignments, attendance sessions, and schedule will live inside it."
              : "A class admin has not added any course to this class group yet."}
          </p>
        </div>
      ) : (
        <ul className="divide-border border-border mt-6 divide-y border-y">
          {realCourses.map((course) => {
            const assignmentCount = assignmentCounts.get(course.id) ?? 0;

            return (
              <li
                key={course.id}
                className="relative"
              >
                <div className="hover:bg-hover group flex items-center gap-4 px-1 py-4 transition-colors">
                  <span className="bg-accent-soft text-accent flex h-9 w-9 shrink-0 items-center justify-center rounded-lg">
                    <BookOpen
                      aria-hidden="true"
                      className="h-4 w-4"
                    />
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-2">
                      <h2 className="truncate text-[15px] font-medium">
                        <Link
                          href={`/dashboard/classes/${found.slug}/courses/${course.id}`}
                          className="focus-visible:outline-accent rounded-sm after:absolute after:inset-0 focus-visible:outline-2 focus-visible:outline-offset-2"
                        >
                          {course.name}
                        </Link>
                      </h2>
                      {course.code ? (
                        <span className="bg-muted text-muted-foreground shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px]">
                          {course.code}
                        </span>
                      ) : null}
                      {course.status === "archived" ? (
                        <StatusBadge
                          status="archived"
                          className="shrink-0"
                        />
                      ) : null}
                    </div>

                    <p className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-2 text-xs">
                      {course.lecturer_name ? (
                        <span className="max-w-52 truncate">
                          {course.lecturer_name}
                        </span>
                      ) : (
                        <span>No lecturer set</span>
                      )}
                      <span aria-hidden="true">·</span>
                      <span>
                        {formatCount(assignmentCount)}{" "}
                        {pluralize(assignmentCount, "assignment")}
                      </span>
                    </p>
                  </div>

                  <ChevronRight
                    aria-hidden="true"
                    className="text-muted-foreground/70 h-4 w-4 shrink-0"
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {role.canManage ? (
        <p className="text-muted-foreground mt-6 text-xs leading-relaxed">
          Archived courses keep their assignments, submissions, and attendance
          history. Only their status changes.
        </p>
      ) : null}
    </div>
  );
}

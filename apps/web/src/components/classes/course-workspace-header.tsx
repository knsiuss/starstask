import { ArrowLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

import type { ClassSubjectView } from "@starstask/contracts";

import { CourseAdminMenu } from "@/components/classes/course-admin-menu";
import {
  CourseWorkspaceTabs,
  type CourseTab,
} from "@/components/classes/course-workspace-tabs";
import { StatusBadge } from "@/components/classes/status-badge";

type CourseWorkspaceHeaderProps = {
  classSlug: string;
  className: string;
  semester: string;
  academicYear: string;
  course: ClassSubjectView;
  /** Omitted on screens outside the tab set, such as course settings. */
  activeTab?: CourseTab;
  canManage: boolean;
  classActive: boolean;
};

/**
 * Shared breadcrumb, title, and section navigation for every course page.
 *
 * The description lives here so each course screen does not repeat it. Class
 * information stays in the breadcrumb and the metadata line.
 */
export function CourseWorkspaceHeader({
  classSlug,
  className,
  semester,
  academicYear,
  course,
  activeTab,
  canManage,
  classActive,
}: CourseWorkspaceHeaderProps) {
  const base = `/dashboard/classes/${classSlug}`;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <nav
          aria-label="Breadcrumb"
          className="text-muted-foreground flex flex-wrap items-center gap-1.5 text-sm"
        >
          <Link
            href="/classes"
            className="hover:text-foreground underline-offset-4 hover:underline"
          >
            My Classes
          </Link>
          <ChevronRight
            aria-hidden="true"
            className="h-3.5 w-3.5"
          />
          <Link
            href={base}
            className="hover:text-foreground underline-offset-4 hover:underline"
          >
            {className}
          </Link>
          <ChevronRight
            aria-hidden="true"
            className="h-3.5 w-3.5"
          />
          <span className="text-foreground truncate">{course.name}</span>
        </nav>

        <Link
          href={base}
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-xs font-medium"
        >
          <ArrowLeft
            aria-hidden="true"
            className="h-3.5 w-3.5"
          />
          Back to class
        </Link>
      </div>

      <header className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              {course.name}
            </h1>
            {course.code ? (
              <span className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 font-mono text-[11px]">
                {course.code}
              </span>
            ) : null}
            {course.status === "archived" ? (
              <StatusBadge status="archived" />
            ) : null}
          </div>
          <p className="text-muted-foreground mt-1 text-sm">
            {semester} {academicYear}
            {course.lecturer_name ? (
              <>
                <span
                  aria-hidden="true"
                  className="mx-1.5"
                >
                  ·
                </span>
                {course.lecturer_name}
              </>
            ) : null}
          </p>
          {course.description ? (
            <p className="text-muted-foreground mt-2 max-w-3xl text-sm leading-relaxed">
              {course.description}
            </p>
          ) : null}
        </div>

        {canManage ? (
          <CourseAdminMenu
            classSlug={classSlug}
            courseId={course.id}
            courseStatus={course.status}
            classActive={classActive}
          />
        ) : null}
      </header>

      <CourseWorkspaceTabs
        slug={classSlug}
        courseId={course.id}
        activeTab={activeTab}
      />
    </>
  );
}

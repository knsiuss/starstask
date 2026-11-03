import { ArrowLeft, ChevronRight, Users } from "lucide-react";
import Link from "next/link";

import { ClassWorkspaceActions } from "@/components/classes/class-workspace-actions";
import { ClassWorkspaceTabs } from "@/components/classes/class-workspace-tabs";
import { StatusBadge } from "@/components/classes/status-badge";
import { Badge } from "@/components/ui/badge";
import type { ClassSummary } from "@/lib/db/classes";
import { pluralize } from "@starstask/shared";

type ClassAttendanceHeaderProps = {
  classSummary: ClassSummary;
  canManage: boolean;
  isActive: boolean;
  roleLabel: string;
  hasElevatedRole: boolean;
  memberCount: number;
};

/**
 * Header of the class attendance workspace.
 *
 * It repeats the class identity of the dashboard so the admin always knows
 * which class the workspace below belongs to, even though the workspace itself
 * scrolls on its own.
 */
export function ClassAttendanceHeader({
  classSummary,
  canManage,
  isActive,
  roleLabel,
  hasElevatedRole,
  memberCount,
}: ClassAttendanceHeaderProps) {
  const title = classSummary.class_code ?? classSummary.name;

  return (
    <>
      <nav
        aria-label="Breadcrumb"
        className="text-muted-foreground flex flex-wrap items-center gap-1.5 text-sm"
      >
        <Link
          href="/classes"
          className="hover:text-foreground inline-flex items-center gap-1"
        >
          <ArrowLeft
            aria-hidden="true"
            className="h-3.5 w-3.5"
          />
          My Classes
        </Link>
        <ChevronRight
          aria-hidden="true"
          className="text-muted-foreground/60 h-3.5 w-3.5"
        />
        <span className="text-foreground font-medium">{title}</span>
      </nav>

      <header className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="bg-accent-soft text-accent flex h-11 w-11 shrink-0 items-center justify-center rounded-xl">
            <Users
              aria-hidden="true"
              className="h-5 w-5"
            />
          </span>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-2xl font-semibold tracking-tight">
                {title}
              </h1>
              <StatusBadge status={classSummary.status} />
              <Badge variant={hasElevatedRole ? "accent" : "neutral"}>
                {roleLabel}
              </Badge>
            </div>
            <p className="text-muted-foreground mt-1 truncate text-sm">
              {classSummary.name}
              {classSummary.course_name !== classSummary.name
                ? ` · ${classSummary.course_name}`
                : null}{" "}
              · {classSummary.semester} {classSummary.academic_year} ·{" "}
              {memberCount} {pluralize(memberCount, "member")}
            </p>
          </div>
        </div>

        <ClassWorkspaceActions
          classSlug={classSummary.slug}
          canManage={canManage}
          isActive={isActive}
        />
      </header>

      <ClassWorkspaceTabs
        slug={classSummary.slug}
        activeTab="attendance"
      />
    </>
  );
}

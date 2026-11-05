import { ArrowRight, BookOpen, Info, Users } from "lucide-react";
import Link from "next/link";

import { StatusBadge } from "@/components/classes/status-badge";
import type { ClassSubjectWithTaskCount } from "@starstask/contracts";
import type { ClassMemberView, ClassSummary } from "@/lib/db/classes";
import { formatDate, formatCount, pluralize } from "@starstask/shared";

type ClassInfoTabProps = {
  classSummary: ClassSummary;
  members: ClassMemberView[];
  courses: ClassSubjectWithTaskCount[];
  canManage: boolean;
};

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 py-2.5">
      <dt className="text-muted-foreground text-sm">{label}</dt>
      <dd className="text-foreground text-sm font-medium">{value}</dd>
    </div>
  );
}

/**
 * The "Class Info" tab: the class group's own details in one place.
 *
 * Courses are the academic content; this tab describes the group that holds
 * them. Editing stays in `/manage`, so members get a read-only view and only
 * admins see the management link.
 */
export function ClassInfoTab({
  classSummary,
  members,
  courses,
  canManage,
}: ClassInfoTabProps) {
  const admins = members.filter((member) => member.is_admin);
  const activeCourses = courses.filter(
    (course) => course.id !== classSummary.id && course.status === "active",
  );

  return (
    <section
      aria-labelledby="class-info-heading"
      className="border-border bg-surface mt-6 rounded-xl border"
    >
      <div className="border-border flex flex-wrap items-start justify-between gap-3 border-b px-5 py-4">
        <div>
          <h2
            id="class-info-heading"
            className="flex items-center gap-2 text-base font-semibold"
          >
            <Info
              aria-hidden="true"
              className="text-accent h-4 w-4"
            />
            Class information
          </h2>
          <p className="text-muted-foreground mt-1 text-xs">
            Details of this class group. Courses inside it inherit this
            membership.
          </p>
        </div>
        <StatusBadge status={classSummary.status} />
      </div>

      <div className="grid gap-6 p-5 sm:grid-cols-2">
        <dl className="divide-border divide-y">
          <InfoRow
            label="Class code"
            value={classSummary.class_code ?? "Not set"}
          />
          <InfoRow
            label="Semester"
            value={classSummary.semester}
          />
          <InfoRow
            label="Academic year"
            value={classSummary.academic_year}
          />
          <InfoRow
            label="Institution"
            value={classSummary.institution ?? "Not set"}
          />
          <InfoRow
            label="Lecturer"
            value={classSummary.lecturer_name ?? "Not set"}
          />
          <InfoRow
            label="Created"
            value={formatDate(classSummary.created_at)}
          />
        </dl>

        <div className="space-y-4">
          <div className="border-border bg-subtle grid grid-cols-2 gap-3 rounded-lg border p-4">
            <div>
              <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
                <Users
                  aria-hidden="true"
                  className="h-3.5 w-3.5"
                />
                Members
              </p>
              <p className="mt-1 text-xl font-semibold tracking-tight">
                {formatCount(members.length)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
                <BookOpen
                  aria-hidden="true"
                  className="h-3.5 w-3.5"
                />
                Active courses
              </p>
              <p className="mt-1 text-xl font-semibold tracking-tight">
                {formatCount(activeCourses.length)}
              </p>
            </div>
          </div>

          <div>
            <h3 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              Description
            </h3>
            <p className="text-foreground mt-1.5 text-sm leading-relaxed">
              {classSummary.description || "No description yet."}
            </p>
          </div>

          <div>
            <h3 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              Class admins
            </h3>
            {admins.length === 0 ? (
              <p className="text-muted-foreground mt-1.5 text-sm">
                No class admin assigned.
              </p>
            ) : (
              <ul className="mt-1.5 space-y-1">
                {admins.map((admin) => (
                  <li
                    key={admin.user_id}
                    className="text-foreground text-sm"
                  >
                    {admin.display_name}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {canManage ? (
        <div className="border-border border-t px-5 py-3">
          <Link
            href={`/app/classes/${classSummary.slug}/manage`}
            className="text-accent hover:text-accent-hover inline-flex items-center gap-1.5 text-sm font-medium underline-offset-4 hover:underline"
          >
            Edit this information in Manage
            <ArrowRight
              aria-hidden="true"
              className="h-3.5 w-3.5"
            />
          </Link>
        </div>
      ) : null}
    </section>
  );
}

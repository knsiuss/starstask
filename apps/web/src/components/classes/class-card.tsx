import { GraduationCap, Users } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import type { ClassListItem } from "@/lib/db/classes";
import { excerpt, pluralize } from "@starstask/shared";

type ClassCardProps = {
  classItem: ClassListItem;
};

export function ClassCard({ classItem }: ClassCardProps) {
  return (
    <article className="border-border bg-surface hover:border-accent/30 flex h-full flex-col rounded-xl border p-5 transition-colors">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Badge variant="neutral">{classItem.course_name}</Badge>
        <span className="text-muted-foreground">{classItem.semester}</span>
      </div>

      <h2 className="mt-3 text-lg leading-snug font-semibold tracking-tight">
        <Link
          href={`/classes/${classItem.slug}`}
          className="hover:text-accent focus-visible:outline-accent rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          {classItem.name}
        </Link>
      </h2>

      <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
        {excerpt(classItem.description, 160)}
      </p>

      <dl className="text-muted-foreground mt-auto flex flex-wrap items-center gap-4 pt-4 text-xs">
        <div className="inline-flex items-center gap-1.5">
          <GraduationCap
            aria-hidden="true"
            className="h-3.5 w-3.5"
          />
          <dt className="sr-only">Academic year</dt>
          <dd>{classItem.academic_year}</dd>
        </div>
        <div className="inline-flex items-center gap-1.5">
          <Users
            aria-hidden="true"
            className="h-3.5 w-3.5"
          />
          <dt className="sr-only">Members</dt>
          <dd>
            {classItem.member_count}{" "}
            {pluralize(classItem.member_count, "member")}
          </dd>
        </div>
        {classItem.lecturer_name ? (
          <div className="truncate">
            <dt className="sr-only">Lecturer</dt>
            <dd>{classItem.lecturer_name}</dd>
          </div>
        ) : null}
      </dl>
    </article>
  );
}

type ClassListProps = {
  classes: ClassListItem[];
};

export function ClassList({ classes }: ClassListProps) {
  if (classes.length === 0) {
    return (
      <div className="border-border bg-subtle rounded-lg border border-dashed px-6 py-14 text-center">
        <h2 className="text-base font-semibold">No classes found</h2>
        <p className="text-muted-foreground mx-auto mt-1 max-w-md text-sm">
          Try a different search or semester. Approved classes appear here once
          a platform admin reviews the application.
        </p>
      </div>
    );
  }

  return (
    <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {classes.map((classItem) => (
        <li
          key={classItem.id}
          className="h-full"
        >
          <ClassCard classItem={classItem} />
        </li>
      ))}
    </ul>
  );
}

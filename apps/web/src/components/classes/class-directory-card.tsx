import {
  BookOpen,
  ChevronRight,
  ClipboardList,
  GraduationCap,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";

import { ClassDirectoryMenu } from "@/components/classes/class-directory-menu";
import { StatusBadge } from "@/components/classes/status-badge";
import type { ClassDirectoryItem } from "@/lib/db/classes";
import { excerpt, pluralize } from "@starstask/shared";
import type { ClassDirectoryView } from "@starstask/contracts";

type ClassDirectoryCardProps = {
  classItem: ClassDirectoryItem;
};

const TITLE_LINK_CLASS =
  "rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent after:absolute after:inset-0";

function ClassIcon() {
  return (
    <span className="bg-accent-soft text-accent flex h-9 w-9 shrink-0 items-center justify-center rounded-md">
      <GraduationCap
        aria-hidden="true"
        className="h-4 w-4"
      />
    </span>
  );
}

function AssignmentCount({ count }: { count: number }) {
  return (
    <span className="text-muted-foreground inline-flex items-center gap-1.5 text-xs">
      <ClipboardList
        aria-hidden="true"
        className="h-3.5 w-3.5"
      />
      {count} {pluralize(count, "assignment")}
    </span>
  );
}

export function ClassDirectoryCard({ classItem }: ClassDirectoryCardProps) {
  const subjectCount = classItem.subject_count ?? 1;

  return (
    <article className="border-border bg-surface hover:border-accent/30 hover:bg-hover group relative flex h-full flex-col rounded-xl border p-5 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <ClassIcon />
        <div className="relative z-10">
          <ClassDirectoryMenu
            classSlug={classItem.slug}
            className={classItem.name}
            isAdmin={classItem.is_admin}
          />
        </div>
      </div>

      <h2 className="mt-3 text-base leading-snug font-semibold tracking-tight">
        <Link
          href={`/dashboard/classes/${classItem.slug}`}
          className={TITLE_LINK_CLASS}
        >
          {classItem.name}
        </Link>
      </h2>

      <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
        <span className="font-mono bg-muted rounded px-1.5 py-0.2">
          {classItem.slug}
        </span>
        <span aria-hidden="true">·</span>
        <span>
          {classItem.semester} {classItem.academic_year}
        </span>
        {classItem.admin_name ? (
          <>
            <span aria-hidden="true">·</span>
            <span className="flex items-center gap-1">
              <ShieldCheck
                aria-hidden="true"
                className="text-accent h-3 w-3"
              />
              {classItem.admin_name}
            </span>
          </>
        ) : null}
      </div>

      <p className="text-muted-foreground mt-3 line-clamp-2 text-sm leading-relaxed">
        {excerpt(classItem.description, 160)}
      </p>

      <div className="mt-auto flex items-center justify-between gap-3 pt-4 border-t border-border/50">
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1 font-medium">
            <BookOpen
              aria-hidden="true"
              className="h-3.5 w-3.5 text-accent"
            />
            {subjectCount} {pluralize(subjectCount, "subject")}
          </span>
          <AssignmentCount count={classItem.published_count} />
        </div>
        <div className="flex items-center gap-2">
          {classItem.status === "archived" ? (
            <StatusBadge status="archived" />
          ) : null}
          <ChevronRight
            aria-hidden="true"
            className="text-muted-foreground/70 h-4 w-4 transition-transform group-hover:translate-x-0.5"
          />
        </div>
      </div>
    </article>
  );
}

export function ClassDirectoryRow({ classItem }: ClassDirectoryCardProps) {
  const subjectCount = classItem.subject_count ?? 1;

  return (
    <article className="border-border bg-surface hover:border-accent/30 hover:bg-hover group relative flex items-center gap-4 rounded-xl border px-4 py-3 transition-colors">
      <ClassIcon />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h2 className="truncate text-sm font-semibold">
            <Link
              href={`/dashboard/classes/${classItem.slug}`}
              className={TITLE_LINK_CLASS}
            >
              {classItem.name}
            </Link>
          </h2>
          <span className="font-mono bg-muted text-muted-foreground rounded px-1.5 py-0.2 text-[10px]">
            {classItem.slug}
          </span>
        </div>
        <p className="text-muted-foreground mt-0.5 truncate text-xs flex items-center gap-2">
          <span>
            {subjectCount} {pluralize(subjectCount, "subject")}
          </span>
          <span aria-hidden="true">·</span>
          <span>
            {classItem.semester} {classItem.academic_year}
          </span>
          {classItem.admin_name ? (
            <>
              <span aria-hidden="true">·</span>
              <span>Admin: {classItem.admin_name}</span>
            </>
          ) : null}
        </p>
      </div>

      <div className="hidden sm:block">
        <AssignmentCount count={classItem.published_count} />
      </div>

      {classItem.status === "archived" ? (
        <StatusBadge
          status="archived"
          className="hidden sm:inline-flex"
        />
      ) : null}

      <div className="relative z-10">
        <ClassDirectoryMenu
          classSlug={classItem.slug}
          className={classItem.name}
          isAdmin={classItem.is_admin}
        />
      </div>
    </article>
  );
}

export function ClassDirectoryList({
  classes,
  view,
}: {
  classes: ClassDirectoryItem[];
  view: ClassDirectoryView;
}) {
  if (view === "list") {
    return (
      <div className="space-y-2">
        {classes.map((classItem) => (
          <ClassDirectoryRow
            key={classItem.id}
            classItem={classItem}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {classes.map((classItem) => (
        <ClassDirectoryCard
          key={classItem.id}
          classItem={classItem}
        />
      ))}
    </div>
  );
}

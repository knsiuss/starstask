import Link from "next/link";

import {
  BookOpen,
  ChevronRight,
  ClipboardList,
  GraduationCap,
  ShieldCheck,
} from "lucide-react";

import { pluralize } from "@starstask/shared";

import { SectionHeader } from "@/components/dashboard/section-header";
import { Button } from "@/components/ui/button";
import type { DashboardClass } from "@/lib/db/dashboard";

type MyClassesSectionProps = {
  classes: DashboardClass[];
};

export function MyClassesSection({ classes }: MyClassesSectionProps) {
  const description =
    classes.length > 0
      ? `${classes.length} active ${pluralize(classes.length, "class")}`
      : undefined;

  return (
    <section aria-labelledby="my-classes">
      <SectionHeader
        id="my-classes"
        title="My classes"
        description={description}
        action={
          classes.length > 0
            ? { href: "/classes", label: "View all" }
            : undefined
        }
      />

      {classes.length === 0 ? (
        <div className="border-border bg-subtle mt-3 flex flex-col gap-4 rounded-xl border border-dashed p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="border-border bg-surface text-muted-foreground flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border">
              <GraduationCap
                aria-hidden="true"
                className="h-4 w-4"
              />
            </span>
            <div className="min-w-0">
              <p className="text-foreground text-sm font-medium">
                No active classes yet
              </p>
              <p className="text-muted-foreground mt-0.5 max-w-md text-xs leading-relaxed">
                Join a class group using an invitation link or browse available
                public classes. All subjects inside the group become available
                once you join.
              </p>
            </div>
          </div>

          <Button
            asChild
            size="sm"
            variant="secondary"
            className="min-h-10 shrink-0 self-start sm:self-auto"
          >
            <Link href="/classes/discover">Browse classes</Link>
          </Button>
        </div>
      ) : (
        <ul
          className={
            classes.length === 1
              ? "mt-3 grid grid-cols-1 gap-3"
              : "mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2"
          }
        >
          {classes.map((classItem) => (
            <li
              key={classItem.id}
              className="min-w-0"
            >
              <ClassCard classItem={classItem} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function getClassInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const [firstWord, secondWord] = words;

  if (!firstWord) {
    return "CL";
  }

  return secondWord
    ? `${firstWord[0] ?? ""}${secondWord[0] ?? ""}`.toUpperCase()
    : firstWord.slice(0, 2).toUpperCase();
}

function ClassCard({ classItem }: { classItem: DashboardClass }) {
  const initials = getClassInitials(classItem.name);

  return (
    <Link
      href={`/app/classes/${classItem.slug}`}
      className="border-border bg-surface hover:border-accent/40 hover:bg-hover/40 focus-visible:outline-accent group flex h-full min-w-0 flex-col justify-between gap-3 rounded-xl border p-4 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="border-border bg-subtle text-foreground flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border text-xs font-semibold tracking-tight"
        >
          {initials}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <span className="text-foreground group-hover:text-accent truncate text-[15px] leading-snug font-semibold transition-colors">
              {classItem.name}
            </span>
            <ChevronRight
              aria-hidden="true"
              className="text-muted-foreground/70 group-hover:text-accent mt-0.5 h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5"
            />
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <span className="bg-muted text-muted-foreground rounded-md px-1.5 py-0.5 font-mono text-[11px]">
              {classItem.slug}
            </span>
            <span className="text-muted-foreground text-xs whitespace-nowrap">
              {classItem.semester} {classItem.academic_year}
            </span>
            {classItem.is_admin ? (
              <span className="bg-accent-soft text-accent rounded-md px-1.5 py-0.5 text-[11px] font-medium">
                Admin
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="border-border/60 text-muted-foreground flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 border-t pt-2.5 text-xs">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="inline-flex items-center gap-1 tabular-nums">
            <BookOpen
              aria-hidden="true"
              className="text-accent h-3.5 w-3.5 shrink-0"
            />
            {classItem.subject_count}{" "}
            {pluralize(classItem.subject_count, "subject")}
          </span>
          <span
            className={
              classItem.task_count > 0
                ? "text-foreground inline-flex items-center gap-1 font-medium tabular-nums"
                : "inline-flex items-center gap-1 tabular-nums"
            }
          >
            <ClipboardList
              aria-hidden="true"
              className="text-muted-foreground h-3.5 w-3.5 shrink-0"
            />
            {classItem.task_count} {pluralize(classItem.task_count, "task")}
          </span>
        </div>

        {classItem.admin_name ? (
          <span className="inline-flex min-w-0 items-center gap-1">
            <ShieldCheck
              aria-hidden="true"
              className="text-accent h-3.5 w-3.5 shrink-0"
            />
            <span className="max-w-[140px] truncate">
              {classItem.admin_name}
            </span>
          </span>
        ) : null}
      </div>
    </Link>
  );
}

import {
  BookOpen,
  ChevronRight,
  ClipboardList,
  GraduationCap,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";

import { SectionHeader } from "@/components/dashboard/section-header";
import { Button } from "@/components/ui/button";
import type { DashboardClass } from "@/lib/db/dashboard";
import { pluralize } from "@starstask/shared";

type MyClassesSectionProps = {
  classes: DashboardClass[];
};

/** Distinct crops of the brand landscape so each class tile reads separately. */
const IMAGE_POSITIONS: readonly string[] = [
  "0% 50%",
  "33% 50%",
  "66% 50%",
  "100% 50%",
];

const DEFAULT_IMAGE_POSITION = "0% 50%";

export function MyClassesSection({ classes }: MyClassesSectionProps) {
  return (
    <section aria-labelledby="my-classes">
      <SectionHeader
        id="my-classes"
        title="My classes"
        action={
          classes.length > 0
            ? { href: "/classes", label: "View all" }
            : undefined
        }
      />

      {classes.length === 0 ? (
        <div className="border-border bg-subtle mt-3 flex flex-col gap-3 rounded-xl border border-dashed px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="border-border bg-surface text-muted-foreground flex h-9 w-9 shrink-0 items-center justify-center rounded-md border">
              <GraduationCap
                aria-hidden="true"
                className="h-4 w-4"
              />
            </span>
            <div>
              <p className="text-sm font-medium">No active classes yet</p>
              <p className="text-muted-foreground mt-0.5 max-w-md text-xs leading-relaxed">
                Join a class group using an invitation link or browse available
                public classes. Once you join a group, all its subjects are
                immediately available to you.
              </p>
            </div>
          </div>
          <Button
            asChild
            size="sm"
            variant="secondary"
            className="shrink-0 self-start sm:self-auto"
          >
            <Link href="/classes/discover">Browse classes</Link>
          </Button>
        </div>
      ) : (
        <ul className="mt-3 space-y-3">
          {classes.map((classItem, index) => (
            <li key={classItem.id}>
              <ClassRow
                classItem={classItem}
                imagePosition={
                  IMAGE_POSITIONS[index % IMAGE_POSITIONS.length] ??
                  DEFAULT_IMAGE_POSITION
                }
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ClassRow({
  classItem,
  imagePosition,
}: {
  classItem: DashboardClass;
  imagePosition: string;
}) {
  return (
    <Link
      href={`/dashboard/classes/${classItem.slug}`}
      className="border-border bg-surface hover:border-accent/40 focus-visible:outline-accent group flex items-center gap-3 rounded-xl border p-3 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 sm:gap-4 sm:p-4"
    >
      <span
        aria-hidden="true"
        style={{ backgroundPosition: imagePosition }}
        className="border-border h-14 w-14 shrink-0 rounded-lg border bg-[url('/hero-dashboard.svg')] bg-cover shadow-[inset_0_0_0_1px_rgba(255,255,255,0.35)] sm:h-16 sm:w-16"
      />

      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="text-foreground group-hover:text-accent truncate text-[15px] font-semibold transition-colors">
            {classItem.name}
          </span>
          <span className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 font-mono text-[10px]">
            {classItem.slug}
          </span>
          {classItem.is_admin ? (
            <span className="bg-accent-soft text-accent rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase">
              Class admin
            </span>
          ) : null}
        </div>

        {classItem.admin_name ? (
          <p className="text-muted-foreground mt-1 flex items-center gap-1 text-xs">
            <ShieldCheck
              aria-hidden="true"
              className="text-accent h-3 w-3 shrink-0"
            />
            <span className="truncate">Admin: {classItem.admin_name}</span>
          </p>
        ) : null}

        <div className="text-muted-foreground mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-xs">
          <span className="bg-subtle inline-flex items-center gap-1 rounded-md px-2 py-1 font-medium">
            <BookOpen
              aria-hidden="true"
              className="text-accent h-3.5 w-3.5"
            />
            {classItem.subject_count}{" "}
            {pluralize(classItem.subject_count, "subject")}
          </span>
          <span className="bg-subtle inline-flex items-center gap-1 rounded-md px-2 py-1 font-medium">
            <ClipboardList
              aria-hidden="true"
              className="h-3.5 w-3.5"
            />
            {classItem.task_count} {pluralize(classItem.task_count, "task")}
          </span>
          <span className="whitespace-nowrap">
            {classItem.semester} {classItem.academic_year}
          </span>
        </div>
      </div>

      <ChevronRight
        aria-hidden="true"
        className="text-muted-foreground/60 group-hover:text-accent h-4 w-4 shrink-0 transition-colors"
      />
    </Link>
  );
}

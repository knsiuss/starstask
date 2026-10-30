import {
  ArrowRight,
  BookOpen,
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

export function MyClassesSection({ classes }: MyClassesSectionProps) {
  return (
    <section
      aria-labelledby="my-classes"
      className="mt-8"
    >
      <SectionHeader
        id="my-classes"
        title="My classes"
        description="Main class groups where you have an active membership."
      />

      {classes.length === 0 ? (
        <div className="border-border bg-subtle mt-4 flex flex-col gap-3 rounded-xl border border-dashed px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
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
        <ul className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {classes.map((classItem) => (
            <li key={classItem.id}>
              <div className="border-border bg-surface hover:border-accent/40 group flex h-full flex-col justify-between rounded-xl border p-4 transition-all">
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/dashboard/classes/${classItem.slug}`}
                          className="text-foreground group-hover:text-accent truncate text-base font-semibold transition-colors"
                        >
                          {classItem.name}
                        </Link>
                        <span className="bg-muted text-muted-foreground font-mono rounded px-1.5 py-0.5 text-[10px]">
                          {classItem.slug}
                        </span>
                      </div>
                      {classItem.admin_name ? (
                        <p className="text-muted-foreground mt-1 flex items-center gap-1 text-xs">
                          <ShieldCheck
                            aria-hidden="true"
                            className="text-accent h-3 w-3 shrink-0"
                          />
                          <span>Admin: {classItem.admin_name}</span>
                        </p>
                      ) : null}
                    </div>
                    <GraduationCap
                      aria-hidden="true"
                      className="text-muted-foreground/60 group-hover:text-accent h-5 w-5 shrink-0 transition-colors"
                    />
                  </div>

                  <div className="text-muted-foreground mt-4 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs">
                    <span className="bg-subtle inline-flex items-center gap-1 rounded-md px-2 py-1 font-medium">
                      <BookOpen
                        aria-hidden="true"
                        className="h-3.5 w-3.5 text-accent"
                      />
                      {classItem.subject_count}{" "}
                      {classItem.subject_count === 1 ? "subject" : "subjects"}
                    </span>
                    <span className="bg-subtle inline-flex items-center gap-1 rounded-md px-2 py-1 font-medium">
                      <ClipboardList
                        aria-hidden="true"
                        className="h-3.5 w-3.5"
                      />
                      {classItem.task_count}{" "}
                      {pluralize(classItem.task_count, "task")}
                    </span>
                    <span className="text-muted-foreground/80">
                      {classItem.semester} {classItem.academic_year}
                    </span>
                  </div>
                </div>

                <div className="border-border/60 mt-4 border-t pt-3">
                  <Link
                    href={`/dashboard/classes/${classItem.slug}`}
                    className="text-accent hover:text-accent-hover inline-flex items-center gap-1 text-xs font-medium"
                  >
                    Open class group
                    <ArrowRight
                      aria-hidden="true"
                      className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
                    />
                  </Link>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

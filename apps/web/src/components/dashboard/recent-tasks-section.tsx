import { ChevronRight, FileText } from "lucide-react";
import Link from "next/link";

import { SectionHeader } from "@/components/dashboard/section-header";
import type { DashboardTask } from "@/lib/db/dashboard";
import { APP_TIME_ZONE } from "@starstask/shared";

type RecentTasksSectionProps = {
  tasks: DashboardTask[];
};

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: APP_TIME_ZONE,
  day: "numeric",
  month: "short",
  year: "numeric",
});

export function RecentTasksSection({ tasks }: RecentTasksSectionProps) {
  return (
    <section
      aria-labelledby="recent-tasks"
      className="border-border bg-surface rounded-xl border shadow-[0_1px_2px_rgba(9,9,11,0.03)]"
    >
      <div className="px-4 pt-4">
        <SectionHeader
          id="recent-tasks"
          title="Recent assignments"
          density="rail"
          action={{ href: "/dashboard/assignments", label: "View all" }}
        />
      </div>

      {tasks.length === 0 ? (
        <div className="flex flex-col items-center px-4 py-7 text-center">
          <FileText
            aria-hidden="true"
            className="text-muted-foreground h-5 w-5"
          />
          <p className="mt-2 text-sm font-medium">No assignments yet</p>
          <p className="text-muted-foreground mt-1 text-xs">
            Assignments published in your classes will appear here.
          </p>
        </div>
      ) : (
        <ul className="mt-1">
          {tasks.map((task) => (
            <li key={task.id}>
              <Link
                href={`/assignments/${task.id}`}
                className="hover:bg-hover focus-visible:outline-accent group flex items-center gap-3 px-4 py-2.5 transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2"
              >
                <span
                  aria-hidden="true"
                  className="bg-subtle text-muted-foreground group-hover:text-accent flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors"
                >
                  <FileText className="h-4 w-4" />
                </span>

                <span className="min-w-0 flex-1">
                  <span className="text-foreground group-hover:text-accent block truncate text-[13px] font-semibold transition-colors">
                    {task.title}
                  </span>
                  <span className="text-muted-foreground mt-0.5 block truncate text-xs">
                    {task.class_name}
                    {task.deadline
                      ? ` · ${dateFormatter.format(new Date(task.deadline))}`
                      : null}
                  </span>
                </span>

                <ChevronRight
                  aria-hidden="true"
                  className="text-muted-foreground/50 h-3.5 w-3.5 shrink-0"
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

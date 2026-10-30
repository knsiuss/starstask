import { ClipboardList } from "lucide-react";
import Link from "next/link";

import { LiveDeadlineBadge } from "@/components/dashboard/live-deadline-badge";
import { SectionHeader } from "@/components/dashboard/section-header";
import type { DashboardPriorityTask } from "@/lib/db/dashboard";
import { formatDeadline } from "@starstask/shared";

type PriorityTasksSectionProps = {
  tasks: DashboardPriorityTask[];
  nowIso: string;
};

export function PriorityTasksSection({
  tasks,
  nowIso,
}: PriorityTasksSectionProps) {
  return (
    <section
      aria-labelledby="priority-tasks"
      className="mt-8"
    >
      <SectionHeader
        id="priority-tasks"
        title="Priority tasks"
        description="Overdue work and the closest upcoming deadlines in your classes."
        action={{ href: "/dashboard/assignments", label: "View all" }}
      />

      <div className="border-border bg-surface mt-4 overflow-hidden rounded-xl border shadow-[0_1px_2px_rgba(9,9,11,0.03)]">
        {tasks.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <ClipboardList
              aria-hidden="true"
              className="text-muted-foreground mx-auto h-5 w-5"
            />
            <p className="mt-2 text-sm font-medium">Nothing urgent right now</p>
            <p className="text-muted-foreground mx-auto mt-1 max-w-sm text-xs leading-relaxed">
              Overdue tasks and the next deadlines in your classes will appear
              here.
            </p>
          </div>
        ) : (
          <ul className="divide-border divide-y">
            {tasks.map((task) => (
              <li key={task.id}>
                <Link
                  href={`/assignments/${task.id}`}
                  className="hover:bg-hover focus-visible:outline-accent group flex items-center gap-3 px-4 py-3.5 transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 sm:px-5"
                >
                  <span
                    aria-hidden="true"
                    className="bg-subtle text-muted-foreground flex h-8 w-8 shrink-0 items-center justify-center rounded-md"
                  >
                    <ClipboardList className="h-4 w-4" />
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="text-foreground group-hover:text-accent line-clamp-2 text-sm font-medium sm:line-clamp-1">
                      {task.title}
                    </p>
                    <p className="text-muted-foreground mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                      <span className="truncate">{task.className}</span>
                      <span aria-hidden="true">·</span>
                      <span className="whitespace-nowrap">
                        {formatDeadline(task.deadline)}
                      </span>
                    </p>
                  </div>

                  <LiveDeadlineBadge
                    deadline={task.deadline}
                    initialNowIso={nowIso}
                  />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

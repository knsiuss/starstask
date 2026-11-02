import { ChevronRight, ClipboardList } from "lucide-react";
import Link from "next/link";

import { SectionHeader } from "@/components/dashboard/section-header";
import type { DashboardPriorityTask } from "@/lib/db/dashboard";
import { cn } from "@/lib/utils/cn";
import {
  APP_TIME_ZONE,
  getJakartaDayDifference,
  toJakartaDateKey,
} from "@starstask/shared";

type PriorityTasksSectionProps = {
  tasks: DashboardPriorityTask[];
  nowIso: string;
};

type DueTone = "danger" | "warning" | "muted";

const TONE_CLASS: Record<DueTone, string> = {
  danger: "text-danger",
  warning: "text-warning",
  muted: "text-muted-foreground",
};

const DOT_CLASS: Record<DueTone, string> = {
  danger: "bg-danger",
  warning: "bg-warning",
  muted: "bg-accent",
};

const shortDateFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: APP_TIME_ZONE,
  day: "numeric",
  month: "short",
  year: "numeric",
});

const timeFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: APP_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/**
 * Mirrors the deadline buckets used elsewhere, but as compact text instead of a
 * badge so four rows fit in the rail without wrapping.
 */
function describeDue(
  deadline: string,
  nowIso: string,
): { label: string; tone: DueTone } {
  const now = new Date(nowIso);
  const due = new Date(deadline);
  const days = getJakartaDayDifference(due, now);

  if (due.getTime() <= now.getTime()) {
    return { label: "Past deadline", tone: "danger" };
  }

  if (toJakartaDateKey(due) === toJakartaDateKey(now)) {
    return {
      label: `Today, ${timeFormatter.format(due)}`,
      tone: "danger",
    };
  }

  if (days === 1) {
    return { label: "Tomorrow", tone: "warning" };
  }

  return {
    label: shortDateFormatter.format(due),
    tone: days <= 7 ? "warning" : "muted",
  };
}

export function PriorityTasksSection({
  tasks,
  nowIso,
}: PriorityTasksSectionProps) {
  return (
    <section
      aria-labelledby="priority-tasks"
      className="border-border bg-surface rounded-xl border shadow-[0_1px_2px_rgba(9,9,11,0.03)]"
    >
      <div className="px-4 pt-4">
        <SectionHeader
          id="priority-tasks"
          title="Priority tasks"
          density="rail"
          action={{ href: "/dashboard/assignments", label: "View all" }}
        />
      </div>

      {tasks.length === 0 ? (
        <div className="flex flex-col items-center px-4 py-7 text-center">
          <ClipboardList
            aria-hidden="true"
            className="text-muted-foreground h-5 w-5"
          />
          <p className="mt-2 text-sm font-medium">Nothing urgent</p>
          <p className="text-muted-foreground mt-1 text-xs">
            Closest deadlines in your classes will appear here.
          </p>
        </div>
      ) : (
        <ul className="mt-1">
          {tasks.map((task) => {
            const due = describeDue(task.deadline, nowIso);

            return (
              <li key={task.id}>
                <Link
                  href={`/assignments/${task.id}`}
                  className="hover:bg-hover focus-visible:outline-accent group flex items-start gap-3 px-4 py-2.5 transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2"
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                      DOT_CLASS[due.tone],
                    )}
                  />

                  <span className="min-w-0 flex-1">
                    <span className="text-foreground group-hover:text-accent block truncate text-[13px] font-semibold transition-colors">
                      {task.title}
                    </span>
                    <span className="mt-1 inline-flex max-w-full">
                      <span className="bg-subtle text-muted-foreground truncate rounded px-1.5 py-0.5 text-[10px] font-medium">
                        {task.className}
                      </span>
                    </span>
                  </span>

                  <span
                    className={cn(
                      "mt-0.5 shrink-0 text-[11px] font-medium whitespace-nowrap",
                      TONE_CLASS[due.tone],
                    )}
                  >
                    {due.label}
                  </span>

                  <ChevronRight
                    aria-hidden="true"
                    className="text-muted-foreground/50 mt-0.5 h-3.5 w-3.5 shrink-0"
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

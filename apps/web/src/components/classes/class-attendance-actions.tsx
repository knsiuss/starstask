import { ChevronRight, type LucideIcon } from "lucide-react";
import Link from "next/link";

export type ClassAttendanceAction = {
  href: string;
  label: string;
  icon: LucideIcon;
};

/** The small link card shown beside the class attendance summary. */
export function ClassAttendanceActions({
  actions,
}: {
  actions: ClassAttendanceAction[];
}) {
  return (
    <section
      aria-labelledby="class-attendance-actions"
      className="border-border bg-surface overflow-hidden rounded-xl border"
    >
      <h2
        id="class-attendance-actions"
        className="px-4 pt-4 pb-2 text-sm font-semibold tracking-tight"
      >
        Class actions
      </h2>
      <ul className="divide-border divide-y">
        {actions.map((action) => {
          const Icon = action.icon;

          return (
            <li key={action.href}>
              <Link
                href={action.href}
                className="group hover:bg-subtle focus-visible:outline-accent flex items-center gap-3 px-4 py-3 focus-visible:outline-2 focus-visible:outline-offset-[-2px]"
              >
                <Icon
                  aria-hidden="true"
                  className="text-muted-foreground h-4 w-4 shrink-0"
                />
                <span className="min-w-0 flex-1 text-sm font-medium">
                  {action.label}
                </span>
                <ChevronRight
                  aria-hidden="true"
                  className="text-muted-foreground h-4 w-4 shrink-0 transition group-hover:translate-x-0.5"
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

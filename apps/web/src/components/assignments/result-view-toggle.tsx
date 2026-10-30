import { LayoutGrid, List } from "lucide-react";
import Link from "next/link";

import type { AssignmentView } from "@/lib/assignments/urls";
import { cn } from "@/lib/utils/cn";

type ResultViewToggleProps = {
  current: AssignmentView;
  listHref: string;
  gridHref: string;
};

export function ResultViewToggle({
  current,
  listHref,
  gridHref,
}: ResultViewToggleProps) {
  const options = [
    { view: "list" as const, label: "List", href: listHref, Icon: List },
    { view: "grid" as const, label: "Grid", href: gridHref, Icon: LayoutGrid },
  ];

  return (
    <div
      role="group"
      aria-label="Result layout"
      className="border-border bg-surface inline-flex items-center rounded-lg border p-0.5"
    >
      {options.map(({ view, label, href, Icon }) => {
        const isActive = current === view;

        return (
          <Link
            key={view}
            href={href}
            aria-current={isActive ? "true" : undefined}
            className={cn(
              "focus-visible:outline-accent inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2",
              isActive
                ? "bg-accent-soft text-accent"
                : "text-muted-foreground hover:bg-hover hover:text-foreground",
            )}
          >
            <Icon
              aria-hidden="true"
              className="h-3.5 w-3.5"
            />
            {label}
          </Link>
        );
      })}
    </div>
  );
}

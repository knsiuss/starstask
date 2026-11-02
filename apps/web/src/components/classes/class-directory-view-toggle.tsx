import { LayoutGrid, List } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils/cn";
import type {
  ClassDirectoryQuery,
  ClassDirectoryView,
} from "@starstask/contracts";

type ClassDirectoryViewToggleProps = {
  query: ClassDirectoryQuery;
};

function viewHref(
  query: ClassDirectoryQuery,
  view: ClassDirectoryView,
): string {
  const params = new URLSearchParams();

  if (query.search) {
    params.set("search", query.search);
  }

  if (query.semester) {
    params.set("semester", query.semester);
  }

  params.set("sort", query.sort);
  params.set("view", view);

  return `/classes?${params.toString()}`;
}

/**
 * Grid and list are two densities of the same data, so the preference lives in
 * the URL and survives a reload or a shared link.
 */
export function ClassDirectoryViewToggle({
  query,
}: ClassDirectoryViewToggleProps) {
  const options = [
    { view: "grid" as const, label: "Grid view", icon: LayoutGrid },
    { view: "list" as const, label: "List view", icon: List },
  ];

  return (
    <div className="border-border bg-surface flex items-center gap-0.5 rounded-lg border p-0.5">
      {options.map((option) => {
        const isActive = query.view === option.view;

        return (
          <Link
            key={option.view}
            href={viewHref(query, option.view)}
            aria-label={option.label}
            aria-current={isActive ? "true" : undefined}
            className={cn(
              "focus-visible:outline-accent flex h-7 w-7 items-center justify-center rounded-md transition-colors focus-visible:outline-2 focus-visible:outline-offset-2",
              isActive
                ? "bg-accent-soft text-accent"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <option.icon
              aria-hidden="true"
              className="h-3.5 w-3.5"
            />
          </Link>
        );
      })}
    </div>
  );
}

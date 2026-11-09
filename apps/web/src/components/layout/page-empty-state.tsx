import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

type PageEmptyStateProps = {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
};

/**
 * Dashed-card empty state, one padding scale (py-10 sm:py-14) and one radius
 * (rounded-xl) so every filtered list and cleared inbox reads the same way
 * the dashboard's dashed blocks do.
 */
export function PageEmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: PageEmptyStateProps) {
  return (
    <div
      className={cn(
        "border-border bg-subtle flex flex-col items-center rounded-xl border border-dashed px-6 py-10 text-center sm:py-14",
        className,
      )}
    >
      {Icon ? (
        <span className="bg-muted flex h-11 w-11 items-center justify-center rounded-xl">
          <Icon
            aria-hidden="true"
            className="text-muted-foreground h-5 w-5"
          />
        </span>
      ) : null}
      <h2 className="text-foreground mt-3 text-base font-semibold tracking-tight">
        {title}
      </h2>
      {description ? (
        <p className="text-muted-foreground mx-auto mt-1.5 max-w-md text-sm leading-relaxed">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

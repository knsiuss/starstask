import type { ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

type PageHeaderProps = {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
};

/**
 * One H1 scale for every non-dashboard page: text-2xl on mobile,
 * text-3xl from sm up, matching the dashboard stat-card rhythm.
 */
export function PageHeader({
  title,
  description,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        "flex flex-wrap items-start justify-between gap-x-4 gap-y-4",
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="text-foreground text-2xl leading-tight font-semibold tracking-tight sm:text-3xl">
          {title}
        </h1>
        {description ? (
          <p className="text-muted-foreground mt-1.5 max-w-2xl text-sm leading-relaxed">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {actions}
        </div>
      ) : null}
    </header>
  );
}

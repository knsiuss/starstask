import type { ReactNode } from "react";

type WorkspaceEmptyStateProps = {
  title: string;
  description: string;
  action?: ReactNode;
};

/**
 * Shared empty state card for the Assignments workspace tabs.
 */
export function WorkspaceEmptyState({
  title,
  description,
  action,
}: WorkspaceEmptyStateProps) {
  return (
    <div className="border-border bg-surface flex flex-col items-center rounded-xl border border-dashed px-5 py-12 text-center sm:px-6 sm:py-14">
      <h2 className="text-foreground text-base font-semibold tracking-tight">
        {title}
      </h2>
      <p className="text-muted-foreground mt-1.5 max-w-md text-sm leading-relaxed">
        {description}
      </p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

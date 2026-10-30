import { SearchX } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

type ExploreEmptyStateProps = {
  hasActiveFilters: boolean;
  resetHref: string;
};

export function ExploreEmptyState({
  hasActiveFilters,
  resetHref,
}: ExploreEmptyStateProps) {
  return (
    <div className="border-border bg-surface flex flex-col items-center rounded-xl border px-6 py-12 text-center">
      <span className="bg-subtle flex h-10 w-10 items-center justify-center rounded-full">
        <SearchX
          aria-hidden="true"
          className="text-muted-foreground h-5 w-5"
        />
      </span>
      <h2 className="mt-4 text-base font-semibold tracking-tight">
        {hasActiveFilters ? "No assignments found" : "No assignments yet"}
      </h2>
      <p className="text-muted-foreground mt-1.5 max-w-sm text-sm leading-relaxed">
        {hasActiveFilters
          ? "Try a different search to find what you're looking for."
          : "Published assignments will appear here once students share them."}
      </p>
      {hasActiveFilters ? (
        <Button
          asChild
          variant="secondary"
          size="sm"
          className="mt-5"
        >
          <Link href={resetHref}>Reset filters</Link>
        </Button>
      ) : null}
    </div>
  );
}

import Link from "next/link";

type ExploreEmptyStateProps = {
  hasActiveFilters: boolean;
  resetHref: string;
};

/**
 * Plain-text empty state. No card, no icon tile: when a list is empty the only
 * thing worth reading is the reason and the way out.
 */
export function ExploreEmptyState({
  hasActiveFilters,
  resetHref,
}: ExploreEmptyStateProps) {
  return (
    <div className="px-4 py-12 text-center sm:py-16">
      <p className="text-foreground text-sm font-medium">
        {hasActiveFilters ? "No assignments match" : "No assignments yet"}
      </p>
      <p className="text-muted-foreground mx-auto mt-1.5 max-w-sm text-sm leading-relaxed">
        {hasActiveFilters
          ? "Try a different search or remove a filter."
          : "Published assignments will appear here once students share them."}
      </p>
      {hasActiveFilters ? (
        <Link
          href={resetHref}
          className="text-accent hover:bg-accent-soft focus-visible:outline-accent mt-4 inline-flex min-h-[44px] items-center justify-center rounded-md px-4 text-sm font-medium underline-offset-4 transition-colors hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 sm:min-h-9"
        >
          Reset filters
        </Link>
      ) : null}
    </div>
  );
}

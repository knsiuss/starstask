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
    <div className="px-2 py-16 text-center">
      <p className="text-foreground text-sm font-medium">
        {hasActiveFilters ? "No assignments match" : "No assignments yet"}
      </p>
      <p className="text-muted-foreground mx-auto mt-1 max-w-sm text-sm leading-relaxed">
        {hasActiveFilters
          ? "Try a different search or remove a filter."
          : "Published assignments will appear here once students share them."}
      </p>
      {hasActiveFilters ? (
        <Link
          href={resetHref}
          className="text-accent mt-4 inline-block text-sm underline-offset-4 hover:underline"
        >
          Reset filters
        </Link>
      ) : null}
    </div>
  );
}

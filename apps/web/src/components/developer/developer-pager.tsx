import Link from "next/link";

import { Button } from "@/components/ui/button";

export function DeveloperPager({
  page,
  totalPages,
  buildHref,
  itemLabel,
}: {
  page: number;
  totalPages: number;
  buildHref: (page: number) => string;
  itemLabel: string;
}) {
  const hasPrevious = page > 1;
  const hasNext = page < totalPages;

  return (
    <div className="border-border flex items-center justify-between gap-3 border-t px-4 py-3">
      {hasPrevious ? (
        <Button
          asChild
          variant="secondary"
          size="sm"
        >
          <Link
            href={buildHref(page - 1)}
            rel="prev"
          >
            Previous
          </Link>
        </Button>
      ) : (
        <span className="text-muted-foreground text-sm">Previous</span>
      )}

      <p className="text-muted-foreground text-xs">
        Page {page.toLocaleString()} of {totalPages.toLocaleString()} ·{" "}
        {itemLabel}
      </p>

      {hasNext ? (
        <Button
          asChild
          variant="secondary"
          size="sm"
        >
          <Link
            href={buildHref(page + 1)}
            rel="next"
          >
            Next
          </Link>
        </Button>
      ) : (
        <span className="text-muted-foreground text-sm">Next</span>
      )}
    </div>
  );
}

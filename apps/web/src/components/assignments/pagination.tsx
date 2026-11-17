import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

type PaginationProps = {
  basePath: string;
  page: number;
  totalPages: number;
  params: Record<string, string | undefined>;
};

export function Pagination({
  basePath,
  page,
  totalPages,
  params,
}: PaginationProps) {
  if (totalPages <= 1) {
    return null;
  }

  const buildHref = (targetPage: number) => {
    const searchParams = new URLSearchParams();

    for (const [key, value] of Object.entries(params)) {
      if (value) {
        searchParams.set(key, value);
      }
    }

    searchParams.set("page", String(targetPage));

    return `${basePath}?${searchParams.toString()}`;
  };

  return (
    <nav
      aria-label="Pagination"
      className="mt-6 flex flex-wrap items-center justify-between gap-3 sm:mt-8"
    >
      <p className="text-muted-foreground text-sm tabular-nums">
        Page {page} of {totalPages}
      </p>
      <div className="flex items-center gap-2">
        {page > 1 ? (
          <Button
            asChild
            variant="secondary"
            size="sm"
            className="min-h-[44px] px-4 sm:min-h-9 sm:px-3"
          >
            <Link
              href={buildHref(page - 1)}
              rel="prev"
            >
              <ChevronLeft
                aria-hidden="true"
                className="h-4 w-4"
              />
              Previous
            </Link>
          </Button>
        ) : (
          <Button
            variant="secondary"
            size="sm"
            disabled
            className="min-h-[44px] px-4 sm:min-h-9 sm:px-3"
          >
            <ChevronLeft
              aria-hidden="true"
              className="h-4 w-4"
            />
            Previous
          </Button>
        )}
        {page < totalPages ? (
          <Button
            asChild
            variant="secondary"
            size="sm"
            className="min-h-[44px] px-4 sm:min-h-9 sm:px-3"
          >
            <Link
              href={buildHref(page + 1)}
              rel="next"
            >
              Next
              <ChevronRight
                aria-hidden="true"
                className="h-4 w-4"
              />
            </Link>
          </Button>
        ) : (
          <Button
            variant="secondary"
            size="sm"
            disabled
            className="min-h-[44px] px-4 sm:min-h-9 sm:px-3"
          >
            Next
            <ChevronRight
              aria-hidden="true"
              className="h-4 w-4"
            />
          </Button>
        )}
      </div>
    </nav>
  );
}

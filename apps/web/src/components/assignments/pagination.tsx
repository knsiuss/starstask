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
      className="mt-8 flex flex-wrap items-center justify-between gap-3"
    >
      <p className="text-muted-foreground text-sm">
        Page {page} of {totalPages}
      </p>
      <div className="flex gap-2">
        {page > 1 ? (
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
          <Button
            variant="secondary"
            size="sm"
            disabled
          >
            Previous
          </Button>
        )}
        {page < totalPages ? (
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
          <Button
            variant="secondary"
            size="sm"
            disabled
          >
            Next
          </Button>
        )}
      </div>
    </nav>
  );
}

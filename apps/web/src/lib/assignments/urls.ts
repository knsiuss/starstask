/** Matches `listAssignmentsQuerySchema` so default page sizes stay out of URLs. */
const DEFAULT_PAGE_SIZE = "12";

export type AssignmentUrlParams = {
  search?: string;
  course?: string;
  class?: string;
  semester?: string;
  type?: string;
  tag?: string;
  sort?: string;
  pageSize?: string | number;
};

/**
 * Builds an assignments-page href from the active filters. Empty values, the
 * default sort, and the default page size are omitted so the URL stays
 * readable.
 */
export function buildAssignmentsHref(
  params: AssignmentUrlParams,
  overrides: Partial<AssignmentUrlParams> = {},
): string {
  const merged = { ...params, ...overrides };
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(merged)) {
    if (!value) {
      continue;
    }

    if (key === "sort" && value === "newest") {
      continue;
    }

    if (key === "pageSize" && String(value) === DEFAULT_PAGE_SIZE) {
      continue;
    }

    searchParams.set(key, String(value));
  }

  const query = searchParams.toString();

  return query ? `/assignments?${query}` : "/assignments";
}

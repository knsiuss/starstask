export type AssignmentView = "list" | "grid";

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
  view?: AssignmentView;
};

export function parseAssignmentView(
  value: string | string[] | undefined,
): AssignmentView {
  const candidate = Array.isArray(value) ? value[0] : value;

  return candidate === "grid" ? "grid" : "list";
}

/**
 * Builds an assignments-page href from the active filters. Empty values, the
 * default sort, and the default list view are omitted so the URL stays readable.
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

    if (key === "view" && value === "list") {
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

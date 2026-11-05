/**
 * Fetches every row of a PostgREST list query in pages, so exports and
 * rosters are never silently truncated by a single `.limit()`.
 *
 * The caller supplies a factory that builds a fresh query per page (a
 * PostgREST builder cannot be reused across ranges) and an error callback
 * that throws the caller's domain error, keeping this helper free of any
 * data-access error type.
 */

export type PageResult<T> = {
  data: T[] | null;
  error: { code?: string } | null;
};

export const FETCH_ALL_PAGE_SIZE = 500;

export async function fetchAllRows<T>(
  fetchPage: (from: number, to: number) => Promise<PageResult<T>>,
  onError: (code?: string) => never,
  pageSize: number = FETCH_ALL_PAGE_SIZE,
): Promise<T[]> {
  const rows: T[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await fetchPage(from, from + pageSize - 1);

    if (error) {
      onError(error.code);
    }

    const batch = data ?? [];
    rows.push(...batch);

    if (batch.length < pageSize) {
      return rows;
    }

    from += pageSize;
  }
}

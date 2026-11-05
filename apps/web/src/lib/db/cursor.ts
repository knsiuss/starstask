/**
 * Keyset cursor helpers for newest-first feeds.
 *
 * The cursor is the `created_at` timestamp of the last row of a page. Rows
 * are filtered with `created_at < cursor`, so pages stay stable when new
 * rows arrive at the top — unlike offset pagination, which repeats or skips
 * rows. Timestamps are microsecond-precision in Postgres; a rare exact tie
 * at a page boundary may repeat one row, which clients dedupe by id.
 */

export function encodeCursor(createdAt: string): string {
  return createdAt;
}

export function decodeCursor(cursor: string | null | undefined): string | null {
  if (!cursor) {
    return null;
  }

  const parsed = Date.parse(cursor);

  return Number.isNaN(parsed) ? null : cursor;
}

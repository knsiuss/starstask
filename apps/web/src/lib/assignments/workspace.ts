/**
 * Pure presentation logic for the member assignments workspace
 * (`/assignments`). Everything here is deterministic and free of server
 * imports so unit tests can pin the status mapping, sorting, and URL
 * builders without a database.
 */

/** Display statuses for a publication request (stored as assignment rows). */
export type RequestStatus =
  "pending" | "approved" | "rejected" | "revision_requested";

/** Marker the review dialog writes for revision requests. */
export const REVISION_REQUEST_PREFIX = "Revision requested:";

export type RequestStatusRow = {
  status: string;
  rejection_reason: string | null;
};

/**
 * Maps a stored assignment status onto the display status. Published rows are
 * the approved requests, `pending_review` rows are still pending, and a
 * rejected row whose reason carries the revision marker is a revision
 * request — the existing revise flow lets the student edit it back into the
 * queue.
 */
export function toRequestStatus(row: RequestStatusRow): RequestStatus {
  if (row.status === "published") {
    return "approved";
  }

  if (row.status === "rejected") {
    return row.rejection_reason?.startsWith(REVISION_REQUEST_PREFIX)
      ? "revision_requested"
      : "rejected";
  }

  return "pending";
}

/** Feedback text shown to the requester, with the revision marker stripped. */
export function requestFeedback(row: RequestStatusRow): string | null {
  const reason = row.rejection_reason?.trim();

  if (!reason || row.status !== "rejected") {
    return null;
  }

  return reason.startsWith(REVISION_REQUEST_PREFIX)
    ? reason.slice(REVISION_REQUEST_PREFIX.length).trim() || null
    : reason;
}

export const REQUEST_STATUS_LABELS: Record<RequestStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  revision_requested: "Revision Requested",
};

export type ScheduleSort = "newest" | "oldest" | "deadline";

export type SortableItem = {
  created_at: string;
  deadline: string | null;
};

/**
 * Orders schedule rows. Deadline sort puts the nearest future deadline first
 * and rows without a deadline last, so "nearest deadline" means the next thing
 * the member actually has to act on.
 */
export function sortScheduleItems<T extends SortableItem>(
  items: readonly T[],
  sort: ScheduleSort,
): T[] {
  const sorted = [...items];

  if (sort === "oldest") {
    sorted.sort((a, b) => a.created_at.localeCompare(b.created_at));
  } else if (sort === "deadline") {
    sorted.sort((a, b) => {
      if (a.deadline && b.deadline) {
        return a.deadline.localeCompare(b.deadline);
      }

      if (a.deadline) {
        return -1;
      }

      if (b.deadline) {
        return 1;
      }

      return a.created_at.localeCompare(b.created_at);
    });
  } else {
    sorted.sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  return sorted;
}

export type DeadlineUrgency = "upcoming" | "expired" | "none";

/** `now` is injected so tests (and the page) control the reference instant. */
export function deadlineUrgency(
  deadline: string | null,
  now: Date,
): DeadlineUrgency {
  if (!deadline) {
    return "none";
  }

  return new Date(deadline).getTime() >= now.getTime() ? "upcoming" : "expired";
}

/**
 * Short remaining-time label such as "in 3 days", "in 5 hours", or
 * "expired 2 days ago". Sub-day precision is kept for the nearest deadlines
 * because those are the ones that change behaviour.
 */
export function formatRemainingTime(
  deadline: string | null,
  now: Date,
): string | null {
  if (!deadline) {
    return null;
  }

  const diffMs = new Date(deadline).getTime() - now.getTime();
  const absMs = Math.abs(diffMs);
  const minutes = Math.round(absMs / 60_000);
  const hours = Math.round(absMs / 3_600_000);
  const days = Math.round(absMs / 86_400_000);

  const amount =
    minutes < 60
      ? `${minutes} min`
      : hours < 36
        ? `${hours} hour${hours === 1 ? "" : "s"}`
        : `${days} day${days === 1 ? "" : "s"}`;

  return diffMs >= 0 ? `in ${amount}` : `expired ${amount} ago`;
}

export type WorkspaceUrlParams = {
  tab?: string;
  search?: string;
  class?: string;
  status?: string;
  sort?: string;
  page?: string | number;
};

/**
 * Builds a workspace href from the active filters, omitting defaults so the
 * URL stays readable and shareable.
 */
export function buildWorkspaceHref(params: WorkspaceUrlParams): string {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "") {
      continue;
    }

    if (key === "tab" && value === "schedule") {
      continue;
    }

    if (key === "status" && value === "all") {
      continue;
    }

    if (key === "sort" && value === "newest") {
      continue;
    }

    if (key === "page" && String(value) === "1") {
      continue;
    }

    searchParams.set(key, String(value));
  }

  const query = searchParams.toString();

  return query ? `/assignments?${query}` : "/assignments";
}

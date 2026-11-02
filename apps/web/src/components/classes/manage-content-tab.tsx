import { FileText, Search } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Pagination } from "@/components/assignments/pagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getClassDashboardCounts,
  listClassSubmissions,
  type ClassDashboardCounts,
} from "@/lib/db/class-submissions";
import { cn } from "@/lib/utils/cn";
import { formatDate, pluralize } from "@starstask/shared";

export const CONTENT_STATUSES = [
  "published",
  "pending_review",
  "unpublished",
  "archived",
] as const;

export type ContentStatus = (typeof CONTENT_STATUSES)[number];

export function isContentStatus(
  value: string | undefined,
): value is ContentStatus {
  return (
    value !== undefined &&
    (CONTENT_STATUSES as readonly string[]).includes(value)
  );
}

const STATUS_LABELS: Record<ContentStatus, string> = {
  published: "Published",
  pending_review: "Pending review",
  unpublished: "Unpublished",
  archived: "Archived",
};

const EMPTY_COPY: Record<ContentStatus, { title: string; body: string }> = {
  published: {
    title: "Nothing published yet",
    body: "Approve a submission and it appears here and on the public class page.",
  },
  pending_review: {
    title: "The review queue is empty",
    body: "New member submissions appear here for review.",
  },
  unpublished: {
    title: "No unpublished content",
    body: "Content you unpublish from moderation is listed here.",
  },
  archived: {
    title: "No archived content",
    body: "Archived assignments stay readable and can be restored from review.",
  },
};

const PAGE_SIZE = 20;

function filterHref(
  classSlug: string,
  status: ContentStatus,
  search?: string,
): string {
  const params = new URLSearchParams({ tab: "content", status });

  if (search) {
    params.set("q", search);
  }

  return `/dashboard/classes/${classSlug}/manage?${params.toString()}`;
}

type ManageContentTabProps = {
  classId: string;
  classSlug: string;
  status: ContentStatus;
  search: string;
  page: number;
};

function buildFilters(
  counts: ClassDashboardCounts,
): { status: ContentStatus; count: number }[] {
  return [
    { status: "published", count: counts.published },
    { status: "pending_review", count: counts.pendingReview },
    { status: "unpublished", count: counts.unpublished },
    { status: "archived", count: counts.archived },
  ];
}

export async function ManageContentTab({
  classId,
  classSlug,
  status,
  search,
  page,
}: ManageContentTabProps) {
  const [counts, list] = await Promise.all([
    getClassDashboardCounts(classId),
    listClassSubmissions({
      classId,
      status,
      page,
      pageSize: PAGE_SIZE,
      search,
    }),
  ]);

  if (list.totalPages > 1 && page > list.totalPages) {
    const params = new URLSearchParams({
      tab: "content",
      status,
      page: String(list.totalPages),
    });

    if (search) {
      params.set("q", search);
    }

    redirect(`/dashboard/classes/${classSlug}/manage?${params.toString()}`);
  }

  const base = `/dashboard/classes/${classSlug}/manage`;
  const filters = buildFilters(counts);
  const emptyCopy = EMPTY_COPY[status];

  return (
    <section
      aria-labelledby="manage-content"
      className="mt-6"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2
            id="manage-content"
            className="text-lg font-semibold tracking-tight"
          >
            Content
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Review submissions and moderate what this class publishes.
          </p>
        </div>

        <form
          action={base}
          method="get"
          className="flex w-full max-w-md items-center gap-2"
        >
          <input
            type="hidden"
            name="tab"
            value="content"
          />
          <input
            type="hidden"
            name="status"
            value={status}
          />
          <div className="relative min-w-0 flex-1">
            <Search
              aria-hidden="true"
              className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
            />
            <Input
              name="q"
              defaultValue={search}
              placeholder="Search titles"
              aria-label="Search content by title"
              className="pl-9"
            />
          </div>
          <Button
            type="submit"
            size="sm"
            variant="secondary"
          >
            Search
          </Button>
          {search ? (
            <Button
              asChild
              size="sm"
              variant="ghost"
            >
              <Link href={filterHref(classSlug, status)}>Clear</Link>
            </Button>
          ) : null}
        </form>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-1.5">
        {filters.map((filter) => {
          const isActive = filter.status === status;

          return (
            <Link
              key={filter.status}
              href={filterHref(classSlug, filter.status, search || undefined)}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                isActive
                  ? "border-accent bg-accent-soft text-accent"
                  : "border-border bg-surface text-muted-foreground hover:text-foreground",
              )}
            >
              {STATUS_LABELS[filter.status]}
              <span className="tabular-nums opacity-70">{filter.count}</span>
            </Link>
          );
        })}
      </div>

      <div
        id="review-queue"
        className="scroll-mt-6"
      >
        <div className="border-border bg-surface mt-4 rounded-2xl border">
          <div className="border-border flex flex-wrap items-center justify-between gap-2 border-b px-5 py-3.5">
            <h3 className="text-sm font-semibold">{STATUS_LABELS[status]}</h3>
            <p className="text-muted-foreground text-xs">
              {list.total} {pluralize(list.total, "item")}
            </p>
          </div>

          {list.items.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <FileText
                aria-hidden="true"
                className="text-muted-foreground mx-auto h-5 w-5"
              />
              <p className="mt-2 text-sm font-medium">{emptyCopy.title}</p>
              <p className="text-muted-foreground mx-auto mt-1 max-w-sm text-xs">
                {search
                  ? `No title matches “${search}”. Try a different search.`
                  : emptyCopy.body}
              </p>
            </div>
          ) : (
            <ul className="divide-border divide-y">
              {list.items.map((submission) => (
                <li
                  key={submission.id}
                  className="flex flex-wrap items-start justify-between gap-3 px-5 py-3.5"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{submission.title}</p>
                    <p className="text-muted-foreground mt-0.5 text-xs">
                      {submission.submitter.display_name} ·{" "}
                      {submission.attachment_count}{" "}
                      {pluralize(submission.attachment_count, "file")} ·{" "}
                      {status === "pending_review" ? "submitted" : "updated"}{" "}
                      {formatDate(
                        status === "pending_review"
                          ? submission.created_at
                          : submission.updated_at,
                      )}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-3 text-xs font-medium">
                    {status === "published" ? (
                      <Link
                        href={`/assignments/${submission.id}`}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        View public
                      </Link>
                    ) : null}
                    <Link
                      href={`${base}/review/${submission.id}`}
                      className="text-accent hover:underline"
                    >
                      {status === "pending_review" ? "Review" : "Moderate"}
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <Pagination
        basePath={base}
        page={list.page}
        totalPages={list.totalPages}
        params={{
          tab: "content",
          status,
          q: search || undefined,
        }}
      />
    </section>
  );
}

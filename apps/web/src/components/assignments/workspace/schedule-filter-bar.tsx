"use client";

import { RotateCcw, Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { WorkspaceClassOption } from "@/lib/db/assignment-workspace";

type Props = {
  search?: string;
  classId?: string;
  status: string;
  sort: string;
  classes: WorkspaceClassOption[];
  managesAnyClass: boolean;
};

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "published", label: "Published" },
  { value: "upcoming", label: "Upcoming deadline" },
  { value: "overdue", label: "Past deadline" },
  { value: "no_deadline", label: "No deadline" },
] as const;

const REVIEW_STATUS_OPTIONS = [
  { value: "pending_review", label: "Pending review" },
  { value: "rejected", label: "Rejected" },
  { value: "draft", label: "Draft" },
] as const;

const SORT_OPTIONS = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "deadline", label: "Nearest deadline" },
] as const;

/**
 * Schedule toolbar. Selects navigate on change and the search waits for
 * Enter, so a filtered view stays a real, shareable URL across mobile and desktop.
 */
export function ScheduleFilterBar({
  search,
  classId,
  status,
  sort,
  classes,
  managesAnyClass,
}: Props) {
  const router = useRouter();
  const statusOptions = managesAnyClass
    ? [...STATUS_OPTIONS, ...REVIEW_STATUS_OPTIONS]
    : STATUS_OPTIONS;

  const hasActiveFilters = Boolean(
    search || classId || status !== "all" || sort !== "newest",
  );

  const navigate = (
    overrides: Partial<{
      search: string;
      class: string;
      status: string;
      sort: string;
    }>,
  ) => {
    const params = new URLSearchParams();

    params.set("tab", "schedule");

    const nextSearch = overrides.search ?? search ?? "";
    const nextClass = overrides.class ?? classId ?? "";
    const nextStatus = overrides.status ?? status;
    const nextSort = overrides.sort ?? sort;

    if (nextSearch) {
      params.set("search", nextSearch);
    }

    if (nextClass) {
      params.set("class", nextClass);
    }

    if (nextStatus !== "all") {
      params.set("status", nextStatus);
    }

    if (nextSort !== "newest") {
      params.set("sort", nextSort);
    }

    router.push(`/assignments?${params.toString()}`);
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        navigate({ search: String(form.get("search") ?? "") });
      }}
      className="space-y-2.5"
    >
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:grid-cols-[minmax(0,1fr)_165px_165px_155px]">
        <div className="relative min-w-0 sm:col-span-3 lg:col-span-1">
          <Label
            htmlFor="workspace-search"
            className="sr-only"
          >
            Search assignments
          </Label>
          <Search
            aria-hidden="true"
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
          />
          <Input
            id="workspace-search"
            name="search"
            type="search"
            defaultValue={search ?? ""}
            placeholder="Search assignments..."
            className="h-11 pr-11 pl-9 sm:h-10"
          />
          {search ? (
            <button
              type="button"
              onClick={() => navigate({ search: "" })}
              aria-label="Clear search"
              className="text-muted-foreground hover:text-foreground focus-visible:outline-accent absolute top-1/2 right-1 flex h-9 w-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              <X
                aria-hidden="true"
                className="h-4 w-4"
              />
            </button>
          ) : null}
        </div>

        <div className="min-w-0">
          <Label
            htmlFor="workspace-class"
            className="sr-only"
          >
            Filter by class
          </Label>
          <Select
            id="workspace-class"
            value={classId ?? ""}
            onChange={(event) => navigate({ class: event.target.value })}
            className="h-11 sm:h-10"
          >
            <option value="">All classes</option>
            {classes.map((item) => (
              <option
                key={item.id}
                value={item.id}
              >
                {item.name}
                {item.class_code ? ` (${item.class_code})` : ""}
              </option>
            ))}
          </Select>
        </div>

        <div className="min-w-0">
          <Label
            htmlFor="workspace-status"
            className="sr-only"
          >
            Filter by status
          </Label>
          <Select
            id="workspace-status"
            value={status}
            onChange={(event) => navigate({ status: event.target.value })}
            className="h-11 sm:h-10"
          >
            {statusOptions.map((option) => (
              <option
                key={option.value}
                value={option.value}
              >
                {option.label}
              </option>
            ))}
          </Select>
        </div>

        <div className="min-w-0">
          <Label
            htmlFor="workspace-sort"
            className="sr-only"
          >
            Sort assignments
          </Label>
          <Select
            id="workspace-sort"
            value={sort}
            onChange={(event) => navigate({ sort: event.target.value })}
            className="h-11 sm:h-10"
          >
            {SORT_OPTIONS.map((option) => (
              <option
                key={option.value}
                value={option.value}
              >
                {option.label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {hasActiveFilters ? (
        <div className="flex items-center justify-end">
          <button
            type="button"
            onClick={() => router.push("/assignments")}
            className="text-muted-foreground hover:text-foreground inline-flex min-h-[44px] cursor-pointer items-center gap-1.5 rounded-md px-2 text-xs font-medium transition-colors sm:min-h-[32px]"
          >
            <RotateCcw
              aria-hidden="true"
              className="h-3.5 w-3.5"
            />
            Reset filters
          </button>
        </div>
      ) : null}
    </form>
  );
}

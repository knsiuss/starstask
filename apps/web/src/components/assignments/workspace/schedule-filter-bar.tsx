"use client";

import { Search, X } from "lucide-react";
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
 * Enter, so a filtered view stays a real, shareable URL.
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
      className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[1fr_180px_180px_180px]"
    >
      <div className="relative">
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
          placeholder="Search assignments…"
          className="pl-9"
        />
        {search ? (
          <button
            type="button"
            onClick={() => navigate({ search: "" })}
            aria-label="Clear search"
            className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2 rounded p-0.5"
          >
            <X
              aria-hidden="true"
              className="h-4 w-4"
            />
          </button>
        ) : null}
      </div>

      <div>
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

      <div>
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

      <div>
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
    </form>
  );
}

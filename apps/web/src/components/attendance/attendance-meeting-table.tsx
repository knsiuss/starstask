"use client";

import { Search } from "lucide-react";
import * as React from "react";

import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { AttendanceMeetingRosterEntry } from "@/lib/attendance/meeting-types";
import {
  ATTENDANCE_MEETING_CELL_LABELS,
  type AttendanceMeetingCellStatus,
} from "@starstask/contracts";
import { formatSessionTime } from "@starstask/shared";

const TIME_ZONE = "Asia/Jakarta";

const STATUS_BADGE: Record<AttendanceMeetingCellStatus, BadgeProps["variant"]> =
  {
    present: "success",
    late: "warning",
    excused: "accent",
    absent: "danger",
    not_recorded: "neutral",
    not_applicable: "neutral",
  };

const STATUS_RANK: Record<AttendanceMeetingCellStatus, number> = {
  present: 0,
  late: 1,
  excused: 2,
  absent: 3,
  not_recorded: 4,
  not_applicable: 5,
};

const METHOD_LABELS: Record<string, string> = {
  geo: "GPS",
  manual: "Manual",
  system: "Auto absent",
};

type SortKey = "roster" | "name" | "nim" | "checkedIn" | "status";

function sortValue(entry: AttendanceMeetingRosterEntry, key: SortKey): number {
  switch (key) {
    case "name":
    case "nim":
    case "roster":
      return 0;
    case "checkedIn":
      return entry.checkedInAt ? Date.parse(entry.checkedInAt) : Infinity;
    case "status":
      return STATUS_RANK[entry.status];
  }
}

function compare(
  left: AttendanceMeetingRosterEntry,
  right: AttendanceMeetingRosterEntry,
  key: SortKey,
): number {
  if (key === "name") {
    return left.fullName.localeCompare(right.fullName, "id", {
      sensitivity: "base",
      numeric: true,
    });
  }

  if (key === "nim") {
    if (!left.nim && !right.nim) {
      return 0;
    }

    if (!left.nim) {
      return 1;
    }

    if (!right.nim) {
      return -1;
    }

    return left.nim.localeCompare(right.nim, "id", { numeric: true });
  }

  const delta = sortValue(left, key) - sortValue(right, key);

  if (delta !== 0 && Number.isFinite(delta)) {
    return delta;
  }

  return 0;
}

export function AttendanceMeetingTable({
  roster,
}: {
  roster: AttendanceMeetingRosterEntry[];
}) {
  const [query, setQuery] = React.useState("");
  const [sortKey, setSortKey] = React.useState<SortKey>("roster");
  const [onlyIssues, setOnlyIssues] = React.useState(false);

  const filtered = React.useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const base = roster.filter((entry) => {
      if (
        onlyIssues &&
        entry.status !== "not_recorded" &&
        entry.status !== "absent"
      ) {
        return false;
      }

      if (!normalized) {
        return true;
      }

      return (
        entry.fullName.toLowerCase().includes(normalized) ||
        (entry.nim?.toLowerCase().includes(normalized) ?? false) ||
        (entry.displayName?.toLowerCase().includes(normalized) ?? false)
      );
    });

    if (sortKey === "roster") {
      return base;
    }

    return [...base].sort((left, right) => compare(left, right, sortKey));
  }, [onlyIssues, query, roster, sortKey]);

  return (
    <div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[13rem] flex-1 space-y-1">
          <Label
            htmlFor="attendance-roster-search"
            className="text-xs"
          >
            Search
          </Label>
          <div className="relative">
            <Search
              aria-hidden="true"
              className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
            />
            <Input
              id="attendance-roster-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Name or NIM"
              className="pl-9"
            />
          </div>
        </div>
        <div className="space-y-1">
          <Label
            htmlFor="attendance-roster-sort"
            className="text-xs"
          >
            Sort by
          </Label>
          <Select
            id="attendance-roster-sort"
            value={sortKey}
            onChange={(event) => setSortKey(event.target.value as SortKey)}
            className="w-44"
          >
            <option value="roster">Roster (A–Z)</option>
            <option value="nim">NIM</option>
            <option value="checkedIn">Check-in time</option>
            <option value="status">Status</option>
          </Select>
        </div>
        <label className="text-muted-foreground flex items-center gap-2 pb-3 text-xs">
          <input
            type="checkbox"
            checked={onlyIssues}
            onChange={(event) => setOnlyIssues(event.target.checked)}
            className="accent-accent h-4 w-4"
          />
          Only absent or not recorded
        </label>
      </div>

      <div className="border-border mt-3 overflow-x-auto rounded-xl border">
        <table className="w-full min-w-[52rem] text-sm">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr className="text-left text-xs">
              <th className="px-3 py-2 font-medium">No.</th>
              <th className="px-3 py-2 font-medium">NIM</th>
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="px-3 py-2 font-medium">Check-in</th>
              <th className="px-3 py-2 font-medium">Distance</th>
              <th className="px-3 py-2 font-medium">GPS accuracy</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-border divide-y">
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className="text-muted-foreground px-3 py-8 text-center text-xs"
                >
                  {roster.length === 0
                    ? "This class has no members yet."
                    : "No member matches this search."}
                </td>
              </tr>
            ) : (
              filtered.map((entry, index) => (
                <tr key={entry.userId}>
                  <td className="text-muted-foreground px-3 py-2 text-xs tabular-nums">
                    {index + 1}
                  </td>
                  <td className="px-3 py-2 text-xs tabular-nums">
                    {entry.nim ?? "—"}
                  </td>
                  <td className="px-3 py-2">
                    <span className="font-medium">{entry.fullName}</span>
                    {!entry.eligible ? (
                      <span className="text-muted-foreground ml-1.5 text-[11px]">
                        joined after the meeting
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-xs tabular-nums">
                    {entry.checkedInAt
                      ? `${formatSessionTime(entry.checkedInAt, TIME_ZONE)}`
                      : "—"}
                  </td>
                  <td className="px-3 py-2 text-xs tabular-nums">
                    {entry.distanceM !== null
                      ? `${Math.round(entry.distanceM)} m`
                      : "—"}
                  </td>
                  <td className="px-3 py-2 text-xs tabular-nums">
                    {entry.accuracyM !== null
                      ? `±${Math.round(entry.accuracyM)} m`
                      : "—"}
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant={STATUS_BADGE[entry.status]}>
                      {ATTENDANCE_MEETING_CELL_LABELS[entry.status]}
                    </Badge>
                  </td>
                  <td className="text-muted-foreground px-3 py-2 text-xs">
                    {[
                      entry.method ? METHOD_LABELS[entry.method] : null,
                      entry.identityVerified ? "identity verified" : null,
                      entry.note,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

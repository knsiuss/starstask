"use client";

import { useRouter } from "next/navigation";
import * as React from "react";

import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  CALENDAR_EVENT_TYPE_LABELS,
  CALENDAR_EVENT_TYPES,
  type CalendarQuery,
  type CalendarView,
} from "@starstask/contracts";

type FilterClass = {
  id: string;
  name: string;
  isAdmin: boolean;
};

type FilterSubject = {
  id: string;
  classId: string;
  name: string;
};

type CalendarFiltersProps = {
  view: CalendarView;
  anchorKey: string;
  query: CalendarQuery;
  classes: FilterClass[];
  subjects: FilterSubject[];
};

/**
 * Filters are pushed as a new URL rather than held in local state, so the
 * server renders the next view and the back button restores the old filters.
 */
export function CalendarFilters({
  view,
  anchorKey,
  query,
  classes,
  subjects,
}: CalendarFiltersProps) {
  const router = useRouter();
  const [type, setType] = React.useState(query.type);
  const [classId, setClassId] = React.useState(query.class ?? "");
  const [subjectId, setSubjectId] = React.useState(query.subject ?? "");

  const visibleSubjects = classId
    ? subjects.filter((subject) => subject.classId === classId)
    : subjects;

  const navigate = (next: {
    type?: string;
    classId?: string;
    subjectId?: string;
  }) => {
    const params = new URLSearchParams();

    params.set("view", view);
    params.set("date", anchorKey);

    const nextType = next.type ?? type;
    const nextClass = next.classId ?? classId;
    const nextSubject = next.subjectId ?? subjectId;

    if (nextType !== "all") {
      params.set("type", nextType);
    }

    if (nextClass) {
      params.set("class", nextClass);
    }

    if (nextSubject) {
      params.set("subject", nextSubject);
    }

    router.push(`/schedule?${params.toString()}`);
  };

  const changeClass = (value: string) => {
    const subjectStillFits =
      !value ||
      (subjectId !== "" &&
        subjects.some(
          (subject) => subject.id === subjectId && subject.classId === value,
        ));
    const nextSubject = subjectStillFits ? subjectId : "";

    setClassId(value);
    setSubjectId(nextSubject);
    navigate({ classId: value, subjectId: nextSubject });
  };

  const hasFilters =
    query.type !== "all" || Boolean(query.class) || Boolean(query.subject);

  return (
    <div className="border-border bg-surface mt-4 rounded-lg border p-3 sm:p-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-40 flex-1">
          <Label htmlFor="calendar-type">Show</Label>
          <Select
            id="calendar-type"
            value={type}
            onChange={(event) => {
              setType(event.target.value as CalendarQuery["type"]);
              navigate({ type: event.target.value });
            }}
            className="mt-1"
          >
            {CALENDAR_EVENT_TYPES.map((value) => (
              <option
                key={value}
                value={value}
              >
                {value === "all"
                  ? "All events"
                  : CALENDAR_EVENT_TYPE_LABELS[value]}
              </option>
            ))}
          </Select>
        </div>

        <div className="min-w-40 flex-1">
          <Label htmlFor="calendar-class">Class</Label>
          <Select
            id="calendar-class"
            value={classId}
            onChange={(event) => changeClass(event.target.value)}
            className="mt-1"
          >
            <option value="">All classes</option>
            {classes.map((item) => (
              <option
                key={item.id}
                value={item.id}
              >
                {item.name}
              </option>
            ))}
          </Select>
        </div>

        <div className="min-w-40 flex-1">
          <Label htmlFor="calendar-subject">Subject</Label>
          <Select
            id="calendar-subject"
            value={subjectId}
            onChange={(event) => {
              setSubjectId(event.target.value);
              navigate({ subjectId: event.target.value });
            }}
            className="mt-1"
          >
            <option value="">All subjects</option>
            {visibleSubjects.map((subject) => (
              <option
                key={subject.id}
                value={subject.id}
              >
                {subject.name}
              </option>
            ))}
          </Select>
        </div>

        {hasFilters ? (
          <button
            type="button"
            onClick={() => {
              setType("all");
              setClassId("");
              setSubjectId("");
              navigate({ type: "all", classId: "", subjectId: "" });
            }}
            className="text-muted-foreground hover:text-foreground pb-2.5 text-sm underline-offset-4 hover:underline"
          >
            Reset filters
          </button>
        ) : null}
      </div>
    </div>
  );
}

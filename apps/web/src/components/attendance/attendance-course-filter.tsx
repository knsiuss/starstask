"use client";

import { Layers } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import type { AttendanceTab } from "@/components/attendance/attendance-tabs";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

type CourseOption = {
  id: string;
  name: string;
  code: string | null;
};

type AttendanceCourseFilterProps = {
  /** Class workspace path the filtered view is pushed to. */
  basePath: string;
  activeView: AttendanceTab;
  subjects: CourseOption[];
  selectedCourseId: string | null;
};

/**
 * Course selector for the class attendance tab.
 *
 * The choice is stored in the URL rather than in client state, so the back
 * button and a shared link restore the same course. Every option comes from the
 * class's own courses; nothing is listed when the class has none.
 */
export function AttendanceCourseFilter({
  basePath,
  activeView,
  subjects,
  selectedCourseId,
}: AttendanceCourseFilterProps) {
  const router = useRouter();
  const formRef = React.useRef<HTMLFormElement>(null);

  if (subjects.length === 0) {
    return null;
  }

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const params = new URLSearchParams();

    for (const [key, value] of new FormData(event.currentTarget).entries()) {
      if (typeof value === "string" && value !== "") {
        params.set(key, value);
      }
    }

    router.push(`${basePath}?${params.toString()}`);
  };

  return (
    <form
      // Remount so the uncontrolled select follows the URL on back navigation.
      key={`${selectedCourseId ?? "all"}|${activeView}`}
      ref={formRef}
      method="get"
      action={basePath}
      onSubmit={submit}
      className="flex flex-wrap items-center gap-2"
    >
      <input
        type="hidden"
        name="view"
        value={activeView}
      />

      <div className="relative min-w-0 w-full sm:w-72">
        <Layers
          aria-hidden="true"
          className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
        />
        <Label
          htmlFor="attendance-course"
          className="sr-only"
        >
          Course
        </Label>
        <Select
          id="attendance-course"
          name="subject"
          defaultValue={selectedCourseId ?? ""}
          onChange={() => formRef.current?.requestSubmit()}
          className="h-10 pl-9 text-sm"
        >
          <option value="">All courses</option>
          {subjects.map((subject) => (
            <option
              key={subject.id}
              value={subject.id}
            >
              {subject.code
                ? `${subject.code} · ${subject.name}`
                : subject.name}
            </option>
          ))}
        </Select>
      </div>

      {selectedCourseId ? (
        <button
          type="button"
          onClick={() => router.push(`${basePath}?view=${activeView}`)}
          className="text-muted-foreground hover:text-foreground text-xs underline-offset-4 hover:underline"
        >
          Clear course filter
        </button>
      ) : null}
    </form>
  );
}

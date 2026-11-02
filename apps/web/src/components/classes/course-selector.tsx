"use client";

import { Alert } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { CourseOption } from "@/lib/classes/course-selection";

type CourseSelectorProps = {
  id: string;
  courses: CourseOption[];
  value: string;
  onChange: (courseId: string) => void;
  error?: string;
  hint?: string;
  disabled?: boolean;
};

/**
 * One course picker for every creation form.
 *
 * A class with a single course shows it explicitly instead of a disabled
 * select; the value is still submitted, so the record is never created at the
 * class level.
 */
export function CourseSelector({
  id,
  courses,
  value,
  onChange,
  error,
  hint,
  disabled = false,
}: CourseSelectorProps) {
  const selected = courses.find((course) => course.id === value);

  if (courses.length === 0) {
    return (
      <div className="space-y-1.5">
        <Label htmlFor={id}>Course</Label>
        <Alert
          variant="warning"
          id={id}
        >
          <p className="text-xs leading-relaxed">
            This class has no active course yet. A class admin must add a course
            before academic content can be created.
          </p>
        </Alert>
      </div>
    );
  }

  if (courses.length === 1) {
    return (
      <div className="space-y-1.5">
        <Label htmlFor={id}>Course</Label>
        <div
          id={id}
          className="border-border bg-subtle text-foreground rounded-md border px-3 py-2 text-sm font-medium"
        >
          {selected ? courseLabel(selected) : courses[0]?.name}
        </div>
        <p className="text-muted-foreground text-xs">
          This class has one active course, so every post is filed under it.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>
        Course
        <span
          aria-hidden="true"
          className="text-danger ml-0.5"
        >
          *
        </span>
      </Label>
      <Select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        required
        aria-required="true"
        aria-invalid={Boolean(error)}
      >
        <option value="">Choose a course</option>
        {courses.map((course) => (
          <option
            key={course.id}
            value={course.id}
          >
            {courseLabel(course)}
          </option>
        ))}
      </Select>
      {hint ? <p className="text-muted-foreground text-xs">{hint}</p> : null}
      {error ? <p className="text-danger text-xs">{error}</p> : null}
    </div>
  );
}

function courseLabel(course: CourseOption): string {
  return course.code ? `${course.code} · ${course.name}` : course.name;
}

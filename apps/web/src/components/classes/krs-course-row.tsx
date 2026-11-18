"use client";

import { Trash2 } from "lucide-react";

import type { KrsCourseDraft } from "@starstask/contracts";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

export type CourseRow = KrsCourseDraft & { key: string };

const DAYS = [
  { value: "", label: "No schedule day" },
  { value: "1", label: "Monday" },
  { value: "2", label: "Tuesday" },
  { value: "3", label: "Wednesday" },
  { value: "4", label: "Thursday" },
  { value: "5", label: "Friday" },
  { value: "6", label: "Saturday" },
  { value: "7", label: "Sunday" },
] as const;

type KrsCourseRowProps = {
  course: CourseRow;
  index: number;
  onChange: (key: string, patch: Partial<KrsCourseDraft>) => void;
  onRemove: (key: string) => void;
};

/**
 * Editable course and weekly schedule card inside the KRS import preview.
 */
export function KrsCourseRow({
  course,
  index,
  onChange,
  onRemove,
}: KrsCourseRowProps) {
  return (
    <div className="border-border bg-subtle space-y-3 rounded-lg border p-3.5">
      <div className="flex items-start gap-2">
        <div className="grid flex-1 gap-3 sm:grid-cols-3">
          <div className="space-y-1">
            <Label htmlFor={`course-code-${course.key}`}>Code</Label>
            <Input
              id={`course-code-${course.key}`}
              value={course.courseCode}
              onChange={(event) =>
                onChange(course.key, { courseCode: event.target.value })
              }
              placeholder="TPL0313"
              maxLength={30}
              className="h-11"
            />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor={`course-name-${course.key}`}>
              Course {index + 1} name
            </Label>
            <Input
              id={`course-name-${course.key}`}
              value={course.courseName}
              onChange={(event) =>
                onChange(course.key, { courseName: event.target.value })
              }
              placeholder="Pemrograman Web 1"
              maxLength={120}
              className="h-11"
            />
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={`Remove course ${index + 1}`}
          onClick={() => onRemove(course.key)}
          className="mt-6 min-h-[44px] min-w-[44px] shrink-0"
        >
          <Trash2
            aria-hidden="true"
            className="h-4 w-4"
          />
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1">
          <Label htmlFor={`lecturer-${course.key}`}>Lecturer</Label>
          <Input
            id={`lecturer-${course.key}`}
            value={course.lecturerName ?? ""}
            onChange={(event) =>
              onChange(course.key, {
                lecturerName: event.target.value || null,
              })
            }
            placeholder="Optional"
            maxLength={120}
            className="h-11"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`day-${course.key}`}>Day</Label>
          <Select
            id={`day-${course.key}`}
            value={course.dayOfWeek ? String(course.dayOfWeek) : ""}
            onChange={(event) =>
              onChange(course.key, {
                dayOfWeek: event.target.value
                  ? Number(event.target.value)
                  : null,
              })
            }
            className="h-11"
          >
            {DAYS.map((day) => (
              <option
                key={day.label}
                value={day.value}
              >
                {day.label}
              </option>
            ))}
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label htmlFor={`start-${course.key}`}>Start</Label>
            <Input
              id={`start-${course.key}`}
              type="time"
              value={course.startTime ?? ""}
              onChange={(event) =>
                onChange(course.key, {
                  startTime: event.target.value || null,
                })
              }
              className="h-11"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`end-${course.key}`}>End</Label>
            <Input
              id={`end-${course.key}`}
              type="time"
              value={course.endTime ?? ""}
              onChange={(event) =>
                onChange(course.key, {
                  endTime: event.target.value || null,
                })
              }
              className="h-11"
            />
          </div>
        </div>
        <div className="space-y-1">
          <Label htmlFor={`room-${course.key}`}>Room</Label>
          <Input
            id={`room-${course.key}`}
            value={course.room ?? ""}
            onChange={(event) =>
              onChange(course.key, { room: event.target.value || null })
            }
            placeholder="Optional"
            maxLength={80}
            className="h-11"
          />
        </div>
      </div>
    </div>
  );
}

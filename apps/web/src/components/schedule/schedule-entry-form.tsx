import { Loader2, PlusCircle, X } from "lucide-react";
import type { FormEvent } from "react";

import {
  CLASS_SCHEDULE_DAY_LABELS,
  CLASS_SCHEDULE_DAYS,
} from "@starstask/contracts";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

export type ScheduleSubjectOption = {
  id: string;
  name: string;
  lecturer_name: string | null;
};

export type ScheduleEntryValues = {
  subjectId: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  room: string;
  lecturerName: string;
};

export const EMPTY_SCHEDULE_VALUES: ScheduleEntryValues = {
  subjectId: "",
  dayOfWeek: "1",
  startTime: "",
  endTime: "",
  room: "",
  lecturerName: "",
};

type ScheduleEntryFormProps = {
  subjects: ScheduleSubjectOption[];
  values: ScheduleEntryValues;
  fieldErrors: Record<string, string>;
  error: string | null;
  busyId: string | null;
  editingId: string | null;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onChange: <Key extends keyof ScheduleEntryValues>(
    key: Key,
    value: ScheduleEntryValues[Key],
  ) => void;
  onReset: () => void;
  /** Sidebar variant: two-column fields and a full-width submit button. */
  compact?: boolean;
};

export function ScheduleEntryForm({
  subjects,
  values,
  fieldErrors,
  error,
  busyId,
  editingId,
  onSubmit,
  onChange,
  onReset,
  compact = false,
}: ScheduleEntryFormProps) {
  return (
    <form
      onSubmit={onSubmit}
      className={
        compact
          ? undefined
          : "border-border bg-surface mt-5 rounded-lg border p-4"
      }
    >
      <h3 className="inline-flex items-center gap-2 text-sm font-semibold tracking-tight">
        <PlusCircle
          aria-hidden="true"
          className="h-4 w-4"
        />
        {editingId ? "Edit schedule entry" : "Add a weekly slot"}
      </h3>

      {error ? (
        <Alert
          variant="error"
          className="mt-3"
        >
          {error}
        </Alert>
      ) : null}

      <div
        className={
          compact
            ? "mt-3 grid gap-3 sm:grid-cols-2"
            : "mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
        }
      >
        <div>
          <Label htmlFor="schedule-subject">Subject</Label>
          <Select
            id="schedule-subject"
            value={values.subjectId}
            onChange={(event) => onChange("subjectId", event.target.value)}
            aria-invalid={Boolean(fieldErrors.subjectId)}
            className="mt-1"
          >
            <option value="">Choose a subject</option>
            {subjects.map((subject) => (
              <option
                key={subject.id}
                value={subject.id}
              >
                {subject.name}
              </option>
            ))}
          </Select>
          {fieldErrors.subjectId ? (
            <p className="text-danger mt-1 text-xs">{fieldErrors.subjectId}</p>
          ) : null}
        </div>

        <div>
          <Label htmlFor="schedule-day">Day</Label>
          <Select
            id="schedule-day"
            value={values.dayOfWeek}
            onChange={(event) => onChange("dayOfWeek", event.target.value)}
            className="mt-1"
          >
            {CLASS_SCHEDULE_DAYS.map((day) => (
              <option
                key={day}
                value={String(day)}
              >
                {CLASS_SCHEDULE_DAY_LABELS[day]}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <Label htmlFor="schedule-room">Room (optional)</Label>
          <Input
            id="schedule-room"
            value={values.room}
            onChange={(event) => onChange("room", event.target.value)}
            placeholder="For example: Room 301"
            maxLength={120}
            className="mt-1"
          />
        </div>

        <div>
          <Label htmlFor="schedule-start">Starts</Label>
          <Input
            id="schedule-start"
            type="time"
            value={values.startTime}
            onChange={(event) => onChange("startTime", event.target.value)}
            aria-invalid={Boolean(fieldErrors.startTime)}
            className="mt-1"
          />
          {fieldErrors.startTime ? (
            <p className="text-danger mt-1 text-xs">{fieldErrors.startTime}</p>
          ) : null}
        </div>

        <div>
          <Label htmlFor="schedule-end">Ends</Label>
          <Input
            id="schedule-end"
            type="time"
            value={values.endTime}
            onChange={(event) => onChange("endTime", event.target.value)}
            aria-invalid={Boolean(fieldErrors.endTime)}
            className="mt-1"
          />
          {fieldErrors.endTime ? (
            <p className="text-danger mt-1 text-xs">{fieldErrors.endTime}</p>
          ) : null}
        </div>

        <div>
          <Label htmlFor="schedule-lecturer">Lecturer (optional)</Label>
          <Input
            id="schedule-lecturer"
            value={values.lecturerName}
            onChange={(event) => onChange("lecturerName", event.target.value)}
            placeholder="Falls back to the subject lecturer"
            maxLength={120}
            className="mt-1"
          />
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <Button
          type="submit"
          disabled={busyId !== null}
          className={compact ? "w-full" : undefined}
        >
          {busyId === "new" || (editingId && busyId === editingId) ? (
            <Loader2
              aria-hidden="true"
              className="h-4 w-4 animate-spin"
            />
          ) : null}
          {editingId ? "Save changes" : "Add slot"}
        </Button>
        {editingId ? (
          <Button
            type="button"
            variant="ghost"
            onClick={onReset}
            disabled={busyId !== null}
          >
            <X
              aria-hidden="true"
              className="h-4 w-4"
            />
            Cancel
          </Button>
        ) : null}
      </div>
    </form>
  );
}

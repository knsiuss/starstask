"use client";

import { Loader2, Pencil, PlusCircle, Trash2, X } from "lucide-react";
import * as React from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { ClassScheduleEntry } from "@/lib/db/class-schedule";
import {
  CLASS_SCHEDULE_DAY_LABELS,
  CLASS_SCHEDULE_DAYS,
  classScheduleCreateSchema,
  toFieldErrors,
  type ClassScheduleDay,
} from "@starstask/contracts";

type ScheduleSubjectOption = {
  id: string;
  name: string;
  lecturer_name: string | null;
};

type ScheduleManagerProps = {
  classSlug: string;
  subjects: ScheduleSubjectOption[];
  entries: ClassScheduleEntry[];
};

type FormValues = {
  subjectId: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  room: string;
  lecturerName: string;
};

const EMPTY_VALUES: FormValues = {
  subjectId: "",
  dayOfWeek: "1",
  startTime: "",
  endTime: "",
  room: "",
  lecturerName: "",
};

/**
 * Add, edit, and remove the recurring weekly meeting slots of one class.
 * Every class member can maintain the shared timetable; the API and RLS enforce
 * the same membership rule.
 */
export function ScheduleManager({
  classSlug,
  subjects,
  entries: initialEntries,
}: ScheduleManagerProps) {
  const [entries, setEntries] = React.useState(initialEntries);
  const [values, setValues] = React.useState<FormValues>(EMPTY_VALUES);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>(
    {},
  );
  const [error, setError] = React.useState<string | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const grouped = CLASS_SCHEDULE_DAYS.map((day) => ({
    day,
    items: entries.filter((entry) => entry.day_of_week === day),
  })).filter((group) => group.items.length > 0);

  const resetForm = () => {
    setEditingId(null);
    setValues(EMPTY_VALUES);
    setFieldErrors({});
    setError(null);
  };

  const startEdit = (entry: ClassScheduleEntry) => {
    setEditingId(entry.id);
    setValues({
      subjectId: entry.subject_id,
      dayOfWeek: String(entry.day_of_week),
      startTime: entry.start_time,
      endTime: entry.end_time,
      room: entry.room ?? "",
      lecturerName: entry.lecturer_name ?? "",
    });
    setFieldErrors({});
    setError(null);
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (busyId) {
      return;
    }

    setError(null);
    setFieldErrors({});

    const parsed = classScheduleCreateSchema.safeParse({
      subjectId: values.subjectId || undefined,
      dayOfWeek: Number(values.dayOfWeek),
      startTime: values.startTime,
      endTime: values.endTime,
      room: values.room,
      lecturerName: values.lecturerName,
    });

    if (!parsed.success) {
      const errors = toFieldErrors(parsed.error);
      setFieldErrors(errors);
      setError(
        errors.subjectId ??
          errors.dayOfWeek ??
          errors.startTime ??
          errors.endTime ??
          "Check the highlighted fields.",
      );
      return;
    }

    setBusyId(editingId ?? "new");

    try {
      const response = await fetch(
        editingId
          ? `/api/classes/${classSlug}/schedule/${editingId}`
          : `/api/classes/${classSlug}/schedule`,
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(parsed.data),
        },
      );

      const body = (await response.json().catch(() => null)) as {
        error?: { message?: string; fields?: Record<string, string> };
      } | null;

      if (!response.ok) {
        setFieldErrors(body?.error?.fields ?? {});
        setError(body?.error?.message ?? "Could not save the schedule entry.");
        return;
      }

      const subject = subjects.find(
        (item) => item.id === parsed.data.subjectId,
      );
      const saved: ClassScheduleEntry = {
        id: editingId ?? crypto.randomUUID(),
        subject_id: parsed.data.subjectId,
        subject_name: subject?.name ?? "Subject",
        subject_lecturer_name: subject?.lecturer_name ?? null,
        day_of_week: parsed.data.dayOfWeek,
        start_time: parsed.data.startTime,
        end_time: parsed.data.endTime,
        room: parsed.data.room ?? null,
        lecturer_name: parsed.data.lecturerName ?? null,
      };

      setEntries((current) =>
        editingId
          ? current.map((entry) => (entry.id === editingId ? saved : entry))
          : [...current, saved],
      );
      resetForm();
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (id: string) => {
    if (busyId) {
      return;
    }

    setBusyId(id);

    try {
      const response = await fetch(`/api/classes/${classSlug}/schedule/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;

        setError(body?.error?.message ?? "Could not delete the entry.");
        return;
      }

      setEntries((current) => current.filter((entry) => entry.id !== id));

      if (editingId === id) {
        resetForm();
      }
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setBusyId(null);
    }
  };

  if (subjects.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Subjects are created by class admins. Once a subject exists, its weekly
        meeting times can be added here.
      </p>
    );
  }

  return (
    <div>
      {grouped.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No class hours saved yet. Add the first slot below.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {grouped.map(({ day, items }) => (
            <div
              key={day}
              className="border-border bg-surface rounded-lg border p-4"
            >
              <h3 className="text-sm font-semibold tracking-tight">
                {CLASS_SCHEDULE_DAY_LABELS[day]}
              </h3>
              <ul className="mt-2 space-y-2.5">
                {items.map((entry) => (
                  <li
                    key={entry.id}
                    className="text-sm"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium">
                          {entry.start_time}–{entry.end_time} ·{" "}
                          {entry.subject_name}
                        </p>
                        <p className="text-muted-foreground mt-0.5 text-xs">
                          {entry.room ? `${entry.room} · ` : ""}
                          {entry.lecturer_name ??
                            entry.subject_lecturer_name ??
                            "No lecturer set"}
                          {entry.lecturer_name ? " (from this entry)" : ""}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => startEdit(entry)}
                          disabled={busyId !== null}
                          aria-label={`Edit ${entry.subject_name} on ${CLASS_SCHEDULE_DAY_LABELS[entry.day_of_week as ClassScheduleDay]}`}
                        >
                          {busyId === entry.id && editingId === entry.id ? (
                            <Loader2
                              aria-hidden="true"
                              className="h-3.5 w-3.5 animate-spin"
                            />
                          ) : (
                            <Pencil
                              aria-hidden="true"
                              className="h-3.5 w-3.5"
                            />
                          )}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => void remove(entry.id)}
                          disabled={busyId !== null}
                          aria-label={`Remove ${entry.subject_name} on ${CLASS_SCHEDULE_DAY_LABELS[entry.day_of_week as ClassScheduleDay]}`}
                        >
                          <Trash2
                            aria-hidden="true"
                            className="h-3.5 w-3.5"
                          />
                        </Button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      <form
        onSubmit={submit}
        className="border-border bg-surface mt-5 rounded-lg border p-4"
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

        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <Label htmlFor="schedule-subject">Subject</Label>
            <Select
              id="schedule-subject"
              value={values.subjectId}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  subjectId: event.target.value,
                }))
              }
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
              <p className="text-danger mt-1 text-xs">
                {fieldErrors.subjectId}
              </p>
            ) : null}
          </div>

          <div>
            <Label htmlFor="schedule-day">Day</Label>
            <Select
              id="schedule-day"
              value={values.dayOfWeek}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  dayOfWeek: event.target.value,
                }))
              }
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
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  room: event.target.value,
                }))
              }
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
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  startTime: event.target.value,
                }))
              }
              aria-invalid={Boolean(fieldErrors.startTime)}
              className="mt-1"
            />
            {fieldErrors.startTime ? (
              <p className="text-danger mt-1 text-xs">
                {fieldErrors.startTime}
              </p>
            ) : null}
          </div>

          <div>
            <Label htmlFor="schedule-end">Ends</Label>
            <Input
              id="schedule-end"
              type="time"
              value={values.endTime}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  endTime: event.target.value,
                }))
              }
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
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  lecturerName: event.target.value,
                }))
              }
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
              onClick={resetForm}
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
    </div>
  );
}

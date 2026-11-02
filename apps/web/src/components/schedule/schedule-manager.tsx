"use client";

import * as React from "react";

import { classScheduleCreateSchema, toFieldErrors } from "@starstask/contracts";

import {
  EMPTY_SCHEDULE_VALUES,
  ScheduleEntryForm,
  type ScheduleEntryValues,
  type ScheduleSubjectOption,
} from "@/components/schedule/schedule-entry-form";
import { ScheduleEntryGroups } from "@/components/schedule/schedule-entry-groups";
import type { ClassScheduleEntry } from "@/lib/db/class-schedule";

type ScheduleManagerProps = {
  classSlug: string;
  subjects: ScheduleSubjectOption[];
  entries: ClassScheduleEntry[];
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
  const [values, setValues] = React.useState<ScheduleEntryValues>(
    EMPTY_SCHEDULE_VALUES,
  );
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>(
    {},
  );
  const [error, setError] = React.useState<string | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const change = <Key extends keyof ScheduleEntryValues>(
    key: Key,
    value: ScheduleEntryValues[Key],
  ) => {
    setValues((current) => ({ ...current, [key]: value }));
  };

  const resetForm = () => {
    setEditingId(null);
    setValues(EMPTY_SCHEDULE_VALUES);
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
      <ScheduleEntryGroups
        entries={entries}
        busyId={busyId}
        editingId={editingId}
        onEdit={startEdit}
        onRemove={(id) => void remove(id)}
      />

      <ScheduleEntryForm
        subjects={subjects}
        values={values}
        fieldErrors={fieldErrors}
        error={error}
        busyId={busyId}
        editingId={editingId}
        onSubmit={submit}
        onChange={change}
        onReset={resetForm}
      />
    </div>
  );
}

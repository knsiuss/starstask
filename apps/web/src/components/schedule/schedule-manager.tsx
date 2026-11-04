"use client";

import { CalendarDays, GraduationCap, Users } from "lucide-react";
import * as React from "react";

import { classScheduleCreateSchema, toFieldErrors } from "@starstask/contracts";

import {
  EMPTY_SCHEDULE_VALUES,
  ScheduleEntryForm,
  type ScheduleEntryValues,
  type ScheduleSubjectOption,
} from "@/components/schedule/schedule-entry-form";
import { ScheduleEntryGroups } from "@/components/schedule/schedule-entry-groups";
import { ScheduleImport } from "@/components/schedule/schedule-import";
import type { ClassScheduleEntry } from "@/lib/db/class-schedule";

type ScheduleManagerProps = {
  classSlug: string;
  subjects: ScheduleSubjectOption[];
  entries: ClassScheduleEntry[];
  /** Shown in the stats card when the caller knows the class size. */
  memberCount?: number;
  /** Course creation is admin-only; the import preview respects it. */
  canCreateCourses?: boolean;
};

/**
 * Add, edit, and remove the recurring weekly meeting slots of one class.
 * Every class member can maintain the shared timetable; the API and RLS enforce
 * the same membership rule.
 */
export function ScheduleManager({
  classSlug,
  subjects: initialSubjects,
  entries: initialEntries,
  memberCount,
  canCreateCourses = false,
}: ScheduleManagerProps) {
  const [entries, setEntries] = React.useState(initialEntries);
  // Courses created during a PDF import join the options immediately, so
  // later rows and the stats card see them without a page reload.
  const [subjects, setSubjects] = React.useState(initialSubjects);
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

    // The manual form has no period/date controls, so an edit keeps the
    // semester range the row already carries (usually from an import).
    const editingEntry = editingId
      ? entries.find((entry) => entry.id === editingId)
      : undefined;
    const payload = {
      ...parsed.data,
      period: parsed.data.period ?? editingEntry?.period ?? undefined,
      startDate: parsed.data.startDate ?? editingEntry?.start_date ?? undefined,
      endDate: parsed.data.endDate ?? editingEntry?.end_date ?? undefined,
    };

    try {
      const response = await fetch(
        editingId
          ? `/api/classes/${classSlug}/schedule/${editingId}`
          : `/api/classes/${classSlug}/schedule`,
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
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
        period: payload.period ?? null,
        start_date: payload.startDate ?? null,
        end_date: payload.endDate ?? null,
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
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
      <div className="min-w-0">
        <ScheduleEntryGroups
          entries={entries}
          busyId={busyId}
          editingId={editingId}
          onEdit={startEdit}
          onRemove={(id) => void remove(id)}
        />
      </div>

      <aside className="min-w-0 space-y-4 lg:sticky lg:top-24">
        <section
          aria-label="Schedule summary"
          className="border-border bg-surface rounded-xl border p-4"
        >
          <dl className="grid grid-cols-3 gap-2">
            <Stat
              icon={
                <GraduationCap
                  aria-hidden="true"
                  className="h-4 w-4"
                />
              }
              value={subjects.length}
              label="Courses"
            />
            {memberCount !== undefined ? (
              <Stat
                icon={
                  <Users
                    aria-hidden="true"
                    className="h-4 w-4"
                  />
                }
                value={memberCount}
                label="Members"
              />
            ) : null}
            <Stat
              icon={
                <CalendarDays
                  aria-hidden="true"
                  className="h-4 w-4"
                />
              }
              value={entries.length}
              label="Schedule slots"
            />
          </dl>
        </section>

        <div className="border-border bg-surface rounded-xl border p-4">
          <ScheduleImport
            classSlug={classSlug}
            subjects={subjects}
            canCreateCourses={canCreateCourses}
            onCourseCreated={(subject) =>
              setSubjects((current) => [...current, subject])
            }
            onImported={(created) =>
              setEntries((current) => [...current, ...created])
            }
          />
        </div>

        <div className="border-border bg-surface rounded-xl border p-4">
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
            compact
          />
        </div>
      </aside>
    </div>
  );
}

function Stat({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="bg-accent-soft text-accent flex h-9 w-9 shrink-0 items-center justify-center rounded-full">
        {icon}
      </span>
      <div className="min-w-0">
        <dd className="text-lg leading-none font-semibold">{value}</dd>
        <dt className="text-muted-foreground mt-1 truncate text-[11px]">
          {label}
        </dt>
      </div>
    </div>
  );
}

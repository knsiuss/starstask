"use client";

import {
  ArrowUpRight,
  BookOpen,
  Loader2,
  MoreHorizontal,
  Pencil,
  RotateCcw,
  X,
} from "lucide-react";
import { Archive } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";

import { StatusBadge } from "@/components/classes/status-badge";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils/cn";
import type { ClassSubjectWithTaskCount } from "@starstask/contracts";
import { pluralize } from "@starstask/shared";

type CourseManagerProps = {
  classSlug: string;
  courses: ClassSubjectWithTaskCount[];
  layout?: "grid" | "list";
};

type EditValues = {
  name: string;
  code: string;
  lecturerName: string;
  description: string;
};

/**
 * Edit and archive the courses of one class group. Archiving keeps every
 * assignment, material, and attendance record; it only stops new content.
 * The same filtered course list renders as cards (grid) or rows (list).
 */
export function CourseManager({
  classSlug,
  courses,
  layout = "grid",
}: CourseManagerProps) {
  const router = useRouter();
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [values, setValues] = React.useState<EditValues>({
    name: "",
    code: "",
    lecturerName: "",
    description: "",
  });
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const patch = async (
    course: ClassSubjectWithTaskCount,
    body: Record<string, string | undefined>,
    requestId: string,
  ) => {
    setError(null);
    setBusyId(requestId);

    try {
      const response = await fetch(
        `/api/classes/${classSlug}/subjects/${course.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        setError(payload?.error?.message ?? "Could not update the course.");
        return false;
      }

      return true;
    } catch {
      setError("Network error. Check your connection and try again.");
      return false;
    } finally {
      setBusyId(null);
    }
  };

  const startEdit = (course: ClassSubjectWithTaskCount) => {
    setEditingId(course.id);
    setValues({
      name: course.name,
      code: course.code ?? "",
      lecturerName: course.lecturer_name ?? "",
      description: course.description ?? "",
    });
    setError(null);
  };

  const saveEdit = async (course: ClassSubjectWithTaskCount) => {
    if (busyId) {
      return;
    }

    const saved = await patch(
      course,
      {
        name: values.name,
        code: values.code.trim() || undefined,
        lecturerName: values.lecturerName.trim() || undefined,
        description: values.description.trim() || undefined,
        status: course.status,
      },
      course.id,
    );

    if (saved) {
      setEditingId(null);
      router.refresh();
    }
  };

  const setStatus = async (
    course: ClassSubjectWithTaskCount,
    status: "active" | "archived",
  ) => {
    if (busyId) {
      return;
    }

    // The update function replaces every supplied column, so the current values
    // are sent back with the new status to avoid clearing them.
    const saved = await patch(
      course,
      {
        name: course.name,
        code: course.code ?? undefined,
        lecturerName: course.lecturer_name ?? undefined,
        description: course.description ?? undefined,
        status,
      },
      course.id,
    );

    if (saved) {
      router.refresh();
    }
  };

  return (
    <div>
      {error ? (
        <Alert
          variant="error"
          className="mt-4"
        >
          {error}
        </Alert>
      ) : null}

      {layout === "grid" ? (
        <ul className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {courses.map((course) => (
            <li key={course.id}>
              <CourseCard
                classSlug={classSlug}
                course={course}
                isEditing={editingId === course.id}
                values={values}
                onValuesChange={setValues}
                busy={busyId === course.id}
                onEdit={() => startEdit(course)}
                onCancelEdit={() => setEditingId(null)}
                onSave={() => void saveEdit(course)}
                onToggleStatus={() =>
                  void setStatus(
                    course,
                    course.status === "active" ? "archived" : "active",
                  )
                }
              />
            </li>
          ))}
        </ul>
      ) : (
        <ul className="divide-border border-border bg-surface mt-4 divide-y overflow-hidden rounded-xl border">
          {courses.map((course) => (
            <li
              key={course.id}
              className="px-4 py-4"
            >
              <CourseCard
                classSlug={classSlug}
                course={course}
                isEditing={editingId === course.id}
                values={values}
                onValuesChange={setValues}
                busy={busyId === course.id}
                onEdit={() => startEdit(course)}
                onCancelEdit={() => setEditingId(null)}
                onSave={() => void saveEdit(course)}
                onToggleStatus={() =>
                  void setStatus(
                    course,
                    course.status === "active" ? "archived" : "active",
                  )
                }
                compact
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

type CourseCardProps = {
  classSlug: string;
  course: ClassSubjectWithTaskCount;
  isEditing: boolean;
  values: EditValues;
  onValuesChange: (values: EditValues) => void;
  busy: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSave: () => void;
  onToggleStatus: () => void;
  compact?: boolean;
};

/** One course in the board: identity, status, task count, and actions. */
function CourseCard({
  classSlug,
  course,
  isEditing,
  values,
  onValuesChange,
  busy,
  onEdit,
  onCancelEdit,
  onSave,
  onToggleStatus,
  compact = false,
}: CourseCardProps) {
  if (isEditing) {
    return (
      <div className="border-border bg-surface rounded-xl border p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Edit course</h3>
          <button
            type="button"
            onClick={onCancelEdit}
            aria-label="Close edit form"
            className="text-muted-foreground hover:text-foreground rounded p-1"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor={`course-name-${course.id}`}>Name</Label>
            <Input
              id={`course-name-${course.id}`}
              value={values.name}
              onChange={(event) =>
                onValuesChange({ ...values, name: event.target.value })
              }
              maxLength={120}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`course-code-${course.id}`}>Code (optional)</Label>
            <Input
              id={`course-code-${course.id}`}
              value={values.code}
              onChange={(event) =>
                onValuesChange({ ...values, code: event.target.value })
              }
              maxLength={20}
            />
          </div>
        </div>

        <div className="mt-3 space-y-1.5">
          <Label htmlFor={`course-lecturer-${course.id}`}>
            Lecturer (optional)
          </Label>
          <Input
            id={`course-lecturer-${course.id}`}
            value={values.lecturerName}
            onChange={(event) =>
              onValuesChange({ ...values, lecturerName: event.target.value })
            }
            maxLength={120}
          />
        </div>

        <div className="mt-3 space-y-1.5">
          <Label htmlFor={`course-description-${course.id}`}>
            Description (optional)
          </Label>
          <Textarea
            id={`course-description-${course.id}`}
            value={values.description}
            onChange={(event) =>
              onValuesChange({ ...values, description: event.target.value })
            }
            rows={3}
            maxLength={2_000}
          />
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={onCancelEdit}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={onSave}
            disabled={busy || !values.name.trim()}
          >
            {busy ? (
              <Loader2
                aria-hidden="true"
                className="mr-1.5 h-3.5 w-3.5 animate-spin"
              />
            ) : null}
            Save course
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-wrap items-start justify-between gap-3",
        !compact && "border-border bg-surface h-full rounded-xl border p-4",
      )}
    >
      <div className="flex min-w-0 gap-3">
        <span
          aria-hidden="true"
          className="bg-accent-soft text-accent flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
        >
          <BookOpen className="h-4.5 w-4.5" />
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/app/classes/${classSlug}/courses/${course.id}`}
              className="hover:text-accent text-sm font-semibold tracking-tight hover:underline"
            >
              {course.name}
            </Link>
            <StatusBadge status={course.status} />
          </div>
          <p className="text-muted-foreground mt-1 text-xs">
            {[course.code, course.lecturer_name].filter(Boolean).join(" · ") ||
              "No lecturer set"}
          </p>
          <p className="text-muted-foreground mt-1.5 inline-flex items-center gap-1.5 text-xs">
            {course.task_count} {pluralize(course.task_count, "assignment")}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <Button
          asChild
          size="sm"
          variant="secondary"
        >
          <Link href={`/app/classes/${classSlug}/courses/${course.id}`}>
            Open
            <ArrowUpRight
              aria-hidden="true"
              className="ml-1 h-3.5 w-3.5"
            />
          </Link>
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="sm"
              variant="secondary"
              aria-label={`Actions for ${course.name}`}
              disabled={busy}
            >
              {busy ? (
                <Loader2
                  aria-hidden="true"
                  className="h-3.5 w-3.5 animate-spin"
                />
              ) : (
                <MoreHorizontal
                  aria-hidden="true"
                  className="h-3.5 w-3.5"
                />
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={onEdit}>
              <Pencil
                aria-hidden="true"
                className="h-3.5 w-3.5"
              />
              Edit course
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onToggleStatus}>
              {course.status === "active" ? (
                <>
                  <Archive
                    aria-hidden="true"
                    className="h-3.5 w-3.5"
                  />
                  Archive course
                </>
              ) : (
                <>
                  <RotateCcw
                    aria-hidden="true"
                    className="h-3.5 w-3.5"
                  />
                  Reactivate course
                </>
              )}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

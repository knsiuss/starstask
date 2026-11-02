"use client";

import {
  ArrowUpRight,
  BookOpen,
  Loader2,
  Pencil,
  RotateCcw,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";

import type { ClassSubjectWithTaskCount } from "@starstask/contracts";
import { pluralize } from "@starstask/shared";

import { StatusBadge } from "@/components/classes/status-badge";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type CourseManagerProps = {
  classSlug: string;
  courses: ClassSubjectWithTaskCount[];
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
 */
export function CourseManager({ classSlug, courses }: CourseManagerProps) {
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

      {courses.length === 0 ? (
        <p className="text-muted-foreground mt-4 text-sm">
          No course yet. Add the first course before posting assignments,
          attendance, or schedule entries.
        </p>
      ) : (
        <ul className="divide-border border-border mt-4 divide-y border-y">
          {courses.map((course) => {
            const isEditing = editingId === course.id;

            return (
              <li
                key={course.id}
                className="py-4"
              >
                {isEditing ? (
                  <div className="border-border bg-subtle rounded-xl border p-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold">Edit course</h3>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
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
                            setValues((current) => ({
                              ...current,
                              name: event.target.value,
                            }))
                          }
                          maxLength={120}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor={`course-code-${course.id}`}>
                          Code (optional)
                        </Label>
                        <Input
                          id={`course-code-${course.id}`}
                          value={values.code}
                          onChange={(event) =>
                            setValues((current) => ({
                              ...current,
                              code: event.target.value,
                            }))
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
                          setValues((current) => ({
                            ...current,
                            lecturerName: event.target.value,
                          }))
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
                          setValues((current) => ({
                            ...current,
                            description: event.target.value,
                          }))
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
                        onClick={() => setEditingId(null)}
                        disabled={busyId === course.id}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => void saveEdit(course)}
                        disabled={busyId === course.id || !values.name.trim()}
                      >
                        {busyId === course.id ? (
                          <Loader2
                            aria-hidden="true"
                            className="mr-1.5 h-3.5 w-3.5 animate-spin"
                          />
                        ) : null}
                        Save course
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex min-w-0 gap-3">
                      <span className="bg-accent-soft text-accent flex h-9 w-9 shrink-0 items-center justify-center rounded-lg">
                        <BookOpen
                          aria-hidden="true"
                          className="h-4 w-4"
                        />
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            href={`/dashboard/classes/${classSlug}/courses/${course.id}`}
                            className="hover:text-accent text-sm font-medium hover:underline"
                          >
                            {course.name}
                          </Link>
                          {course.code ? (
                            <span className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 font-mono text-[10px]">
                              {course.code}
                            </span>
                          ) : null}
                          <StatusBadge status={course.status} />
                        </div>
                        <p className="text-muted-foreground mt-1 text-xs">
                          {course.lecturer_name ?? "No lecturer set"}
                          {" · "}
                          {course.task_count}{" "}
                          {pluralize(course.task_count, "published assignment")}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1">
                      <Button
                        asChild
                        size="sm"
                        variant="ghost"
                      >
                        <Link
                          href={`/dashboard/classes/${classSlug}/courses/${course.id}`}
                        >
                          Open
                          <ArrowUpRight
                            aria-hidden="true"
                            className="ml-1 h-3.5 w-3.5"
                          />
                        </Link>
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => startEdit(course)}
                        disabled={busyId === course.id}
                      >
                        <Pencil
                          aria-hidden="true"
                          className="mr-1 h-3.5 w-3.5"
                        />
                        Edit
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          void setStatus(
                            course,
                            course.status === "active" ? "archived" : "active",
                          )
                        }
                        disabled={busyId === course.id}
                      >
                        {busyId === course.id ? (
                          <Loader2
                            aria-hidden="true"
                            className="mr-1 h-3.5 w-3.5 animate-spin"
                          />
                        ) : (
                          <RotateCcw
                            aria-hidden="true"
                            className="mr-1 h-3.5 w-3.5"
                          />
                        )}
                        {course.status === "active" ? "Archive" : "Reactivate"}
                      </Button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

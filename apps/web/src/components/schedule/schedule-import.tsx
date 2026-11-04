"use client";

import { Loader2, Plus, Upload } from "lucide-react";
import { useRef, useState } from "react";

import type { ScheduleSubjectOption } from "@/components/schedule/schedule-entry-form";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { formatDate } from "@starstask/shared";

import {
  normalizeScheduleName,
  type MatchedScheduleRow,
  type ScheduleMatchMethod,
} from "@/features/schedule/schedule-match";
import type { ClassScheduleEntry } from "@/lib/db/class-schedule";
import type { ScheduleParseWarning } from "@/lib/ocr/schedule-parse";

type ImportResponse = {
  rows: MatchedScheduleRow[];
  warnings: ScheduleParseWarning[];
};

type CourseDraft = {
  name: string;
  code: string;
  lecturer: string;
};

type PreviewRow = MatchedScheduleRow & {
  included: boolean;
  subjectId: string;
  createDraft: CourseDraft | null;
  createdNew: boolean;
};

type ScheduleImportProps = {
  classSlug: string;
  subjects: ScheduleSubjectOption[];
  canCreateCourses: boolean;
  onCourseCreated: (subject: ScheduleSubjectOption) => void;
  onImported: (entries: ClassScheduleEntry[]) => void;
};

const MATCH_LABELS: Record<ScheduleMatchMethod, string> = {
  code: "Matched by course code",
  name: "Matched by name",
  "name+lecturer": "Matched by name and lecturer",
  none: "No match — choose a course",
};

/**
 * Uploads a timetable PDF, shows the parsed rows for confirmation, and
 * saves the confirmed ones. Parsing and matching happen server-side; this
 * component only collects the user's confirmation.
 */
export function ScheduleImport({
  classSlug,
  subjects,
  canCreateCourses,
  onCourseCreated,
  onImported,
}: ScheduleImportProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [creatingIndex, setCreatingIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewRow[] | null>(null);
  const [warnings, setWarnings] = useState<ScheduleParseWarning[]>([]);

  const upload = async (file: File) => {
    setBusy(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(
        `/api/classes/${classSlug}/schedule/import`,
        { method: "POST", body: formData },
      );
      const body = (await response.json().catch(() => null)) as {
        data?: ImportResponse;
        error?: { message?: string };
      } | null;

      if (!response.ok || !body?.data) {
        setError(
          body?.error?.message ??
            "This file could not be read. Add the slots manually instead.",
        );
        return;
      }

      setPreview(
        body.data.rows.map((row) => ({
          ...row,
          included: true,
          subjectId: row.subjectId ?? "",
          createDraft: null,
          createdNew: false,
        })),
      );
      setWarnings(body.data.warnings);
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!preview) {
      return;
    }

    const selected = preview.filter((row) => row.included && row.subjectId);

    if (selected.length === 0) {
      setError("Choose a course for at least one row to import.");
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const response = await fetch(`/api/classes/${classSlug}/schedule/batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          selected.map((row) => ({
            subjectId: row.subjectId,
            dayOfWeek: row.dayOfWeek,
            startTime: row.startTime,
            endTime: row.endTime,
            room: row.room,
            lecturerName: row.lecturerName,
            period: row.period,
            startDate: row.startDate,
            endDate: row.endDate,
          })),
        ),
      });
      const body = (await response.json().catch(() => null)) as {
        data?: ClassScheduleEntry[];
        error?: { message?: string };
      } | null;

      if (!response.ok || !body?.data) {
        setError(
          body?.error?.message ??
            "The imported slots could not be saved. Nothing was changed.",
        );
        return;
      }

      onImported(body.data);
      setPreview(null);
      setWarnings([]);
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  const updateRow = (index: number, patch: Partial<PreviewRow>) => {
    setPreview((current) =>
      current
        ? current.map((row, rowIndex) =>
            rowIndex === index ? { ...row, ...patch } : row,
          )
        : current,
    );
  };

  const createCourse = async (index: number) => {
    const row = preview?.[index];
    const draft = row?.createDraft;

    if (!row || !draft) {
      return;
    }

    const name = draft.name.trim();

    if (name.length < 2) {
      setError("Give the new course a name of at least 2 characters.");
      return;
    }

    // Another row may have created the same course already in this preview.
    const existing = subjects.find(
      (subject) =>
        normalizeScheduleName(subject.name) === normalizeScheduleName(name),
    );

    if (existing) {
      updateRow(index, {
        subjectId: existing.id,
        createDraft: null,
        included: true,
      });
      return;
    }

    setCreatingIndex(index);
    setError(null);

    try {
      const response = await fetch(`/api/classes/${classSlug}/subjects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          code: draft.code.trim() || undefined,
          lecturerName: draft.lecturer.trim() || undefined,
        }),
      });
      const body = (await response.json().catch(() => null)) as {
        data?: { id?: string };
        error?: { message?: string };
      } | null;

      if (!response.ok || !body?.data?.id) {
        setError(
          body?.error?.message ??
            "The new course could not be created. Nothing was changed.",
        );
        return;
      }

      const created: ScheduleSubjectOption = {
        id: body.data.id,
        name,
        lecturer_name: draft.lecturer.trim() || null,
      };

      onCourseCreated(created);
      updateRow(index, {
        subjectId: created.id,
        createDraft: null,
        createdNew: true,
        included: true,
      });
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setCreatingIndex(null);
    }
  };

  const selectedCount =
    preview?.filter((row) => row.included && row.subjectId).length ?? 0;

  return (
    <div>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="sr-only"
        aria-label="Upload a timetable PDF"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";

          if (file) {
            void upload(file);
          }
        }}
      />
      <Button
        type="button"
        variant="secondary"
        className="w-full rounded-full"
        disabled={busy}
        onClick={() => fileInputRef.current?.click()}
      >
        {busy ? (
          <Loader2
            aria-hidden="true"
            className="h-4 w-4 animate-spin"
          />
        ) : (
          <Upload
            aria-hidden="true"
            className="h-4 w-4"
          />
        )}
        Import from PDF
      </Button>
      <p className="text-muted-foreground mt-2 text-xs">
        Upload a timetable PDF with a text layer. Rows are matched to this
        class&apos;s courses and always confirmed before saving.
      </p>

      {error && !preview ? (
        <Alert
          variant="error"
          className="mt-3"
        >
          {error}
        </Alert>
      ) : null}

      <Dialog
        open={preview !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPreview(null);
            setWarnings([]);
            setError(null);
          }
        }}
      >
        <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-2xl">
          <DialogTitle>Review imported slots</DialogTitle>
          <DialogDescription>
            Check the course, time, and details for each row. Rows without a
            course are skipped until you choose one.
          </DialogDescription>

          {error ? (
            <Alert
              variant="error"
              className="mt-4"
            >
              {error}
            </Alert>
          ) : null}

          {warnings.length > 0 ? (
            <Alert
              variant="warning"
              className="mt-4"
            >
              {warnings.length}{" "}
              {warnings.length === 1 ? "row was" : "rows were"} skipped because
              they could not be read. Add them manually if needed.
            </Alert>
          ) : null}

          <ul className="mt-4 space-y-3">
            {preview?.map((row, index) => {
              const draft = row.createDraft;

              return (
                <li
                  key={`${row.rowNumber}-${index}`}
                  className="border-border bg-surface rounded-xl border p-3"
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={row.included}
                      disabled={!row.subjectId}
                      onChange={(event) =>
                        updateRow(index, { included: event.target.checked })
                      }
                      aria-label={`Include row ${row.rowNumber}`}
                      className="accent-(--color-accent) mt-1 h-4 w-4 shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">
                        {row.courseName}
                        <span className="text-muted-foreground font-normal">
                          {" "}
                          · {row.startTime}–{row.endTime}
                          {row.room ? ` · ${row.room}` : ""}
                          {row.lecturerName ? ` · ${row.lecturerName}` : ""}
                        </span>
                      </p>
                      <p className="text-muted-foreground mt-0.5 text-xs">
                        Day {row.dayOfWeek}
                        {row.period ? ` · Period ${row.period}` : ""}
                        {row.startDate && row.endDate
                          ? ` · ${formatDate(row.startDate)} – ${formatDate(row.endDate)}`
                          : ""}
                        {" · "}
                        {row.createdNew
                          ? "New course created"
                          : MATCH_LABELS[row.matchedBy]}
                        {row.classCode ? ` · Class ${row.classCode}` : ""}
                      </p>
                      {row.warnings.map((warning) => (
                        <p
                          key={warning}
                          className="text-warning mt-0.5 text-xs"
                        >
                          {warning}
                        </p>
                      ))}
                      <div className="mt-2 max-w-xs">
                        <Label htmlFor={`import-subject-${index}`}>
                          Course
                        </Label>
                        <Select
                          id={`import-subject-${index}`}
                          value={row.subjectId}
                          onChange={(event) =>
                            updateRow(index, {
                              subjectId: event.target.value,
                              createDraft: null,
                              included: true,
                            })
                          }
                          className="mt-1"
                        >
                          <option value="">Choose a course</option>
                          {subjects.map((subject) => (
                            <option
                              key={subject.id}
                              value={subject.id}
                            >
                              {subject.name}
                            </option>
                          ))}
                        </Select>

                        {canCreateCourses &&
                        !row.subjectId &&
                        !row.createDraft ? (
                          <button
                            type="button"
                            onClick={() =>
                              updateRow(index, {
                                createDraft: {
                                  name: row.courseName,
                                  code: row.courseCode,
                                  lecturer: row.lecturerName ?? "",
                                },
                              })
                            }
                            className="text-accent focus-visible:outline-accent mt-2 inline-flex items-center gap-1 text-xs font-medium hover:underline focus-visible:outline-2"
                          >
                            <Plus
                              aria-hidden="true"
                              className="h-3.5 w-3.5"
                            />
                            Create new course
                          </button>
                        ) : null}

                        {draft ? (
                          <div className="border-border bg-muted/50 mt-2 space-y-2 rounded-lg border p-3">
                            <div>
                              <Label htmlFor={`import-new-name-${index}`}>
                                New course name
                              </Label>
                              <Input
                                id={`import-new-name-${index}`}
                                value={draft.name}
                                onChange={(event) =>
                                  updateRow(index, {
                                    createDraft: {
                                      ...draft,
                                      name: event.target.value,
                                    },
                                  })
                                }
                                maxLength={120}
                                className="mt-1"
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <Label htmlFor={`import-new-code-${index}`}>
                                  Code (optional)
                                </Label>
                                <Input
                                  id={`import-new-code-${index}`}
                                  value={draft.code}
                                  onChange={(event) =>
                                    updateRow(index, {
                                      createDraft: {
                                        ...draft,
                                        code: event.target.value,
                                      },
                                    })
                                  }
                                  maxLength={20}
                                  className="mt-1"
                                />
                              </div>
                              <div>
                                <Label htmlFor={`import-new-lecturer-${index}`}>
                                  Lecturer (optional)
                                </Label>
                                <Input
                                  id={`import-new-lecturer-${index}`}
                                  value={draft.lecturer}
                                  onChange={(event) =>
                                    updateRow(index, {
                                      createDraft: {
                                        ...draft,
                                        lecturer: event.target.value,
                                      },
                                    })
                                  }
                                  maxLength={120}
                                  className="mt-1"
                                />
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                type="button"
                                size="sm"
                                disabled={
                                  creatingIndex !== null ||
                                  draft.name.trim().length < 2
                                }
                                onClick={() => void createCourse(index)}
                              >
                                {creatingIndex === index ? (
                                  <Loader2
                                    aria-hidden="true"
                                    className="h-3.5 w-3.5 animate-spin"
                                  />
                                ) : null}
                                Create course
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                disabled={creatingIndex !== null}
                                onClick={() =>
                                  updateRow(index, { createDraft: null })
                                }
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={() => {
                setPreview(null);
                setWarnings([]);
                setError(null);
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={busy || selectedCount === 0}
              onClick={() => void save()}
            >
              {busy ? (
                <Loader2
                  aria-hidden="true"
                  className="h-4 w-4 animate-spin"
                />
              ) : null}
              Save {selectedCount} {selectedCount === 1 ? "slot" : "slots"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

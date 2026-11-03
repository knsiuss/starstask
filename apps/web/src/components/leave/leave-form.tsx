"use client";

import {
  AlignLeft,
  Bookmark,
  CalendarDays,
  Check,
  ChevronDown,
  ClipboardCheck,
  FileText,
  GraduationCap,
  Loader2,
  Paperclip,
  Send,
  Sparkles,
  Tags,
  Trash2,
  UploadCloud,
  type LucideIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils/cn";
import { isFeatureEnabled } from "@/lib/config/features";
import {
  LEAVE_EVIDENCE_MAX_BYTES,
  LEAVE_EVIDENCE_MAX_FILES,
  LEAVE_EXPLANATION_MAX,
  LEAVE_REASON_CATEGORIES,
  LEAVE_REASON_LABELS,
  leaveRequestCreateSchema,
  leaveRequestUpdateSchema,
  toFieldErrors,
  type LeaveFieldSource,
  type LeaveOcrSuggestion,
  type LeaveRequestStatus,
} from "@starstask/contracts";
import { formatFileSize, formatLeaveDate } from "@starstask/shared";

/** One course of a class the absence can cover. */
export type LeaveCourseChoice = {
  id: string;
  name: string;
};

/** One class the student can file the request under. */
export type LeaveClassChoice = {
  id: string;
  name: string;
  /** Active courses of the class. A class can hold more than one. */
  courses: LeaveCourseChoice[];
};

type LeaveFormProps = {
  mode: "create" | "edit";
  classId: string;
  requestId?: string;
  status?: LeaveRequestStatus;
  /** Classes offered in create mode; the form starts on `classId`. */
  classes?: LeaveClassChoice[];
  /** Courses the absence already covers, when editing a draft. */
  initialSubjectIds?: string[];
  initial: {
    leaveStartDate: string;
    leaveEndDate: string;
    reasonCategory: string;
    explanation: string;
    documentIssueDate: string;
  };
  suggestion?: LeaveOcrSuggestion | null;
  fieldSources?: Record<string, LeaveFieldSource>;
  ocrStatus?: string;
};

type FormState = {
  leaveStartDate: string;
  leaveEndDate: string;
  reasonCategory: string;
  explanation: string;
  documentIssueDate: string;
};

const SUGGESTION_FIELDS = [
  { key: "leaveStartDate", label: "Absence start" },
  { key: "leaveEndDate", label: "Absence end" },
  { key: "documentIssueDate", label: "Document issue date" },
  { key: "studentName", label: "Student name" },
  { key: "documentType", label: "Document type" },
] as const;

/** Must match the values the `field_sources` contract accepts. */
const SOURCE_LABELS: Record<LeaveFieldSource, string> = {
  manual: "Entered by you",
  ocr: "Confirmed from the document",
  ocr_corrected: "Corrected by you",
};

const CARD =
  "rounded-2xl border border-border bg-surface p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]";
const FIELD = "mt-1.5 h-11 rounded-xl";

/**
 * Create/edit form.
 *
 * OCR suggestions are only ever shown in edit mode, where they come from an
 * uploaded document; nothing is applied automatically and the confirmed source
 * of each field is recorded separately from its value.
 */
export function LeaveForm({
  mode,
  classId,
  requestId,
  status = "draft",
  classes = [],
  initialSubjectIds = [],
  initial,
  suggestion,
  fieldSources = {},
  ocrStatus,
}: LeaveFormProps) {
  const router = useRouter();
  const [form, setForm] = React.useState<FormState>(initial);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>(
    {},
  );
  const [error, setError] = React.useState<string | null>(null);
  const [warning, setWarning] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState<"save" | "submit" | null>(null);
  const [sources, setSources] =
    React.useState<Record<string, LeaveFieldSource>>(fieldSources);
  // A create attempt that already reached the API must not create a second
  // draft when the student retries after a failed upload.
  const [createdId, setCreatedId] = React.useState<string | null>(null);
  const [files, setFiles] = React.useState<File[]>([]);
  // The absence itself is unchanged by turning the reader off; the document is
  // simply not sent to the extraction provider.
  const [readerEnabled, setReaderEnabled] = React.useState(true);
  const [selectedClassId, setSelectedClassId] = React.useState(classId);
  // A class's courses belong to that class only, so switching the class clears
  // a selection that could not be saved against the new one.
  const [selectedSubjectIds, setSelectedSubjectIds] =
    React.useState<string[]>(initialSubjectIds);

  const isEditable = status === "draft";
  // A saved draft already belongs to a class; switching the picker afterwards
  // would look like it moved the draft, which the update endpoint cannot do.
  const classLocked = createdId !== null;
  const selectedClass =
    classes.find((item) => item.id === selectedClassId) ?? classes[0];

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function selectClass(nextClassId: string) {
    setSelectedClassId(nextClassId);
    setSelectedSubjectIds([]);
  }

  function toggleCourse(subjectId: string) {
    setSelectedSubjectIds((current) =>
      current.includes(subjectId)
        ? current.filter((id) => id !== subjectId)
        : [...current, subjectId],
    );
  }

  function onSelectFiles(event: React.ChangeEvent<HTMLInputElement>) {
    const incoming = Array.from(event.target.files ?? []);
    event.target.value = "";

    if (incoming.length === 0) {
      return;
    }

    const oversized = incoming.find(
      (file) => file.size > LEAVE_EVIDENCE_MAX_BYTES,
    );

    if (oversized) {
      setError(`${oversized.name} is larger than 10 MB.`);
      return;
    }

    if (files.length + incoming.length > LEAVE_EVIDENCE_MAX_FILES) {
      setError(`You can attach at most ${LEAVE_EVIDENCE_MAX_FILES} files.`);
      return;
    }

    setError(null);
    setFiles([...files, ...incoming]);
  }

  function removeFile(file: File) {
    setFiles((current) => current.filter((item) => item !== file));
  }

  /**
   * Uploads the staged files after the draft exists.
   *
   * Successful files leave the queue so a retry cannot attach them twice; the
   * first failure keeps its file and stops, because submitting without every
   * chosen document would silently drop the student's evidence.
   */
  async function uploadStagedFiles(id: string): Promise<boolean> {
    for (const file of files) {
      const body = new FormData();
      body.append("file", file);

      if (!readerEnabled) {
        body.append("ocr", "off");
      }

      const response = await fetch(`/api/leave-requests/${id}/evidence`, {
        method: "POST",
        body,
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;

        setError(payload?.error?.message ?? `Could not upload ${file.name}.`);
        return false;
      }

      setFiles((current) => current.filter((item) => item !== file));
    }

    return true;
  }

  function applySuggestion(key: keyof FormState, value: string) {
    update(key, value);
    // `ocr` is the contract's value for "accepted an extracted value", so a
    // later confirm call can persist it without being rejected.
    setSources((current) => ({ ...current, [key]: "ocr" }));
  }

  async function persist(): Promise<string | null> {
    setFieldErrors({});
    setError(null);
    setWarning(null);

    const payload = {
      leaveStartDate: form.leaveStartDate,
      leaveEndDate: form.leaveEndDate,
      reasonCategory: form.reasonCategory,
      explanation: form.explanation,
      documentIssueDate: form.documentIssueDate,
      subjectIds: selectedSubjectIds,
    };

    if (mode === "create" && !createdId) {
      const parsed = leaveRequestCreateSchema.safeParse({
        ...payload,
        classId: selectedClass?.id ?? classId,
      });

      if (!parsed.success) {
        setFieldErrors(toFieldErrors(parsed.error));
        return null;
      }

      const response = await fetch("/api/leave-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });

      const id = await handleSaveResponse(response);

      if (id) {
        setCreatedId(id);
      }

      return finishSave(id);
    }

    const targetId = mode === "edit" ? requestId : createdId;

    if (!targetId) {
      return null;
    }

    const parsed = leaveRequestUpdateSchema.safeParse(payload);

    if (!parsed.success) {
      setFieldErrors(toFieldErrors(parsed.error));
      return null;
    }

    const response = await fetch(`/api/leave-requests/${targetId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed.data),
    });

    return finishSave(await handleSaveResponse(response));
  }

  /**
   * Records which values came from the document.
   *
   * This runs after the save, so a provenance failure can never lose the
   * student's edits; it is surfaced as a warning instead.
   */
  async function finishSave(id: string | null): Promise<string | null> {
    if (!id) {
      return null;
    }

    if (ocrStatus !== "succeeded" || Object.keys(sources).length === 0) {
      return id;
    }

    const response = await fetch(`/api/leave-requests/${id}/ocr`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fieldSources: sources }),
    });

    if (!response.ok) {
      setWarning(
        "Saved, but StarsTask could not record which values came from the document.",
      );
    }

    return id;
  }

  async function handleSaveResponse(
    response: Response,
  ): Promise<string | null> {
    const body = (await response.json().catch(() => null)) as {
      data?: { id: string; reference?: string };
      error?: { message: string; fieldErrors?: Record<string, string> };
    } | null;

    if (!response.ok) {
      setFieldErrors(body?.error?.fieldErrors ?? {});
      setError(body?.error?.message ?? "Could not save the request.");
      return null;
    }

    return body?.data?.id ?? requestId ?? null;
  }

  async function onSave() {
    setBusy("save");

    try {
      const id = await persist();

      if (!id) {
        return;
      }

      if (!(await uploadStagedFiles(id))) {
        return;
      }

      router.push(`/leave-requests/${id}`);
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function onSubmit() {
    // A class with courses needs a choice: the request must say which courses
    // the absence is for, otherwise it silently claims all of them.
    if (
      (selectedClass?.courses.length ?? 0) > 0 &&
      selectedSubjectIds.length === 0
    ) {
      setError("Select at least one course this absence covers.");
      return;
    }

    if (mode === "create" && !createdId && files.length === 0) {
      setError("Attach at least one supporting document before submitting.");
      return;
    }

    setBusy("submit");

    try {
      const id = await persist();

      if (!id) {
        return;
      }

      if (!(await uploadStagedFiles(id))) {
        return;
      }

      const response = await fetch(`/api/leave-requests/${id}/submit`, {
        method: "POST",
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: { message: string };
        } | null;

        setError(body?.error?.message ?? "Could not submit the request.");
        return;
      }

      router.push(`/leave-requests/${id}`);
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  const hasSuggestion =
    suggestion &&
    SUGGESTION_FIELDS.some((field) => Boolean(suggestion[field.key]));
  const showReader = isFeatureEnabled("ocr");
  // Only the edit form has a side column, so the create form stays one column
  // on desktop instead of leaving an empty 320px lane beside it.
  const hasAside = mode === "edit" && showReader;

  return (
    <div
      className={cn(
        "grid gap-4",
        hasAside && "lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start",
      )}
    >
      <form
        className="grid gap-3.5 pb-32 lg:pb-0"
        onSubmit={(event) => {
          event.preventDefault();
          void onSave();
        }}
      >
        {error ? (
          <Alert variant="error">
            <p className="font-medium">{error}</p>
          </Alert>
        ) : null}

        {warning ? (
          <Alert variant="warning">
            <p>{warning}</p>
          </Alert>
        ) : null}

        {selectedClass ? (
          <section className={CARD}>
            <SectionHeader
              icon={GraduationCap}
              title="Class"
            />

            {classes.length > 1 ? (
              <>
                <Label
                  htmlFor="leaveClass"
                  className="sr-only"
                >
                  Class
                </Label>
                <Select
                  id="leaveClass"
                  value={selectedClass.id}
                  onChange={(event) => selectClass(event.target.value)}
                  disabled={busy !== null || classLocked}
                  className={cn(FIELD, "font-medium")}
                >
                  {classes.map((item) => (
                    <option
                      key={item.id}
                      value={item.id}
                    >
                      {item.name}
                    </option>
                  ))}
                </Select>
              </>
            ) : (
              <p className="mt-2 text-sm font-medium">{selectedClass.name}</p>
            )}

            {classLocked ? (
              <p className="text-muted-foreground mt-1 text-[11px]">
                This draft is already filed under {selectedClass.name}.
              </p>
            ) : null}

            {selectedClass.courses.length > 0 ? (
              <div className="mt-3">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-muted-foreground text-[11px] font-medium">
                    Courses this absence covers
                  </p>
                  <span className="text-muted-foreground shrink-0 text-[11px] tabular-nums">
                    {selectedSubjectIds.length} selected
                  </span>
                </div>

                <ul
                  aria-label="Courses this absence covers"
                  className="mt-1.5 flex flex-wrap gap-1.5"
                >
                  {selectedClass.courses.map((course) => {
                    const selected = selectedSubjectIds.includes(course.id);

                    return (
                      <li key={course.id}>
                        <button
                          type="button"
                          aria-pressed={selected}
                          disabled={busy !== null}
                          onClick={() => toggleCourse(course.id)}
                          className={cn(
                            "focus-visible:outline-accent flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2",
                            selected
                              ? "border-accent bg-accent-soft text-accent"
                              : "border-border bg-subtle text-foreground hover:border-accent/60",
                          )}
                        >
                          {selected ? (
                            <Check
                              aria-hidden="true"
                              className="h-3 w-3"
                            />
                          ) : null}
                          {course.name}
                        </button>
                      </li>
                    );
                  })}
                </ul>

                <p className="text-muted-foreground mt-2 text-[11px] leading-relaxed">
                  Pick every course this absence applies to. You can choose more
                  than one.
                </p>
              </div>
            ) : null}
          </section>
        ) : null}

        <section className={CARD}>
          <SectionHeader
            icon={CalendarDays}
            title="Absence period"
          />

          <div className="mt-3 grid grid-cols-1 gap-2.5 min-[350px]:grid-cols-2">
            <div className="min-w-0">
              <Label
                htmlFor="leaveStartDate"
                className="text-muted-foreground text-[11px] font-medium"
              >
                From
              </Label>
              <Input
                id="leaveStartDate"
                type="date"
                value={form.leaveStartDate}
                onChange={(event) =>
                  update("leaveStartDate", event.target.value)
                }
                aria-invalid={Boolean(fieldErrors.leaveStartDate)}
                className={cn(FIELD, "min-w-0 px-2.5")}
                required
              />
              {fieldErrors.leaveStartDate ? (
                <p className="text-danger mt-1 text-[11px]">
                  {fieldErrors.leaveStartDate}
                </p>
              ) : null}
            </div>

            <div className="min-w-0">
              <Label
                htmlFor="leaveEndDate"
                className="text-muted-foreground text-[11px] font-medium"
              >
                To
              </Label>
              <Input
                id="leaveEndDate"
                type="date"
                value={form.leaveEndDate}
                onChange={(event) => update("leaveEndDate", event.target.value)}
                aria-invalid={Boolean(fieldErrors.leaveEndDate)}
                className={cn(FIELD, "min-w-0 px-2.5")}
                required
              />
              {fieldErrors.leaveEndDate ? (
                <p className="text-danger mt-1 text-[11px]">
                  {fieldErrors.leaveEndDate}
                </p>
              ) : null}
            </div>
          </div>

          <div className="mt-3">
            <Label
              htmlFor="documentIssueDate"
              className="text-muted-foreground text-[11px] font-medium"
            >
              Document issue date · optional
            </Label>
            <Input
              id="documentIssueDate"
              type="date"
              value={form.documentIssueDate}
              onChange={(event) =>
                update("documentIssueDate", event.target.value)
              }
              className={cn(FIELD, "px-2.5")}
            />
          </div>
        </section>

        <section className={CARD}>
          <SectionHeader
            icon={Tags}
            title="Reason"
          />

          <Label
            htmlFor="reasonCategory"
            className="sr-only"
          >
            Reason
          </Label>
          <Select
            id="reasonCategory"
            value={form.reasonCategory}
            onChange={(event) => update("reasonCategory", event.target.value)}
            aria-invalid={Boolean(fieldErrors.reasonCategory)}
            className={FIELD}
            required
          >
            <option value="">Choose a reason</option>
            {LEAVE_REASON_CATEGORIES.map((reason) => (
              <option
                key={reason}
                value={reason}
              >
                {LEAVE_REASON_LABELS[reason]}
              </option>
            ))}
          </Select>
          {fieldErrors.reasonCategory ? (
            <p className="text-danger mt-1 text-[11px]">
              {fieldErrors.reasonCategory}
            </p>
          ) : null}
        </section>

        <section className={CARD}>
          <div className="flex items-start justify-between gap-3">
            <SectionHeader
              icon={AlignLeft}
              title="Explanation"
            />
            <span className="text-muted-foreground shrink-0 text-[11px] tabular-nums">
              {form.explanation.length} / {LEAVE_EXPLANATION_MAX}
            </span>
          </div>

          <Label
            htmlFor="explanation"
            className="sr-only"
          >
            Explanation
          </Label>
          <Textarea
            id="explanation"
            value={form.explanation}
            onChange={(event) => update("explanation", event.target.value)}
            aria-invalid={Boolean(fieldErrors.explanation)}
            rows={4}
            maxLength={LEAVE_EXPLANATION_MAX}
            className="mt-3 min-h-24 rounded-xl"
            placeholder="Briefly explain your reason…"
            required
          />
          {fieldErrors.explanation ? (
            <p className="text-danger mt-1 text-[11px]">
              {fieldErrors.explanation}
            </p>
          ) : null}
        </section>

        {mode === "create" ? (
          <section className={CARD}>
            <div className="flex items-start justify-between gap-3">
              <SectionHeader
                icon={Paperclip}
                title="Supporting document"
              />
              {files.length > 0 ? (
                <span className="bg-muted text-muted-foreground shrink-0 rounded-md px-2 py-0.5 text-[11px] font-medium tabular-nums">
                  {files.length} / {LEAVE_EVIDENCE_MAX_FILES}
                </span>
              ) : null}
            </div>

            <label
              htmlFor="evidenceFiles"
              className="border-input bg-subtle hover:border-accent/60 hover:bg-accent-soft/40 focus-within:outline-accent mt-3 flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed px-4 py-5 text-center transition-colors focus-within:outline-2 focus-within:outline-offset-2"
            >
              <UploadCloud
                aria-hidden="true"
                className="text-accent h-6 w-6"
              />
              <span className="text-accent text-sm font-medium">
                Tap to upload file
              </span>
              <span className="text-muted-foreground text-[11px]">
                PDF, JPG, or PNG · max 10 MB
              </span>
            </label>
            <input
              id="evidenceFiles"
              type="file"
              multiple
              accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
              onChange={onSelectFiles}
              disabled={busy !== null}
              className="sr-only"
            />

            {files.length > 0 ? (
              <ul className="mt-2.5 grid gap-1.5">
                {files.map((file) => (
                  <li
                    key={`${file.name}-${file.size}-${file.lastModified}`}
                    className="border-border bg-subtle flex items-center gap-2 rounded-xl border px-2.5 py-2"
                  >
                    <FileText
                      aria-hidden="true"
                      className="text-muted-foreground h-4 w-4 shrink-0"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium">
                        {file.name}
                      </span>
                      <span className="text-muted-foreground block text-[11px]">
                        {formatFileSize(file.size)}
                      </span>
                    </span>

                    <button
                      type="button"
                      onClick={() => removeFile(file)}
                      disabled={busy !== null}
                      aria-label={`Remove ${file.name}`}
                      className="text-muted-foreground hover:text-danger hover:bg-danger-soft focus-visible:outline-accent flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
                    >
                      <Trash2
                        aria-hidden="true"
                        className="h-4 w-4"
                      />
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        ) : null}

        {showReader && mode === "create" ? (
          <section className="border-border bg-subtle flex items-start gap-3 rounded-2xl border p-4">
            <span className="bg-accent-soft text-accent flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
              <Sparkles
                aria-hidden="true"
                className="h-4 w-4"
              />
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <h2 className="text-[15px] leading-6 font-semibold">
                  Document Reader
                </h2>
                <span className="bg-accent-soft text-accent rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wide">
                  AI
                </span>
              </div>
              <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
                {readerEnabled
                  ? "Reads your PDF and suggests the absence dates. You confirm every value."
                  : "Off. Nothing is extracted and you type the dates yourself."}
              </p>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={readerEnabled}
              aria-label="Document Reader AI"
              onClick={() => setReaderEnabled((current) => !current)}
              className={cn(
                "focus-visible:outline-accent relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2",
                readerEnabled ? "bg-accent" : "bg-input",
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "bg-surface absolute h-5 w-5 rounded-full shadow-sm transition-transform",
                  readerEnabled ? "translate-x-5" : "translate-x-0.5",
                )}
              />
            </button>
          </section>
        ) : null}

        {hasSuggestion && mode === "edit" ? (
          <section className="border-border bg-subtle grid gap-2 rounded-2xl border p-4">
            <p className="flex items-center gap-1.5 text-sm font-semibold">
              <Sparkles
                aria-hidden="true"
                className="text-accent h-4 w-4"
              />
              Document Reader suggestions
            </p>

            {SUGGESTION_FIELDS.map((field) => {
              const value = suggestion?.[field.key];

              if (!value) {
                return null;
              }

              const isDate =
                field.key !== "studentName" && field.key !== "documentType";
              const display = isDate ? formatLeaveDate(value) : value;
              const source = sources[field.key];

              return (
                <div
                  key={field.key}
                  className="border-border bg-surface rounded-xl border p-2.5"
                >
                  <p className="text-muted-foreground text-[11px]">
                    {field.label}
                  </p>
                  <p className="text-sm font-medium">{display}</p>

                  {isDate ? (
                    <button
                      type="button"
                      onClick={() =>
                        applySuggestion(field.key as keyof FormState, value)
                      }
                      className="text-accent mt-1 text-xs underline-offset-4 hover:underline"
                    >
                      Use this value
                    </button>
                  ) : null}

                  {source ? (
                    <p className="text-muted-foreground mt-1 text-[11px]">
                      {SOURCE_LABELS[source]}
                    </p>
                  ) : null}
                </div>
              );
            })}

            <p className="text-muted-foreground text-[11px]">
              Read from the document, not verified. Check every value before
              submitting.
            </p>
          </section>
        ) : null}

        <details className="group border-border bg-subtle rounded-2xl border px-4 py-3">
          <summary className="flex cursor-pointer list-none items-center gap-2.5 [&::-webkit-details-marker]:hidden">
            <span className="bg-accent-soft text-accent flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
              <ClipboardCheck
                aria-hidden="true"
                className="h-4 w-4"
              />
            </span>
            <span className="flex-1 text-[15px] leading-6 font-semibold">
              Before you submit
            </span>
            <ChevronDown
              aria-hidden="true"
              className="text-muted-foreground h-4 w-4 shrink-0 transition-transform group-open:rotate-180"
            />
          </summary>

          <ul className="text-muted-foreground mt-2.5 grid list-disc gap-1 pl-11 text-xs leading-relaxed">
            <li>Dates exactly as printed on the document.</li>
            <li>A reason and a short explanation.</li>
            {mode === "create" ? (
              <li>At least one PDF, JPG, or PNG, up to 10 MB.</li>
            ) : null}
          </ul>
        </details>

        {/* Sits directly on top of the fixed mobile tab bar (3.75rem), so the
            content scrolls behind it and never peeks through a gap. */}
        <div className="bg-surface/95 border-border fixed inset-x-0 bottom-15 z-30 flex gap-2.5 border-t px-4 py-3 backdrop-blur lg:static lg:mt-1 lg:justify-end lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
          <Button
            type="submit"
            variant="secondary"
            size="lg"
            className="h-11 flex-1 rounded-xl lg:flex-none lg:px-5"
            disabled={busy !== null || !isEditable}
          >
            {busy === "save" ? (
              <Loader2
                aria-hidden="true"
                className="h-4 w-4 animate-spin"
              />
            ) : (
              <Bookmark
                aria-hidden="true"
                className="h-4 w-4"
              />
            )}
            Save draft
          </Button>

          <Button
            type="button"
            size="lg"
            className="h-11 flex-[1.3] rounded-xl lg:flex-none lg:px-5"
            onClick={() => void onSubmit()}
            disabled={busy !== null || !isEditable}
          >
            {busy === "submit" ? (
              <Loader2
                aria-hidden="true"
                className="h-4 w-4 animate-spin"
              />
            ) : (
              <Send
                aria-hidden="true"
                className="h-4 w-4"
              />
            )}
            Submit request
          </Button>
        </div>
      </form>

      {hasAside ? (
        <aside className="grid content-start gap-3">
          <div className="border-border bg-subtle rounded-2xl border p-4">
            <p className="flex items-center gap-1.5 text-sm font-semibold">
              <Sparkles
                aria-hidden="true"
                className="text-accent h-4 w-4"
              />
              Document Reader
            </p>

            {ocrStatus === "not_run" ? (
              <p className="text-muted-foreground mt-1.5 text-xs leading-relaxed">
                Upload a PDF on the request page and StarsTask will try to read
                the dates. Everything it finds stays a suggestion.
              </p>
            ) : null}

            {ocrStatus === "unsupported" ? (
              <p className="text-muted-foreground mt-1.5 text-xs leading-relaxed">
                This file could not be read automatically (it may be a scan).
                Enter the details by hand — nothing is blocked.
              </p>
            ) : null}

            {ocrStatus === "failed" ? (
              <p className="text-muted-foreground mt-1.5 text-xs leading-relaxed">
                The document could not be read. Enter the details by hand.
              </p>
            ) : null}

            {ocrStatus === "succeeded" ? (
              <p className="text-muted-foreground mt-1.5 text-xs leading-relaxed">
                Suggestions below come from your document. Accept only the ones
                that match it.
              </p>
            ) : null}
          </div>
        </aside>
      ) : null}
    </div>
  );
}

type SectionHeaderProps = {
  icon: LucideIcon;
  title: string;
};

function SectionHeader({ icon: Icon, title }: SectionHeaderProps) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="bg-accent-soft text-accent flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
        <Icon
          aria-hidden="true"
          className="h-4 w-4"
        />
      </span>
      <h2 className="text-[15px] leading-6 font-semibold">{title}</h2>
    </div>
  );
}

"use client";

import { FileText, Loader2, Sparkles, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { isFeatureEnabled } from "@/lib/config/features";
import {
  LEAVE_EVIDENCE_MAX_BYTES,
  LEAVE_EVIDENCE_MAX_FILES,
  LEAVE_EXPLANATION_MAX,
  LEAVE_EXPLANATION_MIN,
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

type LeaveFormProps = {
  mode: "create" | "edit";
  classId: string;
  requestId?: string;
  status?: LeaveRequestStatus;
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

/**
 * Create/edit form.
 *
 * OCR suggestions are shown beside the inputs and only ever fill a field when
 * the student clicks "Use". Nothing is applied automatically, and the confirmed
 * source of each field is recorded separately from its value.
 */
export function LeaveForm({
  mode,
  classId,
  requestId,
  status = "draft",
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

  const isEditable = status === "draft";

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
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
    };

    if (mode === "create" && !createdId) {
      const parsed = leaveRequestCreateSchema.safeParse({
        ...payload,
        classId,
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

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <form
        className="grid gap-5"
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

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="leaveStartDate">Absence from</Label>
            <Input
              id="leaveStartDate"
              type="date"
              value={form.leaveStartDate}
              onChange={(event) => update("leaveStartDate", event.target.value)}
              aria-invalid={Boolean(fieldErrors.leaveStartDate)}
              className="mt-1"
              required
            />
            {fieldErrors.leaveStartDate ? (
              <p className="text-danger mt-1 text-xs">
                {fieldErrors.leaveStartDate}
              </p>
            ) : null}
          </div>

          <div>
            <Label htmlFor="leaveEndDate">Absence to</Label>
            <Input
              id="leaveEndDate"
              type="date"
              value={form.leaveEndDate}
              onChange={(event) => update("leaveEndDate", event.target.value)}
              aria-invalid={Boolean(fieldErrors.leaveEndDate)}
              className="mt-1"
              required
            />
            {fieldErrors.leaveEndDate ? (
              <p className="text-danger mt-1 text-xs">
                {fieldErrors.leaveEndDate}
              </p>
            ) : null}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="reasonCategory">Reason</Label>
            <Select
              id="reasonCategory"
              value={form.reasonCategory}
              onChange={(event) => update("reasonCategory", event.target.value)}
              aria-invalid={Boolean(fieldErrors.reasonCategory)}
              className="mt-1"
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
              <p className="text-danger mt-1 text-xs">
                {fieldErrors.reasonCategory}
              </p>
            ) : null}
          </div>

          <div>
            <Label htmlFor="documentIssueDate">
              Document issue date{" "}
              <span className="text-muted-foreground font-normal">
                (optional)
              </span>
            </Label>
            <Input
              id="documentIssueDate"
              type="date"
              value={form.documentIssueDate}
              onChange={(event) =>
                update("documentIssueDate", event.target.value)
              }
              className="mt-1"
            />
            <p className="text-muted-foreground mt-1 text-xs">
              The date printed on the letter — not the absence dates and not the
              submission date.
            </p>
          </div>
        </div>

        <div>
          <Label htmlFor="explanation">Explanation</Label>
          <Textarea
            id="explanation"
            value={form.explanation}
            onChange={(event) => update("explanation", event.target.value)}
            aria-invalid={Boolean(fieldErrors.explanation)}
            rows={5}
            maxLength={LEAVE_EXPLANATION_MAX}
            className="mt-1"
            placeholder="What your class admin needs to know. Avoid unnecessary medical detail."
            required
          />
          <p className="text-muted-foreground mt-1 text-xs">
            At least {LEAVE_EXPLANATION_MIN} characters.
          </p>
          {fieldErrors.explanation ? (
            <p className="text-danger mt-1 text-xs">
              {fieldErrors.explanation}
            </p>
          ) : null}
        </div>

        {mode === "create" ? (
          <div>
            <Label htmlFor="evidenceFiles">Supporting document</Label>
            <input
              id="evidenceFiles"
              type="file"
              multiple
              accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
              onChange={onSelectFiles}
              disabled={busy !== null}
              className="text-muted-foreground file:border-border file:bg-muted file:text-foreground hover:file:bg-muted/70 mt-1 w-full text-sm file:mr-3 file:rounded-md file:border file:px-3 file:py-1.5 file:text-sm"
              aria-describedby="evidenceFiles-hint"
            />
            <p
              id="evidenceFiles-hint"
              className="text-muted-foreground mt-1 text-xs"
            >
              PDF, JPG, or PNG · up to 10 MB each · at least one is required
              before submitting.
            </p>

            {files.length > 0 ? (
              <ul className="mt-2 grid gap-2">
                {files.map((file) => (
                  <li
                    key={`${file.name}-${file.size}-${file.lastModified}`}
                    className="border-border flex items-center justify-between gap-2 rounded-lg border p-2.5"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <FileText
                        aria-hidden="true"
                        className="text-muted-foreground h-4 w-4 shrink-0"
                      />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">
                          {file.name}
                        </span>
                        <span className="text-muted-foreground block text-xs">
                          {formatFileSize(file.size)}
                        </span>
                      </span>
                    </span>

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(file)}
                      disabled={busy !== null}
                      aria-label={`Remove ${file.name}`}
                    >
                      <Trash2
                        aria-hidden="true"
                        className="h-4 w-4"
                      />
                    </Button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button
            type="submit"
            variant="secondary"
            disabled={busy !== null || !isEditable}
          >
            {busy === "save" ? (
              <Loader2
                aria-hidden="true"
                className="h-4 w-4 animate-spin"
              />
            ) : null}
            Save draft
          </Button>

          <Button
            type="button"
            onClick={() => void onSubmit()}
            disabled={busy !== null || !isEditable}
          >
            {busy === "submit" ? (
              <Loader2
                aria-hidden="true"
                className="h-4 w-4 animate-spin"
              />
            ) : null}
            Submit
          </Button>
        </div>

        <p className="text-muted-foreground text-xs">
          Submitting sends the request to your class admin, who approves or
          rejects it. An approved absence marks the covered sessions excused; it
          never marks you present.
        </p>
      </form>

      {isFeatureEnabled("ocr") ? (
        <aside className="grid content-start gap-3">
          <div className="border-border bg-muted/40 rounded-xl border p-4">
            <p className="flex items-center gap-1.5 text-sm font-medium">
              <Sparkles
                aria-hidden="true"
                className="h-4 w-4"
              />
              Document reader
            </p>

            {mode === "create" ? (
              <p className="text-muted-foreground mt-1.5 text-xs">
                Attach a PDF above. After you save, StarsTask reads it and shows
                the suggested dates on the request page for you to confirm.
              </p>
            ) : null}

            {mode === "edit" && ocrStatus === "not_run" ? (
              <p className="text-muted-foreground mt-1.5 text-xs">
                Upload a PDF and StarsTask will try to read the dates for you.
                Everything it finds is a suggestion you must confirm.
              </p>
            ) : null}

            {ocrStatus === "unsupported" ? (
              <p className="text-muted-foreground mt-1.5 text-xs">
                This file could not be read automatically (it may be a scan).
                Enter the details by hand — nothing is blocked.
              </p>
            ) : null}

            {ocrStatus === "failed" ? (
              <p className="text-muted-foreground mt-1.5 text-xs">
                The document could not be read. Enter the details by hand.
              </p>
            ) : null}

            {hasSuggestion ? (
              <div className="mt-3 grid gap-2">
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
                      className="border-border bg-background rounded-lg border p-2.5"
                    >
                      <p className="text-muted-foreground text-[11px]">
                        {field.label}
                      </p>
                      <p className="text-sm font-medium">{display}</p>

                      {field.key !== "studentName" &&
                      field.key !== "documentType" ? (
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
              </div>
            ) : null}
          </div>
        </aside>
      ) : null}
    </div>
  );
}

"use client";

import { Loader2, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
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
import { formatLeaveDate } from "@starstask/shared";

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

  const isEditable = status === "draft";

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
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

    if (mode === "create") {
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

      return finishSave(await handleSaveResponse(response));
    }

    const parsed = leaveRequestUpdateSchema.safeParse(payload);

    if (!parsed.success) {
      setFieldErrors(toFieldErrors(parsed.error));
      return null;
    }

    const response = await fetch(`/api/leave-requests/${requestId}`, {
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

      router.push(`/leave-requests/${id}`);
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function onSubmit() {
    setBusy("submit");

    try {
      const id = await persist();

      if (!id) {
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
          Submitting sends the request to your class admin, who checks it and
          forwards it to the lecturer. StarsTask has no approve or reject step;
          the lecturer decides outside StarsTask.
        </p>
      </form>

      <aside className="grid content-start gap-3">
        <div className="border-border bg-muted/40 rounded-xl border p-4">
          <p className="flex items-center gap-1.5 text-sm font-medium">
            <Sparkles
              aria-hidden="true"
              className="h-4 w-4"
            />
            Document reader
          </p>

          {ocrStatus === "not_run" ? (
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
    </div>
  );
}

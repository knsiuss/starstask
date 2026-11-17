"use client";

import { Paperclip, X } from "lucide-react";
import * as React from "react";

import {
  ASSIGNMENT_ATTACHMENTS_MAX,
  ATTACHMENT_ALLOWED_EXTENSIONS,
} from "@starstask/contracts";
import { formatFileSize } from "@starstask/shared";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  STARTER_PRESETS,
  type StarterAssignmentSource,
  type StarterPreset,
} from "@/lib/assignments/starter-kit";

export function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="border-border bg-surface space-y-5 rounded-xl border p-4 sm:p-6">
      <div className="space-y-1">
        <legend className="text-foreground text-base font-semibold tracking-tight">
          {title}
        </legend>
        {description ? (
          <p className="text-muted-foreground text-sm leading-relaxed">
            {description}
          </p>
        ) : null}
      </div>
      {children}
    </fieldset>
  );
}

export function Field({
  id,
  label,
  error,
  hint,
  required,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>
        {label}
        {required ? (
          <span
            aria-hidden="true"
            className="text-danger ml-0.5"
          >
            *
          </span>
        ) : null}
      </Label>
      {children}
      {hint ? (
        <p
          id={`${id}-hint`}
          className="text-muted-foreground text-xs leading-relaxed"
        >
          {hint}
        </p>
      ) : null}
      {error ? (
        <p
          id={`${id}-error`}
          role="alert"
          className="text-danger text-xs font-medium"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function StarterKitSection({
  previousAssignments,
  previousId,
  starterNote,
  onPreviousIdChange,
  onApplyPreset,
  onApplyPrevious,
}: {
  previousAssignments: StarterAssignmentSource[];
  previousId: string;
  starterNote: string | null;
  onPreviousIdChange: (value: string) => void;
  onApplyPreset: (preset: StarterPreset) => void;
  onApplyPrevious: () => void;
}) {
  return (
    <fieldset className="border-border bg-subtle space-y-4 rounded-xl border p-4 sm:p-5">
      <div className="space-y-1">
        <legend className="text-foreground text-base font-semibold tracking-tight">
          Starter kit
        </legend>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Optional. A template fills the description skeleton, type, and tags.
          You can still change everything afterwards.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {STARTER_PRESETS.map((preset) => (
          <Button
            key={preset.id}
            type="button"
            variant="secondary"
            size="sm"
            className="min-h-[44px] sm:min-h-8"
            onClick={() => onApplyPreset(preset)}
          >
            {preset.label}
          </Button>
        ))}
      </div>

      {previousAssignments.length > 0 ? (
        <div className="grid gap-2.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <div className="grid gap-1.5">
            <Label htmlFor="previous-assignment">
              Copy details from a previous assignment
            </Label>
            <Select
              id="previous-assignment"
              value={previousId}
              className="min-h-[44px]"
              onChange={(event) => onPreviousIdChange(event.target.value)}
            >
              <option value="">Choose one of your assignments</option>
              {previousAssignments.map((assignment) => (
                <option
                  key={assignment.id}
                  value={assignment.id}
                >
                  {assignment.title} · {assignment.courseName}
                </option>
              ))}
            </Select>
          </div>
          <Button
            type="button"
            variant="secondary"
            className="min-h-[44px] w-full sm:w-auto"
            disabled={!previousId}
            onClick={onApplyPrevious}
          >
            Copy details
          </Button>
        </div>
      ) : null}

      {starterNote ? (
        <p
          aria-live="polite"
          className="text-accent text-xs font-medium"
        >
          {starterNote}
        </p>
      ) : null}
    </fieldset>
  );
}

export function AttachmentsSection({
  mode,
  files,
  error,
  onFilesChange,
  onRemoveFile,
}: {
  mode: "create" | "edit";
  files: File[];
  error?: string;
  onFilesChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveFile: (index: number) => void;
}) {
  return (
    <FormSection title="Attachments">
      {mode === "create" ? (
        <div className="space-y-3">
          <p
            id="files-hint"
            className="text-muted-foreground text-sm leading-relaxed"
          >
            Optional. Up to {ASSIGNMENT_ATTACHMENTS_MAX} files, 10 MB each. PDF,
            DOCX, PPTX, XLSX, PNG, JPG, CSV, IPYNB, TXT, PY, JS, ZIP.
          </p>
          <div className="border-border bg-subtle rounded-lg border border-dashed p-4">
            <Label
              htmlFor="files"
              className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 sm:min-h-0"
            >
              <Paperclip
                aria-hidden="true"
                className="text-accent h-4 w-4"
              />
              <span>Choose files</span>
            </Label>
            <input
              id="files"
              name="files"
              type="file"
              multiple
              accept={ATTACHMENT_ALLOWED_EXTENSIONS.map(
                (ext) => `.${ext}`,
              ).join(",")}
              onChange={onFilesChange}
              className="text-muted-foreground file:bg-accent-soft file:text-accent hover:file:bg-accent-soft/80 mt-2 block min-h-[44px] w-full cursor-pointer text-sm file:mr-3 file:min-h-[44px] file:cursor-pointer file:rounded-md file:border-0 file:px-3.5 file:py-2 file:text-sm file:font-medium sm:min-h-0 sm:file:min-h-9"
              aria-invalid={Boolean(error)}
              aria-describedby={error ? "files-error files-hint" : "files-hint"}
            />
            {files.length > 0 ? (
              <ul
                aria-label="Selected files"
                className="mt-3 space-y-2"
              >
                {files.map((file, index) => (
                  <li
                    key={`${file.name}-${file.size}-${index}`}
                    className="border-border bg-surface flex items-center gap-2.5 rounded-lg border px-3 py-2 text-sm"
                  >
                    <span className="text-foreground min-w-0 flex-1 truncate">
                      {file.name}
                    </span>
                    <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                      {formatFileSize(file.size)}
                    </span>
                    <button
                      type="button"
                      aria-label={`Remove ${file.name}`}
                      onClick={() => onRemoveFile(index)}
                      className="text-muted-foreground hover:text-danger focus-visible:outline-accent flex min-h-[44px] min-w-[44px] shrink-0 cursor-pointer items-center justify-center rounded-md transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 sm:min-h-8 sm:min-w-8"
                    >
                      <X
                        aria-hidden="true"
                        className="h-4 w-4"
                      />
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          {error ? (
            <p
              id="files-error"
              role="alert"
              className="text-danger text-xs font-medium"
            >
              {error}
            </p>
          ) : null}
        </div>
      ) : (
        <p className="text-muted-foreground text-sm leading-relaxed">
          Manage attachments from the assignment page. You can add, rename, or
          delete files there without changing the assignment itself.
        </p>
      )}
    </FormSection>
  );
}

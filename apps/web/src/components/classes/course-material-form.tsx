"use client";

import { FileUp, Loader2, X } from "lucide-react";
import * as React from "react";

import {
  COURSE_MATERIAL_FORMATS,
  COURSE_MATERIAL_KINDS,
  type CourseMaterialFormat,
  type CourseMaterialKind,
} from "@starstask/contracts";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const KIND_LABELS: Record<CourseMaterialKind, string> = {
  document: "Document",
  video: "Video",
  link: "Link",
  other: "Other",
};

const FORMAT_LABELS: Record<CourseMaterialFormat, string> = {
  markdown: "Markdown",
  html: "HTML (Sandboxed)",
  plain: "Plain text",
};

const MEETINGS = Array.from({ length: 16 }, (_, index) => index + 1);

export type MaterialFormValues = {
  kind: CourseMaterialKind;
  meetingNumber: string;
  contentFormat: CourseMaterialFormat;
  title: string;
  description: string;
  resourceUrl: string;
  filePath: string | null;
  fileName: string | null;
  fileMime: string | null;
  fileSize: number | null;
};

type Props = {
  classSlug: string;
  courseId: string;
  editingId: string | null;
  values: MaterialFormValues;
  fieldErrors: Record<string, string>;
  formMessage: string | null;
  isBusy: boolean;
  onChange: <Key extends keyof MaterialFormValues>(
    key: Key,
    value: MaterialFormValues[Key],
  ) => void;
  onClose: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
};

export function CourseMaterialForm({
  classSlug,
  courseId,
  editingId,
  values,
  fieldErrors,
  formMessage,
  isBusy,
  onChange,
  onClose,
  onSubmit,
}: Props) {
  const [uploading, setUploading] = React.useState(false);
  const [uploadError, setUploadError] = React.useState<string | null>(null);

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setUploading(true);
    setUploadError(null);

    try {
      const formData = new FormData();

      formData.set("subjectId", courseId);
      formData.set("file", file);

      const response = await fetch(
        `/api/classes/${classSlug}/materials/upload`,
        {
          method: "POST",
          body: formData,
        },
      );
      const body = (await response.json().catch(() => null)) as {
        data?: { path: string; name: string; mimeType: string; size: number };
        error?: { message?: string };
      } | null;

      if (!response.ok || !body?.data) {
        setUploadError(body?.error?.message ?? "Could not upload file.");
        return;
      }

      onChange("filePath", body.data.path);
      onChange("fileName", body.data.name);
      onChange("fileMime", body.data.mimeType);
      onChange("fileSize", body.data.size);
    } catch {
      setUploadError("Network error while uploading file.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <form
      onSubmit={onSubmit}
      className="border-border bg-surface mt-5 space-y-4 rounded-xl border p-4 sm:p-5"
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">
          {editingId ? "Edit material" : "Add course material"}
        </h3>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close form"
          className="text-muted-foreground hover:text-foreground p-1"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="mat-meeting">Pertemuan</Label>
          <Select
            id="mat-meeting"
            value={values.meetingNumber}
            onChange={(event) => onChange("meetingNumber", event.target.value)}
            className="h-11"
          >
            <option value="">General</option>
            {MEETINGS.map((num) => (
              <option
                key={num}
                value={String(num)}
              >
                Pertemuan {num}
              </option>
            ))}
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="mat-kind">Type</Label>
          <Select
            id="mat-kind"
            value={values.kind}
            onChange={(event) =>
              onChange("kind", event.target.value as CourseMaterialKind)
            }
            className="h-11"
          >
            {COURSE_MATERIAL_KINDS.map((kind) => (
              <option
                key={kind}
                value={kind}
              >
                {KIND_LABELS[kind]}
              </option>
            ))}
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="mat-format">Text format</Label>
          <Select
            id="mat-format"
            value={values.contentFormat}
            onChange={(event) =>
              onChange(
                "contentFormat",
                event.target.value as CourseMaterialFormat,
              )
            }
            className="h-11"
          >
            {COURSE_MATERIAL_FORMATS.map((fmt) => (
              <option
                key={fmt}
                value={fmt}
              >
                {FORMAT_LABELS[fmt]}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="mat-title">Title</Label>
        <Input
          id="mat-title"
          value={values.title}
          onChange={(event) => onChange("title", event.target.value)}
          placeholder="Pertemuan 1: Pengantar"
          className="h-11"
        />
        {fieldErrors.title ? (
          <p className="text-danger text-xs">{fieldErrors.title}</p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="mat-desc">Content (Markdown, HTML, or notes)</Label>
        <Textarea
          id="mat-desc"
          value={values.description}
          onChange={(event) => onChange("description", event.target.value)}
          rows={4}
          placeholder="Write notes in Markdown, paste HTML snippet, or summarize the meeting..."
        />
        {fieldErrors.description ? (
          <p className="text-danger text-xs">{fieldErrors.description}</p>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="mat-url">External link (optional)</Label>
          <Input
            id="mat-url"
            value={values.resourceUrl}
            onChange={(event) => onChange("resourceUrl", event.target.value)}
            placeholder="https://..."
            className="h-11"
          />
          {fieldErrors.resourceUrl ? (
            <p className="text-danger text-xs">{fieldErrors.resourceUrl}</p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="mat-file">File (PDF, HTML, MD, Image)</Label>
          <div className="flex items-center gap-2">
            <label
              htmlFor="mat-file"
              className="border-border bg-subtle hover:bg-muted inline-flex h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 text-xs font-medium"
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileUp className="h-4 w-4" />
              )}
              {values.fileName ? values.fileName : "Upload file"}
            </label>
            <input
              id="mat-file"
              type="file"
              accept=".pdf,.html,.htm,.md,.txt,.png,.jpg,.jpeg,.webp"
              className="sr-only"
              onChange={(event) => void handleFileChange(event)}
            />
            {values.filePath ? (
              <button
                type="button"
                onClick={() => {
                  onChange("filePath", null);
                  onChange("fileName", null);
                  onChange("fileMime", null);
                  onChange("fileSize", null);
                }}
                className="text-muted-foreground hover:text-danger text-xs"
              >
                Remove
              </button>
            ) : null}
          </div>
          {uploadError ? (
            <p className="text-danger text-xs">{uploadError}</p>
          ) : null}
        </div>
      </div>

      {formMessage ? <Alert variant="error">{formMessage}</Alert> : null}

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          onClick={onClose}
          className="min-h-[44px]"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={isBusy || uploading}
          className="min-h-[44px]"
        >
          {isBusy ? (
            <Loader2
              aria-hidden="true"
              className="h-4 w-4 animate-spin"
            />
          ) : null}
          {editingId ? "Save changes" : "Publish material"}
        </Button>
      </div>
    </form>
  );
}

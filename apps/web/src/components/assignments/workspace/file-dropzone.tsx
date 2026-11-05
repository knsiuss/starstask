"use client";

import { CloudUpload, FileText, X } from "lucide-react";
import * as React from "react";

import { ASSIGNMENT_ATTACHMENTS_MAX } from "@starstask/contracts";

type Props = {
  files: File[];
  onChange: (files: File[]) => void;
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Drag-and-drop file picker. Validation stays server-side; this component
 * only enforces the same count cap before upload so the user gets immediate
 * feedback, and renders the selected files with a remove action.
 */
export function FileDropzone({ files, onChange }: Props) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [isDragActive, setIsDragActive] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const addFiles = (incoming: File[]) => {
    setError(null);

    if (files.length + incoming.length > ASSIGNMENT_ATTACHMENTS_MAX) {
      setError(`You can attach up to ${ASSIGNMENT_ATTACHMENTS_MAX} files.`);
      return;
    }

    onChange([...files, ...incoming]);
  };

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload supporting files"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragActive(true);
        }}
        onDragLeave={() => setIsDragActive(false)}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragActive(false);
          addFiles([...event.dataTransfer.files]);
        }}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed px-4 py-6 text-center transition-colors focus-visible:outline-accent focus-visible:outline-2 focus-visible:outline-offset-2 ${
          isDragActive
            ? "border-accent bg-accent-soft"
            : "border-border bg-surface hover:border-accent/40 hover:bg-band"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          className="sr-only"
          accept=".pdf,.docx,.pptx,.xlsx,.png,.jpg,.jpeg"
          aria-label="Supporting files"
          onChange={(event) => {
            addFiles([...(event.target.files ?? [])]);
            event.target.value = "";
          }}
        />
        <span className="bg-accent-soft text-accent flex h-10 w-10 items-center justify-center rounded-full">
          <CloudUpload
            aria-hidden="true"
            className="h-5 w-5"
          />
        </span>
        <p className="text-foreground mt-2 text-sm font-medium">
          Click to upload or drag and drop files
        </p>
        <p className="text-muted-foreground mt-0.5 text-xs">
          PDF, DOCX, PNG, JPG, CSV, IPYNB, PY · Max 10MB per file
        </p>
      </div>

      {error ? (
        <p
          role="alert"
          className="text-danger mt-1.5 text-xs"
        >
          {error}
        </p>
      ) : null}

      {files.length > 0 ? (
        <ul
          aria-label="Selected files"
          className="mt-2 space-y-1.5"
        >
          {files.map((file, index) => (
            <li
              key={`${file.name}-${file.size}-${index}`}
              className="border-border bg-surface flex items-center gap-2.5 rounded-lg border px-3 py-2"
            >
              <FileText
                aria-hidden="true"
                className="text-muted-foreground h-4 w-4 shrink-0"
              />
              <span className="text-foreground min-w-0 flex-1 truncate text-sm">
                {file.name}
              </span>
              <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                {formatFileSize(file.size)}
              </span>
              <button
                type="button"
                aria-label={`Remove ${file.name}`}
                onClick={() => onChange(files.filter((_, i) => i !== index))}
                className="text-muted-foreground hover:text-danger shrink-0 rounded p-1"
              >
                <X
                  aria-hidden="true"
                  className="h-3.5 w-3.5"
                />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

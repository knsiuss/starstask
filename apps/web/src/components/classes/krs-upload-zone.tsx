"use client";

import { FileUp, Loader2 } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

type KrsUploadZoneProps = {
  isParsing: boolean;
  hasParsed: boolean;
  fileName: string | null;
  onFileSelected: (file: File | undefined) => void;
  onManualEntry: () => void;
};

/**
 * Drag-and-drop and file-picker upload zone for KRS PDF or image files.
 */
export function KrsUploadZone({
  isParsing,
  hasParsed,
  fileName,
  onFileSelected,
  onManualEntry,
}: KrsUploadZoneProps) {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = React.useState(false);

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setIsDragging(false);
        onFileSelected(event.dataTransfer.files[0]);
      }}
      className={cn(
        "border-border bg-subtle rounded-lg border border-dashed p-5 text-center transition-colors",
        isDragging && "border-accent bg-accent-soft/40",
      )}
    >
      <input
        ref={fileInputRef}
        id="krs-file-input"
        type="file"
        accept=".pdf,.png,.jpg,.jpeg,.webp"
        onChange={(event) => {
          onFileSelected(event.target.files?.[0]);
          if (fileInputRef.current) {
            fileInputRef.current.value = "";
          }
        }}
        className="sr-only"
      />
      <FileUp
        aria-hidden="true"
        className="text-muted-foreground mx-auto h-6 w-6"
      />
      <p className="text-foreground mt-2 text-sm font-medium">
        {isParsing
          ? "Reading KRS file..."
          : fileName
            ? `Loaded ${fileName}`
            : "Upload your KRS PDF or screenshot"}
      </p>
      <p className="text-muted-foreground mt-1 text-xs">
        Supports PDF, PNG, JPG, and WebP up to 10 MB. Student IDs and grades are
        ignored and files are not stored.
      </p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        <Button
          type="button"
          variant="secondary"
          disabled={isParsing}
          onClick={() => fileInputRef.current?.click()}
          className="min-h-[44px]"
        >
          {isParsing ? (
            <Loader2
              aria-hidden="true"
              className="h-4 w-4 animate-spin"
            />
          ) : (
            <FileUp
              aria-hidden="true"
              className="h-4 w-4"
            />
          )}
          {isParsing
            ? "Parsing..."
            : hasParsed
              ? "Replace file"
              : "Choose file"}
        </Button>
        {!hasParsed ? (
          <Button
            type="button"
            variant="ghost"
            disabled={isParsing}
            onClick={onManualEntry}
            className="min-h-[44px]"
          >
            Enter rows manually
          </Button>
        ) : null}
      </div>
    </div>
  );
}

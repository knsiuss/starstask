"use client";

import { Download, FileSpreadsheet } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

type ExportSubject = {
  id: string;
  name: string;
  code: string | null;
};

type AttendanceExportCardProps = {
  classSlug: string;
  subjects: ExportSubject[];
  /** Hides the course picker when the class has exactly one course. */
  hideSubjectPicker?: boolean;
};

/**
 * Semester exports for one class.
 *
 * Both workbooks are produced per course, so the picker is only hidden when
 * the class has a single course and the choice cannot be wrong.
 */
export function AttendanceExportCard({
  classSlug,
  subjects,
  hideSubjectPicker = false,
}: AttendanceExportCardProps) {
  const [subjectId, setSubjectId] = React.useState(subjects[0]?.id ?? "");
  const selectedSubjectId = subjects.some(
    (subject) => subject.id === subjectId,
  )
    ? subjectId
    : (subjects[0]?.id ?? "");

  if (subjects.length === 0) {
    return (
      <section className="border-border bg-surface rounded-xl border p-4">
        <h3 className="text-sm font-semibold">Export</h3>
        <p className="text-muted-foreground mt-1 text-xs">
          Add a course to this class before exporting its attendance.
        </p>
      </section>
    );
  }

  const exportHref = (kind: "recap" | "checklist") =>
    `/api/classes/${classSlug}/attendance/exports/${kind}?subjectId=${selectedSubjectId}`;

  return (
    <section className="border-border bg-surface rounded-xl border p-4">
      <h3 className="text-sm font-semibold">Export</h3>

      {hideSubjectPicker || subjects.length === 1 ? null : (
        <div className="mt-3 space-y-1.5">
          <Label
            htmlFor="attendance-export-subject"
            className="text-xs"
          >
            Course
          </Label>
          <Select
            id="attendance-export-subject"
            value={selectedSubjectId}
            onChange={(event) => setSubjectId(event.target.value)}
          >
            {subjects.map((subject) => (
              <option
                key={subject.id}
                value={subject.id}
              >
                {subject.code ? `${subject.code} · ` : ""}
                {subject.name}
              </option>
            ))}
          </Select>
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          asChild
          size="sm"
          variant="secondary"
        >
          <a href={exportHref("recap")}>
            <Download
              aria-hidden="true"
              className="h-4 w-4"
            />
            Recap (.xlsx)
          </a>
        </Button>
        <Button
          asChild
          size="sm"
          variant="secondary"
        >
          <a href={exportHref("checklist")}>
            <FileSpreadsheet
              aria-hidden="true"
              className="h-4 w-4"
            />
            Blank checklist
          </a>
        </Button>
      </div>
    </section>
  );
}

"use client";

import { CalendarDays, CircleCheck, Clock, Info } from "lucide-react";

import { FileDropzone } from "@/components/assignments/workspace/file-dropzone";
import { PublicationSectionHeader } from "@/components/assignments/workspace/publication-section-header";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { WorkspaceClassOption } from "@/lib/db/assignment-workspace";
import { ASSIGNMENT_TITLE_MAX } from "@starstask/contracts";

export const DESCRIPTION_MAX = 20_000;

type RequestPublicationFieldsProps = {
  classes: WorkspaceClassOption[];
  selected: WorkspaceClassOption | undefined;
  classId: string;
  subjectId: string;
  title: string;
  description: string;
  deadlineDate: string;
  deadlineTime: string;
  files: File[];
  fieldErrors: Record<string, string>;
  onClassChange: (nextClassId: string) => void;
  onSubjectChange: (nextSubjectId: string) => void;
  onTitleChange: (nextTitle: string) => void;
  onDescriptionChange: (nextDescription: string) => void;
  onDeadlineDateChange: (nextDate: string) => void;
  onDeadlineTimeChange: (nextTime: string) => void;
  onFilesChange: (nextFiles: File[]) => void;
};

/**
 * Form sections for the assignment creation and publication request dialog.
 */
export function RequestPublicationFields({
  classes,
  selected,
  classId,
  subjectId,
  title,
  description,
  deadlineDate,
  deadlineTime,
  files,
  fieldErrors,
  onClassChange,
  onSubjectChange,
  onTitleChange,
  onDescriptionChange,
  onDeadlineDateChange,
  onDeadlineTimeChange,
  onFilesChange,
}: RequestPublicationFieldsProps) {
  return (
    <>
      <section aria-labelledby="ca-section-class">
        <PublicationSectionHeader
          number={1}
          id="ca-section-class"
          heading="Class Information"
          supporting="Select the class and course for this assignment."
        />
        <div className="bg-band border-border/60 mt-4 grid gap-4 rounded-xl border p-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="request-class">Class</Label>
            <Select
              id="request-class"
              value={classId}
              onChange={(event) => onClassChange(event.target.value)}
              className="bg-surface h-11 sm:h-10"
            >
              {classes.map((item) => (
                <option
                  key={item.id}
                  value={item.id}
                >
                  {item.name}
                  {item.class_code ? ` (${item.class_code})` : ""}
                </option>
              ))}
            </Select>
            <p className="mt-1.5">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                  selected?.is_admin
                    ? "bg-success-soft text-success"
                    : "bg-accent-soft text-accent"
                }`}
              >
                {selected?.is_admin ? (
                  <CircleCheck
                    aria-hidden="true"
                    className="h-3 w-3"
                  />
                ) : (
                  <Info
                    aria-hidden="true"
                    className="h-3 w-3"
                  />
                )}
                {selected?.is_admin
                  ? "You manage this class"
                  : "You are a member of this class"}
              </span>
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="request-course">Course</Label>
            <Select
              id="request-course"
              value={subjectId}
              onChange={(event) => onSubjectChange(event.target.value)}
              aria-invalid={Boolean(fieldErrors.subjectId)}
              className="bg-surface h-11 sm:h-10"
            >
              {selected?.subjects.map((subject) => (
                <option
                  key={subject.id}
                  value={subject.id}
                >
                  {subject.name}
                  {subject.code ? ` (${subject.code})` : ""}
                </option>
              ))}
            </Select>
            {fieldErrors.subjectId ? (
              <p className="text-danger text-xs">{fieldErrors.subjectId}</p>
            ) : null}
            {selected && selected.subjects.length === 0 ? (
              <p className="text-danger text-xs">
                This class has no courses yet. Ask an admin to add one before
                submitting.
              </p>
            ) : null}
          </div>
        </div>
      </section>

      <section aria-labelledby="ca-section-details">
        <PublicationSectionHeader
          number={2}
          id="ca-section-details"
          heading="Assignment Details"
          supporting="Provide the title and description for your assignment."
        />
        <div className="mt-4 space-y-4">
          <div>
            <Label htmlFor="request-title">
              Title <span className="text-danger">*</span>
            </Label>
            <div className="relative mt-1.5">
              <Input
                id="request-title"
                value={title}
                onChange={(event) => onTitleChange(event.target.value)}
                maxLength={ASSIGNMENT_TITLE_MAX}
                placeholder="e.g. Final Project Web Programming"
                aria-invalid={Boolean(fieldErrors.title)}
                className="h-11 pr-14 sm:h-10"
              />
              <span
                aria-hidden="true"
                className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs tabular-nums"
              >
                {title.length}/{ASSIGNMENT_TITLE_MAX}
              </span>
            </div>
            {fieldErrors.title ? (
              <p className="text-danger mt-1 text-xs">{fieldErrors.title}</p>
            ) : null}
          </div>
          <div>
            <Label htmlFor="request-description">
              Description <span className="text-danger">*</span>
            </Label>
            <Textarea
              id="request-description"
              value={description}
              onChange={(event) => onDescriptionChange(event.target.value)}
              rows={4}
              maxLength={DESCRIPTION_MAX}
              placeholder="Describe the assignment requirements, objectives, and instructions."
              aria-invalid={Boolean(fieldErrors.description)}
              className="mt-1.5"
            />
            <div className="mt-1 flex items-center justify-between gap-3">
              {fieldErrors.description ? (
                <p className="text-danger text-xs">{fieldErrors.description}</p>
              ) : (
                <span />
              )}
              <span
                aria-hidden="true"
                className="text-muted-foreground shrink-0 text-xs tabular-nums"
              >
                {description.length}/{DESCRIPTION_MAX.toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="ca-section-schedule">
        <PublicationSectionHeader
          number={3}
          id="ca-section-schedule"
          heading="Schedule & Attachments"
          supporting="Set the deadline and add supporting files (optional)."
        />
        <div className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="request-deadline-date">Deadline Date</Label>
              <div className="relative mt-1.5">
                <CalendarDays
                  aria-hidden="true"
                  className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
                />
                <Input
                  id="request-deadline-date"
                  type="date"
                  value={deadlineDate}
                  onChange={(event) => onDeadlineDateChange(event.target.value)}
                  className="h-11 pl-9 sm:h-10"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="request-deadline-time">Deadline Time</Label>
              <div className="relative mt-1.5">
                <Clock
                  aria-hidden="true"
                  className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
                />
                <Input
                  id="request-deadline-time"
                  type="time"
                  value={deadlineTime}
                  onChange={(event) => onDeadlineTimeChange(event.target.value)}
                  className="h-11 pl-9 sm:h-10"
                />
              </div>
            </div>
          </div>
          {fieldErrors.deadline ? (
            <p
              role="alert"
              className="text-danger text-xs"
            >
              {fieldErrors.deadline}
            </p>
          ) : null}
          <div>
            <Label htmlFor="request-files">
              Supporting Files{" "}
              <span className="text-muted-foreground font-normal">
                (Optional)
              </span>
            </Label>
            <div className="mt-1.5">
              <FileDropzone
                files={files}
                onChange={onFilesChange}
              />
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

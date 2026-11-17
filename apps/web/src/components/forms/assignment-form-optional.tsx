"use client";

import { ASSIGNMENT_TYPES } from "@starstask/contracts";

import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import { Field, FormSection } from "./assignment-form-fields";
import type { AssignmentFormValues } from "./assignment-form-helpers";

type FieldUpdateHandler = (
  key: keyof AssignmentFormValues,
  value: string,
) => void;

export function OptionalDetailsSection({
  values,
  fieldErrors,
  onUpdate,
}: {
  values: AssignmentFormValues;
  fieldErrors: Record<string, string>;
  onUpdate: FieldUpdateHandler;
}) {
  return (
    <FormSection title="Optional details">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          id="lecturerName"
          label="Lecturer"
          error={fieldErrors.lecturerName}
        >
          <Input
            id="lecturerName"
            name="lecturerName"
            value={values.lecturerName}
            onChange={(event) => onUpdate("lecturerName", event.target.value)}
            maxLength={120}
            className="min-h-[44px]"
          />
        </Field>
        <Field
          id="assignmentType"
          label="Type"
          error={fieldErrors.assignmentType}
        >
          <Select
            id="assignmentType"
            name="assignmentType"
            value={values.assignmentType}
            onChange={(event) => onUpdate("assignmentType", event.target.value)}
            className="min-h-[44px]"
          >
            <option value="">Not specified</option>
            {ASSIGNMENT_TYPES.map((type) => (
              <option
                key={type}
                value={type}
              >
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          id="semester"
          label="Semester"
          error={fieldErrors.semester}
        >
          <Input
            id="semester"
            name="semester"
            value={values.semester}
            onChange={(event) => onUpdate("semester", event.target.value)}
            maxLength={20}
            placeholder="e.g. 1"
            className="min-h-[44px]"
          />
        </Field>
        <Field
          id="academicYear"
          label="Academic year"
          error={fieldErrors.academicYear}
          hint="Format: 2025/2026"
        >
          <Input
            id="academicYear"
            name="academicYear"
            value={values.academicYear}
            onChange={(event) => onUpdate("academicYear", event.target.value)}
            maxLength={20}
            placeholder="2025/2026"
            aria-invalid={Boolean(fieldErrors.academicYear)}
            aria-describedby={
              fieldErrors.academicYear ? "academicYear-error" : undefined
            }
            className="min-h-[44px]"
          />
        </Field>
      </div>

      <Field
        id="deadline"
        label="Deadline"
        error={fieldErrors.deadline}
        hint="Optional. Times are interpreted as Asia/Jakarta (WIB)."
      >
        <Input
          id="deadline"
          name="deadline"
          type="datetime-local"
          value={values.deadlineLocal}
          onChange={(event) => onUpdate("deadlineLocal", event.target.value)}
          aria-invalid={Boolean(fieldErrors.deadline)}
          aria-describedby={
            fieldErrors.deadline ? "deadline-error" : "deadline-hint"
          }
          className="min-h-[44px]"
        />
      </Field>

      <Field
        id="tags"
        label="Tags"
        error={fieldErrors.tags}
        hint="Comma separated, up to 10 tags."
      >
        <Input
          id="tags"
          name="tags"
          value={values.tagsText}
          onChange={(event) => onUpdate("tagsText", event.target.value)}
          placeholder="database, sql, chapter-4"
          aria-invalid={Boolean(fieldErrors.tags)}
          aria-describedby={fieldErrors.tags ? "tags-error" : "tags-hint"}
          className="min-h-[44px]"
        />
      </Field>

      <Field
        id="referenceUrls"
        label="Reference links"
        error={fieldErrors.referenceUrls}
        hint="One http(s) link per line, up to 10."
      >
        <Textarea
          id="referenceUrls"
          name="referenceUrls"
          value={values.referenceUrlsText}
          onChange={(event) =>
            onUpdate("referenceUrlsText", event.target.value)
          }
          rows={3}
          placeholder="https://example.com/reference"
          aria-invalid={Boolean(fieldErrors.referenceUrls)}
          aria-describedby={
            fieldErrors.referenceUrls
              ? "referenceUrls-error"
              : "referenceUrls-hint"
          }
        />
      </Field>
    </FormSection>
  );
}

"use client";

import { useRouter } from "next/navigation";
import * as React from "react";

import { assignmentCreateSchema, toFieldErrors } from "@starstask/contracts";
import { fromJakartaDateTimeInput } from "@starstask/shared";

import { Alert } from "@/components/ui/alert";
import {
  applyStarterAssignment,
  applyStarterPreset,
  type StarterAssignmentSource,
  type StarterPreset,
} from "@/lib/assignments/starter-kit";

import { AssignmentFormActions } from "./assignment-form-actions";
import {
  AssignmentDetailsSection,
  CourseSection,
} from "./assignment-form-details";
import {
  AttachmentsSection,
  StarterKitSection,
} from "./assignment-form-fields";
import {
  type AssignmentFormValues,
  buildCourseChoices,
  type CourseOption,
  DIRECT_COPY,
  focusFirstError,
  getInitialFormValues,
  QUEUED_COPY,
  splitList,
  submitAssignmentRequest,
  validateSelectedFiles,
} from "./assignment-form-helpers";
import { OptionalDetailsSection } from "./assignment-form-optional";

export type { AssignmentFormValues };

type AssignmentFormProps = {
  mode: "create" | "edit";
  assignmentId?: string;
  initialValues: AssignmentFormValues;
  /** Courses of the classes the user belongs to; empty for a user with none. */
  courseOptions: CourseOption[];
  previousAssignments?: StarterAssignmentSource[];
  /**
   * When true a new submission enters the public archive at once instead of the
   * review queue, so the copy must not promise an admin review.
   */
  publishesDirectly?: boolean;
};

export function AssignmentForm({
  mode,
  assignmentId,
  initialValues,
  courseOptions,
  previousAssignments = [],
  publishesDirectly = false,
}: AssignmentFormProps) {
  const router = useRouter();
  const [values, setValues] = React.useState(() =>
    getInitialFormValues(initialValues, courseOptions),
  );
  const [files, setFiles] = React.useState<File[]>([]);
  const [previousId, setPreviousId] = React.useState("");
  const [starterNote, setStarterNote] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>(
    {},
  );
  const [formMessage, setFormMessage] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const createCopy = publishesDirectly ? DIRECT_COPY : QUEUED_COPY;
  const submitLabel = mode === "edit" ? "Save changes" : createCopy.submitLabel;

  const update = (key: keyof AssignmentFormValues, value: string) => {
    setValues((current) => ({ ...current, [key]: value }));
  };

  const courseChoices = buildCourseChoices(values, courseOptions);

  const selectedCourse = courseChoices.find(
    (course) => course.name === values.courseName,
  );

  const handleCourseChange = (courseId: string) => {
    const course = courseChoices.find((option) => option.id === courseId);

    if (!course) {
      return;
    }

    setValues((current) => ({
      ...current,
      courseName: course.name,
      courseCode: course.code ?? "",
      department: course.department ?? "",
    }));
  };

  const applyPreset = (preset: StarterPreset) => {
    setValues((current) => applyStarterPreset(current, preset));
    setFieldErrors({});
    setFormMessage(null);
    setStarterNote(
      `${preset.label} template applied. Review every field before publishing.`,
    );
  };

  const applyPreviousAssignment = () => {
    const source = previousAssignments.find((item) => item.id === previousId);

    if (!source) {
      return;
    }

    setValues((current) => applyStarterAssignment(current, source));
    setFieldErrors({});
    setFormMessage(null);
    setStarterNote(
      "Details copied. Your title, deadline, semester, and academic year were left unchanged.",
    );
  };

  const handleFiles = (event: React.ChangeEvent<HTMLInputElement>) => {
    const result = validateSelectedFiles(Array.from(event.target.files ?? []));

    setFieldErrors((current) => ({
      ...current,
      attachments: result.error,
    }));
    setFiles(result.files);
  };

  const handleRemoveFile = (index: number) => {
    setFiles((current) =>
      current.filter((_, itemIndex) => itemIndex !== index),
    );
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    setFieldErrors({});
    setFormMessage(null);

    const deadlineIso = values.deadlineLocal
      ? fromJakartaDateTimeInput(values.deadlineLocal)
      : null;

    if (values.deadlineLocal && !deadlineIso) {
      setFieldErrors({ deadline: "Enter a valid date and time." });
      focusFirstError({ deadline: "invalid" });
      return;
    }

    const payload = {
      title: values.title,
      description: values.description,
      courseName: values.courseName,
      courseCode: values.courseCode || undefined,
      department: values.department || undefined,
      lecturerName: values.lecturerName || undefined,
      semester: values.semester || undefined,
      academicYear: values.academicYear || undefined,
      assignmentType: values.assignmentType || undefined,
      deadline: deadlineIso ?? undefined,
      tags: splitList(values.tagsText, /,/),
      referenceUrls: splitList(values.referenceUrlsText, /\n/),
    };

    const parsed = assignmentCreateSchema.safeParse(payload);

    if (!parsed.success) {
      const errors = toFieldErrors(parsed.error);
      setFieldErrors(errors);
      focusFirstError(errors);
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await submitAssignmentRequest({
        mode,
        assignmentId,
        parsedData: parsed.data,
        values,
        deadlineIso,
        files,
      });

      if (!result.ok) {
        setFieldErrors(result.fieldErrors);
        setFormMessage(result.message);
        focusFirstError(result.fieldErrors);
        return;
      }

      router.push(
        mode === "create"
          ? `/assignments/${result.id}?created=1`
          : `/assignments/${result.id}?updated=1`,
      );
      router.refresh();
    } catch {
      setFormMessage("Network error. Check your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="space-y-6"
    >
      {formMessage ? <Alert variant="error">{formMessage}</Alert> : null}

      {mode === "create" ? (
        <StarterKitSection
          previousAssignments={previousAssignments}
          previousId={previousId}
          starterNote={starterNote}
          onPreviousIdChange={setPreviousId}
          onApplyPreset={applyPreset}
          onApplyPrevious={applyPreviousAssignment}
        />
      ) : null}

      <AssignmentDetailsSection
        values={values}
        fieldErrors={fieldErrors}
        onUpdate={update}
      />

      <CourseSection
        values={values}
        fieldErrors={fieldErrors}
        courseOptions={courseOptions}
        courseChoices={courseChoices}
        selectedCourseId={selectedCourse?.id ?? ""}
        onCourseChange={handleCourseChange}
        onUpdate={update}
      />

      <OptionalDetailsSection
        values={values}
        fieldErrors={fieldErrors}
        onUpdate={update}
      />

      <AttachmentsSection
        mode={mode}
        files={files}
        error={fieldErrors.attachments}
        onFilesChange={handleFiles}
        onRemoveFile={handleRemoveFile}
      />

      <div
        className="hidden"
        aria-hidden="true"
      >
        <label htmlFor="website">Website</label>
        <input
          id="website"
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      <AssignmentFormActions
        isSubmitting={isSubmitting}
        submitLabel={submitLabel}
        footnote={mode === "create" ? createCopy.footnote : undefined}
        onCancel={() => router.back()}
      />
    </form>
  );
}

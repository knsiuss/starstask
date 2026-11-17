"use client";

import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import { Field, FormSection } from "./assignment-form-fields";
import type {
  AssignmentFormValues,
  CourseOption,
} from "./assignment-form-helpers";

type FieldUpdateHandler = (
  key: keyof AssignmentFormValues,
  value: string,
) => void;

export function AssignmentDetailsSection({
  values,
  fieldErrors,
  onUpdate,
}: {
  values: AssignmentFormValues;
  fieldErrors: Record<string, string>;
  onUpdate: FieldUpdateHandler;
}) {
  return (
    <FormSection title="Assignment details">
      <Field
        id="title"
        label="Title"
        error={fieldErrors.title}
        required
      >
        <Input
          id="title"
          name="title"
          value={values.title}
          onChange={(event) => onUpdate("title", event.target.value)}
          maxLength={200}
          required
          aria-required="true"
          aria-invalid={Boolean(fieldErrors.title)}
          aria-describedby={fieldErrors.title ? "title-error" : undefined}
          placeholder="e.g. Normalization exercise: Chapter 4"
          className="min-h-[44px]"
        />
      </Field>

      <Field
        id="description"
        label="Description or instructions"
        error={fieldErrors.description}
        required
        hint="Paste the brief, requirements, and any grading notes. Do not include private personal data."
      >
        <Textarea
          id="description"
          name="description"
          value={values.description}
          onChange={(event) => onUpdate("description", event.target.value)}
          rows={8}
          maxLength={20_000}
          required
          aria-required="true"
          aria-invalid={Boolean(fieldErrors.description)}
          aria-describedby={
            fieldErrors.description
              ? "description-error description-hint"
              : "description-hint"
          }
        />
      </Field>
    </FormSection>
  );
}

export function CourseSection({
  values,
  fieldErrors,
  courseOptions,
  courseChoices,
  selectedCourseId,
  onCourseChange,
  onUpdate,
}: {
  values: AssignmentFormValues;
  fieldErrors: Record<string, string>;
  courseOptions: CourseOption[];
  courseChoices: CourseOption[];
  selectedCourseId: string;
  onCourseChange: (courseId: string) => void;
  onUpdate: FieldUpdateHandler;
}) {
  return (
    <FormSection title="Course">
      {courseOptions.length > 0 ? (
        <>
          <Field
            id="courseName"
            label="Course"
            error={fieldErrors.courseName}
            required
            hint="Courses come from the classes you belong to. The code and department follow the class."
          >
            <Select
              id="courseName"
              name="courseName"
              value={selectedCourseId}
              onChange={(event) => onCourseChange(event.target.value)}
              required
              aria-required="true"
              aria-invalid={Boolean(fieldErrors.courseName)}
              aria-describedby={
                fieldErrors.courseName
                  ? "courseName-error courseName-hint"
                  : "courseName-hint"
              }
              className="min-h-[44px]"
            >
              <option value="">Select a course</option>
              {courseChoices.map((course) => (
                <option
                  key={course.id}
                  value={course.id}
                >
                  {course.code &&
                  course.code.toLowerCase() !== course.name.toLowerCase()
                    ? `${course.name} (${course.code})`
                    : course.name}
                </option>
              ))}
            </Select>
          </Field>

          <dl className="border-border/60 bg-subtle grid gap-3 rounded-lg border p-3.5 sm:grid-cols-2">
            <div>
              <dt className="text-foreground text-xs font-medium">
                Course code
              </dt>
              <dd className="text-muted-foreground mt-0.5 text-sm">
                {values.courseCode || "Not specified"}
              </dd>
            </div>
            <div>
              <dt className="text-foreground text-xs font-medium">
                Department
              </dt>
              <dd className="text-muted-foreground mt-0.5 text-sm">
                {values.department || "Not specified"}
              </dd>
            </div>
          </dl>
        </>
      ) : (
        <>
          <Field
            id="courseName"
            label="Course name"
            error={fieldErrors.courseName}
            required
          >
            <Input
              id="courseName"
              name="courseName"
              value={values.courseName}
              onChange={(event) => onUpdate("courseName", event.target.value)}
              maxLength={120}
              required
              aria-required="true"
              aria-invalid={Boolean(fieldErrors.courseName)}
              aria-describedby={
                fieldErrors.courseName ? "courseName-error" : undefined
              }
              placeholder="e.g. Database Systems"
              className="min-h-[44px]"
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              id="courseCode"
              label="Course code"
              error={fieldErrors.courseCode}
            >
              <Input
                id="courseCode"
                name="courseCode"
                value={values.courseCode}
                onChange={(event) => onUpdate("courseCode", event.target.value)}
                maxLength={20}
                placeholder="e.g. IF2230"
                className="min-h-[44px]"
              />
            </Field>
            <Field
              id="department"
              label="Department"
              error={fieldErrors.department}
            >
              <Input
                id="department"
                name="department"
                value={values.department}
                onChange={(event) => onUpdate("department", event.target.value)}
                maxLength={120}
                placeholder="e.g. Informatics"
                className="min-h-[44px]"
              />
            </Field>
          </div>

          <p className="text-muted-foreground text-xs">
            Join a class to pick its course instead of typing one.
          </p>
        </>
      )}
    </FormSection>
  );
}

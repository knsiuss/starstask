"use client";

import { Pencil, X } from "lucide-react";
import * as React from "react";

import {
  ClassSettingsForm,
  type ClassSettingsValues,
} from "@/components/classes/class-settings-form";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

const JOIN_POLICY_LABELS: Record<ClassSettingsValues["joinPolicy"], string> = {
  invitation: "Invitation only",
  open: "Open by class name",
};

type ClassSettingsPanelProps = {
  classSlug: string;
  classId: string;
  archived: boolean;
  initialValues: ClassSettingsValues;
};

/**
 * Read-only class metadata by default. Editing is an explicit, reversible step
 * so the settings tab never opens as a wall of inputs.
 */
export function ClassSettingsPanel({
  classSlug,
  classId,
  archived,
  initialValues,
}: ClassSettingsPanelProps) {
  const [isEditing, setIsEditing] = React.useState(false);
  const rows = [
    { label: "Class name", value: initialValues.name },
    { label: "Class code", value: initialValues.classCode || "Not set" },
    { label: "Course", value: initialValues.courseName },
    { label: "Semester", value: initialValues.semester },
    { label: "Academic year", value: initialValues.academicYear },
    {
      label: "Institution",
      value: initialValues.institution || "Not set",
    },
    { label: "Lecturer", value: initialValues.lecturerName || "Not set" },
    {
      label: "Joining",
      value: JOIN_POLICY_LABELS[initialValues.joinPolicy],
    },
  ];

  return (
    <section
      aria-labelledby="basic-information"
      className="border-border bg-surface rounded-2xl border"
    >
      <div className="border-border flex flex-wrap items-start justify-between gap-3 border-b px-5 py-4">
        <div>
          <h2
            id="basic-information"
            className="text-base font-semibold tracking-tight"
          >
            Basic information
          </h2>
          <p className="text-muted-foreground mt-0.5 text-xs">
            Name, code, and academic period.
          </p>
        </div>

        {!archived ? (
          isEditing ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsEditing(false)}
            >
              <X
                aria-hidden="true"
                className="h-3.5 w-3.5"
              />
              Cancel
            </Button>
          ) : (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setIsEditing(true)}
            >
              <Pencil
                aria-hidden="true"
                className="h-3.5 w-3.5"
              />
              Edit
            </Button>
          )
        ) : null}
      </div>

      <div className="px-5 py-4">
        {archived ? (
          <Alert
            variant="info"
            className="mb-4"
          >
            Settings are read-only while the class is archived. Restore it to
            edit the name, code, or academic period.
          </Alert>
        ) : null}

        {isEditing ? (
          <ClassSettingsForm
            classSlug={classSlug}
            classId={classId}
            initialValues={initialValues}
          />
        ) : (
          <dl className="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
            {rows.map((row) => (
              <div key={row.label}>
                <dt className="text-muted-foreground text-xs">{row.label}</dt>
                <dd className="mt-0.5 font-medium">{row.value}</dd>
              </div>
            ))}
            <div className="sm:col-span-2">
              <dt className="text-muted-foreground text-xs">Description</dt>
              <dd className="mt-1 leading-relaxed whitespace-pre-line">
                {initialValues.description || "No description"}
              </dd>
            </div>
          </dl>
        )}
      </div>
    </section>
  );
}

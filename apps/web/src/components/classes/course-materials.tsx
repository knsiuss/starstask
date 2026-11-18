"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import {
  courseMaterialCreateSchema,
  courseMaterialUpdateSchema,
  toFieldErrors,
  type CourseCommentView,
  type CourseMaterialView,
} from "@starstask/contracts";

import {
  CourseMaterialForm,
  type MaterialFormValues,
} from "@/components/classes/course-material-form";
import { CourseMeetingCards } from "@/components/classes/course-meeting-cards";
import { Button } from "@/components/ui/button";

type CourseMaterialsProps = {
  classSlug: string;
  courseId: string;
  currentUserId: string;
  materials: CourseMaterialView[];
  initialComments: CourseCommentView[];
  canManage: boolean;
  courseActive: boolean;
  initialCompose?: boolean;
};

const EMPTY_VALUES: MaterialFormValues = {
  kind: "document",
  meetingNumber: "1",
  contentFormat: "markdown",
  title: "",
  description: "",
  resourceUrl: "",
  filePath: null,
  fileName: null,
  fileMime: null,
  fileSize: null,
};

export function CourseMaterials({
  classSlug,
  courseId,
  currentUserId,
  materials,
  initialComments,
  canManage,
  courseActive,
  initialCompose = false,
}: CourseMaterialsProps) {
  const router = useRouter();
  const [comments, setComments] =
    React.useState<CourseCommentView[]>(initialComments);
  const [isFormOpen, setIsFormOpen] = React.useState(
    initialCompose && canManage && courseActive,
  );
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);
  const [values, setValues] = React.useState<MaterialFormValues>(EMPTY_VALUES);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>(
    {},
  );
  const [formMessage, setFormMessage] = React.useState<string | null>(null);
  const [isBusy, setIsBusy] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  const canWrite = canManage && courseActive;

  const update = <Key extends keyof MaterialFormValues>(
    key: Key,
    value: MaterialFormValues[Key],
  ) => {
    setValues((current) => ({ ...current, [key]: value }));
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingId(null);
    setValues(EMPTY_VALUES);
    setFieldErrors({});
    setFormMessage(null);
  };

  const startEdit = (material: CourseMaterialView) => {
    setEditingId(material.id);
    setValues({
      kind: material.kind,
      meetingNumber:
        material.meeting_number !== null ? String(material.meeting_number) : "",
      contentFormat: material.content_format ?? "markdown",
      title: material.title,
      description: material.description ?? "",
      resourceUrl: material.resource_url ?? "",
      filePath: material.file_path ?? null,
      fileName: material.file_name ?? null,
      fileMime: material.file_mime ?? null,
      fileSize: material.file_size ?? null,
    });
    setFieldErrors({});
    setFormMessage(null);
    setIsFormOpen(true);
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isBusy) {
      return;
    }

    setFieldErrors({});
    setFormMessage(null);

    const schema =
      editingId === null
        ? courseMaterialCreateSchema
        : courseMaterialUpdateSchema;
    const parsed = schema.safeParse({
      subjectId: courseId,
      kind: values.kind,
      meetingNumber: values.meetingNumber ? Number(values.meetingNumber) : null,
      contentFormat: values.contentFormat,
      title: values.title,
      description: values.description.trim() || undefined,
      resourceUrl: values.resourceUrl.trim() || undefined,
      filePath: values.filePath,
      fileName: values.fileName,
      fileMime: values.fileMime,
      fileSize: values.fileSize,
    });

    if (!parsed.success) {
      setFieldErrors(toFieldErrors(parsed.error));
      return;
    }

    setIsBusy(true);

    try {
      const endpoint =
        editingId === null
          ? `/api/classes/${classSlug}/materials`
          : `/api/classes/${classSlug}/materials/${editingId}`;
      const response = await fetch(endpoint, {
        method: editingId === null ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const body = (await response.json().catch(() => null)) as {
        error?: { message?: string; fields?: Record<string, string> };
      } | null;

      if (!response.ok) {
        setFieldErrors(body?.error?.fields ?? {});
        setFormMessage(body?.error?.message ?? "Could not save the material.");
        return;
      }

      closeForm();
      router.refresh();
    } catch {
      setFormMessage("Network error while saving material.");
    } finally {
      setIsBusy(false);
    }
  };

  const remove = async (materialId: string) => {
    setDeletingId(materialId);
    setDeleteError(null);

    try {
      const response = await fetch(
        `/api/classes/${classSlug}/materials/${materialId}`,
        { method: "DELETE" },
      );

      if (!response.ok) {
        setDeleteError("Could not delete material.");
        return;
      }

      router.refresh();
    } catch {
      setDeleteError("Network error while deleting material.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="mt-5">
      {deleteError ? (
        <p
          role="alert"
          className="text-danger mb-3 text-sm"
        >
          {deleteError}
        </p>
      ) : null}
      {canWrite && !isFormOpen ? (
        <div className="flex justify-end">
          <Button
            type="button"
            onClick={() => setIsFormOpen(true)}
            className="min-h-[44px]"
          >
            <Plus
              aria-hidden="true"
              className="h-4 w-4"
            />
            Add material
          </Button>
        </div>
      ) : null}

      {canWrite && isFormOpen ? (
        <CourseMaterialForm
          classSlug={classSlug}
          courseId={courseId}
          editingId={editingId}
          values={values}
          fieldErrors={fieldErrors}
          formMessage={formMessage}
          isBusy={isBusy}
          onChange={update}
          onClose={closeForm}
          onSubmit={(event) => void submit(event)}
        />
      ) : null}

      <CourseMeetingCards
        classSlug={classSlug}
        courseId={courseId}
        currentUserId={currentUserId}
        materials={materials}
        comments={comments}
        canWrite={canWrite}
        deletingId={deletingId}
        onEdit={startEdit}
        onDelete={(id) => void remove(id)}
        onCommentsChange={setComments}
      />
    </div>
  );
}

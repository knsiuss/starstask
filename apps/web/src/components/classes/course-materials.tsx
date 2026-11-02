"use client";

import { ExternalLink, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import {
  COURSE_MATERIAL_KINDS,
  courseMaterialCreateSchema,
  courseMaterialUpdateSchema,
  toFieldErrors,
  type CourseMaterialKind,
  type CourseMaterialView,
} from "@starstask/contracts";
import { formatDate } from "@starstask/shared";

import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
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

type CourseMaterialsProps = {
  classSlug: string;
  courseId: string;
  materials: CourseMaterialView[];
  canManage: boolean;
  courseActive: boolean;
  /** Opens the upload form straight away, for the course admin menu link. */
  initialCompose?: boolean;
};

type FormValues = {
  kind: CourseMaterialKind;
  title: string;
  description: string;
  resourceUrl: string;
};

const EMPTY_VALUES: FormValues = {
  kind: "document",
  title: "",
  description: "",
  resourceUrl: "",
};

/**
 * Learning materials of one course. Every item is stored with the course, and
 * every write is re-authorized by the API and by row-level security.
 */
export function CourseMaterials({
  classSlug,
  courseId,
  materials,
  canManage,
  courseActive,
  initialCompose = false,
}: CourseMaterialsProps) {
  const router = useRouter();
  const [isFormOpen, setIsFormOpen] = React.useState(
    initialCompose && canManage && courseActive,
  );
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [values, setValues] = React.useState<FormValues>(EMPTY_VALUES);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>(
    {},
  );
  const [formMessage, setFormMessage] = React.useState<string | null>(null);
  const [isBusy, setIsBusy] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  const canWrite = canManage && courseActive;

  const update = <Key extends keyof FormValues>(
    key: Key,
    value: FormValues[Key],
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

  const startCreate = () => {
    setEditingId(null);
    setValues(EMPTY_VALUES);
    setFieldErrors({});
    setFormMessage(null);
    setIsFormOpen(true);
  };

  const startEdit = (material: CourseMaterialView) => {
    setEditingId(material.id);
    setValues({
      kind: material.kind,
      title: material.title,
      description: material.description ?? "",
      resourceUrl: material.resource_url ?? "",
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
      title: values.title,
      description: values.description.trim() || undefined,
      resourceUrl: values.resourceUrl.trim() || undefined,
    });

    if (!parsed.success) {
      setFieldErrors(toFieldErrors(parsed.error));
      return;
    }

    setIsBusy(true);

    try {
      const response = await fetch(
        editingId === null
          ? `/api/classes/${classSlug}/materials`
          : `/api/classes/${classSlug}/materials/${editingId}`,
        {
          method: editingId === null ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(parsed.data),
        },
      );

      const body = (await response.json().catch(() => null)) as {
        error?: { message?: string; fieldErrors?: Record<string, string> };
      } | null;

      if (!response.ok) {
        setFieldErrors(body?.error?.fieldErrors ?? {});
        setFormMessage(body?.error?.message ?? "Could not save the material.");
        return;
      }

      closeForm();
      router.refresh();
    } catch {
      setFormMessage("Network error. Check your connection and try again.");
    } finally {
      setIsBusy(false);
    }
  };

  const remove = async (materialId: string) => {
    if (isBusy) {
      return;
    }

    setIsBusy(true);
    setFormMessage(null);

    try {
      const response = await fetch(
        `/api/classes/${classSlug}/materials/${materialId}`,
        { method: "DELETE" },
      );

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        setFormMessage(
          body?.error?.message ?? "Could not delete the material.",
        );
        return;
      }

      setDeletingId(null);
      router.refresh();
    } catch {
      setFormMessage("Network error. Check your connection and try again.");
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div>
      {formMessage ? (
        <Alert
          variant="error"
          className="mt-4"
        >
          {formMessage}
        </Alert>
      ) : null}

      {canWrite ? (
        <div className="mt-4">
          {isFormOpen ? (
            <MaterialForm
              values={values}
              editing={editingId !== null}
              fieldErrors={fieldErrors}
              isBusy={isBusy}
              onChange={update}
              onSubmit={submit}
              onClose={closeForm}
            />
          ) : (
            <Button
              type="button"
              size="sm"
              onClick={startCreate}
            >
              <Plus
                aria-hidden="true"
                className="h-4 w-4"
              />
              Add material
            </Button>
          )}
        </div>
      ) : null}

      {materials.length === 0 ? (
        <p className="text-muted-foreground mt-4 text-sm">
          No learning material in this course yet.
        </p>
      ) : (
        <ul className="divide-border border-border mt-4 divide-y border-y">
          {materials.map((material) => (
            <li
              key={material.id}
              className="py-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-medium">{material.title}</h3>
                    <Badge variant="neutral">
                      {KIND_LABELS[material.kind]}
                    </Badge>
                  </div>
                  {material.description ? (
                    <p className="text-muted-foreground mt-1 max-w-3xl text-sm leading-relaxed whitespace-pre-line">
                      {material.description}
                    </p>
                  ) : null}
                  <p className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-3 text-xs">
                    {material.resource_url ? (
                      <a
                        href={material.resource_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-accent inline-flex items-center gap-1 font-medium hover:underline"
                      >
                        Open resource
                        <ExternalLink
                          aria-hidden="true"
                          className="h-3 w-3"
                        />
                      </a>
                    ) : null}
                    <span>Added {formatDate(material.created_at)}</span>
                  </p>
                </div>

                {canWrite ? (
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => startEdit(material)}
                      aria-label={`Edit ${material.title}`}
                      className="text-muted-foreground hover:text-foreground hover:bg-hover rounded p-1 transition-colors"
                    >
                      <Pencil
                        aria-hidden="true"
                        className="h-3.5 w-3.5"
                      />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletingId(material.id)}
                      aria-label={`Delete ${material.title}`}
                      className="text-muted-foreground hover:text-danger hover:bg-danger/10 rounded p-1 transition-colors"
                    >
                      <Trash2
                        aria-hidden="true"
                        className="h-3.5 w-3.5"
                      />
                    </button>
                  </div>
                ) : null}
              </div>

              {deletingId === material.id ? (
                <div className="border-danger/30 bg-danger-soft mt-3 flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2">
                  <p className="text-danger text-xs">
                    Delete this material permanently?
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setDeletingId(null)}
                      disabled={isBusy}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="danger"
                      onClick={() => void remove(material.id)}
                      disabled={isBusy}
                    >
                      {isBusy ? (
                        <Loader2
                          aria-hidden="true"
                          className="h-3.5 w-3.5 animate-spin"
                        />
                      ) : null}
                      Delete
                    </Button>
                  </div>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function MaterialForm({
  values,
  editing,
  fieldErrors,
  isBusy,
  onChange,
  onSubmit,
  onClose,
}: {
  values: FormValues;
  editing: boolean;
  fieldErrors: Record<string, string>;
  isBusy: boolean;
  onChange: <Key extends keyof FormValues>(
    key: Key,
    value: FormValues[Key],
  ) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onClose: () => void;
}) {
  return (
    <div className="border-border bg-subtle rounded-xl border p-4 sm:p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-foreground text-sm font-semibold">
          {editing ? "Edit material" : "Add learning material"}
        </h3>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close form"
          className="text-muted-foreground hover:text-foreground rounded p-1"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <form
        onSubmit={onSubmit}
        noValidate
        className="mt-4 space-y-3"
      >
        <div className="grid gap-3 sm:grid-cols-[160px_minmax(0,1fr)]">
          <div className="space-y-1.5">
            <Label htmlFor="material-kind">Kind</Label>
            <Select
              id="material-kind"
              value={values.kind}
              onChange={(event) =>
                onChange("kind", event.target.value as CourseMaterialKind)
              }
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
            <Label htmlFor="material-title">
              Title
              <span
                aria-hidden="true"
                className="text-danger ml-0.5"
              >
                *
              </span>
            </Label>
            <Input
              id="material-title"
              value={values.title}
              onChange={(event) => onChange("title", event.target.value)}
              maxLength={200}
              aria-invalid={Boolean(fieldErrors.title)}
            />
            {fieldErrors.title ? (
              <p className="text-danger text-xs">{fieldErrors.title}</p>
            ) : null}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="material-description">Description</Label>
          <Textarea
            id="material-description"
            value={values.description}
            onChange={(event) => onChange("description", event.target.value)}
            rows={4}
            maxLength={5_000}
            aria-invalid={Boolean(fieldErrors.description)}
          />
          {fieldErrors.description ? (
            <p className="text-danger text-xs">{fieldErrors.description}</p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="material-url">Resource link</Label>
          <Input
            id="material-url"
            type="url"
            value={values.resourceUrl}
            onChange={(event) => onChange("resourceUrl", event.target.value)}
            placeholder="https://..."
            maxLength={2_048}
            aria-invalid={Boolean(fieldErrors.resourceUrl)}
          />
          <p className="text-muted-foreground text-xs">
            Add a description, a link, or both.
          </p>
          {fieldErrors.resourceUrl ? (
            <p className="text-danger text-xs">{fieldErrors.resourceUrl}</p>
          ) : null}
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            disabled={isBusy}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            size="sm"
            disabled={isBusy}
          >
            {isBusy ? (
              <Loader2
                aria-hidden="true"
                className="mr-1.5 h-3.5 w-3.5 animate-spin"
              />
            ) : null}
            {editing ? "Save changes" : "Add material"}
          </Button>
        </div>
      </form>
    </div>
  );
}

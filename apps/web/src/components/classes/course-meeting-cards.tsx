"use client";

import {
  BookOpen,
  ChevronDown,
  ExternalLink,
  Pencil,
  Trash2,
} from "lucide-react";
import * as React from "react";

import type {
  CourseCommentView,
  CourseMaterialKind,
  CourseMaterialView,
} from "@starstask/contracts";
import { formatDate } from "@starstask/shared";

import { CourseDiscussionThread } from "@/components/classes/course-discussion-thread";
import { CourseMaterialRenderer } from "@/components/classes/course-material-renderer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const KIND_LABELS: Record<CourseMaterialKind, string> = {
  document: "Document",
  video: "Video",
  link: "Link",
  other: "Other",
};

type Props = {
  classSlug: string;
  courseId: string;
  currentUserId: string;
  materials: CourseMaterialView[];
  comments: CourseCommentView[];
  canWrite: boolean;
  deletingId: string | null;
  onEdit: (material: CourseMaterialView) => void;
  onDelete: (materialId: string) => void;
  onCommentsChange: (next: CourseCommentView[]) => void;
};

type MeetingGroup = {
  key: string;
  meetingNumber: number | null;
  label: string;
  materials: CourseMaterialView[];
  comments: CourseCommentView[];
};

export function CourseMeetingCards({
  classSlug,
  courseId,
  currentUserId,
  materials,
  comments,
  canWrite,
  deletingId,
  onEdit,
  onDelete,
  onCommentsChange,
}: Props) {
  const [collapsed, setCollapsed] = React.useState<Record<string, boolean>>({});

  const groups = React.useMemo(() => {
    const meetingSet = new Set<number | null>();

    for (const material of materials) {
      meetingSet.add(material.meeting_number ?? null);
    }

    for (const comment of comments) {
      meetingSet.add(comment.meeting_number ?? null);
    }

    if (meetingSet.size === 0) {
      meetingSet.add(1);
    }

    const sortedKeys = [...meetingSet].sort((a, b) => {
      if (a === null) {
        return 1;
      }

      if (b === null) {
        return -1;
      }

      return a - b;
    });

    return sortedKeys.map((meetingNumber): MeetingGroup => {
      const key = meetingNumber === null ? "general" : `m-${meetingNumber}`;

      return {
        key,
        meetingNumber,
        label:
          meetingNumber === null ? "General" : `Pertemuan ${meetingNumber}`,
        materials: materials.filter(
          (item) => (item.meeting_number ?? null) === meetingNumber,
        ),
        comments: comments.filter(
          (item) => (item.meeting_number ?? null) === meetingNumber,
        ),
      };
    });
  }, [comments, materials]);

  return (
    <div className="mt-5 space-y-4">
      {groups.map((group) => {
        const isCollapsed = Boolean(collapsed[group.key]);

        return (
          <section
            key={group.key}
            className="border-border bg-surface rounded-xl border"
          >
            <button
              type="button"
              onClick={() =>
                setCollapsed((prev) => ({
                  ...prev,
                  [group.key]: !prev[group.key],
                }))
              }
              className="hover:bg-subtle flex min-h-[52px] w-full items-center justify-between gap-3 rounded-t-xl px-4 py-3 text-left sm:px-5"
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="bg-accent-soft text-accent flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
                  <BookOpen
                    aria-hidden="true"
                    className="h-4 w-4"
                  />
                </span>
                <div className="min-w-0">
                  <h3 className="text-foreground text-sm font-semibold sm:text-base">
                    {group.label}
                  </h3>
                  <p className="text-muted-foreground text-xs">
                    {group.materials.length}{" "}
                    {group.materials.length === 1 ? "material" : "materials"} ·{" "}
                    {group.comments.length}{" "}
                    {group.comments.length === 1 ? "comment" : "comments"}
                  </p>
                </div>
              </div>
              <ChevronDown
                aria-hidden="true"
                className={`text-muted-foreground h-4 w-4 shrink-0 transition-transform ${isCollapsed ? "-rotate-90" : ""}`}
              />
            </button>

            {!isCollapsed ? (
              <div className="border-border border-t px-4 py-4 sm:px-5">
                {group.materials.length === 0 ? (
                  <p className="text-muted-foreground text-sm">
                    No materials uploaded for {group.label} yet.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {group.materials.map((material) => (
                      <article
                        key={material.id}
                        className="border-border bg-subtle/40 rounded-lg border p-3.5 sm:p-4"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="neutral">
                                {KIND_LABELS[material.kind]}
                              </Badge>
                              <span className="text-muted-foreground text-xs">
                                {formatDate(material.created_at)}
                              </span>
                            </div>
                            <h4 className="text-foreground mt-1.5 text-sm font-semibold sm:text-base">
                              {material.title}
                            </h4>
                          </div>

                          <div className="flex items-center gap-1">
                            {material.resource_url ? (
                              <Button
                                asChild
                                variant="ghost"
                                size="sm"
                                className="min-h-[36px]"
                              >
                                <a
                                  href={material.resource_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  Link
                                  <ExternalLink
                                    aria-hidden="true"
                                    className="h-3.5 w-3.5"
                                  />
                                </a>
                              </Button>
                            ) : null}
                            {canWrite ? (
                              <>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="min-h-[36px]"
                                  onClick={() => onEdit(material)}
                                  aria-label={`Edit ${material.title}`}
                                >
                                  <Pencil
                                    aria-hidden="true"
                                    className="h-3.5 w-3.5"
                                  />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="text-danger min-h-[36px]"
                                  disabled={deletingId === material.id}
                                  onClick={() => onDelete(material.id)}
                                  aria-label={`Delete ${material.title}`}
                                >
                                  <Trash2
                                    aria-hidden="true"
                                    className="h-3.5 w-3.5"
                                  />
                                </Button>
                              </>
                            ) : null}
                          </div>
                        </div>

                        <div className="mt-3">
                          <CourseMaterialRenderer material={material} />
                        </div>
                      </article>
                    ))}
                  </div>
                )}

                <CourseDiscussionThread
                  classSlug={classSlug}
                  courseId={courseId}
                  meetingNumber={group.meetingNumber}
                  currentUserId={currentUserId}
                  comments={comments.filter(
                    (c) => (c.meeting_number ?? null) === group.meetingNumber,
                  )}
                  onCommentsChange={onCommentsChange}
                />
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}

import { Megaphone, NotebookPen } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { ASSIGNMENT_CONTENT_TYPE_LABELS } from "@starstask/contracts";

type AssignmentContentTypeBadgeProps = {
  contentType?: string;
  /** Names the lecturer behind recorded instructions, when known. */
  sourceLabel?: string | null;
};

/**
 * Distinguishes official lecturer assignments from internal class
 * announcements.
 *
 * The badge deliberately never says "verified": StarsTask records what a class
 * admin typed, and the interface must not imply the platform checked it with a
 * lecturer.
 */
export function AssignmentContentTypeBadge({
  contentType,
  sourceLabel,
}: AssignmentContentTypeBadgeProps) {
  const isAnnouncement = contentType === "class_announcement";
  const label = isAnnouncement
    ? ASSIGNMENT_CONTENT_TYPE_LABELS.class_announcement
    : ASSIGNMENT_CONTENT_TYPE_LABELS.lecturer_assignment;
  const Icon = isAnnouncement ? Megaphone : NotebookPen;

  return (
    <span className="inline-flex min-w-0 flex-wrap items-center gap-1.5">
      <Badge variant={isAnnouncement ? "neutral" : "accent"}>
        <Icon
          aria-hidden="true"
          className="h-3 w-3"
        />
        {label}
      </Badge>
      {!isAnnouncement && sourceLabel ? (
        <span className="text-muted-foreground truncate text-xs">
          {sourceLabel}
        </span>
      ) : null}
    </span>
  );
}

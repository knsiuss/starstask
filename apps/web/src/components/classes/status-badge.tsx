import { Badge, type BadgeProps } from "@/components/ui/badge";

type StatusBadgeProps = {
  status: string;
  className?: string;
};

const STATUS_LABELS: Record<string, string> = {
  active: "Active",
  archived: "Archived",
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
  draft: "Draft",
  pending_review: "Pending review",
  published: "Published",
  unpublished: "Unpublished",
};

const STATUS_VARIANTS: Record<string, BadgeProps["variant"]> = {
  active: "success",
  approved: "success",
  published: "success",
  pending: "warning",
  pending_review: "warning",
  draft: "neutral",
  rejected: "danger",
  withdrawn: "neutral",
  archived: "neutral",
  unpublished: "danger",
};

/** Shared status chip so class, application, and submission states read alike. */
export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <Badge
      variant={STATUS_VARIANTS[status] ?? "neutral"}
      className={className}
    >
      {STATUS_LABELS[status] ?? status}
    </Badge>
  );
}

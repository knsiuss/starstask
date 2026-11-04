import { Badge } from "@/components/ui/badge";
import {
  LEAVE_STATUS_LABELS,
  type LeaveRequestStatus,
} from "@starstask/contracts";

const VARIANTS: Record<
  LeaveRequestStatus,
  "neutral" | "accent" | "warning" | "success" | "danger"
> = {
  draft: "neutral",
  submitted: "accent",
  approved: "success",
  rejected: "danger",
  revision_requested: "warning",
  forwarded: "accent",
  cancelled: "neutral",
};

/**
 * Workflow status pill.
 *
 * `approved` means the class admin accepted the absence and the matching
 * sessions were marked excused. `forwarded` is the legacy hand-off state; it
 * says nothing about approval, which is why its tooltip spells that out.
 */
export function LeaveStatusBadge({
  status,
  className,
}: {
  status: LeaveRequestStatus;
  className?: string;
}) {
  const title =
    status === "forwarded"
      ? "Included in a forwarding package. This does not mean the lecturer approved it."
      : undefined;

  return (
    <Badge
      variant={VARIANTS[status]}
      className={className}
      title={title}
    >
      {LEAVE_STATUS_LABELS[status]}
    </Badge>
  );
}

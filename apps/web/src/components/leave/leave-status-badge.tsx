import { Badge } from "@/components/ui/badge";
import {
  LEAVE_STATUS_LABELS,
  type LeaveRequestStatus,
} from "@starstask/contracts";

const VARIANTS: Record<
  LeaveRequestStatus,
  "neutral" | "accent" | "warning" | "success"
> = {
  draft: "neutral",
  submitted: "accent",
  forwarded: "success",
  cancelled: "neutral",
};

/**
 * Workflow status pill.
 *
 * `forwarded` reads as success because the hand-off completed — not because the
 * lecturer approved the absence. The tooltip says so explicitly.
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

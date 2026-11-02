import { Badge } from "@/components/ui/badge";
import {
  ATTENDANCE_STATUS_LABELS,
  type AttendanceDisplayStatus,
} from "@starstask/contracts";

const VARIANTS: Record<
  AttendanceDisplayStatus,
  "neutral" | "accent" | "warning" | "success" | "danger"
> = {
  present: "success",
  late: "warning",
  excused: "accent",
  absent: "danger",
  pending: "neutral",
  unrecorded: "neutral",
};

/** Display-only status pill. `pending` and `unrecorded` are not stored values. */
export function AttendanceStatusBadge({
  status,
  className,
}: {
  status: AttendanceDisplayStatus;
  className?: string;
}) {
  return (
    <Badge
      variant={VARIANTS[status]}
      className={className}
    >
      {ATTENDANCE_STATUS_LABELS[status]}
    </Badge>
  );
}

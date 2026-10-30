import { Badge } from "@/components/ui/badge";
import {
  SESSION_STATUS_LABELS,
  type SessionStatus,
} from "@starstask/contracts";

const VARIANTS: Record<SessionStatus, "success" | "danger" | "neutral"> = {
  scheduled: "success",
  cancelled: "danger",
  completed: "neutral",
};

export function SessionStatusBadge({ status }: { status: SessionStatus }) {
  return (
    <Badge variant={VARIANTS[status]}>{SESSION_STATUS_LABELS[status]}</Badge>
  );
}

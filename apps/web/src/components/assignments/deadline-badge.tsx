import { Badge } from "@/components/ui/badge";
import {
  deadlineStateLabel,
  formatDeadline,
  getDeadlineState,
} from "@starstask/shared";

type DeadlineBadgeProps = {
  deadline: string | null;
  showDate?: boolean;
};

export function DeadlineBadge({
  deadline,
  showDate = true,
}: DeadlineBadgeProps) {
  const state = getDeadlineState(deadline);

  if (state === "none" || !deadline) {
    return <Badge>No deadline</Badge>;
  }

  const variant =
    state === "overdue"
      ? "danger"
      : state === "due_today"
        ? "warning"
        : "accent";

  return (
    <Badge
      variant={variant}
      className="max-w-full min-w-0"
    >
      <span className="shrink-0">{deadlineStateLabel(state)}</span>
      {showDate ? (
        <span className="truncate opacity-80">
          · {formatDeadline(deadline)}
        </span>
      ) : null}
    </Badge>
  );
}

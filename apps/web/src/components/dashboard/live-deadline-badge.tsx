"use client";

import { useEffect, useState } from "react";

import { Badge, type BadgeProps } from "@/components/ui/badge";
import {
  formatCount,
  getDeadlineBucket,
  getJakartaDayDifference,
  pluralize,
  type DeadlineBucket,
} from "@starstask/shared";

type LiveDeadlineBadgeProps = {
  deadline: string | null;
  initialNowIso: string;
};

const BUCKET_LABELS: Record<DeadlineBucket, string> = {
  none: "No due date",
  overdue: "Past deadline",
  due_today: "Due today",
  due_soon: "Due soon",
  later: "Open",
};

const BUCKET_VARIANTS: Record<DeadlineBucket, BadgeProps["variant"]> = {
  none: "neutral",
  overdue: "danger",
  due_today: "warning",
  due_soon: "warning",
  later: "neutral",
};

const REFRESH_INTERVAL_MS = 60_000;

/**
 * Re-renders only when the Jakarta calendar bucket changes, so an open page
 * crosses midnight without polling every second.
 */
export function LiveDeadlineBadge({
  deadline,
  initialNowIso,
}: LiveDeadlineBadgeProps) {
  const [now, setNow] = useState(() => new Date(initialNowIso));

  useEffect(() => {
    if (!deadline) {
      return;
    }

    const tick = () => {
      const next = new Date();

      setNow((previous) =>
        getDeadlineBucket(deadline, previous) ===
        getDeadlineBucket(deadline, next)
          ? previous
          : next,
      );
    };

    const interval = window.setInterval(tick, REFRESH_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, [deadline]);

  const bucket = getDeadlineBucket(deadline, now);

  let label = BUCKET_LABELS[bucket];

  if (bucket === "due_soon" && deadline) {
    const daysLeft = getJakartaDayDifference(deadline, now);

    label = `Due in ${formatCount(daysLeft)} ${pluralize(daysLeft, "day")}`;
  }

  return (
    <Badge
      variant={BUCKET_VARIANTS[bucket]}
      className="shrink-0 whitespace-nowrap"
    >
      {label}
    </Badge>
  );
}

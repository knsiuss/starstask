"use client";

import { useRouter } from "next/navigation";
import * as React from "react";

import {
  FEEDBACK_STATUSES,
  FEEDBACK_STATUS_LABELS,
  type FeedbackStatus,
} from "@starstask/contracts";

import { Select } from "@/components/ui/select";

type FeedbackStatusSelectProps = {
  feedbackId: string;
  initialStatus: FeedbackStatus;
};

export function FeedbackStatusSelect({
  feedbackId,
  initialStatus,
}: FeedbackStatusSelectProps) {
  const router = useRouter();
  const [status, setStatus] = React.useState(initialStatus);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const next = FEEDBACK_STATUSES.find((item) => item === event.target.value);

    if (!next || next === status) {
      return;
    }

    const previous = status;
    setStatus(next);
    setPending(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/feedback/${feedbackId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });

      if (!response.ok) {
        throw new Error("request failed");
      }

      router.refresh();
    } catch {
      setStatus(previous);
      setError("Not saved");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid gap-1">
      <Select
        value={status}
        onChange={handleChange}
        disabled={pending}
        aria-label="Triage status"
        className="min-w-32"
      >
        {FEEDBACK_STATUSES.map((value) => (
          <option
            key={value}
            value={value}
          >
            {FEEDBACK_STATUS_LABELS[value]}
          </option>
        ))}
      </Select>

      {error ? <p className="text-danger text-xs">{error}</p> : null}
    </div>
  );
}

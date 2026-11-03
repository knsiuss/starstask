"use client";

import * as React from "react";

import { AttendanceMeetingDashboard } from "@/components/attendance/attendance-meeting-dashboard";
import { Alert } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import type { AttendanceMeetingDetail } from "@/lib/attendance/meeting-types";

type AttendanceSessionPanelProps = {
  classSlug: string;
  sessionId: string;
};

/**
 * Live detail of one attendance meeting, shown inside a workspace panel.
 *
 * The detail is fetched from the existing meeting endpoint, and the dashboard
 * keeps polling it, so the panel shows the same roster and controls as the
 * standalone meeting page without duplicating any of that logic.
 */
export function AttendanceSessionPanel({
  classSlug,
  sessionId,
}: AttendanceSessionPanelProps) {
  const [detail, setDetail] = React.useState<AttendanceMeetingDetail | null>(
    null,
  );
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const controller = new AbortController();

    const load = async () => {
      try {
        const response = await fetch(
          `/api/classes/${classSlug}/attendance/meetings/${sessionId}`,
          { signal: controller.signal, cache: "no-store" },
        );

        const body = (await response.json().catch(() => null)) as {
          data?: AttendanceMeetingDetail;
          error?: { message?: string };
        } | null;

        if (!response.ok) {
          setError(
            body?.error?.message ?? "Could not load this attendance session.",
          );
          return;
        }

        setDetail(body?.data ?? null);
      } catch (caught) {
        if (controller.signal.aborted) {
          return;
        }

        setError(
          caught instanceof Error
            ? caught.message
            : "Could not load this attendance session.",
        );
      }
    };

    void load();

    return () => controller.abort();
  }, [classSlug, sessionId]);

  if (error) {
    return (
      <Alert variant="error">
        <p className="text-xs leading-relaxed">{error}</p>
      </Alert>
    );
  }

  if (!detail) {
    return (
      <div
        className="space-y-3"
        aria-busy="true"
      >
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <AttendanceMeetingDashboard
      classSlug={classSlug}
      initialDetail={detail}
    />
  );
}

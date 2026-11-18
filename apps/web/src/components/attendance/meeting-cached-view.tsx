"use client";

import Link from "next/link";
import * as React from "react";

import { Alert } from "@/components/ui/alert";
import { StudentMeetingList } from "@/components/attendance/student-meeting-list";
import { readLastView } from "@/lib/offline/checkin-cache";
import type { OfflineCheckInView } from "@/lib/offline/types";

type LoadState =
  { status: "loading" } | { status: "ready"; view: OfflineCheckInView | null };

/**
 * Offline fallback for the check-in deep-link page. Renders the student's
 * last saved view from IndexedDB when the server fetch threw. Nothing here
 * comes from cached SSR HTML; empty cache shows a static panel instead.
 */
export function MeetingCachedView({ sessionId }: { sessionId: string }) {
  const [state, setState] = React.useState<LoadState>({ status: "loading" });

  React.useEffect(() => {
    let cancelled = false;

    void readLastView().then((view) => {
      if (!cancelled) {
        setState({ status: "ready", view });
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  if (state.status === "loading") {
    return (
      <p className="text-muted-foreground mt-5 text-sm">
        Memuat tampilan tersimpan…
      </p>
    );
  }

  const view = state.view;
  const meeting = view?.meetings.find((item) => item.sessionId === sessionId);

  if (!view || !meeting) {
    return (
      <div className="mt-5 space-y-4">
        <Alert variant="warning">
          <p className="text-xs leading-relaxed">
            Kamu sedang offline dan belum ada tampilan tersimpan untuk meeting
            ini. Buka halaman ini sekali saat online agar bisa dipakai offline.
          </p>
        </Alert>
        <Link
          href="/offline"
          className="text-accent inline-block text-sm font-medium hover:underline"
        >
          Ke halaman offline
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-5">
      <Alert
        variant="info"
        className="mb-3"
      >
        <p className="text-xs leading-relaxed">
          Tampilan tersimpan dari kunjungan terakhir. Data mungkin tidak segar.
        </p>
      </Alert>
      <StudentMeetingList
        meetings={[meeting]}
        identity={view.identity}
        heading={meeting.courseName}
      />
    </div>
  );
}

"use client";

import { CalendarDays, ClipboardList, History } from "lucide-react";
import * as React from "react";

import { AttendanceActiveSessions } from "@/components/attendance/attendance-active-sessions";
import { AttendanceBreakdown } from "@/components/attendance/attendance-breakdown";
import { AttendanceExportCard } from "@/components/attendance/attendance-export-card";
import { AttendanceMeetingForm } from "@/components/attendance/attendance-meeting-form";
import { AttendanceProgressCard } from "@/components/attendance/attendance-progress-card";
import { AttendanceQuickActions } from "@/components/attendance/attendance-quick-actions";
import { AttendanceSessionPanel } from "@/components/attendance/attendance-session-panel";
import { ClassAttendanceCourses } from "@/components/attendance/class-attendance-courses";
import { ClassAttendanceMembers } from "@/components/attendance/class-attendance-members";
import { ClassAttendanceSessions } from "@/components/attendance/class-attendance-sessions";
import {
  popWorkspacePanel,
  pushWorkspacePanel,
  WorkspacePanelStack,
  type WorkspacePanel,
} from "@/components/attendance/workspace-panel-stack";
import { buildClassCourseRows } from "@/lib/attendance/course-rows";
import type { AttendanceMeetingListItem } from "@/lib/attendance/meeting-types";
import type { AttendanceGroupSummary } from "@/lib/db/attendance";
import type {
  ClassAttendanceMember,
  ClassAttendanceSession,
} from "@/lib/db/class-attendance";
import type { AttendanceSummaryCounts } from "@starstask/shared";

type WorkspaceSubject = {
  id: string;
  name: string;
  code: string | null;
};

type ClassAttendanceWorkspaceProps = {
  classSlug: string;
  classId: string;
  subjects: WorkspaceSubject[];
  meetings: AttendanceMeetingListItem[];
  members: ClassAttendanceMember[];
  sessions: ClassAttendanceSession[];
  bySubject: AttendanceGroupSummary[];
  summary: AttendanceSummaryCounts;
};

/**
 * The class attendance workspace.
 *
 * The workspace is a fixed-height surface: both columns scroll on their own,
 * and a session opens as a panel over the workspace instead of making the
 * page longer. Nothing here appends a section below the fold.
 */
export function ClassAttendanceWorkspace({
  classSlug,
  classId,
  subjects,
  meetings,
  members,
  sessions,
  bySubject,
  summary,
}: ClassAttendanceWorkspaceProps) {
  const [panels, setPanels] = React.useState<WorkspacePanel[]>([]);

  const openPanel = (panel: WorkspacePanel) => {
    setPanels((current) => pushWorkspacePanel(current, panel));
  };

  const closeTopPanel = () => {
    setPanels((current) => popWorkspacePanel(current));
  };

  const closeAllPanels = () => {
    setPanels([]);
  };

  const base = `/dashboard/classes/${classSlug}`;
  const openSession = (meeting: AttendanceMeetingListItem) =>
    openPanel({
      kind: "session",
      meetingId: meeting.sessionId,
      title: `${meeting.subjectName} · Pertemuan ${meeting.meetingNumber}`,
    });

  const meetingCountsBySubject = React.useMemo(() => {
    const counts = new Map<string, number>();

    for (const meeting of meetings) {
      counts.set(meeting.subjectId, (counts.get(meeting.subjectId) ?? 0) + 1);
    }

    return counts;
  }, [meetings]);

  const courseRows = React.useMemo(
    () =>
      buildClassCourseRows({
        subjects,
        groups: bySubject,
        sessionCounts: meetingCountsBySubject,
      }),
    [subjects, bySubject, meetingCountsBySubject],
  );

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto p-4 lg:grid-cols-[minmax(0,1fr)_21rem] lg:overflow-hidden lg:p-6">
        <div className="flex min-h-0 flex-col gap-4 lg:overflow-y-auto lg:pr-1">
          <section className="border-border bg-surface rounded-2xl border p-5">
            <header className="flex items-center gap-2.5">
              <span className="bg-accent-soft text-accent flex h-9 w-9 items-center justify-center rounded-lg">
                <CalendarDays
                  aria-hidden="true"
                  className="h-4 w-4"
                />
              </span>
              <div className="min-w-0">
                <h2 className="text-sm font-semibold tracking-tight">
                  Create attendance session
                </h2>
                <p className="text-muted-foreground text-xs">
                  One record per student per meeting.
                </p>
              </div>
            </header>

            <div className="mt-4">
              <AttendanceMeetingForm
                classId={classId}
                classSlug={classSlug}
                subjects={subjects}
                bare
              />
            </div>
          </section>

          <AttendanceActiveSessions
            meetings={meetings}
            onOpenSession={openSession}
          />
        </div>

        <aside className="flex min-h-0 flex-col gap-4 lg:overflow-y-auto">
          <AttendanceProgressCard
            summary={summary}
            title="Attendance overview"
            description="Across every member and session."
            totalLabel="Total records"
          />

          <AttendanceQuickActions
            actions={[
              {
                label: "Attendance detail",
                icon: History,
                onSelect: () =>
                  openPanel({
                    kind: "classAttendance",
                    title: "Attendance detail",
                  }),
              },
              {
                label: "Manage sessions",
                icon: CalendarDays,
                href: `${base}/sessions`,
              },
              {
                label: "Absence requests",
                icon: ClipboardList,
                href: `${base}/leave-requests`,
              },
            ]}
          />

          <AttendanceExportCard
            classSlug={classSlug}
            subjects={subjects}
          />
        </aside>
      </div>

      <WorkspacePanelStack
        panels={panels}
        onBack={closeTopPanel}
        onClose={closeAllPanels}
        renderPanel={(panel) => {
          if (panel.kind === "session") {
            return (
              <AttendanceSessionPanel
                classSlug={classSlug}
                sessionId={panel.meetingId}
              />
            );
          }

          return (
            <div className="space-y-6">
              <section aria-labelledby="attendance-detail-courses">
                <h2
                  id="attendance-detail-courses"
                  className="text-sm font-semibold tracking-tight"
                >
                  Courses
                </h2>
                <p className="text-muted-foreground mt-1 text-xs">
                  Each course is recorded on its own.
                </p>
                <div className="mt-3">
                  <ClassAttendanceCourses
                    rows={courseRows}
                    selectedCourseId={null}
                    sessionNoun="meeting"
                    hrefFor={(row) =>
                      `${base}/courses/${row.subjectId}/attendance`
                    }
                    emptyDescription="Add a course under Courses to record attendance for it."
                  />
                </div>
              </section>

              <AttendanceBreakdown
                title="By course"
                description="Aggregated across members and sessions."
                groups={bySubject}
              />
              <ClassAttendanceSessions sessions={sessions} />
              <ClassAttendanceMembers members={members} />
            </div>
          );
        }}
      />
    </div>
  );
}

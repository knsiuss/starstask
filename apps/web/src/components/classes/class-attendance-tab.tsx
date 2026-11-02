import { CalendarDays, ClipboardList, History, Info } from "lucide-react";

import { AttendanceProgressCard } from "@/components/attendance/attendance-progress-card";
import {
  AttendanceTabs,
  type AttendanceTab,
} from "@/components/attendance/attendance-tabs";
import {
  ClassAttendanceActions,
  type ClassAttendanceAction,
} from "@/components/classes/class-attendance-actions";
import { ClassAttendanceManagerView } from "@/components/classes/class-attendance-manager-view";
import { ClassAttendanceMemberView } from "@/components/classes/class-attendance-member-view";
import type { AttendanceCheckInView } from "@/lib/attendance/types";
import type {
  AttendanceMeetingListItem,
  StudentAttendanceMeeting,
} from "@/lib/attendance/meeting-types";
import type { StudentAttendanceView } from "@/lib/db/attendance";
import type { ClassAttendanceView } from "@/lib/db/class-attendance";

export type ClassAttendanceClassInfo = {
  id: string;
  slug: string;
  semester: string;
  academicYear: string;
};

type ClassAttendanceTabProps = {
  classInfo: ClassAttendanceClassInfo;
  activeView: AttendanceTab;
  checkInView: AttendanceCheckInView;
} & (
  | {
      role: "manager";
      view: ClassAttendanceView;
      meetings: AttendanceMeetingListItem[];
      subjects: { id: string; name: string; code: string | null }[];
    }
  | {
      role: "member";
      view: StudentAttendanceView;
      meetings: StudentAttendanceMeeting[];
      identity: { fullName: string | null; nim: string | null };
    }
);

/**
 * Attendance inside the class workspace. Managers see the whole class; everyone
 * else sees only their own records, which the queries already scope to them.
 */
export function ClassAttendanceTab(props: ClassAttendanceTabProps) {
  const { classInfo, activeView, checkInView } = props;
  const base = `/dashboard/classes/${classInfo.slug}`;
  const isManager = props.role === "manager";

  const actions: ClassAttendanceAction[] = isManager
    ? [
        {
          href: `${base}?tab=attendance&view=history`,
          label: "View attendance history",
          icon: History,
        },
        {
          href: `${base}/sessions`,
          label: "Manage sessions",
          icon: CalendarDays,
        },
        {
          href: `${base}/leave-requests`,
          label: "Absence requests",
          icon: ClipboardList,
        },
      ]
    : [
        {
          href: `${base}?tab=attendance&view=history`,
          label: "View attendance history",
          icon: History,
        },
        {
          href: `${base}/leave-requests`,
          label: "Submit absence request",
          icon: ClipboardList,
        },
        {
          href: `${base}?tab=overview`,
          label: "Class information",
          icon: Info,
        },
      ];

  return (
    <div className="mt-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Attendance</h1>
        <p className="text-muted-foreground mt-1 max-w-2xl text-sm">
          {isManager
            ? "Track every member's attendance and record sessions for this class."
            : "Check in to active sessions and review your attendance in this class."}
        </p>
      </header>

      <div className="mt-5">
        <AttendanceTabs
          activeTab={activeView}
          hrefFor={(tab) =>
            tab === "history"
              ? `${base}?tab=attendance&view=history`
              : `${base}?tab=attendance`
          }
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          {props.role === "manager" ? (
            <ClassAttendanceManagerView
              view={props.view}
              checkInView={checkInView}
              activeView={activeView}
              classSlug={classInfo.slug}
              classId={classInfo.id}
              meetings={props.meetings}
              subjects={props.subjects}
            />
          ) : (
            <ClassAttendanceMemberView
              view={props.view}
              checkInView={checkInView}
              activeView={activeView}
              classSlug={classInfo.slug}
              classId={classInfo.id}
              meetings={props.meetings}
              identity={props.identity}
            />
          )}
        </div>

        <aside className="grid content-start gap-4">
          <AttendanceProgressCard
            summary={props.view.summary}
            title={isManager ? "Class attendance" : "Your attendance"}
            description={
              isManager
                ? "Across all members and sessions."
                : `${classInfo.semester} · ${classInfo.academicYear}`
            }
            totalLabel={isManager ? "Total records" : "Total sessions"}
          />
          <ClassAttendanceActions actions={actions} />
        </aside>
      </div>
    </div>
  );
}

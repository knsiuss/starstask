import {
  ArrowRight,
  CalendarClock,
  ClipboardCheck,
  ClipboardList,
  Clock3,
  FileSpreadsheet,
  FileWarning,
  ListChecks,
  Megaphone,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AbsenceDetail } from "@/components/actions/absence-detail";
import {
  AbsenceEmptyState,
  AbsenceFilterBar,
  AbsenceRequestCard,
} from "@/components/actions/absences-tab";
import { AttendanceTab } from "@/components/actions/attendance-tab";
import { ClassSwitcherSelect } from "@/components/actions/class-switcher-select";
import { CreatePresenceButton } from "@/components/attendance/create-presence-button";
import { RequestCard } from "@/components/assignments/workspace/request-card";
import { ReviewRequestDialog } from "@/components/assignments/workspace/review-request-dialog";
import { Pagination } from "@/components/assignments/pagination";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { SetupNotice } from "@/components/layout/setup-notice";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { TabStrip } from "@/components/ui/tab-strip";
import { getSessionUser } from "@/lib/auth/session";
import {
  type ActionCenterRow,
  type ActionCenterTotals,
  type ActionCounts,
} from "@/lib/classes/action-center";
import { getClassActionCenter } from "@/lib/db/class-actions";
import {
  getWorkspaceScope,
  listManagedRequests,
  type WorkspaceRequest,
} from "@/lib/db/assignment-workspace";
import {
  countRevisionLeaveRequests,
  enrichAffectedSessions,
  getLeaveRequestById,
  listAffectedSessions,
  listLeaveHistory,
  listManagedLeaveRequests,
  type LeaveRequestSummary,
} from "@/lib/db/leave";
import { getEvidenceViews } from "@/features/leave/evidence-service";
import { listClassAttendanceMeetings } from "@/lib/db/attendance-meetings";
import {
  getClassRole,
  listClassMembers,
  listClassSubjects,
} from "@/lib/db/classes";
import { isSupabaseConfigured } from "@/lib/env/public";
import { buildLoginPath } from "@/lib/security/redirect";
import { cn } from "@/lib/utils/cn";
import {
  LEAVE_STATUS_LABELS,
  leaveRequestIdSchema,
} from "@starstask/contracts";
import { formatLeaveDate } from "@starstask/shared";

export const metadata: Metadata = {
  title: "Action center",
  description: "Everything waiting on you across the classes you lead.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const TAB_VALUES = [
  "overview",
  "assignments",
  "absences",
  "attendance",
] as const;
type ActionTab = (typeof TAB_VALUES)[number];

/**
 * Charcoal + sage dark palette, scoped to this page. Light mode keeps the
 * shared theme tokens untouched; dark mode re-points the same surfaces at the
 * lecturer console's charcoal panel so this page reads as one with it.
 */
const PANEL =
  "border-border bg-surface text-foreground dark:border-white/[0.06] dark:bg-[#23231f] dark:text-[#ece9e3]";
const PANEL_SUBTLE =
  "border-border bg-subtle dark:border-white/[0.08] dark:bg-white/[0.03]";
const SAGE_TEXT = "dark:text-[#a3b07d]";
const SAGE_LINK =
  "text-accent hover:text-accent-hover dark:text-[#c3ccad] dark:hover:text-[#dde3cd]";
const SECONDARY_BUTTON_DARK =
  "dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-[#ece9e3] dark:hover:bg-white/[0.08]";

type MetricKey = keyof ActionCounts;

type Metric = {
  key: MetricKey;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
  path: (slug: string) => string;
};

const METRICS: readonly Metric[] = [
  {
    key: "pendingSubmissions",
    label: "Submissions to review",
    shortLabel: "Submissions",
    icon: ClipboardCheck,
    path: (slug) =>
      `/classes/${slug}/manage?tab=content&status=pending_review#review-queue`,
  },
  {
    key: "pendingLeave",
    label: "Absence requests",
    shortLabel: "Absences",
    icon: ClipboardList,
    path: (slug) => `/classes/${slug}/leave-requests`,
  },
  {
    key: "todaysSessions",
    label: "Sessions today",
    shortLabel: "Sessions",
    icon: CalendarClock,
    path: (slug) => `/classes/${slug}/sessions`,
  },
  {
    key: "openReports",
    label: "Open reader reports",
    shortLabel: "Reports",
    icon: FileWarning,
    path: (slug) => `/classes/${slug}/reports`,
  },
];

function buildSummary(totals: ActionCenterTotals): string {
  if (totals.actions === 0) {
    return "Nothing is waiting on you right now.";
  }

  const classLabel = totals.classes === 1 ? "class" : "classes";

  return `${totals.actions} ${totals.actions === 1 ? "action" : "actions"} across ${totals.classes} ${classLabel}.`;
}

export type RecentRequestItem = {
  id: string;
  studentName: string;
  type: "Assignment Request" | "Absence Request";
  course: string;
  className: string;
  date: string | null;
  statusLabel: string;
  statusVariant: "accent" | "warning" | "success" | "danger" | "neutral";
  href: string;
};

const ASSIGNMENT_STATUS_LABELS: Record<
  WorkspaceRequest["displayStatus"],
  string
> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  revision_requested: "Revision",
};

const ASSIGNMENT_STATUS_VARIANTS: Record<
  WorkspaceRequest["displayStatus"],
  RecentRequestItem["statusVariant"]
> = {
  pending: "accent",
  approved: "success",
  rejected: "danger",
  revision_requested: "warning",
};

const LEAVE_STATUS_VARIANTS: Record<
  LeaveRequestSummary["status"],
  RecentRequestItem["statusVariant"]
> = {
  draft: "neutral",
  submitted: "accent",
  approved: "success",
  rejected: "danger",
  revision_requested: "warning",
  forwarded: "success",
  cancelled: "neutral",
};

/**
 * Merges the assignment queue and the absence queue into one latest-first
 * list. Every item references its original request (assignment page or absence
 * detail) — no duplicate records are created here.
 */
function buildRecentItems(
  assignments: WorkspaceRequest[],
  absences: LeaveRequestSummary[],
): RecentRequestItem[] {
  const items = [
    ...assignments.map((request) => ({
      id: `assignment-${request.id}`,
      studentName: request.submitter_name ?? "Student",
      type: "Assignment Request" as const,
      course: request.course_name,
      className: request.class_name,
      date: request.created_at,
      statusLabel: ASSIGNMENT_STATUS_LABELS[request.displayStatus],
      statusVariant: ASSIGNMENT_STATUS_VARIANTS[request.displayStatus],
      href: `/assignments/${request.id}`,
    })),
    ...absences.map((request) => ({
      id: `absence-${request.id}`,
      studentName: request.studentName,
      type: "Absence Request" as const,
      course:
        request.subjectIds.length === 0
          ? "Whole class"
          : `${request.subjectIds.length} ${request.subjectIds.length === 1 ? "course" : "courses"}`,
      className: request.className,
      date: request.submittedAt ?? request.createdAt,
      statusLabel: LEAVE_STATUS_LABELS[request.status],
      statusVariant: LEAVE_STATUS_VARIANTS[request.status],
      href: `/actions?tab=absences&request=${request.id}`,
    })),
  ];

  return items
    .sort((left, right) => {
      if (!left.date) return 1;
      if (!right.date) return -1;
      return right.date.localeCompare(left.date);
    })
    .slice(0, 10);
}

function ClassActionsCard({ row }: { row: ActionCenterRow }) {
  return (
    <Card className={cn(PANEL, "p-4 sm:p-5")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold dark:text-[#ece9e3]">
            {row.className}
          </h2>
          <p className="text-muted-foreground mt-0.5 text-xs dark:text-[#a19d92]">
            {row.semester} · {row.academicYear}
          </p>
        </div>
        <span
          className={cn(
            "rounded-full px-2.5 py-0.5 text-[11px] font-medium",
            row.total > 0
              ? "bg-warning-soft text-warning dark:border dark:border-[#f5c15d]/25 dark:bg-[#f5c15d]/10 dark:text-[#e8b84b]"
              : "bg-muted text-muted-foreground dark:border dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-[#a19d92]",
          )}
        >
          {row.total} {row.total === 1 ? "action" : "actions"}
        </span>
      </div>

      <ul className="mt-4 grid gap-2 sm:grid-cols-2">
        {METRICS.map((metric) => {
          const value = row[metric.key];
          const Icon = metric.icon;

          return (
            <li key={metric.key}>
              <Link
                href={metric.path(row.classSlug)}
                className="border-border hover:bg-muted focus-visible:outline-accent flex items-center gap-3 rounded-md border px-3 py-2.5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 dark:border-white/[0.08] dark:bg-white/[0.03] dark:hover:bg-white/[0.06]"
              >
                <Icon
                  aria-hidden="true"
                  className="text-muted-foreground h-4 w-4 shrink-0 dark:text-[#a3b07d]"
                />
                <span className="text-muted-foreground min-w-0 flex-1 truncate text-sm dark:text-[#aaa69e]">
                  {metric.label}
                </span>
                <span
                  className={cn(
                    "shrink-0 text-sm font-semibold tabular-nums",
                    value > 0
                      ? "text-foreground dark:text-[#ece9e3]"
                      : "text-muted-foreground dark:text-[#6f6f64]",
                  )}
                >
                  {value}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      <Link
        href={`/classes/${row.classSlug}/manage`}
        className={cn(
          "mt-3 inline-flex items-center gap-1 rounded-sm text-sm font-medium underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
          SAGE_LINK,
        )}
      >
        Manage this class
        <ArrowRight
          aria-hidden="true"
          className="h-3.5 w-3.5"
        />
      </Link>
    </Card>
  );
}

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function getParam(
  params: Record<string, string | string[] | undefined>,
  key: string,
): string | undefined {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

export default async function ActionCenterPage({ searchParams }: PageProps) {
  if (!isSupabaseConfigured()) {
    return (
      <PageShell
        width="wide"
        className="dark:bg-[#1a1a17] dark:text-[#ece9e3]"
      >
        <PageHeader
          title="Action center"
          className="dark:[&_h1]:text-[#ece9e3]"
        />
        <div className="mt-6">
          <SetupNotice />
        </div>
      </PageShell>
    );
  }

  const session = await getSessionUser();

  if (!session) {
    redirect(buildLoginPath("/actions"));
  }

  const rawParams = await searchParams;
  const tabParam = getParam(rawParams, "tab");
  const tab: ActionTab = (TAB_VALUES as readonly string[]).includes(
    tabParam ?? "",
  )
    ? (tabParam as ActionTab)
    : "overview";

  const [center, scope] = await Promise.all([
    getClassActionCenter(session.user.id).catch(() => null),
    getWorkspaceScope(session.user.id).catch(() => null),
  ]);

  const managedClassIds = scope?.managedClassIds ?? [];
  const [managedRequests, revisionLeaveCount] = await Promise.all([
    scope ? listManagedRequests(scope).catch(() => []) : Promise.resolve([]),
    countRevisionLeaveRequests(managedClassIds).catch(() => 0),
  ]);

  const pendingAssignments = center?.totals.pendingSubmissions ?? 0;
  const pendingAbsences = center?.totals.pendingLeave ?? 0;
  const revisionAssignments = managedRequests.filter(
    (item) => item.displayStatus === "revision_requested",
  ).length;
  const revisionTotal = revisionLeaveCount + revisionAssignments;
  const totalPending = pendingAssignments + pendingAbsences;

  const tabs = [
    {
      href: "/actions?tab=overview",
      label: "Overview",
      active: tab === "overview",
    },
    {
      href: "/actions?tab=assignments",
      label: `Assignment Requests${pendingAssignments > 0 ? ` (${pendingAssignments})` : ""}`,
      active: tab === "assignments",
    },
    {
      href: "/actions?tab=absences",
      label: `Absence Requests${pendingAbsences > 0 ? ` (${pendingAbsences})` : ""}`,
      active: tab === "absences",
    },
    {
      href: "/actions?tab=attendance",
      label: "Attendance",
      active: tab === "attendance",
    },
  ];

  // Class selection shared by the Overview sidebar and the Attendance tab.
  // Unknown or unmanaged ids fall back to the first managed class. Semester
  // metadata comes from the action-center rows, which carry it.
  const classParam = getParam(rawParams, "class");
  const scopeById = new Map(
    (scope?.classes ?? []).map((item) => [item.id, item]),
  );
  const managedOptions = (center?.rows ?? []).map((row) => ({
    id: row.classId,
    slug: row.classSlug,
    name: row.className,
    code: scopeById.get(row.classId)?.class_code ?? null,
    semester: row.semester,
    academicYear: row.academicYear,
  }));
  const selectedClass =
    managedOptions.find((item) => item.id === classParam) ??
    managedOptions[0] ??
    null;

  const sidebarRow = selectedClass
    ? (center?.rows.find((row) => row.classId === selectedClass.id) ?? null)
    : null;
  const sidebarMembers =
    selectedClass && (tab === "overview" || tab === "attendance")
      ? await listClassMembers(selectedClass.id).catch(() => [])
      : [];
  const sidebarMeetings =
    selectedClass && (tab === "overview" || tab === "attendance")
      ? await listClassAttendanceMeetings(selectedClass.id).catch(() => [])
      : [];

  // Absence tab data (only when needed, to keep other tabs light).
  const absenceValues = {
    q: getParam(rawParams, "q"),
    class: getParam(rawParams, "class"),
    course: getParam(rawParams, "course"),
    status: getParam(rawParams, "status"),
    from: getParam(rawParams, "from"),
    to: getParam(rawParams, "to"),
    sort: getParam(rawParams, "sort") ?? "newest",
  };
  const absencePage = Math.max(
    1,
    Number.parseInt(getParam(rawParams, "page") ?? "1", 10) || 1,
  );
  const requestParam = getParam(rawParams, "request");

  const absences =
    tab === "absences" && !requestParam
      ? await listManagedLeaveRequests(managedClassIds, {
          classId:
            absenceValues.class && absenceValues.class !== "all"
              ? absenceValues.class
              : undefined,
          subjectId:
            absenceValues.course && absenceValues.course !== "all"
              ? absenceValues.course
              : undefined,
          status:
            (absenceValues.status as
              | "submitted"
              | "approved"
              | "rejected"
              | "revision_requested"
              | "forwarded"
              | "cancelled"
              | "all"
              | undefined) ?? "all",
          from: absenceValues.from,
          to: absenceValues.to,
          search: absenceValues.q,
          sort:
            absenceValues.sort === "oldest" || absenceValues.sort === "upcoming"
              ? absenceValues.sort
              : "newest",
          page: absencePage,
          pageSize: 20,
        }).catch(() => null)
      : null;

  const absenceDetail = await loadAbsenceDetail(
    tab === "absences" ? requestParam : undefined,
    session.user.id,
    managedClassIds,
  );

  const classOptions = (scope?.classes ?? [])
    .filter((item) => item.is_admin)
    .map((item) => ({ id: item.id, name: item.name, code: item.class_code }));

  // Courses for the picked class drive both course filters (absence + assignment).
  const absenceCourses =
    absenceValues.class && absenceValues.class !== "all"
      ? (scopeById.get(absenceValues.class)?.subjects ?? [])
      : [];

  // Assignment tab filters (GET form; filtering happens over the fetched queue).
  const assignmentValues = {
    q: getParam(rawParams, "aq"),
    class: getParam(rawParams, "aclass"),
    course: getParam(rawParams, "acourse"),
    status: getParam(rawParams, "astatus") ?? "all",
  };

  // Overview recent requests: latest across both queues, same rows the tabs render.
  const recentAbsences =
    tab === "overview"
      ? await listManagedLeaveRequests(managedClassIds, {
          sort: "newest",
          page: 1,
          pageSize: 20,
        }).catch(() => null)
      : null;

  const recentItems =
    tab === "overview"
      ? buildRecentItems(managedRequests, recentAbsences?.items ?? [])
      : [];

  // Attendance tab data for the selected class only.
  const attendanceSubjects = selectedClass
    ? await listClassSubjects(selectedClass.id).catch(() => [])
    : [];
  const attendanceCourses = selectedClass
    ? attendanceSubjects.map((subject) => ({
        id: subject.id,
        name: subject.name,
        code: subject.code,
        lecturerName: subject.lecturer_name,
        meetings: sidebarMeetings.filter(
          (meeting) => meeting.subjectId === subject.id,
        ),
      }))
    : [];

  const leaderActions =
    managedOptions.length > 0 ? (
      <>
        <CreatePresenceButton classes={managedOptions} />
        {selectedClass ? (
          <>
            <Button
              asChild
              size="sm"
              variant="secondary"
              className={SECONDARY_BUTTON_DARK}
            >
              <Link
                href={`/classes/${selectedClass.slug}/academic/announcements`}
              >
                <Megaphone
                  aria-hidden="true"
                  className="h-3.5 w-3.5"
                />
                Announcement
              </Link>
            </Button>
            <Button
              asChild
              size="sm"
              variant="secondary"
              className={SECONDARY_BUTTON_DARK}
            >
              <Link href={`/settings/branding?class=${selectedClass.slug}`}>
                <FileSpreadsheet
                  aria-hidden="true"
                  className="h-3.5 w-3.5"
                />
                Export branding
              </Link>
            </Button>
            <Button
              asChild
              size="sm"
              variant="secondary"
              className={SECONDARY_BUTTON_DARK}
            >
              <Link href={`/classes/${selectedClass.slug}/manage`}>
                <Settings
                  aria-hidden="true"
                  className="h-3.5 w-3.5"
                />
                Manage class
              </Link>
            </Button>
          </>
        ) : null}
      </>
    ) : null;

  return (
    <PageShell
      width="wide"
      className="dark:bg-[#1a1a17] dark:text-[#ece9e3]"
    >
      <p className="text-muted-foreground mb-1 text-xs font-medium tracking-[0.08em] uppercase dark:text-[#a19d92]">
        Class leader
      </p>
      <PageHeader
        title="Action center"
        className="dark:[&_h1]:text-[#ece9e3] dark:[&_p]:text-[#aaa69e]"
        description={
          <>
            {center === null
              ? "Everything waiting on you across the classes you lead."
              : buildSummary(center.totals)}{" "}
            Today&apos;s sessions are counted in Asia/Jakarta time.
          </>
        }
        actions={leaderActions}
      />

      <TabStrip
        label="Action center sections"
        className="mt-5 sm:mt-6"
        items={tabs}
      />

      {center === null ? (
        <Alert
          variant="error"
          className="mt-6"
        >
          Your action counts could not be loaded. Refresh the page to try again.
        </Alert>
      ) : null}

      {tab === "overview" ? (
        <OverviewTab
          center={center}
          totalPending={totalPending}
          pendingAbsences={pendingAbsences}
          pendingAssignments={pendingAssignments}
          revisionTotal={revisionTotal}
          recent={recentItems}
          classes={managedOptions}
          selectedClass={selectedClass}
          totalStudents={sidebarMembers.length}
          pendingForClass={
            sidebarRow
              ? sidebarRow.pendingSubmissions + sidebarRow.pendingLeave
              : 0
          }
          recordedSessions={sidebarMeetings.length}
        />
      ) : tab === "assignments" ? (
        <AssignmentsTab
          requests={managedRequests}
          values={assignmentValues}
          classes={classOptions}
          courses={
            assignmentValues.class && assignmentValues.class !== "all"
              ? (scopeById.get(assignmentValues.class)?.subjects ?? [])
              : []
          }
        />
      ) : tab === "attendance" ? (
        <AttendanceTab
          classes={managedOptions}
          selected={selectedClass}
          courses={attendanceCourses}
          totalStudents={sidebarMembers.length}
          pendingForClass={
            sidebarRow
              ? sidebarRow.pendingSubmissions + sidebarRow.pendingLeave
              : 0
          }
        />
      ) : absenceDetail ? (
        absenceDetail
      ) : absences ? (
        <div className="mt-4 space-y-4">
          <AbsenceFilterBar
            action="/actions"
            values={absenceValues}
            classes={classOptions}
            courses={absenceCourses}
          />
          {absences.items.length === 0 ? (
            <AbsenceEmptyState
              filtered={Boolean(
                absenceValues.q ||
                absenceValues.class !== undefined ||
                absenceValues.course !== undefined ||
                (absenceValues.status && absenceValues.status !== "all") ||
                absenceValues.from ||
                absenceValues.to,
              )}
            />
          ) : (
            <div className="grid gap-3">
              {absences.items.map((request) => (
                <AbsenceRequestCard
                  key={request.id}
                  request={request}
                />
              ))}
            </div>
          )}
          <Pagination
            basePath="/actions"
            page={absences.page}
            totalPages={absences.totalPages}
            params={{
              tab: "absences",
              ...(absenceValues.q ? { q: absenceValues.q } : {}),
              ...(absenceValues.class ? { class: absenceValues.class } : {}),
              ...(absenceValues.course ? { course: absenceValues.course } : {}),
              ...(absenceValues.status ? { status: absenceValues.status } : {}),
              ...(absenceValues.from ? { from: absenceValues.from } : {}),
              ...(absenceValues.to ? { to: absenceValues.to } : {}),
              ...(absenceValues.sort !== "newest"
                ? { sort: absenceValues.sort }
                : {}),
            }}
          />
        </div>
      ) : (
        <AbsenceEmptyState filtered={false} />
      )}
    </PageShell>
  );
}

function OverviewTab({
  center,
  totalPending,
  pendingAbsences,
  pendingAssignments,
  revisionTotal,
  recent,
  classes,
  selectedClass,
  totalStudents,
  pendingForClass,
  recordedSessions,
}: {
  center: Awaited<ReturnType<typeof getClassActionCenter>> | null;
  totalPending: number;
  pendingAbsences: number;
  pendingAssignments: number;
  revisionTotal: number;
  recent: RecentRequestItem[];
  classes: {
    id: string;
    slug: string;
    name: string;
    code: string | null;
    semester: string;
    academicYear: string;
  }[];
  selectedClass: {
    id: string;
    slug: string;
    name: string;
    code: string | null;
    semester: string;
    academicYear: string;
  } | null;
  totalStudents: number;
  pendingForClass: number;
  recordedSessions: number;
}) {
  if (!center) {
    return null;
  }

  const cards = [
    {
      label: "Pending Requests",
      shortLabel: "Pending",
      value: totalPending,
      icon: ListChecks,
    },
    {
      label: "Assignment Requests",
      shortLabel: "Tasks",
      value: pendingAssignments,
      icon: ClipboardCheck,
    },
    {
      label: "Absence Requests",
      shortLabel: "Absence",
      value: pendingAbsences,
      icon: ClipboardList,
    },
    {
      label: "Requires Revision",
      shortLabel: "Revision",
      value: revisionTotal,
      icon: FileWarning,
    },
  ];

  if (center.rows.length === 0) {
    return (
      <div
        className={cn(
          "mt-5 rounded-xl border border-dashed px-5 py-8 text-center sm:mt-6 sm:px-6 sm:py-10",
          PANEL_SUBTLE,
        )}
      >
        <ListChecks
          aria-hidden="true"
          className="text-muted-foreground mx-auto h-6 w-6 dark:text-[#a3b07d]"
        />
        <p className="mt-2 text-sm font-medium dark:text-[#ece9e3]">
          No classes to lead yet
        </p>
        <p className="text-muted-foreground mx-auto mt-1 max-w-sm text-xs leading-relaxed dark:text-[#aaa69e]">
          This page collects review queues for class leaders. Once you
          administer an active class, its pending work appears here.
        </p>
        <Link
          href="/classes"
          className={cn(
            "mt-4 inline-flex items-center gap-1 rounded-sm text-sm font-medium underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
            SAGE_LINK,
          )}
        >
          Go to my classes
          <ArrowRight
            aria-hidden="true"
            className="h-3.5 w-3.5"
          />
        </Link>
      </div>
    );
  }

  return (
    <>
      <dl className="mt-5 grid grid-cols-4 gap-1.5 sm:gap-2.5 lg:mt-6 lg:gap-3">
        {cards.map((item) => {
          const Icon = item.icon;

          return (
            <Card
              key={item.label}
              className={cn(
                PANEL,
                "min-w-0 px-1.5 py-2.5 text-center sm:p-4 sm:text-left",
              )}
            >
              <dd className="text-lg leading-none font-semibold tabular-nums sm:hidden dark:text-[#ece9e3]">
                {item.value}
              </dd>
              <dt className="text-muted-foreground mt-1 flex items-center justify-center gap-1.5 text-[11px] sm:mt-0 sm:justify-start sm:gap-2 sm:text-xs dark:text-[#aaa69e]">
                <Icon
                  aria-hidden="true"
                  className={cn(
                    "hidden h-3.5 w-3.5 shrink-0 sm:inline",
                    SAGE_TEXT,
                  )}
                />
                <span className="truncate sm:hidden">{item.shortLabel}</span>
                <span className="hidden truncate sm:inline">{item.label}</span>
              </dt>
              <dd className="mt-1 hidden text-2xl font-semibold tabular-nums sm:block dark:text-[#ece9e3]">
                {item.value}
              </dd>
            </Card>
          );
        })}
      </dl>

      <div className="mt-4 grid gap-4 sm:mt-6 lg:grid-cols-3">
        <section
          aria-labelledby="recent-requests"
          className={cn("rounded-xl border p-4 sm:p-5 lg:col-span-2", PANEL)}
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2
                id="recent-requests"
                className="flex items-center gap-2 text-sm font-semibold dark:text-[#ece9e3]"
              >
                <Clock3
                  aria-hidden="true"
                  className={cn("h-4 w-4", SAGE_TEXT)}
                />
                Recent requests
              </h2>
              <p className="text-muted-foreground mt-0.5 text-xs dark:text-[#a19d92]">
                Latest requests that need your attention.
              </p>
            </div>
            <Link
              href="/actions?tab=assignments"
              className={cn(
                "inline-flex items-center gap-1 rounded-sm text-xs font-semibold underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                SAGE_LINK,
              )}
            >
              View all requests
              <ArrowRight
                aria-hidden="true"
                className="h-3.5 w-3.5"
              />
            </Link>
          </div>

          {recent.length === 0 ? (
            <div
              className={cn(
                "mt-4 rounded-lg border border-dashed px-4 py-8 text-center",
                PANEL_SUBTLE,
              )}
            >
              <ListChecks
                aria-hidden="true"
                className="text-muted-foreground mx-auto h-5 w-5 dark:text-[#a3b07d]"
              />
              <p className="mt-2 text-sm font-medium dark:text-[#ece9e3]">
                {center.totals.actions === 0
                  ? "All caught up"
                  : "No recent requests"}
              </p>
              <p className="text-muted-foreground mx-auto mt-1 max-w-sm text-xs leading-relaxed dark:text-[#aaa69e]">
                {center.totals.actions === 0
                  ? "No submissions, absence requests, or reader reports need you right now."
                  : "New submissions and absence requests appear here as they arrive."}
              </p>
            </div>
          ) : (
            <ul className="mt-3 divide-y divide-border dark:divide-white/[0.06]">
              {recent.map((item) => (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    className="hover:bg-muted focus-visible:outline-accent -mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 dark:hover:bg-white/[0.04]"
                  >
                    <span
                      aria-hidden="true"
                      className="bg-accent-soft text-accent flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold dark:bg-[#5b6b45] dark:text-[#ece9e3]"
                    >
                      {item.studentName.slice(0, 1).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold dark:text-[#ece9e3]">
                        {item.studentName}
                      </span>
                      <span className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] dark:text-[#a19d92]">
                        <span>{item.type}</span>
                        <span>
                          {item.course} · {item.className}
                        </span>
                        {item.date ? (
                          <span>{formatLeaveDate(item.date.slice(0, 10))}</span>
                        ) : null}
                      </span>
                    </span>
                    <Badge variant={item.statusVariant}>
                      {item.statusLabel}
                    </Badge>
                    <ArrowRight
                      aria-hidden="true"
                      className="text-muted-foreground h-4 w-4 shrink-0 dark:text-[#a19d92]"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside className="space-y-4">
          <section
            aria-labelledby="your-classes"
            className={cn("rounded-xl border p-4 sm:p-5", PANEL)}
          >
            <h2
              id="your-classes"
              className="flex items-center gap-2 text-sm font-semibold dark:text-[#ece9e3]"
            >
              <Users
                aria-hidden="true"
                className={cn("h-4 w-4", SAGE_TEXT)}
              />
              Your classes
            </h2>
            {selectedClass ? (
              <>
                <form
                  action="/actions"
                  method="get"
                  className="mt-3"
                >
                  <input
                    type="hidden"
                    name="tab"
                    value="overview"
                  />
                  <ClassSwitcherSelect
                    id="overview-class"
                    name="class"
                    defaultValue={selectedClass.id}
                    ariaLabel="Choose class"
                    className="mt-3 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-[#ece9e3]"
                  >
                    {classes.map((item) => (
                      <option
                        key={item.id}
                        value={item.id}
                      >
                        {item.code
                          ? `${item.code} - Semester ${item.semester} (${item.academicYear})`
                          : `${item.name} - Semester ${item.semester} (${item.academicYear})`}
                      </option>
                    ))}
                  </ClassSwitcherSelect>
                  <button
                    type="submit"
                    className="sr-only"
                  >
                    Show class
                  </button>
                </form>
                <dl className="mt-3 grid gap-2 text-sm">
                  <div className="flex items-center justify-between">
                    <dt className="text-muted-foreground dark:text-[#a19d92] flex items-center gap-2 text-xs">
                      <Users
                        aria-hidden="true"
                        className="h-3.5 w-3.5"
                      />
                      Total students
                    </dt>
                    <dd className="font-semibold tabular-nums dark:text-[#ece9e3]">
                      {totalStudents}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-muted-foreground dark:text-[#a19d92] flex items-center gap-2 text-xs">
                      <Clock3
                        aria-hidden="true"
                        className="h-3.5 w-3.5"
                      />
                      Pending requests
                    </dt>
                    <dd className="font-semibold tabular-nums dark:text-[#ece9e3]">
                      {pendingForClass}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-muted-foreground dark:text-[#a19d92] flex items-center gap-2 text-xs">
                      <CalendarClock
                        aria-hidden="true"
                        className="h-3.5 w-3.5"
                      />
                      Attendance sessions
                    </dt>
                    <dd className="font-semibold tabular-nums dark:text-[#ece9e3]">
                      {recordedSessions}
                    </dd>
                  </div>
                </dl>
                <div className="border-border mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 border-t pt-3 dark:border-white/[0.06]">
                  <Link
                    href={`/classes/${selectedClass.slug}/attendance`}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-sm text-xs font-medium hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                      SAGE_LINK,
                    )}
                  >
                    Attendance workspace
                    <ArrowRight
                      aria-hidden="true"
                      className="h-3 w-3"
                    />
                  </Link>
                  <span
                    aria-hidden="true"
                    className="text-border text-xs dark:text-[#4e4e45]"
                  >
                    ·
                  </span>
                  <Link
                    href={`/classes/${selectedClass.slug}/reports`}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-sm text-xs font-medium hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                      SAGE_LINK,
                    )}
                  >
                    Reader reports
                    <ArrowRight
                      aria-hidden="true"
                      className="h-3 w-3"
                    />
                  </Link>
                </div>
              </>
            ) : (
              <p className="text-muted-foreground mt-3 text-sm dark:text-[#a19d92]">
                No managed classes.
              </p>
            )}
          </section>
        </aside>
      </div>

      {center.rows.length > 0 ? (
        <div
          className={cn(
            "mt-6 grid gap-4",
            center.rows.length > 1 && "md:grid-cols-2",
          )}
        >
          {center.rows.map((row) => (
            <ClassActionsCard
              key={row.classId}
              row={row}
            />
          ))}
        </div>
      ) : null}
    </>
  );
}

function AssignmentsTab({
  requests,
  values,
  classes,
  courses,
}: {
  requests: WorkspaceRequest[];
  values: { q?: string; class?: string; course?: string; status?: string };
  classes: { id: string; name: string; code: string | null }[];
  courses: { id: string; name: string; code: string | null }[];
}) {
  const query = (values.q ?? "").trim().toLowerCase();
  const classFilter =
    values.class && values.class !== "all" ? values.class : null;
  const courseFilter =
    values.course && values.course !== "all" ? values.course : null;
  const statusFilter =
    values.status && values.status !== "all" ? values.status : null;

  const filtered = requests.filter((request) => {
    if (classFilter && request.class_id !== classFilter) {
      return false;
    }

    if (courseFilter && request.subject_id !== courseFilter) {
      return false;
    }

    if (statusFilter && request.displayStatus !== statusFilter) {
      return false;
    }

    if (query) {
      const matchesTitle = request.title.toLowerCase().includes(query);
      const matchesStudent = (request.submitter_name ?? "")
        .toLowerCase()
        .includes(query);

      if (!matchesTitle && !matchesStudent) {
        return false;
      }
    }

    return true;
  });

  const pending = filtered.filter((item) => item.displayStatus === "pending");
  const decided = filtered.filter((item) => item.displayStatus !== "pending");

  return (
    <div className="mt-4 space-y-6">
      <form
        action="/actions"
        method="get"
        className={cn(
          "grid grid-cols-1 gap-3 rounded-xl border p-3 sm:grid-cols-2 sm:p-4 lg:grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,1fr))_auto] lg:items-end",
          PANEL,
        )}
      >
        <input
          type="hidden"
          name="tab"
          value="assignments"
        />
        <div className="min-w-0 sm:col-span-2 lg:col-span-1">
          <Label htmlFor="assignment-q" className="dark:text-[#aaa69e]">Search</Label>
          <Input
            id="assignment-q"
            name="aq"
            type="search"
            defaultValue={values.q ?? ""}
            placeholder="Student or title…"
            className="mt-1 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-[#ece9e3] dark:placeholder:text-[#6f6f64] dark:focus-visible:border-[#6f7f52]"
          />
        </div>
        <div className="min-w-0">
          <Label htmlFor="assignment-class" className="dark:text-[#aaa69e]">Class</Label>
          <Select
            id="assignment-class"
            name="aclass"
            defaultValue={values.class ?? "all"}
            className="mt-1 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-[#ece9e3]"
          >
            <option value="all">All classes</option>
            {classes.map((item) => (
              <option
                key={item.id}
                value={item.id}
              >
                {item.code ? `${item.code} · ${item.name}` : item.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="min-w-0">
          <Label htmlFor="assignment-course" className="dark:text-[#aaa69e]">Course</Label>
          <Select
            id="assignment-course"
            name="acourse"
            defaultValue={values.course ?? "all"}
            disabled={courses.length === 0}
            className="mt-1 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-[#ece9e3]"
          >
            <option value="all">All courses</option>
            {courses.map((item) => (
              <option
                key={item.id}
                value={item.id}
              >
                {item.code ? `${item.code} · ${item.name}` : item.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="min-w-0">
          <Label htmlFor="assignment-status" className="dark:text-[#aaa69e]">Status</Label>
          <Select
            id="assignment-status"
            name="astatus"
            defaultValue={values.status ?? "all"}
            className="mt-1 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-[#ece9e3]"
          >
            <option value="all">All statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="revision_requested">Revision Requested</option>
          </Select>
        </div>
        <Button
          type="submit"
          variant="secondary"
          className={cn(
            "h-10 w-full sm:col-span-2 lg:col-span-1 lg:w-auto",
            SECONDARY_BUTTON_DARK,
          )}
        >
          Filter
        </Button>
      </form>

      <section aria-labelledby="assignment-pending">
        <h2
          id="assignment-pending"
          className="text-sm font-semibold dark:text-[#ece9e3]"
        >
          Waiting for review ({pending.length})
        </h2>
        {pending.length === 0 ? (
          <p className="text-muted-foreground mt-2 text-sm dark:text-[#a19d92]">
            No publication requests are waiting for review.
          </p>
        ) : (
          <ul className="mt-3 grid gap-3">
            {pending.map((request) => (
              <RequestCard
                key={request.id}
                request={request}
                mode="admin"
                reviewAction={
                  <ReviewRequestDialog
                    assignmentId={request.id}
                    classSlug={request.class_slug}
                    title={request.title}
                  />
                }
              />
            ))}
          </ul>
        )}
      </section>

      {decided.length > 0 ? (
        <section aria-labelledby="assignment-decided">
          <h2
            id="assignment-decided"
            className="text-sm font-semibold dark:text-[#ece9e3]"
          >
            Recently decided
          </h2>
          <ul className="mt-3 grid gap-3">
            {decided.map((request) => (
              <RequestCard
                key={request.id}
                request={request}
                mode="admin"
              />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

/**
 * Loads the absence detail view. Authorization is double-gated: the managed
 * class list from the workspace scope, plus the class role check. A request
 * outside the managed classes is indistinguishable from one that does not
 * exist.
 */
async function loadAbsenceDetail(
  requestParam: string | undefined,
  userId: string,
  managedClassIds: string[],
) {
  if (!requestParam) {
    return null;
  }

  const parsedId = leaveRequestIdSchema.safeParse(requestParam);

  if (!parsedId.success) {
    notFound();
  }

  const request = await getLeaveRequestById(parsedId.data);

  if (!request || !managedClassIds.includes(request.classId)) {
    notFound();
  }

  const role = await getClassRole(request.classId);

  if (!role?.canManage) {
    notFound();
  }

  const [sessions, evidence, history] = await Promise.all([
    listAffectedSessions(request)
      .then((items) => enrichAffectedSessions(request.classId, items))
      .catch(() => []),
    getEvidenceViews(request.id).catch(() => []),
    listLeaveHistory(request.id).catch(() => []),
  ]);

  return (
    <AbsenceDetail
      request={request}
      sessions={sessions}
      evidence={evidence}
      history={history}
    />
  );
}

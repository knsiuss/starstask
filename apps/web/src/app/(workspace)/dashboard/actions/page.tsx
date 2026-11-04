import {
  ArrowRight,
  CalendarClock,
  ClipboardCheck,
  ClipboardList,
  Clock3,
  FileCheck2,
  FileWarning,
  ListChecks,
  Users,
  Zap,
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
import { RequestCard } from "@/components/assignments/workspace/request-card";
import { ReviewRequestDialog } from "@/components/assignments/workspace/review-request-dialog";
import { Pagination } from "@/components/assignments/pagination";
import { SetupNotice } from "@/components/layout/setup-notice";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
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
      `/dashboard/classes/${slug}/manage?tab=content&status=pending_review#review-queue`,
  },
  {
    key: "pendingLeave",
    label: "Absence requests",
    shortLabel: "Absences",
    icon: ClipboardList,
    path: (slug) => `/dashboard/classes/${slug}/leave-requests`,
  },
  {
    key: "todaysSessions",
    label: "Sessions today",
    shortLabel: "Sessions",
    icon: CalendarClock,
    path: (slug) => `/dashboard/classes/${slug}/sessions`,
  },
  {
    key: "openReports",
    label: "Open reader reports",
    shortLabel: "Reports",
    icon: FileWarning,
    path: (slug) => `/dashboard/classes/${slug}/reports`,
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
  studentId: string;
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
      studentId: request.id.slice(0, 8),
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
      studentId: request.studentId.slice(0, 8),
      type: "Absence Request" as const,
      course:
        request.subjectIds.length === 0
          ? "Whole class"
          : `${request.subjectIds.length} ${request.subjectIds.length === 1 ? "course" : "courses"}`,
      className: request.className,
      date: request.submittedAt ?? request.createdAt,
      statusLabel: LEAVE_STATUS_LABELS[request.status],
      statusVariant: LEAVE_STATUS_VARIANTS[request.status],
      href: `/dashboard/actions?tab=absences&request=${request.id}`,
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
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold">{row.className}</h2>
          <p className="text-muted-foreground mt-0.5 text-xs">
            {row.semester} · {row.academicYear}
          </p>
        </div>
        <span
          className={cn(
            "rounded-full px-2.5 py-0.5 text-[11px] font-medium",
            row.total > 0
              ? "bg-warning-soft text-warning"
              : "bg-muted text-muted-foreground",
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
                className="border-border hover:bg-muted flex items-center gap-3 rounded-md border px-3 py-2.5 transition-colors"
              >
                <Icon
                  aria-hidden="true"
                  className="text-muted-foreground h-4 w-4 shrink-0"
                />
                <span className="text-muted-foreground min-w-0 flex-1 truncate text-sm">
                  {metric.label}
                </span>
                <span
                  className={cn(
                    "shrink-0 text-sm font-semibold tabular-nums",
                    value > 0 ? "text-foreground" : "text-muted-foreground",
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
        href={`/dashboard/classes/${row.classSlug}/manage`}
        className="text-accent hover:text-accent-hover mt-3 inline-flex items-center gap-1 text-sm font-medium underline-offset-4 hover:underline"
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
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <h1 className="text-3xl font-semibold tracking-tight">Action center</h1>
        <div className="mt-6">
          <SetupNotice />
        </div>
      </div>
    );
  }

  const session = await getSessionUser();

  if (!session) {
    redirect(buildLoginPath("/dashboard/actions"));
  }

  const rawParams = await searchParams;
  const tabParam = getParam(rawParams, "tab");
  const tab: ActionTab = (TAB_VALUES as readonly string[]).includes(
    tabParam ?? "",
  )
    ? (tabParam as ActionTab)
    : "overview";

  const center = await getClassActionCenter(session.user.id).catch(() => null);
  const scope = await getWorkspaceScope(session.user.id).catch(() => null);

  const managedClassIds = scope?.managedClassIds ?? [];
  const managedRequests = scope
    ? await listManagedRequests(scope).catch(() => [])
    : [];
  const revisionLeaveCount = await countRevisionLeaveRequests(
    managedClassIds,
  ).catch(() => 0);

  const pendingAssignments = center?.totals.pendingSubmissions ?? 0;
  const pendingAbsences = center?.totals.pendingLeave ?? 0;
  const revisionAssignments = managedRequests.filter(
    (item) => item.displayStatus === "revision_requested",
  ).length;
  const revisionTotal = revisionLeaveCount + revisionAssignments;
  const totalPending = pendingAssignments + pendingAbsences;

  const tabs = [
    {
      href: "/dashboard/actions?tab=overview",
      label: "Overview",
      active: tab === "overview",
    },
    {
      href: "/dashboard/actions?tab=assignments",
      label: `Assignment Requests${pendingAssignments > 0 ? ` (${pendingAssignments})` : ""}`,
      active: tab === "assignments",
    },
    {
      href: "/dashboard/actions?tab=absences",
      label: `Absence Requests${pendingAbsences > 0 ? ` (${pendingAbsences})` : ""}`,
      active: tab === "absences",
    },
    {
      href: "/dashboard/actions?tab=attendance",
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

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pt-5 pb-8 sm:px-6 sm:py-8 lg:px-8">
      <header>
        <p className="text-muted-foreground text-xs font-medium tracking-[0.08em] uppercase">
          Class leader
        </p>
        <h1 className="mt-1 text-[26px] leading-tight font-semibold tracking-tight sm:text-3xl">
          Action center
        </h1>
        <p className="text-muted-foreground mt-1 max-w-2xl text-sm leading-relaxed">
          {center === null
            ? "Everything waiting on you across the classes you lead."
            : buildSummary(center.totals)}{" "}
          Today&apos;s sessions are counted in Asia/Jakarta time.
        </p>
      </header>

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
            action="/dashboard/actions"
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
            basePath="/dashboard/actions"
            page={absences.page}
            totalPages={absences.totalPages}
            params={{ tab: "absences" }}
          />
        </div>
      ) : (
        <AbsenceEmptyState filtered={false} />
      )}
    </div>
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
      value: totalPending,
      icon: ListChecks,
    },
    {
      label: "Assignment Requests",
      value: pendingAssignments,
      icon: ClipboardCheck,
    },
    {
      label: "Absence Requests",
      value: pendingAbsences,
      icon: ClipboardList,
    },
    {
      label: "Requires Revision",
      value: revisionTotal,
      icon: FileWarning,
    },
  ];

  if (center.rows.length === 0) {
    return (
      <div className="border-border bg-subtle mt-5 rounded-xl border border-dashed px-5 py-8 text-center sm:mt-6 sm:px-6 sm:py-10">
        <ListChecks
          aria-hidden="true"
          className="text-muted-foreground mx-auto h-6 w-6"
        />
        <p className="mt-2 text-sm font-medium">No classes to lead yet</p>
        <p className="text-muted-foreground mx-auto mt-1 max-w-sm text-xs leading-relaxed">
          This page collects review queues for class leaders. Once you
          administer an active class, its pending work appears here.
        </p>
        <Link
          href="/classes"
          className="text-accent hover:text-accent-hover mt-4 inline-flex items-center gap-1 text-sm font-medium underline-offset-4 hover:underline"
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
      <dl className="mt-5 grid grid-cols-2 gap-2.5 lg:mt-6 lg:gap-3 lg:grid-cols-4">
        {cards.map((item) => {
          const Icon = item.icon;

          return (
            <Card
              key={item.label}
              className="p-4"
            >
              <dt className="text-muted-foreground flex items-center gap-2 text-xs">
                <Icon
                  aria-hidden="true"
                  className="h-3.5 w-3.5"
                />
                {item.label}
              </dt>
              <dd className="mt-1 text-2xl font-semibold tabular-nums">
                {item.value}
              </dd>
            </Card>
          );
        })}
      </dl>

      <div className="mt-4 grid gap-4 sm:mt-6 lg:grid-cols-3">
        <section
          aria-labelledby="recent-requests"
          className="border-border bg-surface rounded-xl border p-4 sm:p-5 lg:col-span-2"
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2
                id="recent-requests"
                className="flex items-center gap-2 text-sm font-semibold"
              >
                <Clock3
                  aria-hidden="true"
                  className="h-4 w-4"
                />
                Recent requests
              </h2>
              <p className="text-muted-foreground mt-0.5 text-xs">
                Latest requests that need your attention.
              </p>
            </div>
            <Link
              href="/dashboard/actions?tab=assignments"
              className="text-accent hover:text-accent-hover inline-flex items-center gap-1 text-xs font-semibold underline-offset-4 hover:underline"
            >
              View all requests
              <ArrowRight
                aria-hidden="true"
                className="h-3.5 w-3.5"
              />
            </Link>
          </div>

          {recent.length === 0 ? (
            <p className="text-muted-foreground mt-4 text-sm">
              No recent requests. New submissions appear here as they arrive.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-border">
              {recent.map((item) => (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    className="hover:bg-muted -mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors"
                  >
                    <span
                      aria-hidden="true"
                      className="bg-accent-soft text-accent flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
                    >
                      {item.studentName.slice(0, 1).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-baseline gap-x-2">
                        <span className="truncate text-sm font-semibold">
                          {item.studentName}
                        </span>
                        <span className="text-muted-foreground font-mono text-[11px]">
                          {item.studentId}
                        </span>
                      </span>
                      <span className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px]">
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
                      className="text-muted-foreground h-4 w-4 shrink-0"
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
            className="border-border bg-surface rounded-xl border p-4 sm:p-5"
          >
            <h2
              id="your-classes"
              className="flex items-center gap-2 text-sm font-semibold"
            >
              <Users
                aria-hidden="true"
                className="h-4 w-4"
              />
              Your classes
            </h2>
            {selectedClass ? (
              <>
                <form
                  action="/dashboard/actions"
                  method="get"
                  className="mt-3"
                >
                  <input
                    type="hidden"
                    name="tab"
                    value="overview"
                  />
                  <Select
                    id="overview-class"
                    name="class"
                    defaultValue={selectedClass.id}
                    aria-label="Choose class"
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
                  </Select>
                  <button
                    type="submit"
                    className="sr-only"
                  >
                    Show class
                  </button>
                </form>
                <dl className="mt-3 grid gap-2 text-sm">
                  <div className="flex items-center justify-between">
                    <dt className="text-muted-foreground flex items-center gap-2 text-xs">
                      <Users
                        aria-hidden="true"
                        className="h-3.5 w-3.5"
                      />
                      Total students
                    </dt>
                    <dd className="font-semibold tabular-nums">
                      {totalStudents}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-muted-foreground flex items-center gap-2 text-xs">
                      <Clock3
                        aria-hidden="true"
                        className="h-3.5 w-3.5"
                      />
                      Pending requests
                    </dt>
                    <dd className="font-semibold tabular-nums">
                      {pendingForClass}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-muted-foreground flex items-center gap-2 text-xs">
                      <CalendarClock
                        aria-hidden="true"
                        className="h-3.5 w-3.5"
                      />
                      Attendance sessions
                    </dt>
                    <dd className="font-semibold tabular-nums">
                      {recordedSessions}
                    </dd>
                  </div>
                </dl>
              </>
            ) : (
              <p className="text-muted-foreground mt-3 text-sm">
                No managed classes.
              </p>
            )}
          </section>

          <section
            aria-labelledby="quick-actions"
            className="border-border bg-surface rounded-xl border p-4 sm:p-5"
          >
            <h2
              id="quick-actions"
              className="flex items-center gap-2 text-sm font-semibold"
            >
              <Zap
                aria-hidden="true"
                className="h-4 w-4"
              />
              Quick actions
            </h2>
            <ul className="mt-3 grid gap-2">
              <li>
                <Link
                  href="/dashboard/actions?tab=assignments"
                  className="border-border hover:bg-muted flex items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors"
                >
                  <FileCheck2
                    aria-hidden="true"
                    className="text-muted-foreground h-4 w-4 shrink-0"
                  />
                  Review assignment requests
                </Link>
              </li>
              <li>
                <Link
                  href="/dashboard/actions?tab=absences"
                  className="border-border hover:bg-muted flex items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors"
                >
                  <ClipboardList
                    aria-hidden="true"
                    className="text-muted-foreground h-4 w-4 shrink-0"
                  />
                  Review absence requests
                </Link>
              </li>
              <li>
                <Link
                  href={
                    selectedClass
                      ? `/dashboard/classes/${selectedClass.slug}/attendance`
                      : "/dashboard/actions?tab=attendance"
                  }
                  className="border-border hover:bg-muted flex items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors"
                >
                  <CalendarClock
                    aria-hidden="true"
                    className="text-muted-foreground h-4 w-4 shrink-0"
                  />
                  Open attendance management
                </Link>
              </li>
            </ul>
          </section>
        </aside>
      </div>

      {center.totals.actions === 0 ? (
        <div className="border-border bg-subtle mt-6 rounded-xl border border-dashed px-6 py-10 text-center">
          <ListChecks
            aria-hidden="true"
            className="text-muted-foreground mx-auto h-6 w-6"
          />
          <p className="mt-2 text-sm font-medium">All caught up</p>
          <p className="text-muted-foreground mx-auto mt-1 max-w-sm text-xs leading-relaxed">
            No submissions, absence requests, sessions, or reader reports need
            you right now. New work appears here as it arrives.
          </p>
        </div>
      ) : null}

      <div className="mt-6 space-y-4">
        {center.rows.map((row) => (
          <ClassActionsCard
            key={row.classId}
            row={row}
          />
        ))}
      </div>
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
        action="/dashboard/actions"
        method="get"
        className="border-border bg-card grid grid-cols-2 gap-3 rounded-xl border p-3 sm:p-4 lg:grid-cols-4"
      >
        <input
          type="hidden"
          name="tab"
          value="assignments"
        />
        <div className="col-span-2 min-w-0">
          <Label htmlFor="assignment-q">Search</Label>
          <Input
            id="assignment-q"
            name="aq"
            type="search"
            defaultValue={values.q ?? ""}
            placeholder="Student or title…"
            className="mt-1"
          />
        </div>
        <div className="min-w-0">
          <Label htmlFor="assignment-class">Class</Label>
          <Select
            id="assignment-class"
            name="aclass"
            defaultValue={values.class ?? "all"}
            className="mt-1"
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
          <Label htmlFor="assignment-course">Course</Label>
          <Select
            id="assignment-course"
            name="acourse"
            defaultValue={values.course ?? "all"}
            disabled={courses.length === 0}
            className="mt-1"
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
          <Label htmlFor="assignment-status">Status</Label>
          <Select
            id="assignment-status"
            name="astatus"
            defaultValue={values.status ?? "all"}
            className="mt-1"
          >
            <option value="all">All statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="revision_requested">Revision Requested</option>
          </Select>
        </div>
      </form>

      <section aria-labelledby="assignment-pending">
        <h2
          id="assignment-pending"
          className="text-sm font-semibold"
        >
          Waiting for review ({pending.length})
        </h2>
        {pending.length === 0 ? (
          <p className="text-muted-foreground mt-2 text-sm">
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
            className="text-sm font-semibold"
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

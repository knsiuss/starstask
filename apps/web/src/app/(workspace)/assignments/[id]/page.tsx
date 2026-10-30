import {
  ArrowLeft,
  CalendarDays,
  ExternalLink,
  GraduationCap,
  Pencil,
  UserRound,
} from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AttachmentList } from "@/components/assignments/attachment-list";
import { AssignmentHistory } from "@/components/assignments/assignment-history";
import { DeadlineBadge } from "@/components/assignments/deadline-badge";
import { DeleteAssignmentButton } from "@/components/assignments/delete-assignment-button";
import { MyReportStatus } from "@/components/assignments/my-report-status";
import { ReportAssignmentButton } from "@/components/assignments/report-assignment-button";
import { SaveAssignmentButton } from "@/components/assignments/save-assignment-button";
import { SetupNotice } from "@/components/layout/setup-notice";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requireAssignmentPageSession } from "@/lib/auth/assignment-access";
import { getAssignmentDetail } from "@/lib/db/assignments";
import {
  getMyAssignmentReport,
  listAssignmentRevisions,
} from "@/lib/db/assignment-trust";
import { isAssignmentSaved } from "@/lib/db/push";
import { isSupabaseConfigured } from "@/lib/env/public";
import { getAttachmentViews } from "@/lib/storage/signed-urls";
import { assignmentIdSchema, isSafeHttpUrl } from "@starstask/contracts";
import {
  excerpt,
  formatDate,
  formatDeadline,
  getDeadlineState,
} from "@starstask/shared";

export const dynamic = "force-dynamic";

type AssignmentPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string; updated?: string }>;
};

export async function generateMetadata({
  params,
}: Pick<AssignmentPageProps, "params">): Promise<Metadata> {
  const { id } = await params;
  const parsedId = assignmentIdSchema.safeParse(id);

  if (!parsedId.success || !isSupabaseConfigured()) {
    return {
      title: "Assignment not found",
      robots: { index: false, follow: false },
    };
  }

  const session = await requireAssignmentPageSession(`/assignments/${id}`);

  if (!session) {
    return {
      title: "Assignment",
      robots: { index: false, follow: false },
    };
  }

  const assignment = await getAssignmentDetail(parsedId.data);

  if (!assignment) {
    return {
      title: "Assignment not found",
      robots: { index: false, follow: false },
    };
  }

  const description = excerpt(assignment.description, 160);

  return {
    title: assignment.title,
    description,
    alternates: { canonical: `/assignments/${assignment.id}` },
    robots: { index: false, follow: false },
    openGraph: {
      type: "article",
      title: assignment.title,
      description,
      url: `/assignments/${assignment.id}`,
    },
  };
}

export default async function AssignmentPage({
  params,
  searchParams,
}: AssignmentPageProps) {
  const { id } = await params;
  const session = await requireAssignmentPageSession(`/assignments/${id}`);
  const parsedId = assignmentIdSchema.safeParse(id);

  if (!parsedId.success) {
    notFound();
  }

  if (!session) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <SetupNotice />
      </div>
    );
  }

  const [assignment, query] = await Promise.all([
    getAssignmentDetail(parsedId.data),
    searchParams,
  ]);

  if (!assignment) {
    notFound();
  }

  const isOwner = session.user.id === assignment.user_id;
  // Independent lookups run in parallel: sequential awaits here added a full
  // round trip each to the page's time to first byte.
  const [isSaved, attachments, revisions, myReport] = await Promise.all([
    !isOwner
      ? isAssignmentSaved(session.user.id, assignment.id)
      : Promise.resolve(false),
    getAttachmentViews(assignment.attachments),
    // RLS returns an empty list for readers who may not see the history, so the
    // section simply stays hidden instead of leaking whether edits happened.
    listAssignmentRevisions(assignment.id),
    !isOwner
      ? getMyAssignmentReport(assignment.id, session.user.id)
      : Promise.resolve(null),
  ]);
  const deadlineState = getDeadlineState(assignment.deadline);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <Link
        href="/assignments"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm"
      >
        <ArrowLeft
          aria-hidden="true"
          className="h-4 w-4"
        />
        All assignments
      </Link>

      {query.created ? (
        <Alert
          variant="success"
          className="mt-4"
        >
          Assignment published. Signed-in students can now find it in search.
        </Alert>
      ) : null}
      {query.updated ? (
        <Alert
          variant="success"
          className="mt-4"
        >
          Your changes have been saved.
        </Alert>
      ) : null}

      <div className="mt-5 grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <article>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="accent">
              {assignment.course_code
                ? `${assignment.course_code} · ${assignment.course_name}`
                : assignment.course_name}
            </Badge>
            {assignment.assignment_type ? (
              <Badge>{assignment.assignment_type}</Badge>
            ) : null}
            {assignment.status === "pending" ? (
              <Badge variant="warning">Pending review</Badge>
            ) : null}
          </div>

          <h1 className="mt-3 text-3xl leading-tight font-semibold tracking-tight sm:text-4xl">
            {assignment.title}
          </h1>

          <div className="text-muted-foreground mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            <span className="inline-flex items-center gap-1.5">
              <UserRound
                aria-hidden="true"
                className="h-4 w-4"
              />
              {assignment.author_display_name}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays
                aria-hidden="true"
                className="h-4 w-4"
              />
              Added {formatDate(assignment.created_at)}
            </span>
            <DeadlineBadge deadline={assignment.deadline} />
          </div>

          {assignment.tags.length > 0 ? (
            <ul
              className="mt-4 flex flex-wrap gap-2"
              aria-label="Tags"
            >
              {assignment.tags.map((tag) => (
                <li key={tag}>
                  <Link
                    href={`/assignments?tag=${encodeURIComponent(tag)}`}
                    className="bg-muted text-muted-foreground hover:bg-accent-soft hover:text-accent rounded-full px-2.5 py-1 text-xs"
                  >
                    #{tag}
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}

          {isOwner ? (
            <div className="mt-5 flex flex-wrap gap-2">
              <Button
                asChild
                variant="secondary"
                size="sm"
              >
                <Link href={`/my-assignments/${assignment.id}/edit`}>
                  <Pencil
                    aria-hidden="true"
                    className="h-3.5 w-3.5"
                  />
                  Edit assignment
                </Link>
              </Button>
              <DeleteAssignmentButton
                assignmentId={assignment.id}
                title={assignment.title}
                variant="inline"
              />
            </div>
          ) : null}

          {!isOwner && assignment.status === "published" ? (
            <div className="mt-5">
              <SaveAssignmentButton
                assignmentId={assignment.id}
                initialSaved={isSaved}
              />
              <p className="text-muted-foreground mt-2 text-xs">
                Saving adds this deadline to your reminders.{" "}
                <Link
                  href="/settings/notifications"
                  className="text-accent hover:underline"
                >
                  Notification settings
                </Link>
              </p>
              <div className="mt-2 space-y-2">
                {myReport ? <MyReportStatus report={myReport} /> : null}
                <ReportAssignmentButton assignmentId={assignment.id} />
              </div>
            </div>
          ) : null}

          <section
            aria-labelledby="description-heading"
            className="mt-8"
          >
            <h2
              id="description-heading"
              className="text-lg font-semibold"
            >
              Description
            </h2>
            <div className="text-foreground mt-3 text-sm leading-relaxed whitespace-pre-line">
              {assignment.description}
            </div>
          </section>

          {attachments.length > 0 ? (
            <section
              aria-labelledby="attachments-heading"
              className="mt-8"
            >
              <h2
                id="attachments-heading"
                className="text-lg font-semibold"
              >
                Attachments
              </h2>
              <p className="text-muted-foreground mt-1 text-xs">
                Download links expire after 15 minutes. Files are scanned for
                type and size on upload.
              </p>
              <div className="mt-3">
                <AttachmentList attachments={attachments} />
              </div>
            </section>
          ) : null}

          {assignment.reference_urls.length > 0 ? (
            <section
              aria-labelledby="references-heading"
              className="mt-8"
            >
              <h2
                id="references-heading"
                className="text-lg font-semibold"
              >
                References
              </h2>
              <ul className="mt-3 space-y-2">
                {assignment.reference_urls
                  .filter((url) => isSafeHttpUrl(url))
                  .map((url) => (
                    <li key={url}>
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-accent inline-flex items-center gap-1.5 text-sm break-all hover:underline"
                      >
                        <ExternalLink
                          aria-hidden="true"
                          className="h-3.5 w-3.5 shrink-0"
                        />
                        {url}
                      </a>
                    </li>
                  ))}
              </ul>
            </section>
          ) : null}

          {!isOwner ? (
            <Alert className="mt-8">
              <p className="font-medium">Have the brief for this course too?</p>
              <p className="mt-1">
                <Link
                  href="/submit"
                  className="text-accent font-medium hover:underline"
                >
                  Contribute your assignment
                </Link>{" "}
                so the next student does not have to guess.
              </p>
            </Alert>
          ) : null}
        </article>

        <aside className="space-y-4">
          <Card>
            <h2 className="text-sm font-semibold">Details</h2>
            <dl className="mt-3 space-y-3 text-sm">
              <DetailRow
                label="Course"
                value={assignment.course_name}
              />
              {assignment.course_code ? (
                <DetailRow
                  label="Course code"
                  value={assignment.course_code}
                />
              ) : null}
              {assignment.course_department ? (
                <DetailRow
                  label="Department"
                  value={assignment.course_department}
                />
              ) : null}
              {assignment.lecturer_name ? (
                <DetailRow
                  label="Lecturer"
                  value={assignment.lecturer_name}
                />
              ) : null}
              {assignment.semester ? (
                <DetailRow
                  label="Semester"
                  value={assignment.semester}
                />
              ) : null}
              {assignment.academic_year ? (
                <DetailRow
                  label="Academic year"
                  value={assignment.academic_year}
                />
              ) : null}
              {assignment.assignment_type ? (
                <DetailRow
                  label="Type"
                  value={assignment.assignment_type}
                />
              ) : null}
              <div>
                <dt className="text-muted-foreground text-xs tracking-wide uppercase">
                  Deadline
                </dt>
                <dd className="mt-1">
                  {assignment.deadline ? (
                    <span
                      className={
                        deadlineState === "overdue" ? "text-danger" : ""
                      }
                    >
                      {formatDeadline(assignment.deadline)}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">
                      No deadline provided
                    </span>
                  )}
                </dd>
              </div>
            </dl>
          </Card>

          <Card>
            <h2 className="text-sm font-semibold">Contributor</h2>
            <div className="mt-3 flex items-center gap-3">
              {assignment.author_avatar_url ? (
                <Image
                  src={assignment.author_avatar_url}
                  alt=""
                  width={36}
                  height={36}
                  className="h-9 w-9 rounded-full"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span
                  aria-hidden="true"
                  className="bg-accent-soft text-accent flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold"
                >
                  {assignment.author_display_name.charAt(0).toUpperCase()}
                </span>
              )}
              <div>
                <p className="text-sm font-medium">
                  {assignment.author_display_name}
                </p>
                <p className="text-muted-foreground text-xs">
                  Contributed {formatDate(assignment.created_at)}
                </p>
              </div>
            </div>
          </Card>

          <AssignmentHistory revisions={revisions} />

          <Card className="bg-subtle">
            <p className="text-muted-foreground flex items-start gap-2 text-xs leading-relaxed">
              <GraduationCap
                aria-hidden="true"
                className="mt-0.5 h-4 w-4 shrink-0"
              />
              Assignments are contributed by students and may be incomplete or
              outdated. Always confirm requirements with your lecturer.
            </p>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground text-xs tracking-wide uppercase">
        {label}
      </dt>
      <dd className="mt-0.5">{value}</dd>
    </div>
  );
}

import {
  ArrowLeft,
  BookOpen,
  CalendarDays,
  ChevronRight,
  Clock,
  ExternalLink,
  GraduationCap,
  Info,
  Pencil,
  Share2,
  UserRound,
  Users,
} from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AttachmentList } from "@/components/assignments/attachment-list";
import { AssignmentContentTypeBadge } from "@/components/assignments/assignment-content-type-badge";
import { AssignmentHistory } from "@/components/assignments/assignment-history";
import { CopyLinkButton } from "@/components/assignments/copy-link-button";
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
import { getSiteUrl, isSupabaseConfigured } from "@/lib/env/public";
import { buildWhatsAppShareUrl } from "@/lib/share/whatsapp";
import { getAttachmentViews } from "@/lib/storage/signed-urls";
import { cn } from "@/lib/utils/cn";
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
  const publishedAt = assignment.published_at ?? assignment.created_at;
  const hasDescription = assignment.description.trim().length > 0;
  const safeReferences = assignment.reference_urls.filter((url) =>
    isSafeHttpUrl(url),
  );
  const isPublished = assignment.status === "published";
  const isRejected = assignment.status === "rejected";
  const statusLabel = isPublished
    ? "Published"
    : isRejected
      ? "Rejected"
      : assignment.status === "pending"
        ? "Pending approval"
        : "Not published";
  const canonicalUrl = `${getSiteUrl().replace(/\/$/, "")}/assignments/${assignment.id}`;
  const whatsappUrl = buildWhatsAppShareUrl({
    title: assignment.title,
    deadline: assignment.deadline,
    url: canonicalUrl,
  });

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <nav
        aria-label="Breadcrumb"
        className="text-muted-foreground flex min-w-0 items-center gap-1.5 text-sm"
      >
        <Link
          href="/assignments"
          className="hover:text-foreground focus-visible:outline-accent inline-flex shrink-0 items-center gap-1.5 rounded-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          <ArrowLeft
            aria-hidden="true"
            className="h-4 w-4"
          />
          Assignments
        </Link>
        <ChevronRight
          aria-hidden="true"
          className="h-3.5 w-3.5 shrink-0 opacity-60"
        />
        <span
          aria-current="page"
          className="text-foreground truncate font-medium"
        >
          {assignment.title}
        </span>
      </nav>

      {query.created ? (
        <Alert
          variant="success"
          className="mt-4"
        >
          {isPublished
            ? "Published. The brief is already in the public archive."
            : "Submitted for review. A platform admin checks new requests before they appear in the public archive."}
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
      {isOwner && isRejected && assignment.rejection_reason ? (
        <Alert
          variant="error"
          className="mt-4"
        >
          <p className="font-medium">Your request needs changes</p>
          <p className="mt-1">{assignment.rejection_reason}</p>
          <p className="mt-2 text-xs">
            Edit the assignment and save it to send it back for review.
          </p>
        </Alert>
      ) : null}

      <header className="mt-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant="accent"
            className="gap-1.5"
          >
            <BookOpen
              aria-hidden="true"
              className="h-3 w-3"
            />
            {assignment.course_code
              ? `${assignment.course_code} · ${assignment.course_name}`
              : assignment.course_name}
          </Badge>
          <AssignmentContentTypeBadge
            contentType={assignment.content_type}
            sourceLabel={assignment.source_label}
          />
          {assignment.assignment_type ? (
            <Badge>{assignment.assignment_type}</Badge>
          ) : null}
          {assignment.status === "pending" ? (
            <Badge variant="warning">Pending approval</Badge>
          ) : null}
          {isRejected ? <Badge variant="danger">Rejected</Badge> : null}
        </div>

        <h1 className="mt-3 text-2xl leading-tight font-semibold tracking-tight text-balance sm:text-3xl">
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
            {isPublished ? "Published" : "Submitted"}{" "}
            {formatDate(isPublished ? publishedAt : assignment.created_at)}
          </span>
          {assignment.deadline ? (
            <span
              className={cn(
                "inline-flex items-center gap-1.5 font-medium",
                deadlineState === "overdue" && "text-danger",
              )}
            >
              <Clock
                aria-hidden="true"
                className="h-4 w-4"
              />
              Due {formatDeadline(assignment.deadline)}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5">
              <Clock
                aria-hidden="true"
                className="h-4 w-4"
              />
              No deadline
            </span>
          )}
        </div>

        {isOwner ? (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button
              asChild
              variant="secondary"
              size="sm"
            >
              <Link href={`/assignments/${assignment.id}/edit`}>
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

        {!isOwner && isPublished ? (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <SaveAssignmentButton
              assignmentId={assignment.id}
              initialSaved={isSaved}
            />
            <ReportAssignmentButton assignmentId={assignment.id} />
          </div>
        ) : null}

        {!isOwner && myReport ? (
          <div className="mt-2">
            <MyReportStatus report={myReport} />
          </div>
        ) : null}

        {assignment.tags.length > 0 ? (
          <ul
            className="mt-3 flex flex-wrap gap-2"
            aria-label="Tags"
          >
            {assignment.tags.map((tag) => (
              <li key={tag}>
                <Link
                  href={`/assignments?tag=${encodeURIComponent(tag)}`}
                  className="bg-muted text-muted-foreground hover:bg-accent-soft hover:text-accent rounded-full px-2.5 py-1 text-xs transition-colors"
                >
                  #{tag}
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </header>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-8">
        <div className="min-w-0">
          <article className="border-border bg-surface rounded-lg border shadow-[0_1px_2px_rgba(9,9,11,0.04)]">
            <section
              aria-labelledby="description-heading"
              className="p-5 sm:p-6"
            >
              <h2
                id="description-heading"
                className="text-base font-semibold"
              >
                Description
              </h2>
              {hasDescription ? (
                <div className="text-foreground mt-2 text-sm leading-relaxed whitespace-pre-line">
                  {assignment.description}
                </div>
              ) : (
                <p className="text-muted-foreground mt-2 text-sm italic">
                  No description has been added for this assignment yet.
                </p>
              )}
            </section>

            {attachments.length > 0 || isOwner ? (
              <section
                aria-labelledby="attachments-heading"
                className="border-border border-t p-5 sm:p-6"
              >
                <h2
                  id="attachments-heading"
                  className="text-base font-semibold"
                >
                  Attachments
                  {attachments.length > 0 ? ` (${attachments.length})` : ""}
                </h2>
                <p className="text-muted-foreground mt-1 text-xs">
                  Images and PDFs preview here. Download links expire after 15
                  minutes; files are checked for type and size on upload.
                </p>
                <div className="mt-3">
                  <AttachmentList
                    attachments={attachments}
                    assignmentId={assignment.id}
                    canManage={isOwner}
                  />
                </div>
              </section>
            ) : null}

            {assignment.drive_url ? (
              <section
                aria-labelledby="drive-heading"
                className="border-border border-t p-5 sm:p-6"
              >
                <h2
                  id="drive-heading"
                  className="text-base font-semibold"
                >
                  Materials on Google Drive
                </h2>
                <p className="text-muted-foreground mt-1 text-xs">
                  Opens in a new tab. Access depends on the sharing settings the
                  class admin set in Drive.
                </p>
                <a
                  href={assignment.drive_url}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="border-border bg-surface hover:bg-muted focus-visible:outline-accent mt-3 inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
                >
                  <ExternalLink
                    aria-hidden="true"
                    className="h-4 w-4"
                  />
                  Open Drive link
                </a>
              </section>
            ) : null}

            {safeReferences.length > 0 ? (
              <section
                aria-labelledby="references-heading"
                className="border-border border-t p-5 sm:p-6"
              >
                <h2
                  id="references-heading"
                  className="text-base font-semibold"
                >
                  References
                </h2>
                <ul className="mt-3 space-y-2">
                  {safeReferences.map((url) => (
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
          </article>

          {!isOwner ? (
            <div className="border-border bg-subtle mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  Have additional assignment materials?
                </p>
                <p className="text-muted-foreground text-xs">
                  Help your classmates by contributing useful information.
                </p>
              </div>
              <Button
                asChild
                variant="secondary"
                size="sm"
                className="shrink-0"
              >
                <Link href="/submit">Contribute</Link>
              </Button>
            </div>
          ) : null}
        </div>

        <aside className="space-y-4">
          <Card className="p-4">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <Info
                aria-hidden="true"
                className="text-muted-foreground h-4 w-4"
              />
              Assignment information
            </h2>
            <dl className="mt-3 space-y-2.5 text-sm">
              <InfoRow
                label="Course"
                value={assignment.course_name}
              />
              {assignment.course_code ? (
                <InfoRow
                  label="Course code"
                  value={assignment.course_code}
                />
              ) : null}
              {assignment.course_department ? (
                <InfoRow
                  label="Department"
                  value={assignment.course_department}
                />
              ) : null}
              {assignment.semester ? (
                <InfoRow
                  label="Semester"
                  value={assignment.semester}
                />
              ) : null}
              {assignment.lecturer_name ? (
                <InfoRow
                  label="Lecturer"
                  value={assignment.lecturer_name}
                />
              ) : null}
              {assignment.academic_year ? (
                <InfoRow
                  label="Academic year"
                  value={assignment.academic_year}
                />
              ) : null}
              {assignment.assignment_type ? (
                <InfoRow
                  label="Type"
                  value={assignment.assignment_type}
                />
              ) : null}
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">Status</dt>
                <dd>
                  <Badge
                    variant={
                      isPublished
                        ? "success"
                        : isRejected
                          ? "danger"
                          : "warning"
                    }
                  >
                    {statusLabel}
                  </Badge>
                </dd>
              </div>
            </dl>
          </Card>

          <Card className="p-4">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <Users
                aria-hidden="true"
                className="text-muted-foreground h-4 w-4"
              />
              Contributor
            </h2>
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
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {assignment.author_display_name}
                </p>
                <p className="text-muted-foreground text-xs">
                  Contributed {formatDate(assignment.created_at)}
                </p>
              </div>
            </div>
          </Card>

          {isPublished ? (
            <Card className="p-4">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <Share2
                  aria-hidden="true"
                  className="text-muted-foreground h-4 w-4"
                />
                Share assignment
              </h2>
              <p className="text-muted-foreground mt-1 text-xs">
                Share this assignment with your class.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <CopyLinkButton url={canonicalUrl} />
                <Button
                  asChild
                  variant="secondary"
                  size="sm"
                >
                  <a
                    href={whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <WhatsAppIcon className="h-3.5 w-3.5 text-[#25D366]" />
                    Share on WhatsApp
                  </a>
                </Button>
              </div>
            </Card>
          ) : null}

          <AssignmentHistory revisions={revisions} />

          <p className="text-muted-foreground flex items-start gap-2 px-1 text-xs leading-relaxed">
            <GraduationCap
              aria-hidden="true"
              className="mt-0.5 h-4 w-4 shrink-0"
            />
            Assignments are contributed by students and may be incomplete or
            outdated. Always confirm requirements with your lecturer.
          </p>
        </aside>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-muted-foreground shrink-0">{label}</dt>
      <dd className="text-right font-medium break-words">{value}</dd>
    </div>
  );
}

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413" />
    </svg>
  );
}

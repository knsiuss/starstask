import { ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AttachmentList } from "@/components/assignments/attachment-list";
import { AssignmentDetailExtras } from "@/components/assignments/detail/assignment-detail-extras";
import { AssignmentDetailHeader } from "@/components/assignments/detail/assignment-detail-header";
import { AssignmentDetailSidebar } from "@/components/assignments/detail/assignment-detail-sidebar";
import { SetupNotice } from "@/components/layout/setup-notice";
import { requireAssignmentPageSession } from "@/lib/auth/assignment-access";
import { getAssignmentDetail } from "@/lib/db/assignments";
import { getClassRole } from "@/lib/db/classes";
import { getMemberCourseAccess } from "@/lib/db/course-access";
import {
  getMyAssignmentReport,
  listAssignmentRevisions,
} from "@/lib/db/assignment-trust";
import { isAssignmentSaved } from "@/lib/db/push";
import { getSiteUrl, isSupabaseConfigured } from "@/lib/env/public";
import { buildWhatsAppShareUrl } from "@/lib/share/whatsapp";
import { getAttachmentViews } from "@/lib/storage/signed-urls";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { assignmentIdSchema, isSafeHttpUrl } from "@starstask/contracts";
import { excerpt } from "@starstask/shared";

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
      <div className="mx-auto max-w-4xl px-4 py-12 pb-24 sm:px-6 sm:pb-12">
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

  if (assignment.class_id) {
    const role = await getClassRole(assignment.class_id);

    if (!role.canManage) {
      if (!role.isMember) {
        notFound();
      }

      const supabase = await createSupabaseServerClient();
      const [access, subjectRow] = await Promise.all([
        getMemberCourseAccess(assignment.class_id, session.user.id),
        supabase
          .from("assignments")
          .select("subject_id")
          .eq("id", assignment.id)
          .maybeSingle(),
      ]);

      if (
        access.scope === "selected" &&
        (!subjectRow.data?.subject_id ||
          !access.allowedSubjectIds.has(subjectRow.data.subject_id))
      ) {
        notFound();
      }
    }
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

  const hasDescription = assignment.description.trim().length > 0;
  const safeReferences = assignment.reference_urls.filter((url) =>
    isSafeHttpUrl(url),
  );
  const isPublished = assignment.status === "published";
  const canonicalUrl = `${getSiteUrl().replace(/\/$/, "")}/assignments/${assignment.id}`;
  const whatsappUrl = buildWhatsAppShareUrl({
    title: assignment.title,
    deadline: assignment.deadline,
    url: canonicalUrl,
  });

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pt-5 pb-24 sm:px-6 sm:pt-8 sm:pb-12 lg:pb-14">
      <AssignmentDetailHeader
        assignment={assignment}
        isOwner={isOwner}
        isSaved={isSaved}
        myReport={myReport}
        query={query}
      />

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_21rem] lg:gap-8">
        <div className="min-w-0 space-y-4">
          <article className="border-border bg-surface divide-border divide-y rounded-xl border">
            <section
              aria-labelledby="description-heading"
              className="p-5 sm:p-6"
            >
              <h2
                id="description-heading"
                className="text-foreground text-base font-semibold"
              >
                Description
              </h2>
              {hasDescription ? (
                <div className="text-foreground mt-2.5 text-[15px] leading-relaxed break-words whitespace-pre-line sm:text-sm">
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
                className="p-5 sm:p-6"
              >
                <h2
                  id="attachments-heading"
                  className="text-foreground text-base font-semibold"
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

            {assignment.drive_url && isSafeHttpUrl(assignment.drive_url) ? (
              <section
                aria-labelledby="drive-heading"
                className="p-5 sm:p-6"
              >
                <h2
                  id="drive-heading"
                  className="text-foreground text-base font-semibold"
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
                  className="border-border bg-surface hover:bg-muted focus-visible:outline-accent mt-3 inline-flex min-h-[44px] items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 sm:min-h-9 sm:px-3 sm:py-1.5"
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
                className="p-5 sm:p-6"
              >
                <h2
                  id="references-heading"
                  className="text-foreground text-base font-semibold"
                >
                  References
                </h2>
                <ul className="mt-3 space-y-1.5">
                  {safeReferences.map((url) => (
                    <li key={url}>
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-accent focus-visible:outline-accent inline-flex min-h-[44px] items-center gap-1.5 rounded-sm py-1 text-sm break-all hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 sm:min-h-0 sm:py-0.5"
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

          <AssignmentDetailExtras
            assignmentId={assignment.id}
            isOwner={isOwner}
            isPublished={isPublished}
            driveClientId={
              process.env.NEXT_PUBLIC_GOOGLE_DRIVE_CLIENT_ID?.trim() ?? ""
            }
          />
        </div>

        <AssignmentDetailSidebar
          assignment={assignment}
          revisions={revisions}
          canonicalUrl={canonicalUrl}
          whatsappUrl={whatsappUrl}
        />
      </div>
    </div>
  );
}

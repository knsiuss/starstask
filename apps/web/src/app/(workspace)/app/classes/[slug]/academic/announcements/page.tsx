import { ArrowLeft, Megaphone, Pin } from "lucide-react";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AnnouncementActions } from "@/components/academic/announcement-actions";
import { AnnouncementForm } from "@/components/academic/announcement-form";
import { MarkReadButton } from "@/components/academic/mark-read-button";
import { ClassUnlinkedNotice } from "@/components/academic/unlinked-notice";
import { SetupNotice } from "@/components/layout/setup-notice";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  hasClassPermission,
  resolveClassMemberForPage,
} from "@/lib/authz/class-permission";
import { requireServiceRoleClient } from "@/lib/authz/service-role";
import {
  listAllAnnouncements,
  listPublishedAnnouncements,
} from "@/lib/db/announcements";
import { listOfferingsForClass } from "@/lib/db/course-offerings";
import { isSupabaseConfigured } from "@/lib/env/public";

export const metadata: Metadata = {
  title: "Class announcements",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type AnnouncementsPageProps = {
  params: Promise<{ slug: string }>;
};

export default async function AcademicAnnouncementsPage({
  params,
}: AnnouncementsPageProps) {
  if (!isSupabaseConfigured()) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <SetupNotice />
      </div>
    );
  }

  const { slug } = await params;
  const access = await resolveClassMemberForPage(slug);

  if (!access.ok) {
    if (access.reason === "unlinked") {
      return (
        <Shell slug={slug}>
          <ClassUnlinkedNotice />
        </Shell>
      );
    }

    notFound();
  }

  const { classRow, session, via } = access;
  const universityId = classRow.universityId;

  if (!universityId) {
    return (
      <Shell slug={classRow.slug}>
        <ClassUnlinkedNotice />
      </Shell>
    );
  }

  const canManage =
    via === "platform_admin" ||
    (await hasClassPermission(classRow.id, "manage_announcements"));

  const offerings = await listOfferingsForClass(classRow.id);

  if (canManage) {
    const service = requireServiceRoleClient();
    const all = await listAllAnnouncements(service, classRow.id);

    return (
      <Shell
        slug={classRow.slug}
        backHref={`/app/classes/${classRow.slug}/academic`}
      >
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Post announcement</CardTitle>
            <CardDescription>
              Formal, class-scoped. Drafts stay invisible to members until you
              publish them.
            </CardDescription>
          </CardHeader>
          <div className="px-6 pb-6">
            <AnnouncementForm
              classSlug={classRow.slug}
              offerings={offerings.map((offering) => ({
                id: offering.id,
                courseName: offering.courseCode
                  ? `${offering.courseCode} · ${offering.courseName}`
                  : offering.courseName,
              }))}
            />
          </div>
        </Card>

        <div className="mt-6 space-y-4">
          {all.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No announcements yet.
            </p>
          ) : (
            all.map((announcement) => (
              <article
                key={announcement.id}
                className="border-border bg-card rounded-2xl border p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="font-semibold">
                      {announcement.pinned ? (
                        <Pin
                          aria-hidden="true"
                          className="text-accent mr-1 inline h-4 w-4"
                        />
                      ) : null}
                      {announcement.title}
                    </h2>
                    <p className="text-muted-foreground mt-0.5 text-xs">
                      {new Date(
                        announcement.publishedAt ?? announcement.createdAt,
                      ).toLocaleString()}
                      {" · "}
                      {announcement.publishedAt ? "published" : "draft"}
                      {announcement.archivedAt ? " · archived" : ""}
                    </p>
                  </div>
                  <AnnouncementActions
                    classSlug={classRow.slug}
                    announcementId={announcement.id}
                    pinned={announcement.pinned}
                    isDraft={!announcement.publishedAt}
                    isArchived={Boolean(announcement.archivedAt)}
                  />
                </div>
                <p className="mt-3 text-sm whitespace-pre-line">
                  {announcement.body}
                </p>
              </article>
            ))
          )}
        </div>
      </Shell>
    );
  }

  const published = await listPublishedAnnouncements(
    classRow.id,
    session.user.id,
  );

  return (
    <Shell
      slug={classRow.slug}
      backHref={`/app/classes/${classRow.slug}`}
    >
      <div className="mt-6 space-y-4">
        {published.length === 0 ? (
          <p className="text-muted-foreground text-sm">No announcements yet.</p>
        ) : (
          published.map((announcement) => (
            <article
              key={announcement.id}
              className="border-border bg-card rounded-2xl border p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="font-semibold">
                    {announcement.pinned ? (
                      <Pin
                        aria-hidden="true"
                        className="text-accent mr-1 inline h-4 w-4"
                      />
                    ) : null}
                    {announcement.title}
                  </h2>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    {announcement.publishedAt
                      ? new Date(announcement.publishedAt).toLocaleString()
                      : ""}
                  </p>
                </div>
                <MarkReadButton
                  classSlug={classRow.slug}
                  announcementId={announcement.id}
                  read={Boolean(announcement.readAt)}
                />
              </div>
              <p className="mt-3 text-sm whitespace-pre-line">
                {announcement.body}
              </p>
            </article>
          ))
        )}
      </div>
    </Shell>
  );
}

function Shell({
  slug,
  backHref,
  children,
}: {
  slug: string;
  backHref?: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <Link
        href={backHref ?? `/app/classes/${slug}/academic`}
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm"
      >
        <ArrowLeft
          aria-hidden="true"
          className="h-4 w-4"
        />
        Academic administration
      </Link>
      <header className="mt-4 flex items-center gap-3">
        <Megaphone
          aria-hidden="true"
          className="text-accent h-6 w-6"
        />
        <h1 className="text-2xl font-semibold tracking-tight">Announcements</h1>
      </header>
      {children}
    </div>
  );
}

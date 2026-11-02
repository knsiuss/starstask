import { ArrowLeft, Layers } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import * as React from "react";

import {
  ManageClassTabs,
  isManageTab,
  type ManageTab,
} from "@/components/classes/manage-class-tabs";
import {
  ManageContentTab,
  isContentStatus,
  type ContentStatus,
} from "@/components/classes/manage-content-tab";
import { ManageCoursesTab } from "@/components/classes/manage-courses-tab";
import { ManageInvitesTab } from "@/components/classes/manage-invites-tab";
import { ManageMembersTab } from "@/components/classes/manage-members-tab";
import { ManageOverviewTab } from "@/components/classes/manage-overview-tab";
import { ManageSettingsTab } from "@/components/classes/manage-settings-tab";
import { StatusBadge } from "@/components/classes/status-badge";
import { SetupNotice } from "@/components/layout/setup-notice";
import { Alert } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { getSessionUser } from "@/lib/auth/session";
import {
  getClassBySlug,
  getClassRole,
  isPlatformAdmin,
} from "@/lib/db/classes";
import { isSupabaseConfigured } from "@/lib/env/public";
import { buildLoginPath } from "@/lib/security/redirect";
import { flattenSearchParams } from "@/lib/utils/search-params";

export const metadata: Metadata = {
  title: "Manage class",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const SEARCH_MAX_LENGTH = 80;

type ManageClassProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

type ResolvedSearch = {
  activeTab: ManageTab;
  contentStatus: ContentStatus;
  search: string;
  page: number;
  reviewed: string | undefined;
};

function parseSearch(flat: Record<string, string | undefined>): ResolvedSearch {
  const parsedPage = Number.parseInt(flat.page ?? "1", 10);

  return {
    activeTab: isManageTab(flat.tab) ? flat.tab : "overview",
    contentStatus: isContentStatus(flat.status) ? flat.status : "published",
    search: (flat.q ?? "").trim().slice(0, SEARCH_MAX_LENGTH),
    page: Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1,
    reviewed: flat.reviewed,
  };
}

export default async function ManageClassPage({
  params,
  searchParams,
}: ManageClassProps) {
  if (!isSupabaseConfigured()) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <SetupNotice />
      </div>
    );
  }

  const session = await getSessionUser();

  if (!session) {
    redirect(buildLoginPath("/dashboard"));
  }

  const { slug } = await params;
  const found = await getClassBySlug(slug);

  if (!found) {
    notFound();
  }

  const [role, platformAdmin] = await Promise.all([
    getClassRole(found.id),
    isPlatformAdmin(),
  ]);

  if (!role.canManage) {
    notFound();
  }

  const flat = flattenSearchParams(await searchParams);

  if (flat.tab && !isManageTab(flat.tab)) {
    redirect(`/dashboard/classes/${found.slug}/manage`);
  }

  const { activeTab, contentStatus, search, page, reviewed } =
    parseSearch(flat);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <Link
        href={`/dashboard/classes/${found.slug}`}
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm"
      >
        <ArrowLeft
          aria-hidden="true"
          className="h-4 w-4"
        />
        Back to class
      </Link>

      {reviewed ? (
        <Alert
          variant={reviewed === "approved" ? "success" : "info"}
          className="mt-4"
        >
          {reviewed === "approved"
            ? "Submission approved and published publicly."
            : "Submission rejected. The submitter can revise and resubmit."}
        </Alert>
      ) : null}

      <header className="mt-4 flex items-start gap-4">
        <span className="border-border bg-accent-soft text-accent flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border">
          {found.avatar_url ? (
            <Image
              src={found.avatar_url}
              alt=""
              width={64}
              height={64}
              unoptimized
              className="h-16 w-16 object-cover"
            />
          ) : (
            <Layers
              aria-hidden="true"
              className="h-7 w-7"
            />
          )}
        </span>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-3xl font-semibold tracking-tight">
              Manage Class
            </h1>
            <StatusBadge status={found.status} />
          </div>
          <p className="text-muted-foreground mt-1 text-sm">
            <span className="text-foreground font-medium">{found.name}</span>
            {found.class_code ? (
              <>
                <span
                  aria-hidden="true"
                  className="mx-1.5"
                >
                  ·
                </span>
                {found.class_code}
              </>
            ) : null}
            <span
              aria-hidden="true"
              className="mx-1.5"
            >
              ·
            </span>
            Semester {found.semester}
            <span
              aria-hidden="true"
              className="mx-1.5"
            >
              ·
            </span>
            {found.academic_year}
          </p>
        </div>
      </header>

      <ManageClassTabs
        slug={found.slug}
        activeTab={activeTab}
      />

      <React.Suspense
        key={activeTab}
        fallback={<ManageTabSkeleton />}
      >
        {activeTab === "overview" ? (
          <ManageOverviewTab
            classId={found.id}
            classSlug={found.slug}
            className={found.name}
            avatarUrl={found.avatar_url}
            coverUrl={found.cover_url}
          />
        ) : null}

        {activeTab === "courses" ? (
          <ManageCoursesTab
            classId={found.id}
            classSlug={found.slug}
          />
        ) : null}

        {activeTab === "members" ? (
          <ManageMembersTab
            classId={found.id}
            classSlug={found.slug}
            currentUserId={session.user.id}
            canManageAdmins={platformAdmin}
          />
        ) : null}

        {activeTab === "invites" ? (
          <ManageInvitesTab
            classId={found.id}
            classSlug={found.slug}
          />
        ) : null}

        {activeTab === "content" ? (
          <ManageContentTab
            classId={found.id}
            classSlug={found.slug}
            status={contentStatus}
            search={search}
            page={page}
          />
        ) : null}

        {activeTab === "settings" ? (
          <ManageSettingsTab
            classSummary={found}
            platformAdmin={platformAdmin}
          />
        ) : null}
      </React.Suspense>
    </div>
  );
}

function ManageTabSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="mt-6 space-y-6"
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton
            key={index}
            className="h-[76px] w-full rounded-2xl"
          />
        ))}
      </div>
      <Skeleton className="h-72 w-full rounded-2xl" />
    </div>
  );
}

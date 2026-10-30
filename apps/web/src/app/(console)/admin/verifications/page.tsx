import type { Metadata } from "next";
import Link from "next/link";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { VerificationFilters } from "@/components/admin/verification-filters";
import { VerificationQueueList } from "@/components/admin/verification-queue-list";
import { Pagination } from "@/components/assignments/pagination";
import { SetupNotice } from "@/components/layout/setup-notice";
import { Alert } from "@/components/ui/alert";
import { requirePlatformAdmin } from "@/lib/auth/admin";
import { listAllClasses } from "@/lib/db/classes";
import { listVerificationQueue } from "@/lib/db/verification";
import { isSupabaseConfigured } from "@/lib/env/public";
import { flattenSearchParams } from "@/lib/utils/search-params";
import { verificationQueueQuerySchema } from "@starstask/contracts";

export const metadata: Metadata = {
  title: "Class representative verification",
  description:
    "Review submitted class representative requests and their evidence.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type AdminVerificationsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminVerificationsPage({
  searchParams,
}: AdminVerificationsPageProps) {
  if (!isSupabaseConfigured()) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
        <h1 className="text-3xl font-semibold tracking-tight">
          Class representative verification
        </h1>
        <div className="mt-6">
          <SetupNotice />
        </div>
      </div>
    );
  }

  await requirePlatformAdmin("/admin/verifications");

  const raw = await searchParams;
  const parsed = verificationQueueQuerySchema.safeParse(
    flattenSearchParams(raw),
  );

  if (!parsed.success) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <Alert variant="error">
          <p className="font-medium">Those filters are not valid.</p>
          <p className="mt-1">
            <Link
              href="/admin/verifications"
              className="underline"
            >
              Reset the queue
            </Link>{" "}
            and try again.
          </p>
        </Alert>
      </div>
    );
  }

  const query = parsed.data;

  const [queue, classes] = await Promise.all([
    listVerificationQueue({
      search: query.search,
      status: query.status,
      classId: query.class,
      semester: query.semester,
      page: query.page,
      pageSize: query.pageSize,
    }),
    listAllClasses(),
  ]);

  const semesters = [...new Set(classes.map((item) => item.semester))].sort(
    (left, right) => left.localeCompare(right),
  );

  const hasActiveFilters =
    Boolean(query.search) ||
    query.status !== "pending" ||
    Boolean(query.class) ||
    Boolean(query.semester);

  return (
    <div>
      <AdminPageHeader
        title="Class representative verification"
        description="Review the evidence a student submitted for one class. Approval grants class admin access for that class only; a profile position never does."
      />

      <div className="mt-6">
        <VerificationFilters
          values={{
            search: query.search,
            status: query.status,
            classId: query.class,
            semester: query.semester,
          }}
          classes={classes.map((item) => ({ id: item.id, name: item.name }))}
          semesters={semesters}
        />
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <h2 className="text-lg font-semibold tracking-tight">Review queue</h2>
          <span className="bg-muted text-muted-foreground rounded-full px-2.5 py-0.5 text-xs font-medium">
            {queue.total} {queue.total === 1 ? "request" : "requests"}
          </span>
        </div>
        {hasActiveFilters ? (
          <Link
            href="/admin/verifications"
            className="text-muted-foreground hover:text-foreground text-sm underline-offset-4 hover:underline"
          >
            Reset filters
          </Link>
        ) : null}
      </div>

      <div className="mt-4">
        <VerificationQueueList
          items={queue.items}
          filtered={hasActiveFilters}
        />
      </div>

      <Pagination
        basePath="/admin/verifications"
        page={queue.page}
        totalPages={queue.totalPages}
        params={{
          search: query.search,
          status: query.status === "pending" ? undefined : query.status,
          class: query.class,
          semester: query.semester,
          pageSize: String(query.pageSize),
        }}
      />
    </div>
  );
}

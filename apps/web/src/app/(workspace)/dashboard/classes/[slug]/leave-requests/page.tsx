import { ArrowLeft, Download, History, Send, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Pagination } from "@/components/assignments/pagination";
import { LeaveFilters } from "@/components/leave/leave-filters";
import { LeaveRequestList } from "@/components/leave/leave-request-list";
import { SetupNotice } from "@/components/layout/setup-notice";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getSessionUser } from "@/lib/auth/session";
import { getClassBySlug, getClassRole } from "@/lib/db/classes";
import { listLeaveRequestsForClass } from "@/lib/db/leave";
import { isSupabaseConfigured } from "@/lib/env/public";
import { buildLoginPath } from "@/lib/security/redirect";
import { flattenSearchParams } from "@/lib/utils/search-params";
import { leaveRequestListQuerySchema } from "@starstask/contracts";

export const metadata: Metadata = {
  title: "Absence requests",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type ClassLeaveRequestsPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ClassLeaveRequestsPage({
  params,
  searchParams,
}: ClassLeaveRequestsPageProps) {
  if (!isSupabaseConfigured()) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <SetupNotice />
      </div>
    );
  }

  const session = await getSessionUser();
  const { slug } = await params;

  if (!session) {
    redirect(buildLoginPath(`/dashboard/classes/${slug}/leave-requests`));
  }

  const found = await getClassBySlug(slug);

  if (!found) {
    notFound();
  }

  const role = await getClassRole(found.id);

  if (!role.canManage) {
    notFound();
  }

  const flat = flattenSearchParams(await searchParams);
  const parsed = leaveRequestListQuerySchema.safeParse(flat);

  if (!parsed.success) {
    return (
      <div className="mx-auto w-full max-w-5xl px-5 py-8 sm:px-8 lg:px-10">
        <Alert variant="error">
          <p className="font-medium">Those filters are not valid.</p>
          <p className="mt-1">
            <Link
              href={`/dashboard/classes/${found.slug}/leave-requests`}
              className="underline"
            >
              Reset the filters
            </Link>{" "}
            and try again.
          </p>
        </Alert>
      </div>
    );
  }

  const query = parsed.data;

  const result = await listLeaveRequestsForClass(found.id, {
    status: query.status ?? "all",
    from: query.from,
    to: query.to,
    search: query.q,
    page: query.page,
    pageSize: query.pageSize,
  });

  const hasActiveFilters =
    (query.status !== undefined && query.status !== "all") ||
    Boolean(query.from) ||
    Boolean(query.to) ||
    Boolean(query.q);

  // Export links carry the same period the queue is filtered by, so what an
  // admin sees on screen is what lands in the file.
  const exportHref = (format: "csv" | "summary" | "complete" | "zip") => {
    const search = new URLSearchParams({ format });

    if (query.from) {
      search.set("from", query.from);
    }

    if (query.to) {
      search.set("to", query.to);
    }

    return `/api/classes/${found.slug}/leave-requests/export?${search.toString()}`;
  };

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-8 sm:px-8 lg:px-10">
      <Link
        href={`/dashboard/classes/${found.slug}`}
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm"
      >
        <ArrowLeft
          aria-hidden="true"
          className="h-4 w-4"
        />
        {found.name}
      </Link>

      <header className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-3xl font-semibold tracking-tight sm:text-[2rem]">
              Absence requests
            </h1>
            <span className="bg-accent-soft text-accent inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium">
              <ShieldCheck
                aria-hidden="true"
                className="h-3 w-3"
              />
              Class admin
            </span>
          </div>
          <p className="text-muted-foreground mt-1.5 max-w-2xl text-sm">
            Check that a request is complete and legible, then put it in a
            package for the lecturer. You are not approving the absence — the
            lecturer decides.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            asChild
            variant="secondary"
          >
            <Link
              href={`/dashboard/classes/${found.slug}/leave-requests/history`}
            >
              <History
                aria-hidden="true"
                className="h-4 w-4"
              />
              History
            </Link>
          </Button>
          <Button asChild>
            <Link
              href={`/dashboard/classes/${found.slug}/leave-requests/forward`}
            >
              <Send
                aria-hidden="true"
                className="h-4 w-4"
              />
              Forward to lecturer
            </Link>
          </Button>
        </div>
      </header>

      <div className="mt-6">
        <LeaveFilters
          action={`/dashboard/classes/${found.slug}/leave-requests`}
          values={{
            status: query.status,
            from: query.from,
            to: query.to,
            q: query.q,
          }}
          showSearch
        />
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <h2 className="text-lg font-semibold tracking-tight">
            Requests for this class
          </h2>
          <span className="bg-muted text-muted-foreground rounded-full px-2.5 py-0.5 text-xs font-medium">
            {result.total} {result.total === 1 ? "request" : "requests"}
          </span>
        </div>
        {hasActiveFilters ? (
          <Link
            href={`/dashboard/classes/${found.slug}/leave-requests`}
            className="text-muted-foreground hover:text-foreground text-sm underline-offset-4 hover:underline"
          >
            Reset filters
          </Link>
        ) : null}
      </div>

      <p className="text-muted-foreground mt-1 text-xs">
        Drafts are excluded — a request only appears here once the student
        submits it.
      </p>

      <div className="mt-4">
        <LeaveRequestList
          requests={result.items}
          hrefFor={(request) => `/leave-requests/${request.id}`}
          showStudent
          emptyTitle="No absence requests yet"
          emptyBody="When a student in this class submits an absence request, it appears here."
          filtered={hasActiveFilters}
        />
      </div>

      <Pagination
        basePath={`/dashboard/classes/${found.slug}/leave-requests`}
        page={result.page}
        totalPages={result.totalPages}
        params={{
          status: query.status,
          from: query.from,
          to: query.to,
          q: query.q,
          pageSize: String(query.pageSize),
        }}
      />

      <Card className="mt-10">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold">
          <Download
            aria-hidden="true"
            className="h-4 w-4"
          />
          Reports
        </h2>
        <p className="text-muted-foreground mt-1 text-xs">
          Built from the absence dates in view
          {query.from || query.to ? " (the period you filtered by)" : ""}. Only
          confirmed values are included, and no file paths or links are written
          into a report.
        </p>

        <ul className="mt-3 grid gap-2 text-sm">
          <li>
            <a
              href={exportHref("csv")}
              className="text-accent font-medium underline-offset-4 hover:underline"
            >
              CSV spreadsheet
            </a>
            <span className="text-muted-foreground">
              {" "}
              — one row per request, safe to open in Excel or Sheets.
            </span>
          </li>
          <li>
            <a
              href={exportHref("summary")}
              className="text-accent font-medium underline-offset-4 hover:underline"
            >
              Summary PDF
            </a>
            <span className="text-muted-foreground">
              {" "}
              — the table on its own. Works even if a document is unavailable.
            </span>
          </li>
          <li>
            <a
              href={exportHref("complete")}
              className="text-accent font-medium underline-offset-4 hover:underline"
            >
              Complete PDF with evidence
            </a>
            <span className="text-muted-foreground">
              {" "}
              — the table plus every attached image. Anything that could not be
              included is listed on the last page.
            </span>
          </li>
          <li>
            <a
              href={exportHref("zip")}
              className="text-accent font-medium underline-offset-4 hover:underline"
            >
              ZIP archive
            </a>
            <span className="text-muted-foreground">
              {" "}
              — summary PDF, a manifest, and the original files.
            </span>
          </li>
        </ul>

        <p className="text-muted-foreground mt-3 text-[11px]">
          These files contain medical information. Download them to a device you
          control and do not forward them beyond the lecturer.
        </p>
      </Card>
    </div>
  );
}

import { Info, PlusCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Pagination } from "@/components/assignments/pagination";
import { LeaveFilters } from "@/components/leave/leave-filters";
import { LeaveRequestList } from "@/components/leave/leave-request-list";
import { SetupNotice } from "@/components/layout/setup-notice";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { getSessionUser } from "@/lib/auth/session";
import { listMyClasses } from "@/lib/db/classes";
import { listLeaveRequestsForStudent } from "@/lib/db/leave";
import { isSupabaseConfigured } from "@/lib/env/public";
import { buildLoginPath } from "@/lib/security/redirect";
import { flattenSearchParams } from "@/lib/utils/search-params";
import { leaveRequestListQuerySchema } from "@starstask/contracts";

export const metadata: Metadata = {
  title: "Absence requests",
  description:
    "Collect your absence documents, attach the supporting evidence, and send them to your class admin for forwarding to the lecturer.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const pageContainer = "mx-auto w-full max-w-4xl px-5 py-8 sm:px-8 lg:px-10";

type LeaveRequestsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LeaveRequestsPage({
  searchParams,
}: LeaveRequestsPageProps) {
  const flat = flattenSearchParams(await searchParams);
  const parsed = leaveRequestListQuerySchema.safeParse(flat);

  if (!parsed.success) {
    return (
      <div className={pageContainer}>
        <Alert variant="error">
          <p className="font-medium">Those filters are not valid.</p>
          <p className="mt-1">
            <Link
              href="/leave-requests"
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

  if (!isSupabaseConfigured()) {
    return (
      <div className={pageContainer}>
        <h1 className="text-3xl font-semibold tracking-tight">
          Absence requests
        </h1>
        <div className="mt-6">
          <SetupNotice />
        </div>
      </div>
    );
  }

  const session = await getSessionUser();

  if (!session) {
    redirect(buildLoginPath("/leave-requests"));
  }

  const query = parsed.data;

  const [result, myClasses] = await Promise.all([
    listLeaveRequestsForStudent(session.user.id, {
      status: query.status ?? "all",
      from: query.from,
      to: query.to,
      page: query.page,
      pageSize: query.pageSize,
    }),
    listMyClasses(session.user.id),
  ]);

  const hasActiveFilters =
    (query.status !== undefined && query.status !== "all") ||
    Boolean(query.from) ||
    Boolean(query.to);

  // With a single class there is nothing to choose, so the button can go
  // straight to the form; with several, the form asks which class first.
  const onlyClass = myClasses.length === 1 ? myClasses[0] : undefined;
  const newHref = onlyClass
    ? `/leave-requests/new?class=${onlyClass.slug}`
    : "/leave-requests/new";

  return (
    <div className={pageContainer}>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-[2rem]">
            Absence requests
          </h1>
          <p className="text-muted-foreground mt-1.5 max-w-2xl text-sm">
            Put your absence document and its dates in one place, then send it
            to your class admin. StarsTask collects and forwards requests — your
            lecturer still decides.
          </p>
        </div>
        {myClasses.length > 0 ? (
          <Button
            asChild
            size="lg"
          >
            <Link href={newHref}>
              <PlusCircle
                aria-hidden="true"
                className="h-4 w-4"
              />
              New request
            </Link>
          </Button>
        ) : null}
      </header>

      {myClasses.length === 0 ? (
        <Alert
          variant="info"
          className="mt-6"
        >
          <p className="font-medium">Join a class first</p>
          <p className="mt-1">
            An absence request belongs to one of your classes, so you need to be
            a member before you can create one.{" "}
            <Link
              href="/classes/discover"
              className="underline"
            >
              Browse classes
            </Link>
            .
          </p>
        </Alert>
      ) : null}

      <div className="mt-6">
        <LeaveFilters
          action="/leave-requests"
          values={{ status: query.status, from: query.from, to: query.to }}
        />
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <h2 className="text-lg font-semibold tracking-tight">
            Your requests
          </h2>
          <span className="bg-muted text-muted-foreground rounded-full px-2.5 py-0.5 text-xs font-medium">
            {result.total} {result.total === 1 ? "request" : "requests"}
          </span>
        </div>
        {hasActiveFilters ? (
          <Link
            href="/leave-requests"
            className="text-muted-foreground hover:text-foreground text-sm underline-offset-4 hover:underline"
          >
            Reset filters
          </Link>
        ) : null}
      </div>

      <div className="mt-4">
        <LeaveRequestList
          requests={result.items}
          hrefFor={(request) => `/leave-requests/${request.id}`}
          emptyTitle="No absence requests yet"
          emptyBody="Start one with your absence document in hand. You can save it as a draft and finish it later."
          filtered={hasActiveFilters}
        />
      </div>

      <Pagination
        basePath="/leave-requests"
        page={result.page}
        totalPages={result.totalPages}
        params={{
          status: query.status,
          from: query.from,
          to: query.to,
          pageSize: String(query.pageSize),
        }}
      />

      <p className="text-muted-foreground mt-8 flex items-start gap-1.5 text-xs">
        <Info
          aria-hidden="true"
          className="mt-0.5 h-3.5 w-3.5 shrink-0"
        />
        <span>
          <strong className="font-medium">Forwarded</strong> means your class
          admin put the request into a package for the lecturer. It does not
          mean the absence was approved, and StarsTask cannot tell you whether
          the lecturer has read it.
        </span>
      </p>
    </div>
  );
}

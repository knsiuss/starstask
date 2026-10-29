import { Bell, Paperclip, Pencil, PlusCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { DeadlineBadge } from "@/components/assignments/deadline-badge";
import { DeleteAssignmentButton } from "@/components/assignments/delete-assignment-button";
import { Pagination } from "@/components/assignments/pagination";
import { SetupNotice } from "@/components/layout/setup-notice";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getSessionUser } from "@/lib/auth/session";
import { getMyAssignments } from "@/lib/db/assignments";
import { isSupabaseConfigured } from "@/lib/env/public";
import { buildLoginPath } from "@/lib/security/redirect";
import { myAssignmentsQuerySchema, toFieldErrors } from "@starstask/contracts";
import { formatDate, pluralize } from "@starstask/shared";

export const metadata: Metadata = {
  title: "My assignments",
  description: "Manage the assignments you contributed to StarsTask.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type MyAssignmentsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function MyAssignmentsPage({
  searchParams,
}: MyAssignmentsPageProps) {
  if (!isSupabaseConfigured()) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <h1 className="text-3xl font-semibold tracking-tight">
          My assignments
        </h1>
        <div className="mt-6">
          <SetupNotice />
        </div>
      </div>
    );
  }

  const session = await getSessionUser();

  if (!session) {
    redirect(buildLoginPath("/my-assignments"));
  }

  const rawParams = await searchParams;
  const parsed = myAssignmentsQuerySchema.safeParse(flattenParams(rawParams));

  if (!parsed.success) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <Alert variant="error">
          <p className="font-medium">That filter is not valid.</p>
          <p className="mt-1">
            <Link
              href="/my-assignments"
              className="underline"
            >
              Show all of your assignments
            </Link>
            .
          </p>
        </Alert>
        <p className="sr-only">
          {Object.values(toFieldErrors(parsed.error)).join(" ")}
        </p>
      </div>
    );
  }

  const query = parsed.data;
  const result = await getMyAssignments(session.user.id, query);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            My assignments
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {result.total} {pluralize(result.total, "assignment")} contributed
            by you.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            asChild
            variant="secondary"
          >
            <Link href="/settings/notifications">
              <Bell
                aria-hidden="true"
                className="h-4 w-4"
              />
              Notifications
            </Link>
          </Button>
          <Button asChild>
            <Link href="/submit">
              <PlusCircle
                aria-hidden="true"
                className="h-4 w-4"
              />
              Submit assignment
            </Link>
          </Button>
        </div>
      </div>

      <nav
        aria-label="Filter by status"
        className="mt-6 flex flex-wrap gap-2"
      >
        <StatusTab
          href="/my-assignments"
          isActive={!query.status}
          label="All"
        />
        <StatusTab
          href="/my-assignments?status=published"
          isActive={query.status === "published"}
          label="Published"
        />
        <StatusTab
          href="/my-assignments?status=pending"
          isActive={query.status === "pending"}
          label="Pending"
        />
      </nav>

      {result.items.length === 0 ? (
        <div className="border-border bg-subtle mt-8 rounded-lg border border-dashed px-6 py-14 text-center">
          <h2 className="text-base font-semibold">Nothing here yet</h2>
          <p className="text-muted-foreground mx-auto mt-1 max-w-md text-sm">
            {query.status
              ? "No assignments with this status. Try another filter."
              : "You have not contributed an assignment yet. Share one from a course you are taking."}
          </p>
          <Button
            asChild
            className="mt-5"
            size="sm"
          >
            <Link href="/submit">Submit your first assignment</Link>
          </Button>
        </div>
      ) : (
        <ul className="divide-border border-border mt-8 divide-y rounded-lg border">
          {result.items.map((assignment) => (
            <li
              key={assignment.id}
              className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant={
                      assignment.status === "published" ? "success" : "warning"
                    }
                  >
                    {assignment.status}
                  </Badge>
                  <span className="text-muted-foreground text-xs">
                    {assignment.course_code
                      ? `${assignment.course_code} · ${assignment.course_name}`
                      : assignment.course_name}
                  </span>
                </div>
                <h2 className="mt-1.5 text-base font-semibold">
                  <Link
                    href={`/assignments/${assignment.id}`}
                    className="hover:text-accent hover:underline"
                  >
                    {assignment.title}
                  </Link>
                </h2>
                <div className="text-muted-foreground mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                  <span>Created {formatDate(assignment.created_at)}</span>
                  <DeadlineBadge
                    deadline={assignment.deadline}
                    showDate={false}
                  />
                  {assignment.attachment_count > 0 ? (
                    <span className="inline-flex items-center gap-1">
                      <Paperclip
                        aria-hidden="true"
                        className="h-3.5 w-3.5"
                      />
                      {assignment.attachment_count}
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="flex shrink-0 flex-wrap gap-2">
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
                    Edit
                  </Link>
                </Button>
                <DeleteAssignmentButton
                  assignmentId={assignment.id}
                  title={assignment.title}
                />
              </div>
            </li>
          ))}
        </ul>
      )}

      <Pagination
        basePath="/my-assignments"
        page={result.page}
        totalPages={result.totalPages}
        params={{ status: query.status }}
      />
    </div>
  );
}

function StatusTab({
  href,
  label,
  isActive,
}: {
  href: string;
  label: string;
  isActive: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={isActive ? "page" : undefined}
      className={
        isActive
          ? "bg-foreground text-background rounded-md px-3 py-1.5 text-sm font-medium"
          : "border-border text-muted-foreground hover:bg-muted hover:text-foreground rounded-md border px-3 py-1.5 text-sm font-medium"
      }
    >
      {label}
    </Link>
  );
}

function flattenParams(
  params: Record<string, string | string[] | undefined>,
): Record<string, string> {
  const flat: Record<string, string> = {};

  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string") {
      flat[key] = value;
    } else if (Array.isArray(value) && typeof value[0] === "string") {
      flat[key] = value[0];
    }
  }

  return flat;
}

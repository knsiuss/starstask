import { ArrowLeft, CalendarDays } from "lucide-react";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ClassUnlinkedNotice } from "@/components/academic/unlinked-notice";
import { SetupNotice } from "@/components/layout/setup-notice";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { resolveClassMemberForPage } from "@/lib/authz/class-permission";
import { listOfferingsForClass } from "@/lib/db/course-offerings";
import { listScheduleForClass } from "@/lib/db/schedule-readonly";
import { isSupabaseConfigured } from "@/lib/env/public";
import {
  formatInTimeZone,
  formatTimeWindow,
  weekdayName,
} from "@/lib/utils/timezone";

export const metadata: Metadata = {
  title: "Schedule model",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type SchedulePageProps = {
  params: Promise<{ slug: string }>;
};

/**
 * Read-only view of the normalized schedule model. Timezone-aware: instances
 * are rendered in the rule's stored timezone, never the viewer's guess. The
 * legacy weekly schedule remains the source of truth for existing pages.
 */
export default async function AcademicSchedulePage({
  params,
}: SchedulePageProps) {
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

  const { classRow } = access;

  if (!classRow.universityId) {
    return (
      <Shell slug={classRow.slug}>
        <ClassUnlinkedNotice />
      </Shell>
    );
  }

  const offerings = await listOfferingsForClass(classRow.id);
  const { rules, instances, exceptions } = await listScheduleForClass(
    offerings.map((offering) => offering.id),
  );
  const ruleById = new Map(rules.map((rule) => [rule.id, rule]));
  const exceptionInstanceIds = new Set(
    exceptions.map((exception) => exception.instanceId),
  );

  return (
    <Shell slug={classRow.slug}>
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Weekly rules</CardTitle>
          <CardDescription>
            Recurring windows per offering, in their stored timezone.
          </CardDescription>
        </CardHeader>
        <div className="px-6 pb-6">
          {rules.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No schedule rules yet.
            </p>
          ) : (
            <ul className="divide-border divide-y text-sm">
              {rules.map((rule) => (
                <li
                  key={rule.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-2"
                >
                  <span>
                    <span className="font-medium">
                      {weekdayName(rule.weekday)} ·{" "}
                      {formatTimeWindow(rule.startTime, rule.endTime)}
                    </span>
                    <span className="text-muted-foreground block text-xs">
                      {rule.courseName}
                      {rule.room ? ` · ${rule.room}` : ""} · {rule.timezone}
                      {rule.effectiveFrom
                        ? ` · from ${rule.effectiveFrom}`
                        : ""}
                      {rule.effectiveTo ? ` to ${rule.effectiveTo}` : ""}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Instances</CardTitle>
          <CardDescription>
            Materialised occurrences (latest 200). Exceptions mark overridden
            sessions.
          </CardDescription>
        </CardHeader>
        <div className="px-6 pb-6">
          {instances.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No schedule instances materialised yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-muted-foreground text-left text-xs">
                    <th className="py-2 pr-4">Date</th>
                    <th className="py-2 pr-4">Course</th>
                    <th className="py-2 pr-4">Starts</th>
                    <th className="py-2 pr-4">Ends</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2">Exception</th>
                  </tr>
                </thead>
                <tbody>
                  {instances.map((instance) => {
                    const rule = ruleById.get(instance.ruleId);

                    return (
                      <tr
                        key={instance.id}
                        className="border-border border-t"
                      >
                        <td className="py-2 pr-4 whitespace-nowrap">
                          {instance.instanceDate}
                        </td>
                        <td className="py-2 pr-4">{rule?.courseName ?? "—"}</td>
                        <td className="py-2 pr-4 whitespace-nowrap">
                          {formatInTimeZone(instance.startsAt, rule?.timezone)}
                        </td>
                        <td className="py-2 pr-4 whitespace-nowrap">
                          {formatInTimeZone(instance.endsAt, rule?.timezone)}
                        </td>
                        <td className="py-2 pr-4">
                          <Badge variant="neutral">{instance.status}</Badge>
                        </td>
                        <td className="py-2">
                          {exceptionInstanceIds.has(instance.id)
                            ? "overridden"
                            : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Exceptions</CardTitle>
          <CardDescription>
            Cancellations, moves and substitutions attached to instances.
          </CardDescription>
        </CardHeader>
        <div className="px-6 pb-6">
          {exceptions.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No exceptions recorded.
            </p>
          ) : (
            <ul className="divide-border divide-y text-sm">
              {exceptions.map((exception) => (
                <li
                  key={exception.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-2"
                >
                  <span>
                    <Badge variant="warning">{exception.kind}</Badge>
                    {exception.note ? (
                      <span className="text-muted-foreground ml-2 text-xs">
                        {exception.note}
                      </span>
                    ) : null}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {new Date(exception.createdAt).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>
    </Shell>
  );
}

function Shell({ slug, children }: { slug: string; children: ReactNode }) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <Link
        href={`/dashboard/classes/${slug}/academic`}
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm"
      >
        <ArrowLeft
          aria-hidden="true"
          className="h-4 w-4"
        />
        Academic administration
      </Link>
      <header className="mt-4 flex items-center gap-3">
        <CalendarDays
          aria-hidden="true"
          className="text-accent h-6 w-6"
        />
        <h1 className="text-2xl font-semibold tracking-tight">
          Schedule model
        </h1>
      </header>
      {children}
    </div>
  );
}

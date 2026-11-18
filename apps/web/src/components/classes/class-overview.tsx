import { ArrowRight, CircleCheck } from "lucide-react";
import Link from "next/link";

import { ClassQuickActions } from "@/components/classes/overview/quick-actions";
import { OverviewStats } from "@/components/classes/overview/overview-stats";
import { RecentAssignments } from "@/components/classes/overview/recent-assignments";
import { YourPosts } from "@/components/classes/overview/your-posts";
import { Button } from "@/components/ui/button";
import type { ClassOverviewData } from "@/lib/db/class-overview";

type ClassOverviewProps = {
  classSlug: string;
  data: ClassOverviewData;
  canManage: boolean;
};

/**
 * Class Overview composition: the left column reads class activity, the right
 * column renders the counters and the role-aware quick actions.
 *
 * On mobile the two columns dissolve (`contents`) and the sections reorder
 * so the class counters and quick actions come first; on xl the wrappers
 * become the two side-by-side columns again, so the desktop layout is
 * untouched.
 */
export function ClassOverview({
  classSlug,
  data,
  canManage,
}: ClassOverviewProps) {
  const base = `/classes/${classSlug}`;
  const activeMeeting = data.activeMeeting;
  const activeMeetingHref =
    activeMeeting && canManage
      ? `${base}/attendance/meetings/${activeMeeting.id}`
      : `${base}/attendance`;

  return (
    <div className="mt-5 flex flex-col gap-4 sm:mt-6 sm:gap-6 xl:flex-row xl:items-start">
      <div className="contents xl:block xl:min-w-0 xl:flex-1 xl:space-y-6">
        {activeMeeting ? (
          <div className="border-accent/30 bg-accent-soft/50 order-1 flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4 xl:order-none">
            <div className="flex items-start gap-3">
              <span className="bg-accent text-accent-foreground flex h-9 w-9 shrink-0 items-center justify-center rounded-lg">
                <CircleCheck
                  aria-hidden="true"
                  className="h-4 w-4"
                />
              </span>
              <div>
                <p className="text-foreground text-sm font-semibold">
                  Attendance open now
                  {activeMeeting.meetingNumber
                    ? ` · Meeting ${activeMeeting.meetingNumber}`
                    : ""}
                </p>
                <p className="text-muted-foreground mt-0.5 text-xs">
                  {activeMeeting.courseName
                    ? `${activeMeeting.courseName} · `
                    : ""}
                  {activeMeeting.title}
                </p>
              </div>
            </div>
            <Button
              asChild
              size="sm"
            >
              <Link href={activeMeetingHref}>
                {canManage ? "Manage meeting" : "Check in"}
                <ArrowRight
                  aria-hidden="true"
                  className="h-3.5 w-3.5"
                />
              </Link>
            </Button>
          </div>
        ) : null}
        <div className="order-3 xl:order-none">
          <RecentAssignments
            assignments={data.recent}
            viewAllHref={`${base}?tab=assignments`}
          />
        </div>
        <div className="order-4 xl:order-none">
          <YourPosts
            posts={data.posts}
            viewAllHref={`${base}?tab=assignments`}
            canManage={canManage}
            createPostHref={`${base}/submit`}
          />
        </div>
      </div>
      <div className="contents xl:block xl:w-[340px] xl:shrink-0 xl:space-y-6">
        <div className="order-1 xl:order-none">
          <OverviewStats stats={data.stats} />
        </div>
        <div className="order-2 hidden lg:block xl:order-none">
          <ClassQuickActions
            classSlug={classSlug}
            canManage={canManage}
          />
        </div>
      </div>
    </div>
  );
}

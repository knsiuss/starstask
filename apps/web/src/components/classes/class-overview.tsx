import { ClassQuickActions } from "@/components/classes/overview/quick-actions";
import { OverviewStats } from "@/components/classes/overview/overview-stats";
import { RecentAssignments } from "@/components/classes/overview/recent-assignments";
import { YourPosts } from "@/components/classes/overview/your-posts";
import type { ClassOverviewData } from "@/lib/db/class-overview";

type ClassOverviewProps = {
  classSlug: string;
  data: ClassOverviewData;
  canManage: boolean;
};

/**
 * Class Overview composition: the left column reads class activity, the right
 * column renders the counters and the role-aware quick actions.
 */
export function ClassOverview({
  classSlug,
  data,
  canManage,
}: ClassOverviewProps) {
  const base = `/dashboard/classes/${classSlug}`;

  return (
    <div className="mt-6 grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0 space-y-6">
        <RecentAssignments
          assignments={data.recent}
          viewAllHref={`${base}?tab=assignments`}
        />
        <YourPosts
          posts={data.posts}
          viewAllHref={`${base}?tab=assignments`}
          canManage={canManage}
          createPostHref={`${base}/submit`}
        />
      </div>
      <div className="min-w-0 space-y-6">
        <OverviewStats stats={data.stats} />
        <ClassQuickActions
          classSlug={classSlug}
          canManage={canManage}
        />
      </div>
    </div>
  );
}

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
  const base = `/dashboard/classes/${classSlug}`;

  return (
    <div className="mt-5 flex flex-col gap-4 sm:mt-6 sm:gap-6 xl:flex-row xl:items-start">
      <div className="contents xl:block xl:min-w-0 xl:flex-1 xl:space-y-6">
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
        <div className="order-2 xl:order-none">
          <ClassQuickActions
            classSlug={classSlug}
            canManage={canManage}
          />
        </div>
      </div>
    </div>
  );
}

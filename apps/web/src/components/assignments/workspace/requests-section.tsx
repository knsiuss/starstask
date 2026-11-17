import { RequestCard } from "@/components/assignments/workspace/request-card";
import { ReviewRequestDialog } from "@/components/assignments/workspace/review-request-dialog";
import { WorkspaceEmptyState } from "@/components/assignments/workspace/workspace-empty-state";
import type {
  listManagedRequests,
  listMyRequests,
} from "@/lib/db/assignment-workspace";

type RequestsSectionProps = {
  manages: boolean;
  myRequests: Awaited<ReturnType<typeof listMyRequests>>;
  managedRequests: Awaited<ReturnType<typeof listManagedRequests>>;
};

/**
 * Publication requests tab content: student tracking list or admin review
 * queue with recently decided items and the admin's own requests.
 */
export function RequestsSection({
  manages,
  myRequests,
  managedRequests,
}: RequestsSectionProps) {
  if (!manages) {
    if (myRequests.length === 0) {
      return (
        <WorkspaceEmptyState
          title="No publication requests yet."
          description="Requests you submit to a class admin will appear here with their review status."
        />
      );
    }

    return (
      <ul className="space-y-3">
        {myRequests.map((request) => (
          <RequestCard
            key={request.id}
            request={request}
            mode="student"
          />
        ))}
      </ul>
    );
  }

  const toReview = managedRequests.filter(
    (item) => item.displayStatus === "pending",
  );
  const decided = managedRequests.filter(
    (item) => item.displayStatus !== "pending",
  );

  return (
    <div className="space-y-8">
      <section aria-labelledby="requests-to-review">
        <div className="flex items-center gap-2">
          <h2
            id="requests-to-review"
            className="text-foreground text-base font-semibold tracking-tight"
          >
            Requests to review
          </h2>
          <span className="bg-accent-soft text-accent rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums">
            {toReview.length}
          </span>
        </div>
        <div className="mt-3">
          {toReview.length === 0 ? (
            <WorkspaceEmptyState
              title="No pending requests."
              description="Student publication requests will appear here when submitted."
            />
          ) : (
            <ul className="space-y-3">
              {toReview.map((request) => (
                <RequestCard
                  key={request.id}
                  request={request}
                  mode="admin"
                  reviewAction={
                    <ReviewRequestDialog
                      assignmentId={request.id}
                      classSlug={request.class_slug}
                      title={request.title}
                    />
                  }
                />
              ))}
            </ul>
          )}
        </div>
      </section>

      {decided.length > 0 ? (
        <section aria-labelledby="requests-decided">
          <h2
            id="requests-decided"
            className="text-foreground text-base font-semibold tracking-tight"
          >
            Recently decided
          </h2>
          <ul className="mt-3 space-y-3">
            {decided.map((request) => (
              <RequestCard
                key={request.id}
                request={request}
                mode="admin"
              />
            ))}
          </ul>
        </section>
      ) : null}

      {myRequests.length > 0 ? (
        <section aria-labelledby="requests-mine">
          <h2
            id="requests-mine"
            className="text-foreground text-base font-semibold tracking-tight"
          >
            My requests
          </h2>
          <ul className="mt-3 space-y-3">
            {myRequests.map((request) => (
              <RequestCard
                key={request.id}
                request={request}
                mode="student"
              />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

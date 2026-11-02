import type { Metadata } from "next";

import { AdminEmptyState } from "@/components/admin/admin-empty-state";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { FeedbackStatusSelect } from "@/components/admin/feedback-status-select";
import { SetupNotice } from "@/components/layout/setup-notice";
import { Alert } from "@/components/ui/alert";
import { requirePlatformAdmin } from "@/lib/auth/admin";
import { listFeedbackForReview } from "@/lib/db/feedback";
import { isSupabaseConfigured } from "@/lib/env/public";
import { FEEDBACK_CATEGORY_LABELS } from "@starstask/contracts";
import { formatDate } from "@starstask/shared";

export const metadata: Metadata = {
  title: "Feedback",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminFeedbackPage() {
  if (!isSupabaseConfigured()) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <SetupNotice />
      </div>
    );
  }

  await requirePlatformAdmin("/admin/feedback");

  let entries: Awaited<ReturnType<typeof listFeedbackForReview>> | null = null;

  try {
    entries = await listFeedbackForReview();
  } catch {
    console.error("[admin] feedback queue load failed");
  }

  return (
    <div>
      <AdminPageHeader
        title="Feedback"
        description="Notes sent from the workspace. Messages are user-authored; no email, name, attachment, or user agent is stored."
      />

      {!entries ? (
        <Alert
          variant="error"
          className="mt-5"
        >
          The feedback queue could not be loaded.
        </Alert>
      ) : entries.length === 0 ? (
        <div className="mt-5">
          <AdminEmptyState
            title="No feedback yet"
            description="Notes sent from Settings → Feedback appear here."
          />
        </div>
      ) : (
        <ul className="mt-6 grid gap-3">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="border-border bg-surface rounded-lg border p-4"
            >
              <div className="flex flex-wrap items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">
                      {FEEDBACK_CATEGORY_LABELS[entry.category]}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {formatDate(entry.createdAt)}
                    </span>
                    {entry.pagePath ? (
                      <span className="text-muted-foreground text-xs">
                        {entry.pagePath}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-2 text-sm whitespace-pre-wrap">
                    {entry.message}
                  </p>
                </div>

                <FeedbackStatusSelect
                  feedbackId={entry.id}
                  initialStatus={entry.status}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

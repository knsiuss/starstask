import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { FeedbackForm } from "@/components/feedback/feedback-form";
import { SetupNotice } from "@/components/layout/setup-notice";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { getSessionUser } from "@/lib/auth/session";
import { listMyFeedback } from "@/lib/db/feedback";
import { isSupabaseConfigured } from "@/lib/env/public";
import { buildLoginPath } from "@/lib/security/redirect";
import { cn } from "@/lib/utils/cn";
import {
  FEEDBACK_CATEGORY_LABELS,
  FEEDBACK_STATUS_LABELS,
  type FeedbackStatus,
} from "@starstask/contracts";
import { formatDate } from "@starstask/shared";

export const metadata: Metadata = {
  title: "Feedback",
  description: "Tell the StarsTask team what broke or what would help.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const STATUS_TONE: Record<FeedbackStatus, string> = {
  open: "bg-subtle text-muted-foreground",
  reviewing: "bg-accent-soft text-accent",
  resolved: "bg-success-soft text-success",
  dismissed: "bg-subtle text-muted-foreground",
};

export default async function FeedbackPage() {
  if (!isSupabaseConfigured()) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <h1 className="text-3xl font-semibold tracking-tight">Feedback</h1>
        <div className="mt-6">
          <SetupNotice />
        </div>
      </div>
    );
  }

  const session = await getSessionUser();

  if (!session) {
    redirect(buildLoginPath("/settings/feedback"));
  }

  const entries = await listMyFeedback(session.user.id).catch(() => null);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Feedback</h1>
        <p className="text-muted-foreground mt-1 max-w-2xl text-sm">
          Report a broken screen, a confusing step, or an idea. A platform admin
          reads every note. Do not include passwords, tokens, medical details,
          or information about other people.
        </p>
      </header>

      <div className="mt-8 grid gap-8">
        <Card>
          <FeedbackForm />
        </Card>

        <section aria-labelledby="recent-feedback-heading">
          <h2
            id="recent-feedback-heading"
            className="text-sm font-semibold"
          >
            Your recent notes
          </h2>

          {entries === null ? (
            <Alert
              variant="error"
              className="mt-3"
            >
              Your recent notes could not be loaded. Sending new feedback still
              works.
            </Alert>
          ) : entries.length === 0 ? (
            <p className="text-muted-foreground mt-2 text-sm">
              You have not sent any feedback yet.
            </p>
          ) : (
            <ul className="mt-3 grid gap-3">
              {entries.map((entry) => (
                <li
                  key={entry.id}
                  className="border-border bg-surface rounded-lg border p-4"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">
                      {FEEDBACK_CATEGORY_LABELS[entry.category]}
                    </span>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[11px] font-medium",
                        STATUS_TONE[entry.status],
                      )}
                    >
                      {FEEDBACK_STATUS_LABELS[entry.status]}
                    </span>
                    <span className="text-muted-foreground ml-auto text-xs">
                      {formatDate(entry.createdAt)}
                    </span>
                  </div>
                  <p className="mt-2 text-sm whitespace-pre-wrap">
                    {entry.message}
                  </p>
                  {entry.pagePath ? (
                    <p className="text-muted-foreground mt-2 text-xs">
                      Page: {entry.pagePath}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

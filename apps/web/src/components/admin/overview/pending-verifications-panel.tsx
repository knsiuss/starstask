import { ArrowRight, UserCheck } from "lucide-react";
import Link from "next/link";

import { VerificationQueueList } from "@/components/admin/verification-queue-list";
import type { VerificationRequestView } from "@/lib/db/verification";

export function PendingVerificationsPanel({
  items,
}: {
  items: VerificationRequestView[];
}) {
  return (
    <section
      aria-labelledby="pending-verifications"
      className="border-border bg-surface rounded-xl border"
    >
      <div className="border-border flex flex-wrap items-start justify-between gap-2 border-b px-4 py-3">
        <div>
          <h2
            id="pending-verifications"
            className="inline-flex items-center gap-2 font-semibold tracking-tight"
          >
            <UserCheck
              aria-hidden="true"
              className="h-4 w-4"
            />
            Verifications
          </h2>
          <p className="text-muted-foreground mt-0.5 text-xs">
            Class representative evidence awaiting review.
          </p>
        </div>
        <Link
          href="/admin/verifications"
          className="text-accent inline-flex items-center gap-1 text-xs font-medium hover:underline"
        >
          Queue
          <ArrowRight
            aria-hidden="true"
            className="h-3 w-3"
          />
        </Link>
      </div>

      <div className="p-4">
        <VerificationQueueList
          items={items}
          filtered={false}
        />
      </div>
    </section>
  );
}

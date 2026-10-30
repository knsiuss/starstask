import { SessionCard } from "@/components/sessions/session-card";
import type { SessionSummary } from "@/lib/db/sessions";

type SessionListProps = {
  sessions: SessionSummary[];
  emptyTitle?: string;
  emptyDescription?: string;
  showClass?: boolean;
};

export function SessionList({
  sessions,
  emptyTitle = "No sessions yet",
  emptyDescription = "Scheduled discussions will appear here.",
  showClass = true,
}: SessionListProps) {
  if (sessions.length === 0) {
    return (
      <div className="border-border bg-subtle rounded-lg border border-dashed px-5 py-10 text-center">
        <p className="text-sm font-medium">{emptyTitle}</p>
        <p className="text-muted-foreground mx-auto mt-1 max-w-sm text-xs">
          {emptyDescription}
        </p>
      </div>
    );
  }

  return (
    <ul className="grid gap-4 md:grid-cols-2">
      {sessions.map((session) => (
        <li key={session.id}>
          <SessionCard
            session={session}
            showClass={showClass}
          />
        </li>
      ))}
    </ul>
  );
}

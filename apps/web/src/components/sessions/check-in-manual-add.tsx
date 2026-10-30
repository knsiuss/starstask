"use client";

import { Loader2, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import {
  SESSION_CHECKIN_STATUSES,
  SESSION_CHECKIN_STATUS_LABELS,
  type SessionCheckInStatus,
} from "@starstask/contracts";

type ManualMember = {
  userId: string;
  displayName: string;
};

type CheckInManualAddProps = {
  sessionId: string;
  members: ManualMember[];
};

/**
 * Records attendance for a member who could not check in from their browser.
 *
 * The select is built from the class roster on the server. The database still
 * rejects a member from another class, so the list is a convenience, not the
 * security boundary.
 */
export function CheckInManualAdd({
  sessionId,
  members,
}: CheckInManualAddProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [userId, setUserId] = React.useState(members[0]?.userId ?? "");
  const [status, setStatus] = React.useState<SessionCheckInStatus>("present");
  const [isSaving, setIsSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  if (members.length === 0) {
    return (
      <p className="text-muted-foreground mt-4 text-xs">
        Nobody has joined this class yet, so there is nobody to record.
      </p>
    );
  }

  const save = async () => {
    if (isSaving || !userId) {
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/sessions/${sessionId}/checkins`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, status }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        setError(body?.error?.message ?? "Could not record this row.");
        return;
      }

      const member = members.find((item) => item.userId === userId);

      toast({
        variant: "success",
        title: `${member?.displayName ?? "Member"} marked ${SESSION_CHECKIN_STATUS_LABELS[
          status
        ].toLowerCase()}`,
      });
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="border-border mt-4 rounded-lg border p-3">
      <p className="text-sm font-medium">Record without a location</p>
      <p className="text-muted-foreground mt-0.5 text-[11px] leading-relaxed">
        Use this when a participant could not share their location. The row is
        marked as manual, so it is never mistaken for a geo check-in.
      </p>

      <div className="mt-3 flex flex-wrap items-end gap-2">
        <div className="min-w-[12rem] flex-1">
          <label
            htmlFor="manual-checkin-member"
            className="text-muted-foreground block text-xs font-medium"
          >
            Member
          </label>
          <select
            id="manual-checkin-member"
            value={userId}
            onChange={(event) => setUserId(event.target.value)}
            disabled={isSaving}
            className="border-border bg-surface focus-visible:outline-accent mt-1 w-full rounded-md border px-2 py-1.5 text-sm focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            {members.map((member) => (
              <option
                key={member.userId}
                value={member.userId}
              >
                {member.displayName}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="manual-checkin-status"
            className="text-muted-foreground block text-xs font-medium"
          >
            Status
          </label>
          <select
            id="manual-checkin-status"
            value={status}
            onChange={(event) =>
              setStatus(event.target.value as SessionCheckInStatus)
            }
            disabled={isSaving}
            className="border-border bg-surface focus-visible:outline-accent mt-1 rounded-md border px-2 py-1.5 text-sm focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            {SESSION_CHECKIN_STATUSES.map((option) => (
              <option
                key={option}
                value={option}
              >
                {SESSION_CHECKIN_STATUS_LABELS[option]}
              </option>
            ))}
          </select>
        </div>

        <Button
          type="button"
          size="sm"
          onClick={() => void save()}
          disabled={isSaving || !userId}
          aria-busy={isSaving}
        >
          {isSaving ? (
            <Loader2
              aria-hidden="true"
              className="h-3.5 w-3.5 animate-spin"
            />
          ) : (
            <UserPlus
              aria-hidden="true"
              className="h-3.5 w-3.5"
            />
          )}
          Record
        </Button>
      </div>

      {error ? (
        <Alert
          variant="error"
          className="mt-3"
        >
          {error}
        </Alert>
      ) : null}
    </div>
  );
}

"use client";

import { Loader2, ShieldCheck, ShieldOff, UserMinus } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import { formatDate } from "@starstask/shared";

import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export type ManagedMember = {
  user_id: string;
  display_name: string;
  bio?: string | null;
  joined_via: string;
  joined_at: string;
  is_admin: boolean;
};

type MemberManagerProps = {
  classSlug: string;
  members: ManagedMember[];
  /** Only platform admins may grant or revoke the class admin role. */
  canManageAdmins: boolean;
  currentUserId: string;
};

export function MemberManager({
  classSlug,
  members,
  canManageAdmins,
  currentUserId,
}: MemberManagerProps) {
  const router = useRouter();
  const [current, setCurrent] = React.useState(members);
  const [error, setError] = React.useState<string | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const send = async (
    url: string,
    method: "POST" | "DELETE",
    userId: string,
  ) => {
    setError(null);
    setBusyId(userId);

    try {
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        setError(body?.error?.message ?? "Could not update this member.");
        return false;
      }

      return true;
    } catch {
      setError("Network error. Check your connection and try again.");
      return false;
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (userId: string) => {
    const ok = await send(
      `/api/classes/${classSlug}/members`,
      "DELETE",
      userId,
    );

    if (ok) {
      setCurrent((list) => list.filter((member) => member.user_id !== userId));
      router.refresh();
    }
  };

  const toggleAdmin = async (member: ManagedMember) => {
    const ok = await send(
      `/api/classes/${classSlug}/admins`,
      member.is_admin ? "DELETE" : "POST",
      member.user_id,
    );

    if (ok) {
      setCurrent((list) =>
        list.map((entry) =>
          entry.user_id === member.user_id
            ? { ...entry, is_admin: !entry.is_admin }
            : entry,
        ),
      );
      router.refresh();
    }
  };

  const sorted = [...current].sort((a, b) => {
    if (a.is_admin !== b.is_admin) {
      return a.is_admin ? -1 : 1;
    }

    return a.display_name.localeCompare(b.display_name);
  });

  return (
    <div className="space-y-3">
      {error ? <Alert variant="error">{error}</Alert> : null}

      <ul className="divide-border border-border divide-y rounded-lg border">
        {sorted.map((member) => (
          <li
            key={member.user_id}
            className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
          >
            <div className="min-w-0">
              <p className="truncate font-medium">
                {member.display_name}
                {member.user_id === currentUserId ? (
                  <span className="text-muted-foreground ml-2 text-xs">
                    (you)
                  </span>
                ) : null}
              </p>
              {member.bio ? (
                <p className="text-muted-foreground mt-1 line-clamp-3 text-xs leading-relaxed whitespace-pre-line">
                  {member.bio}
                </p>
              ) : null}
              <p className="text-muted-foreground mt-0.5 text-xs">
                Joined {formatDate(member.joined_at)} ·{" "}
                {member.joined_via.replace("_", " ")}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              {member.is_admin ? (
                <Badge variant="accent">
                  <ShieldCheck
                    aria-hidden="true"
                    className="h-3 w-3"
                  />
                  Admin
                </Badge>
              ) : null}

              {canManageAdmins ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => void toggleAdmin(member)}
                  disabled={busyId === member.user_id}
                  aria-label={
                    member.is_admin
                      ? `Revoke class admin from ${member.display_name}`
                      : `Make ${member.display_name} a class admin`
                  }
                >
                  {busyId === member.user_id ? (
                    <Loader2
                      aria-hidden="true"
                      className="h-3.5 w-3.5 animate-spin"
                    />
                  ) : member.is_admin ? (
                    <ShieldOff
                      aria-hidden="true"
                      className="h-3.5 w-3.5"
                    />
                  ) : (
                    <ShieldCheck
                      aria-hidden="true"
                      className="h-3.5 w-3.5"
                    />
                  )}
                </Button>
              ) : null}

              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => void remove(member.user_id)}
                disabled={busyId === member.user_id}
                aria-label={`Remove ${member.display_name} from the class`}
              >
                <UserMinus
                  aria-hidden="true"
                  className="h-3.5 w-3.5"
                />
              </Button>
            </div>
          </li>
        ))}
      </ul>

      <p className="text-muted-foreground text-xs">
        Removing a member also removes their class admin role. A class always
        keeps at least one admin.
      </p>
    </div>
  );
}

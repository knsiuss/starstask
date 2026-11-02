"use client";

import {
  Loader2,
  Search,
  ShieldCheck,
  ShieldOff,
  UserMinus,
} from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import { formatDate } from "@starstask/shared";

import { AdminUserCell } from "@/components/admin/admin-user-cell";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type ManagedMember = {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  bio?: string | null;
  joined_via: string;
  joined_at: string;
  is_admin: boolean;
};

type MemberManagerProps = {
  classSlug: string;
  members: ManagedMember[];
  /** Class admins manage their own class; the server checks the same rule. */
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
  const [query, setQuery] = React.useState("");

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
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filtered = normalizedQuery
    ? sorted.filter((member) =>
        member.display_name.toLocaleLowerCase().includes(normalizedQuery),
      )
    : sorted;

  return (
    <div className="space-y-3">
      <div className="relative max-w-sm">
        <Search
          aria-hidden="true"
          className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
        />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search members"
          aria-label="Search members"
          className="pl-9"
        />
      </div>

      {error ? <Alert variant="error">{error}</Alert> : null}

      {filtered.length === 0 ? (
        <div className="border-border bg-subtle rounded-xl border border-dashed px-5 py-10 text-center">
          <p className="text-sm font-medium">No members match that search</p>
          <p className="text-muted-foreground mt-1 text-xs">
            Try a different name.
          </p>
        </div>
      ) : (
        <ul className="divide-border border-border divide-y rounded-xl border">
          {filtered.map((member) => (
            <li
              key={member.user_id}
              className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
            >
              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-2">
                  <AdminUserCell
                    displayName={member.display_name}
                    avatarUrl={member.avatar_url}
                  />
                  {member.user_id === currentUserId ? (
                    <span className="text-muted-foreground shrink-0 text-xs">
                      (you)
                    </span>
                  ) : null}
                </div>
                <p className="text-muted-foreground mt-0.5 text-xs">
                  Joined {formatDate(member.joined_at)}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                {member.is_admin ? (
                  <Badge variant="accent">
                    <ShieldCheck
                      aria-hidden="true"
                      className="h-3 w-3"
                    />
                    Class admin
                  </Badge>
                ) : (
                  <Badge variant="neutral">Member</Badge>
                )}

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
      )}

      <p className="text-muted-foreground text-xs">
        A class always keeps at least one admin.
      </p>
    </div>
  );
}

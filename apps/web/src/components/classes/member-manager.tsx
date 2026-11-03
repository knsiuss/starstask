"use client";

import {
  Ellipsis,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
          error?: { code?: string; message?: string };
        } | null;
        setError(
          body?.error?.code === "invalid_state"
            ? "A class must keep at least one admin."
            : (body?.error?.message ?? "Could not update this member."),
        );
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

                <DropdownMenu>
                  <DropdownMenuTrigger
                    aria-label={`Actions for ${member.display_name}`}
                    disabled={busyId === member.user_id}
                    className="text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-accent flex h-8 w-8 items-center justify-center rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-50"
                  >
                    {busyId === member.user_id ? (
                      <Loader2
                        aria-hidden="true"
                        className="h-4 w-4 animate-spin"
                      />
                    ) : (
                      <Ellipsis
                        aria-hidden="true"
                        className="h-4 w-4"
                      />
                    )}
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {canManageAdmins ? (
                      <DropdownMenuItem
                        onSelect={() => void toggleAdmin(member)}
                        className="flex items-center gap-2"
                      >
                        {member.is_admin ? (
                          <ShieldOff
                            aria-hidden="true"
                            className="h-4 w-4"
                          />
                        ) : (
                          <ShieldCheck
                            aria-hidden="true"
                            className="h-4 w-4"
                          />
                        )}
                        {member.is_admin
                          ? "Remove class admin"
                          : "Make class admin"}
                      </DropdownMenuItem>
                    ) : null}

                    {canManageAdmins ? <DropdownMenuSeparator /> : null}

                    <DropdownMenuItem
                      onSelect={() => void remove(member.user_id)}
                      className="text-danger flex items-center gap-2"
                    >
                      <UserMinus
                        aria-hidden="true"
                        className="h-4 w-4"
                      />
                      Remove from class
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
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

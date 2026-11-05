import { Mail, ShieldCheck, Users } from "lucide-react";
import Link from "next/link";

import { AdminUserCell } from "@/components/admin/admin-user-cell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ClassMemberView } from "@/lib/db/classes";
import { formatDate, pluralize } from "@starstask/shared";

type ClassMembersTabProps = {
  classSlug: string;
  members: ClassMemberView[];
  canManage: boolean;
  currentUserId: string;
  /** Set on course pages: membership is inherited, never per course. */
  inheritedFromClassName?: string;
};

export function ClassMembersTab({
  classSlug,
  members,
  canManage,
  currentUserId,
  inheritedFromClassName,
}: ClassMembersTabProps) {
  const base = `/app/classes/${classSlug}`;
  const adminCount = members.filter((member) => member.is_admin).length;
  const sorted = [...members].sort((first, second) => {
    if (first.is_admin !== second.is_admin) {
      return first.is_admin ? -1 : 1;
    }

    return first.display_name.localeCompare(second.display_name);
  });

  return (
    <section
      aria-labelledby="class-members"
      className="mt-6"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2
            id="class-members"
            className="inline-flex items-center gap-2 text-lg font-semibold tracking-tight"
          >
            <Users
              aria-hidden="true"
              className="h-4 w-4"
            />
            Members
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            {members.length} {pluralize(members.length, "member")} ·{" "}
            {adminCount} {pluralize(adminCount, "class admin")}.{" "}
            {inheritedFromClassName
              ? `Everyone here joined ${inheritedFromClassName}; courses do not have separate memberships.`
              : "Only names and join dates are shown here."}
          </p>
        </div>

        {canManage ? (
          <div className="flex flex-wrap gap-2">
            <Button
              asChild
              size="sm"
              variant="secondary"
            >
              <Link href={`${base}/manage?tab=invites`}>
                <Mail
                  aria-hidden="true"
                  className="h-4 w-4"
                />
                Invite people
              </Link>
            </Button>
            <Button
              asChild
              size="sm"
              variant="secondary"
            >
              <Link href={`${base}/manage?tab=members`}>
                <ShieldCheck
                  aria-hidden="true"
                  className="h-4 w-4"
                />
                Manage members
              </Link>
            </Button>
          </div>
        ) : null}
      </div>

      {sorted.length === 0 ? (
        <div className="border-border bg-surface mt-4 rounded-xl border border-dashed px-6 py-10 text-center">
          <p className="text-sm font-medium">No members yet</p>
          <p className="text-muted-foreground mx-auto mt-1 max-w-sm text-xs">
            {canManage
              ? "Create an invitation link to add the first member."
              : "Members appear here once they join the class."}
          </p>
        </div>
      ) : (
        <>
          <div className="border-border bg-surface mt-4 hidden overflow-x-auto rounded-xl border md:block">
            <table className="w-full text-sm">
              <caption className="sr-only">
                Members of this class with their role and join date
              </caption>
              <thead className="bg-subtle text-muted-foreground">
                <tr className="text-left text-xs font-medium tracking-wide uppercase">
                  <th
                    scope="col"
                    className="px-4 py-2.5"
                  >
                    Member
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-2.5"
                  >
                    Role
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-2.5"
                  >
                    Joined
                  </th>
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {sorted.map((member) => (
                  <tr
                    key={member.user_id}
                    className="hover:bg-muted/40"
                  >
                    <td className="px-4 py-3">
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
                    </td>
                    <td className="px-4 py-3">
                      <MemberRole isAdmin={member.is_admin} />
                    </td>
                    <td className="text-muted-foreground px-4 py-3 whitespace-nowrap">
                      {formatDate(member.joined_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="divide-border border-border bg-surface mt-4 divide-y rounded-xl border md:hidden">
            {sorted.map((member) => (
              <li
                key={member.user_id}
                className="flex items-start justify-between gap-3 px-4 py-3"
              >
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
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <MemberRole isAdmin={member.is_admin} />
                  <span className="text-muted-foreground text-xs">
                    Joined {formatDate(member.joined_at)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function MemberRole({ isAdmin }: { isAdmin: boolean }) {
  if (isAdmin) {
    return (
      <Badge variant="accent">
        <ShieldCheck
          aria-hidden="true"
          className="h-3 w-3"
        />
        Class admin
      </Badge>
    );
  }

  return <Badge variant="neutral">Member</Badge>;
}

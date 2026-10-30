import { Compass, FileText, GraduationCap, Mail, Upload } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils/cn";

type QuickActionsProps = {
  pendingInvitationsCount?: number;
};

export function QuickActions({
  pendingInvitationsCount = 0,
}: QuickActionsProps) {
  const actions = [
    {
      href: "/classes",
      label: "My Classes",
      description: "Open your active class groups",
      icon: GraduationCap,
    },
    {
      href: "/classes/discover",
      label: "Browse Classes",
      description: "Discover public classes",
      icon: Compass,
    },
    {
      href: "/assignments",
      label: "Assignments",
      description: "Explore all assignments",
      icon: Upload,
    },
    {
      href: "/my-assignments",
      label: "My Submissions",
      description: "Check review and status",
      icon: FileText,
    },
  ];

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
          Quick actions
        </h2>
        {pendingInvitationsCount > 0 ? (
          <span className="text-accent inline-flex items-center gap-1.5 text-xs font-medium">
            <Mail
              aria-hidden="true"
              className="h-3.5 w-3.5"
            />
            {pendingInvitationsCount}{" "}
            {pendingInvitationsCount === 1
              ? "pending invitation"
              : "pending invitations"}
          </span>
        ) : null}
      </div>

      <div className="mt-2.5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {actions.map((action) => {
          const Icon = action.icon;

          return (
            <Link
              key={action.href}
              href={action.href}
              className={cn(
                "border-border bg-surface hover:border-accent/40 hover:bg-hover focus-visible:outline-accent",
                "group flex flex-col justify-between rounded-xl border p-3.5 transition-all focus-visible:outline-2 focus-visible:outline-offset-2",
              )}
            >
              <div className="flex items-center justify-between">
                <span className="bg-subtle text-foreground group-hover:bg-accent-soft group-hover:text-accent flex h-8 w-8 items-center justify-center rounded-lg transition-colors">
                  <Icon
                    aria-hidden="true"
                    className="h-4 w-4"
                  />
                </span>
              </div>
              <div className="mt-3">
                <p className="text-foreground group-hover:text-accent text-sm font-semibold transition-colors">
                  {action.label}
                </p>
                <p className="text-muted-foreground mt-0.5 line-clamp-2 text-xs">
                  {action.description}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

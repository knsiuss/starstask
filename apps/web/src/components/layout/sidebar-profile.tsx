import { ChevronRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { cn } from "@/lib/utils/cn";

type SidebarProfileProps = {
  displayName: string;
  email: string | null;
  avatarUrl: string | null;
  /** Icon-only rendering for the collapsed desktop sidebar. */
  compact?: boolean;
};

function initialsFor(displayName: string): string {
  const initials = displayName
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return initials || "ST";
}

/**
 * Account card anchored to the bottom of the desktop sidebar.
 *
 * It links to the profile page rather than opening a menu: the topbar already
 * owns the account menu, so a second identical dropdown would just be a trap.
 */
export function SidebarProfile({
  displayName,
  email,
  avatarUrl,
  compact = false,
}: SidebarProfileProps) {
  return (
    <div className="border-border border-t p-3">
      <Link
        href="/settings/profile"
        aria-label={compact ? `${displayName} profile` : undefined}
        title={compact ? displayName : undefined}
        className={cn(
          "hover:bg-hover focus-visible:outline-accent flex items-center gap-3 rounded-lg px-2 py-2 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2",
          compact && "justify-center px-1",
        )}
      >
        {avatarUrl ? (
          <Image
            src={avatarUrl}
            alt=""
            width={36}
            height={36}
            className="h-9 w-9 shrink-0 rounded-full"
            referrerPolicy="no-referrer"
          />
        ) : (
          <span
            aria-hidden="true"
            className="bg-accent-soft text-accent flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
          >
            {initialsFor(displayName)}
          </span>
        )}{" "}
        {compact ? null : (
          <>
            <span className="min-w-0 flex-1">
              <span className="text-foreground block truncate text-[13px] font-semibold">
                {displayName}
              </span>
              {email ? (
                <span className="text-muted-foreground block truncate text-[11px]">
                  {email}
                </span>
              ) : null}
            </span>
            <ChevronRight
              aria-hidden="true"
              className="text-muted-foreground/60 h-4 w-4 shrink-0"
            />
          </>
        )}
      </Link>
    </div>
  );
}

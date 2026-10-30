"use client";

import {
  Bell,
  ChevronDown,
  LogOut,
  ShieldCheck,
  Terminal,
  UserRound,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type UserMenuProps = {
  displayName: string;
  avatarUrl: string | null;
  /** Renders the platform console entry; /admin re-checks the role. */
  isPlatformAdmin?: boolean;
  /** Renders the developer-console entry; the route re-verifies the email. */
  isDeveloper?: boolean;
};

export function UserMenu({
  displayName,
  avatarUrl,
  isPlatformAdmin = false,
  isDeveloper = false,
}: UserMenuProps) {
  const initials = displayName
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  // Radix unmounts the menu content the instant an item is selected, which
  // silently cancels a native form submit rendered inside it. The POST is
  // therefore issued explicitly, and refresh() re-fetches the server tree so
  // no server component rendered for the signed-in viewer survives.
  const router = useRouter();
  const signOut = () => {
    void fetch("/api/auth/signout", { method: "POST" })
      .catch(() => null)
      .finally(() => {
        router.push("/");
        router.refresh();
      });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="hover:bg-muted focus-visible:outline-accent flex items-center gap-2 rounded-md border border-transparent px-2 py-1.5 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2"
        aria-label={`Account menu for ${displayName}`}
      >
        {avatarUrl ? (
          <Image
            src={avatarUrl}
            alt=""
            width={28}
            height={28}
            className="h-7 w-7 rounded-full"
            referrerPolicy="no-referrer"
          />
        ) : (
          <span
            aria-hidden="true"
            className="bg-accent-soft text-accent flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold"
          >
            {initials || "ST"}
          </span>
        )}
        <span className="hidden max-w-32 truncate sm:block">{displayName}</span>
        <ChevronDown
          aria-hidden="true"
          className="text-muted-foreground h-4 w-4"
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel className="truncate">
          {displayName}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link
            href="/my-assignments"
            className="flex items-center gap-2"
          >
            <UserRound
              aria-hidden="true"
              className="h-4 w-4"
            />
            My assignments
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link
            href="/settings/notifications"
            className="flex items-center gap-2"
          >
            <Bell
              aria-hidden="true"
              className="h-4 w-4"
            />
            Notification settings
          </Link>
        </DropdownMenuItem>
        {isPlatformAdmin ? (
          <DropdownMenuItem asChild>
            <Link
              href="/admin"
              className="flex items-center gap-2"
            >
              <ShieldCheck
                aria-hidden="true"
                className="h-4 w-4"
              />
              Platform console
            </Link>
          </DropdownMenuItem>
        ) : null}
        {isDeveloper ? (
          <DropdownMenuItem asChild>
            <Link
              href="/developer"
              className="flex items-center gap-2"
            >
              <Terminal
                aria-hidden="true"
                className="h-4 w-4"
              />
              Developer console
            </Link>
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={(event) => {
            event.preventDefault();
            signOut();
          }}
          className="flex items-center gap-2"
        >
          <LogOut
            aria-hidden="true"
            className="h-4 w-4"
          />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

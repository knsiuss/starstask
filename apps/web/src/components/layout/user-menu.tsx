"use client";

import { Bell, ChevronDown, LogOut, PlusCircle, UserRound } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

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
};

export function UserMenu({ displayName, avatarUrl }: UserMenuProps) {
  const initials = displayName
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

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
            href="/submit"
            className="flex items-center gap-2"
          >
            <PlusCircle
              aria-hidden="true"
              className="h-4 w-4"
            />
            Submit assignment
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
        <DropdownMenuSeparator />
        <form
          action="/api/auth/signout"
          method="post"
        >
          <DropdownMenuItem asChild>
            <button
              type="submit"
              className="flex w-full items-center gap-2 text-left text-sm"
            >
              <LogOut
                aria-hidden="true"
                className="h-4 w-4"
              />
              Sign out
            </button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

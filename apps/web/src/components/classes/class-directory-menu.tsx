"use client";

import { Ellipsis, LayoutDashboard, ShieldCheck } from "lucide-react";
import Link from "next/link";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type ClassDirectoryMenuProps = {
  classSlug: string;
  className: string;
  isAdmin: boolean;
};

/**
 * Per-card actions. Only destinations the caller can actually open are listed,
 * so the menu never shows a control that would fail authorization.
 */
export function ClassDirectoryMenu({
  classSlug,
  className,
  isAdmin,
}: ClassDirectoryMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Actions for ${className}`}
        className="text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-accent flex h-8 w-8 items-center justify-center rounded-md focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        <Ellipsis
          aria-hidden="true"
          className="h-4 w-4"
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link
            href={`/dashboard/classes/${classSlug}`}
            className="flex items-center gap-2"
          >
            <LayoutDashboard
              aria-hidden="true"
              className="h-4 w-4"
            />
            Class workspace
          </Link>
        </DropdownMenuItem>
        {isAdmin ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link
                href={`/dashboard/classes/${classSlug}/manage`}
                className="flex items-center gap-2"
              >
                <ShieldCheck
                  aria-hidden="true"
                  className="h-4 w-4"
                />
                Manage class
              </Link>
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

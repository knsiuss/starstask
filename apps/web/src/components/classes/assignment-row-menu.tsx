"use client";

import { ClipboardCheck, Eye, MoreHorizontal, Pencil } from "lucide-react";
import Link from "next/link";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type AssignmentRowMenuProps = {
  assignmentId: string;
  assignmentTitle: string;
  classSlug: string;
};

/**
 * The "…" actions menu on an assignment row. Only rendered for class admins,
 * who are the only users with Edit/Review destinations; the row itself is
 * already clickable for everyone else.
 */
export function AssignmentRowMenu({
  assignmentId,
  assignmentTitle,
  classSlug,
}: AssignmentRowMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Actions for ${assignmentTitle}`}
          className="text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-accent relative z-10 flex min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center rounded-lg transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 sm:h-9 sm:min-h-0 sm:w-9 sm:min-w-0"
        >
          <MoreHorizontal
            aria-hidden="true"
            className="h-4 w-4"
          />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link
            href={`/assignments/${assignmentId}`}
            className="flex min-h-[44px] items-center gap-2 sm:min-h-0"
          >
            <Eye
              aria-hidden="true"
              className="h-3.5 w-3.5"
            />
            Open assignment
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link
            href={`/assignments/${assignmentId}/edit`}
            className="flex min-h-[44px] items-center gap-2 sm:min-h-0"
          >
            <Pencil
              aria-hidden="true"
              className="h-3.5 w-3.5"
            />
            Edit
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link
            href={`/app/classes/${classSlug}/review/${assignmentId}`}
            className="flex min-h-[44px] items-center gap-2 sm:min-h-0"
          >
            <ClipboardCheck
              aria-hidden="true"
              className="h-3.5 w-3.5"
            />
            Review
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

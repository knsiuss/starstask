"use client";

import {
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  ExternalLink,
  GraduationCap,
  Info,
  Mail,
  MoreHorizontal,
  PlusCircle,
  Settings,
  Users,
} from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type ClassWorkspaceActionsProps = {
  classSlug: string;
  canManage: boolean;
  isActive: boolean;
};

/**
 * Primary class actions plus a secondary menu. Every entry points at an
 * existing route; nothing here is a placeholder. Actions follow the member's
 * role in this class only — the routes re-check authorization server-side.
 */
export function ClassWorkspaceActions({
  classSlug,
  canManage,
  isActive,
}: ClassWorkspaceActionsProps) {
  const base = `/app/classes/${classSlug}`;

  return (
    <div className="flex flex-wrap items-center justify-start gap-2 sm:justify-end">
      {canManage ? (
        <>
          <Button
            asChild
            variant="secondary"
            size="sm"
          >
            <Link href={`${base}/manage`}>
              <Settings
                aria-hidden="true"
                className="h-4 w-4"
              />
              Manage class
            </Link>
          </Button>
          {isActive ? (
            <Button
              asChild
              size="sm"
            >
              <Link href={`${base}/submit`}>
                <PlusCircle
                  aria-hidden="true"
                  className="h-4 w-4"
                />
                Post assignment
              </Link>
            </Button>
          ) : null}
        </>
      ) : (
        <>
          <Button
            asChild
            variant="secondary"
            size="sm"
          >
            <Link href={`${base}?tab=info`}>
              <Info
                aria-hidden="true"
                className="h-4 w-4"
              />
              View Class Information
            </Link>
          </Button>
          {isActive ? (
            <Button
              asChild
              size="sm"
            >
              <Link href={`${base}/submit`}>
                <PlusCircle
                  aria-hidden="true"
                  className="h-4 w-4"
                />
                Request Assignment Publication
              </Link>
            </Button>
          ) : null}
        </>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="sm"
            variant="secondary"
            aria-label="More class actions"
          >
            <MoreHorizontal
              aria-hidden="true"
              className="h-4 w-4"
            />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {canManage ? (
            <>
              <DropdownMenuLabel>Manage</DropdownMenuLabel>
              <DropdownMenuItem asChild>
                <Link
                  href={`${base}/manage?tab=content&status=pending_review#review-queue`}
                  className="flex items-center gap-2"
                >
                  <ClipboardCheck
                    aria-hidden="true"
                    className="h-3.5 w-3.5"
                  />
                  Review queue
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link
                  href={`${base}/manage?tab=invites`}
                  className="flex items-center gap-2"
                >
                  <Mail
                    aria-hidden="true"
                    className="h-3.5 w-3.5"
                  />
                  Invitations
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link
                  href={`${base}/manage?tab=members`}
                  className="flex items-center gap-2"
                >
                  <Users
                    aria-hidden="true"
                    className="h-3.5 w-3.5"
                  />
                  Members
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link
                  href={`${base}/manage?tab=settings`}
                  className="flex items-center gap-2"
                >
                  <Settings
                    aria-hidden="true"
                    className="h-3.5 w-3.5"
                  />
                  Class settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link
                  href={`${base}/leave-requests`}
                  className="flex items-center gap-2"
                >
                  <ClipboardList
                    aria-hidden="true"
                    className="h-3.5 w-3.5"
                  />
                  Absence requests
                </Link>
              </DropdownMenuItem>
            </>
          ) : (
            <>
              <DropdownMenuItem asChild>
                <Link
                  href={`/leave-requests/new?class=${classSlug}`}
                  className="flex items-center gap-2"
                >
                  <ClipboardList
                    aria-hidden="true"
                    className="h-3.5 w-3.5"
                  />
                  Request absence
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}

          <DropdownMenuItem asChild>
            <Link
              href={`${base}/sessions`}
              className="flex items-center gap-2"
            >
              <CalendarDays
                aria-hidden="true"
                className="h-3.5 w-3.5"
              />
              Sessions
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link
              href={`/classes/${classSlug}`}
              className="flex items-center gap-2"
            >
              <ExternalLink
                aria-hidden="true"
                className="h-3.5 w-3.5"
              />
              Public class page
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link
              href="/classes/discover"
              className="flex items-center gap-2"
            >
              <GraduationCap
                aria-hidden="true"
                className="h-3.5 w-3.5"
              />
              Browse classes
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

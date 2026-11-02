"use client";

import {
  Megaphone,
  MoreHorizontal,
  Pencil,
  PlusCircle,
  Upload,
  Eye,
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

type CourseAdminMenuProps = {
  classSlug: string;
  courseId: string;
  courseStatus: "active" | "archived";
  classActive: boolean;
};

/**
 * Course-scoped actions for class admins.
 *
 * Every entry either creates content inside this course or changes the course
 * itself, so nothing here can post to the parent class by accident.
 */
export function CourseAdminMenu({
  classSlug,
  courseId,
  courseStatus,
  classActive,
}: CourseAdminMenuProps) {
  const base = `/dashboard/classes/${classSlug}/courses/${courseId}`;
  const canCreate = classActive && courseStatus === "active";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="sm"
          variant="secondary"
          aria-label="Course actions"
        >
          <MoreHorizontal
            aria-hidden="true"
            className="h-4 w-4"
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {canCreate ? (
          <>
            <DropdownMenuLabel>Add to this course</DropdownMenuLabel>
            <DropdownMenuItem asChild>
              <Link
                href={`/dashboard/classes/${classSlug}/submit?course=${courseId}`}
                className="flex items-center gap-2"
              >
                <PlusCircle
                  aria-hidden="true"
                  className="h-3.5 w-3.5"
                />
                Create assignment
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link
                href={`${base}/materials?compose=material`}
                className="flex items-center gap-2"
              >
                <Upload
                  aria-hidden="true"
                  className="h-3.5 w-3.5"
                />
                Upload material
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link
                href={`/dashboard/classes/${classSlug}/submit?course=${courseId}&type=class_announcement`}
                className="flex items-center gap-2"
              >
                <Megaphone
                  aria-hidden="true"
                  className="h-3.5 w-3.5"
                />
                Create announcement
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        ) : null}

        <DropdownMenuItem asChild>
          <Link
            href={`${base}/settings`}
            className="flex items-center gap-2"
          >
            <Pencil
              aria-hidden="true"
              className="h-3.5 w-3.5"
            />
            Edit course information
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link
            href={`${base}/settings#visibility`}
            className="flex items-center gap-2"
          >
            <Eye
              aria-hidden="true"
              className="h-3.5 w-3.5"
            />
            Manage course visibility
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

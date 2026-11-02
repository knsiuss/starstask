"use client";

import {
  Eye,
  Loader2,
  Megaphone,
  MoreHorizontal,
  Pencil,
  PlusCircle,
  Trash2,
  Upload,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
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
  const router = useRouter();
  const base = `/dashboard/classes/${classSlug}/courses/${courseId}`;
  const canCreate = classActive && courseStatus === "active";

  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);
  const [hasRecords, setHasRecords] = React.useState(false);
  // Without this flag the menu returns focus to its trigger after closing and
  // steals it from the dialog that the delete item just opened.
  const keepFocusInDialog = React.useRef(false);

  const openDeleteDialog = () => {
    setDeleteError(null);
    setHasRecords(false);
    setConfirmOpen(true);
  };

  const deleteCourse = async () => {
    if (isDeleting) {
      return;
    }

    setIsDeleting(true);
    setDeleteError(null);
    setHasRecords(false);

    try {
      const response = await fetch(
        `/api/classes/${classSlug}/subjects/${courseId}`,
        { method: "DELETE" },
      );
      const body = (await response.json().catch(() => null)) as {
        error?: { code?: string; message?: string };
      } | null;

      if (!response.ok) {
        setDeleteError(body?.error?.message ?? "Could not delete the course.");
        setHasRecords(body?.error?.code === "course_has_records");
        return;
      }

      setConfirmOpen(false);
      router.push(`/dashboard/classes/${classSlug}`);
      router.refresh();
    } catch {
      setDeleteError("Network error. Check your connection and try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  const menu = (
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
      <DropdownMenuContent
        align="end"
        onCloseAutoFocus={(event) => {
          if (keepFocusInDialog.current) {
            keepFocusInDialog.current = false;
            event.preventDefault();
          }
        }}
      >
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
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => {
            keepFocusInDialog.current = true;
            openDeleteDialog();
          }}
          className="text-danger flex items-center gap-2"
        >
          <Trash2
            aria-hidden="true"
            className="h-3.5 w-3.5"
          />
          Delete course
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <>
      {menu}

      <Dialog
        open={confirmOpen}
        onOpenChange={(next) => {
          setConfirmOpen(next);

          if (!next) {
            setDeleteError(null);
            setHasRecords(false);
          }
        }}
      >
        <DialogContent>
          <DialogTitle>Delete this course?</DialogTitle>
          <DialogDescription>
            Only an empty course can be deleted permanently. If it already has
            assignments, materials, meetings, or schedule entries, archive it
            instead so the academic history stays available.
          </DialogDescription>

          {deleteError ? (
            <Alert
              variant={hasRecords ? "warning" : "error"}
              className="mt-4"
            >
              {deleteError}
            </Alert>
          ) : null}

          <div className="mt-6 flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setConfirmOpen(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            {hasRecords ? (
              <Button
                asChild
                variant="secondary"
              >
                <Link href={`${base}/settings#visibility`}>
                  Archive instead
                </Link>
              </Button>
            ) : (
              <Button
                type="button"
                variant="danger"
                onClick={() => void deleteCourse()}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <Loader2
                    aria-hidden="true"
                    className="mr-1.5 h-3.5 w-3.5 animate-spin"
                  />
                ) : (
                  <Trash2
                    aria-hidden="true"
                    className="mr-1.5 h-3.5 w-3.5"
                  />
                )}
                Delete course
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

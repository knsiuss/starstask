"use client";

import { ChevronDown, Plus } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type ManagedClassItem = {
  id: string;
  slug: string;
  name: string;
};

/**
 * Primary action for class admins on `/attendance` to jump straight to
 * creating a new attendance session for their class.
 */
export function CreatePresenceButton({
  classes,
}: {
  classes: ManagedClassItem[];
}) {
  const firstClass = classes[0];

  if (!firstClass) {
    return null;
  }

  if (classes.length === 1) {
    return (
      <Button
        asChild
        size="sm"
      >
        <Link
          href={`/app/classes/${firstClass.slug}/attendance#create-attendance`}
        >
          <Plus
            aria-hidden="true"
            className="h-3.5 w-3.5"
          />
          Create presence
        </Link>
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm">
          <Plus
            aria-hidden="true"
            className="h-3.5 w-3.5"
          />
          Create presence
          <ChevronDown
            aria-hidden="true"
            className="h-3.5 w-3.5"
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {classes.map((classItem) => (
          <DropdownMenuItem
            key={classItem.id}
            asChild
          >
            <Link
              href={`/app/classes/${classItem.slug}/attendance#create-attendance`}
            >
              {classItem.name}
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

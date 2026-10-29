"use client";

import { Menu } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { BrandLink } from "@/components/layout/brand-link";
import { WorkspaceNav } from "@/components/layout/workspace-nav";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type MobileNavProps = {
  isAuthenticated: boolean;
  isPlatformAdmin: boolean;
};

export function MobileNav({
  isAuthenticated,
  isPlatformAdmin,
}: MobileNavProps) {
  const [isOpen, setIsOpen] = useState(false);

  const close = () => setIsOpen(false);

  return (
    <Dialog
      open={isOpen}
      onOpenChange={setIsOpen}
    >
      <DialogTrigger
        aria-label="Open navigation"
        className="text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-accent -ml-1 rounded-md p-2 focus-visible:outline-2 focus-visible:outline-offset-2 lg:hidden"
      >
        <Menu
          aria-hidden="true"
          className="h-5 w-5"
        />
      </DialogTrigger>

      {/* Anchored to the left edge and full height so it reads as a drawer. */}
      <DialogContent className="top-0 left-0 h-dvh w-[86%] max-w-[300px] translate-x-0 translate-y-0 rounded-none p-5">
        <DialogTitle className="sr-only">Navigation</DialogTitle>

        <div className="flex h-full flex-col">
          <div className="pr-10">
            <BrandLink showTagline />
          </div>

          <nav
            aria-label="Mobile workspace"
            className="mt-7 flex-1 overflow-y-auto"
          >
            <WorkspaceNav
              isAuthenticated={isAuthenticated}
              isPlatformAdmin={isPlatformAdmin}
              onNavigate={close}
            />
          </nav>

          {isAuthenticated ? null : (
            <div className="border-border mt-4 border-t pt-4">
              <p className="text-muted-foreground text-xs leading-relaxed">
                Sign in to submit assignments and follow your submissions.
              </p>
              <Button
                asChild
                className="mt-3 w-full"
                size="sm"
              >
                <Link
                  href="/login"
                  onClick={close}
                >
                  Sign in
                </Link>
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

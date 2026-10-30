"use client";

import { Menu } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { BrandLink } from "@/components/layout/brand-link";
import { NavLink } from "@/components/layout/nav-link";
import {
  SITE_LINKS,
  SITE_MEMBER_LINKS,
} from "@/components/layout/site-nav-links";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type SiteMobileNavProps = {
  isAuthenticated: boolean;
};

/** Drawer for public routes, where the desktop link row does not fit. */
export function SiteMobileNav({ isAuthenticated }: SiteMobileNavProps) {
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
            aria-label="Site"
            className="mt-7 flex-1 overflow-y-auto"
          >
            {isAuthenticated ? (
              <div>
                <p className="text-muted-foreground px-3 text-[11px] font-medium tracking-[0.08em] uppercase">
                  Workspace
                </p>
                <ul className="mt-2 space-y-1">
                  {SITE_MEMBER_LINKS.map((link) => (
                    <li key={link.href}>
                      <NavLink
                        href={link.href}
                        onClick={close}
                      >
                        {link.label}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className={isAuthenticated ? "mt-7" : undefined}>
              <p className="text-muted-foreground px-3 text-[11px] font-medium tracking-[0.08em] uppercase">
                Browse
              </p>
              <ul className="mt-2 space-y-1">
                {SITE_LINKS.map((link) => (
                  <li key={link.href}>
                    <NavLink
                      href={link.href}
                      onClick={close}
                    >
                      {link.label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
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

"use client";

import { usePathname } from "next/navigation";

import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";

/**
 * The header's sign-in CTA. It is suppressed on the sign-in route itself, where
 * the page already presents the identical button: one primary action per
 * screen, and the sign-in page keeps exactly the markup it had before the
 * header offered Google sign-in at all.
 */
export function HeaderSignIn() {
  const pathname = usePathname();

  if (pathname === "/login") {
    return null;
  }

  return (
    <div className="hidden sm:block">
      <GoogleSignInButton
        nextPath="/assignments"
        size="sm"
        className="w-auto"
        wrapperClassName="space-y-0"
      />
    </div>
  );
}

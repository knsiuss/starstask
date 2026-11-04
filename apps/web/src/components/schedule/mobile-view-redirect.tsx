"use client";

import { useRouter } from "next/navigation";
import * as React from "react";

/**
 * Mobile opens the calendar in agenda (list) view: bars and seven
 * columns are unreadable at phone width, while the grouped list is the
 * natural first surface. Only fires when the URL carries no explicit
 * view, so bookmarks and shared links keep their intended view.
 */
export function MobileViewRedirect({
  hasExplicitView,
}: {
  hasExplicitView: boolean;
}) {
  const router = useRouter();

  React.useEffect(() => {
    if (hasExplicitView) {
      return;
    }

    if (!window.matchMedia("(max-width: 639px)").matches) {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    params.set("view", "list");
    router.replace(`/schedule?${params.toString()}`);
  }, [hasExplicitView, router]);

  return null;
}

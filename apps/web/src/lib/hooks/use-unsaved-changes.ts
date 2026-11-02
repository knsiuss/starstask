"use client";

import * as React from "react";

const LEAVE_MESSAGE = "You have unsaved changes. Leave without saving?";

/**
 * Warns before an edit in progress is thrown away.
 *
 * `beforeunload` covers reloads and closed tabs. Client-side navigation does not
 * fire it, so same-origin link clicks are intercepted while the form is dirty and
 * the user has to confirm. Hash-only links and new-tab clicks are left alone.
 */
export function useUnsavedChanges(isDirty: boolean) {
  React.useEffect(() => {
    if (!isDirty) {
      return;
    }

    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    const guardNavigation = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const target = event.target;

      if (!(target instanceof Element)) {
        return;
      }

      const anchor = target.closest("a[href]");

      if (!(anchor instanceof HTMLAnchorElement)) {
        return;
      }

      if (anchor.target && anchor.target !== "_self") {
        return;
      }

      if (anchor.hasAttribute("download")) {
        return;
      }

      const destination = new URL(anchor.href, window.location.href);

      if (destination.origin !== window.location.origin) {
        return;
      }

      const isSamePage =
        destination.pathname === window.location.pathname &&
        destination.search === window.location.search;

      if (isSamePage) {
        return;
      }

      if (window.confirm(LEAVE_MESSAGE)) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
    };

    window.addEventListener("beforeunload", warnBeforeUnload);
    document.addEventListener("click", guardNavigation, true);

    return () => {
      window.removeEventListener("beforeunload", warnBeforeUnload);
      document.removeEventListener("click", guardNavigation, true);
    };
  }, [isDirty]);
}

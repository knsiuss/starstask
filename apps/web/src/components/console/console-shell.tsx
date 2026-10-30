import type { ReactNode } from "react";

import { BrandLink } from "@/components/layout/brand-link";
import { UserMenu } from "@/components/layout/user-menu";

type ConsoleShellProps = {
  /** Short label shown next to the brand, e.g. "Platform console". */
  label: string;
  /** Section navigation, rendered compact on mobile and vertical on desktop. */
  nav: ReactNode;
  displayName: string;
  avatarUrl: string | null;
  isPlatformAdmin: boolean;
  isDeveloper: boolean;
  children: ReactNode;
};

/**
 * Full-page chrome for the operator consoles.
 *
 * The admin and developer sections deliberately do not reuse the student
 * workspace shell: one sidebar should mean one job. Each console keeps its own
 * navigation and a single explicit way back to the student app.
 */
export function ConsoleShell({
  label,
  nav,
  displayName,
  avatarUrl,
  isPlatformAdmin,
  isDeveloper,
  children,
}: ConsoleShellProps) {
  return (
    <div className="bg-background min-h-dvh">
      <header className="border-border bg-surface/90 sticky top-0 z-30 border-b backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-[1400px] items-center gap-3 px-4 sm:px-6 lg:px-8">
          <BrandLink />
          <span className="bg-accent-soft text-accent hidden rounded-full px-2.5 py-0.5 text-xs font-medium sm:inline-flex">
            {label}
          </span>

          <div className="ml-auto flex items-center gap-2">
            <UserMenu
              displayName={displayName}
              avatarUrl={avatarUrl}
              isPlatformAdmin={isPlatformAdmin}
              isDeveloper={isDeveloper}
            />
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 px-4 py-6 sm:px-6 lg:flex-row lg:gap-8 lg:px-8 lg:py-8">
        <aside className="shrink-0 lg:w-[240px]">
          <div className="lg:sticky lg:top-24">{nav}</div>
        </aside>

        <main
          id="main-content"
          className="min-w-0 flex-1"
        >
          {children}
        </main>
      </div>
    </div>
  );
}

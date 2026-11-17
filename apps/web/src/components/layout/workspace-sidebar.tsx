"use client";

import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import * as React from "react";

import { BrandLink } from "@/components/layout/brand-link";
import { SidebarProfile } from "@/components/layout/sidebar-profile";
import { WorkspaceNav } from "@/components/layout/workspace-nav";
import { cn } from "@/lib/utils/cn";

type WorkspaceSidebarProps = {
  isAuthenticated: boolean;
  isClassAdmin: boolean;
  isLecturer?: boolean;
  displayName: string;
  email: string | null;
  avatarUrl: string | null;
  showUniversityInfo?: boolean;
};

const COLLAPSE_STORAGE_KEY = "starstask:sidebar-collapsed";

export function WorkspaceSidebar({
  isAuthenticated,
  isClassAdmin,
  isLecturer = false,
  displayName,
  email,
  avatarUrl,
  showUniversityInfo = false,
}: WorkspaceSidebarProps) {
  const [isCollapsed, setIsCollapsed] = React.useState(false);

  React.useEffect(() => {
    const stored = window.localStorage.getItem(COLLAPSE_STORAGE_KEY);

    // Restoring is deferred past paint: a synchronous setState here trips the
    // cascading-render lint, and doing it during render would desync hydration
    // because the server always renders the expanded sidebar.
    const frame = requestAnimationFrame(() => {
      setIsCollapsed(stored === "true");
    });

    return () => cancelAnimationFrame(frame);
  }, []);

  const toggle = () => {
    const next = !isCollapsed;

    setIsCollapsed(next);
    window.localStorage.setItem(COLLAPSE_STORAGE_KEY, String(next));
  };

  return (
    <aside
      className={cn(
        "border-border bg-surface sticky top-0 hidden h-dvh shrink-0 flex-col border-r transition-[width] lg:flex",
        isCollapsed ? "w-[76px]" : "w-[260px]",
      )}
    >
      <div
        className={cn(
          "flex items-center gap-2 px-3 py-4",
          isCollapsed && "flex-col px-2",
        )}
      >
        <BrandLink
          className={cn(
            "min-w-0",
            isCollapsed && "justify-center [&>span:last-child]:hidden",
          )}
          showTagline={!isCollapsed}
        />
        {!isCollapsed ? <span className="flex-1" /> : null}
        <button
          type="button"
          onClick={toggle}
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-accent flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          {isCollapsed ? (
            <PanelLeftOpen
              aria-hidden="true"
              className="h-4 w-4"
            />
          ) : (
            <PanelLeftClose
              aria-hidden="true"
              className="h-4 w-4"
            />
          )}
        </button>
      </div>

      <nav
        aria-label="Workspace"
        className="flex-1 overflow-y-auto px-2 pb-6"
      >
        <WorkspaceNav
          isAuthenticated={isAuthenticated}
          isClassAdmin={isClassAdmin}
          isLecturer={isLecturer}
          compact={isCollapsed}
          showUniversityInfo={showUniversityInfo}
        />
      </nav>

      {isAuthenticated ? (
        <SidebarProfile
          displayName={displayName}
          email={email}
          avatarUrl={avatarUrl}
          compact={isCollapsed}
        />
      ) : null}
    </aside>
  );
}

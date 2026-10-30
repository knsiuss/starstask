import { BrandLink } from "@/components/layout/brand-link";
import { WorkspaceNav } from "@/components/layout/workspace-nav";

type WorkspaceSidebarProps = {
  isAuthenticated: boolean;
};

export function WorkspaceSidebar({ isAuthenticated }: WorkspaceSidebarProps) {
  return (
    <aside className="border-border bg-surface sticky top-0 hidden h-dvh w-[260px] shrink-0 flex-col border-r lg:flex">
      <div className="px-4 py-5">
        <BrandLink showTagline />
      </div>
      <nav
        aria-label="Workspace"
        className="flex-1 overflow-y-auto px-2 pb-6"
      >
        <WorkspaceNav isAuthenticated={isAuthenticated} />
      </nav>
    </aside>
  );
}

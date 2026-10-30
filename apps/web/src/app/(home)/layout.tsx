import type { ReactNode } from "react";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";

/**
 * The landing page keeps the full marketing chrome, including the footer.
 * Other public routes (invite, login, class detail) use the bare `(site)`
 * layout so a focused task page is not buried under landing-page furniture.
 */
export default function HomeLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main
        id="main-content"
        className="flex-1"
      >
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}

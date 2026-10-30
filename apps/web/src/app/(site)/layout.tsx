import type { ReactNode } from "react";

import { SiteHeader } from "@/components/layout/site-header";

/**
 * Public task pages (invite, login, class detail) get the header but no
 * footer: the footer's landing-page link groups are noise on a page whose
 * single job is one action. The footer now lives only in the `(home)` group.
 */
export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main
        id="main-content"
        className="flex-1"
      >
        {children}
      </main>
    </div>
  );
}

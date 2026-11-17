import Link from "next/link";

import { BrandMark } from "@/components/layout/brand-mark";

/**
 * Three balanced columns matching `grid-cols-3` so no group wraps onto an
 * orphan second row.
 */
const FOOTER_GROUPS = [
  {
    heading: "Archive",
    links: [
      { href: "/assignments", label: "Assignments" },
      { href: "/classes/discover", label: "Classes" },
      { href: "/download", label: "Android app" },
    ],
  },
  {
    heading: "Guide",
    links: [
      { href: "/#how-it-works", label: "How it works" },
      { href: "/#faq", label: "FAQ" },
      { href: "/login", label: "Sign in" },
    ],
  },
  {
    heading: "Legal",
    links: [
      { href: "/privacy", label: "Privacy" },
      { href: "/terms", label: "Terms" },
    ],
  },
] as const;

export function SiteFooter() {
  return (
    <footer className="border-border bg-subtle border-t">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1.8fr)]">
          <div className="max-w-xs">
            <Link
              href="/"
              className="text-foreground inline-flex items-center gap-2 text-sm font-semibold tracking-tight"
            >
              <BrandMark size={24} />
              <span>StarsTask</span>
            </Link>
            <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
              Shared university assignment briefs.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-4 sm:gap-8">
            {FOOTER_GROUPS.map((group) => (
              <nav
                key={group.heading}
                aria-label={group.heading}
              >
                <h2 className="text-foreground font-mono text-xs font-semibold tracking-wider uppercase">
                  {group.heading}
                </h2>
                <ul className="mt-3 space-y-2.5">
                  {group.links.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className="text-muted-foreground hover:text-foreground text-sm transition-colors"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        </div>

        <div className="border-border text-muted-foreground mt-10 flex flex-wrap items-center justify-between gap-2 border-t pt-6 text-xs">
          <span>StarsTask</span>
          <span>Google sign-in for students &amp; lecturers</span>
        </div>
      </div>
    </footer>
  );
}

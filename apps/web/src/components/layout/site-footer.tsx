import Link from "next/link";

import { BrandMark } from "@/components/layout/brand-mark";

/**
 * Only destinations that exist are linked. The legal pages are static, so the
 * footer can safely advertise them without a feature check.
 */
const FOOTER_GROUPS = [
  {
    heading: "Browse",
    links: [
      { href: "/assignments", label: "Assignments" },
      { href: "/classes/discover", label: "Browse classes" },
    ],
  },
  {
    heading: "Get",
    links: [{ href: "/download", label: "Download for Android" }],
  },
  {
    heading: "Learn",
    links: [
      { href: "/#how-it-works", label: "How it works" },
      { href: "/#about", label: "About" },
      { href: "/#faq", label: "FAQ" },
    ],
  },
  {
    heading: "Account",
    links: [{ href: "/login", label: "Sign in with Google" }],
  },
  {
    heading: "Legal",
    links: [
      { href: "/privacy", label: "Privacy" },
      { href: "/terms", label: "Terms" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-border bg-subtle mt-16 border-t">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,2fr)]">
        <div className="max-w-sm">
          <p className="text-foreground flex items-center gap-2 text-sm font-semibold">
            <BrandMark size={26} />
            StarsTask
          </p>
          <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
            A shared archive of university assignment briefs. Find. Understand.
            Contribute.
          </p>
        </div>

        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {FOOTER_GROUPS.map((group) => (
            <nav
              key={group.heading}
              aria-label={group.heading}
            >
              <h2 className="text-foreground text-xs font-semibold tracking-wide uppercase">
                {group.heading}
              </h2>
              <ul className="mt-3 space-y-2">
                {group.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-muted-foreground hover:text-foreground text-sm"
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
    </footer>
  );
}

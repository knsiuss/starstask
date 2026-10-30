import { Star } from "lucide-react";
import Link from "next/link";

/**
 * Only destinations that exist are linked. There is no privacy, terms, or
 * contact route in the application yet, so those links are deliberately
 * absent rather than pointing at placeholders.
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
];

export function SiteFooter() {
  return (
    <footer className="border-border bg-subtle mt-16 border-t">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,2fr)]">
        <div className="max-w-sm">
          <p className="text-foreground flex items-center gap-2 text-sm font-semibold">
            <span className="bg-accent text-accent-foreground flex h-7 w-7 items-center justify-center rounded-md">
              <Star
                aria-hidden="true"
                className="h-3.5 w-3.5"
              />
            </span>
            StarsTask
          </p>
          <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
            A shared archive of university assignment briefs. Find. Understand.
            Contribute.
          </p>
        </div>

        <div className="grid gap-8 sm:grid-cols-3">
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

import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-border bg-subtle mt-16 border-t">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:px-6 md:flex-row md:items-start md:justify-between">
        <div className="max-w-sm space-y-2">
          <p className="text-foreground text-sm font-semibold">StarsTask</p>
          <p className="text-muted-foreground text-sm">
            A shared archive of university assignments. Browse freely,
            contribute when you sign in with Google.
          </p>
        </div>

        <nav
          aria-label="Footer"
          className="flex flex-wrap gap-x-6 gap-y-2 text-sm"
        >
          <Link
            className="text-muted-foreground hover:text-foreground"
            href="/assignments"
          >
            Explore assignments
          </Link>
          <Link
            className="text-muted-foreground hover:text-foreground"
            href="/submit"
          >
            Submit an assignment
          </Link>
          <Link
            className="text-muted-foreground hover:text-foreground"
            href="/login"
          >
            Sign in
          </Link>
        </nav>
      </div>
    </footer>
  );
}

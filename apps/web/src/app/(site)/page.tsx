import { ArrowRight, BookOpen, Search, Share2, Star } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { AssignmentList } from "@/components/assignments/assignment-list";
import { SetupNotice } from "@/components/layout/setup-notice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listAssignments, getPublishedCounts } from "@/lib/db/assignments";
import { isSupabaseConfigured } from "@/lib/env/public";
import { listAssignmentsQuerySchema } from "@starstask/contracts";
import { formatCount } from "@starstask/shared";

const LATEST_QUERY = listAssignmentsQuerySchema.parse({
  sort: "newest",
  page: "1",
  pageSize: "6",
});

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const configured = isSupabaseConfigured();
  const [latest, stats] = configured
    ? await Promise.all([listAssignments(LATEST_QUERY), getPublishedCounts()])
    : [null, null];

  return (
    <div>
      <section className="border-border bg-subtle border-b">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <div className="max-w-3xl">
            <p className="border-border bg-background text-muted-foreground inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium">
              <Star
                aria-hidden="true"
                className="text-accent h-3.5 w-3.5"
              />
              Built for university students
            </p>
            <h1 className="mt-5 text-4xl font-semibold tracking-tight sm:text-5xl">
              Every assignment,
              <br className="hidden sm:block" /> one search away.
            </h1>
            <p className="text-muted-foreground mt-4 max-w-2xl text-base leading-relaxed sm:text-lg">
              StarsTask collects assignment briefs from courses across
              universities, so you can see what a task really asks for before
              you start. Browse without an account; sign in with Google when you
              want to contribute.
            </p>

            <form
              action="/assignments"
              method="get"
              className="mt-8 flex max-w-xl flex-col gap-2 sm:flex-row"
              role="search"
            >
              <label
                htmlFor="home-search"
                className="sr-only"
              >
                Search assignments
              </label>
              <div className="relative flex-1">
                <Search
                  aria-hidden="true"
                  className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
                />
                <Input
                  id="home-search"
                  name="search"
                  type="search"
                  placeholder="Search by title, course, or keyword"
                  className="pl-9"
                  maxLength={100}
                />
              </div>
              <Button type="submit">Search assignments</Button>
            </form>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Button
                asChild
                variant="secondary"
              >
                <Link href="/assignments">
                  Explore assignments
                  <ArrowRight
                    aria-hidden="true"
                    className="h-4 w-4"
                  />
                </Link>
              </Button>
              <Button
                asChild
                variant="ghost"
              >
                <Link href="/submit">Contribute an assignment</Link>
              </Button>
            </div>

            {stats ? (
              <dl className="mt-10 flex flex-wrap gap-x-10 gap-y-4">
                <div>
                  <dt className="text-muted-foreground text-xs tracking-wide uppercase">
                    Published assignments
                  </dt>
                  <dd className="text-2xl font-semibold">
                    {formatCount(stats.assignments)}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground text-xs tracking-wide uppercase">
                    Courses represented
                  </dt>
                  <dd className="text-2xl font-semibold">
                    {formatCount(stats.courses)}
                  </dd>
                </div>
              </dl>
            ) : null}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        {!configured ? <SetupNotice /> : null}

        {latest ? (
          <section aria-labelledby="latest-heading">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2
                  id="latest-heading"
                  className="text-2xl font-semibold tracking-tight"
                >
                  Recently added
                </h2>
                <p className="text-muted-foreground mt-1 text-sm">
                  The newest contributions from students.
                </p>
              </div>
              <Link
                href="/assignments"
                className="text-accent inline-flex items-center gap-1 text-sm font-medium hover:underline"
              >
                View all
                <ArrowRight
                  aria-hidden="true"
                  className="h-4 w-4"
                />
              </Link>
            </div>

            <div className="mt-6">
              <AssignmentList
                assignments={latest.items}
                emptyTitle="No assignments yet"
                emptyDescription="The archive is empty. Sign in with Google and publish the first assignment."
              />
            </div>
          </section>
        ) : null}

        <section
          aria-labelledby="how-heading"
          className="mt-16"
        >
          <h2
            id="how-heading"
            className="text-2xl font-semibold tracking-tight"
          >
            How StarsTask works
          </h2>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <StepCard
              icon={
                <Search
                  aria-hidden="true"
                  className="h-5 w-5"
                />
              }
              title="Search the archive"
              description="Filter by course, semester, type, tag, or deadline. Every public page works without an account."
            />
            <StepCard
              icon={
                <BookOpen
                  aria-hidden="true"
                  className="h-5 w-5"
                />
              }
              title="Read the real brief"
              description="See descriptions, deadlines, references, and downloadable attachments before you commit to the work."
            />
            <StepCard
              icon={
                <Share2
                  aria-hidden="true"
                  className="h-5 w-5"
                />
              }
              title="Give something back"
              description="Sign in with Google to publish assignments you have received. You can edit or delete only your own contributions."
            />
          </div>
        </section>
      </div>
    </div>
  );
}

function StepCard({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="border-border rounded-lg border p-5">
      <span className="bg-accent-soft text-accent flex h-9 w-9 items-center justify-center rounded-md">
        {icon}
      </span>
      <h3 className="mt-3 text-base font-semibold">{title}</h3>
      <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
        {description}
      </p>
    </div>
  );
}

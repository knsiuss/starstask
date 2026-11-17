import Link from "next/link";

import { ChevronRight, GraduationCap } from "lucide-react";

import {
  getMyHomeMembership,
  type HomeMembershipRow,
} from "@/lib/db/course-offerings";
import type { IdentityContext } from "@/lib/identity/derive-identity-context";
import { getIdentityContext } from "@/lib/identity/get-identity-context";

type AcademicCardData =
  | { kind: "unlinked" }
  | {
      kind: "linked";
      context: Extract<IdentityContext, { status: "active" }>;
      home: HomeMembershipRow | null;
    }
  | null;

/** Data fetch isolated from JSX so the dashboard never crashes on failure. */
async function loadAcademicCardData(): Promise<AcademicCardData> {
  try {
    const resolved = await getIdentityContext();

    if (!resolved.authenticated) {
      return null;
    }

    if (resolved.context.status !== "active") {
      return { kind: "unlinked" };
    }

    const home = await getMyHomeMembership();

    return { kind: "linked", context: resolved.context, home };
  } catch {
    return null;
  }
}

/**
 * Compact academic-identity card for the dashboard right rail.
 * Any failure renders nothing rather than breaking the dashboard.
 */
export async function AcademicContextCard() {
  const data = await loadAcademicCardData();

  if (!data) {
    return null;
  }

  if (data.kind === "unlinked") {
    return (
      <Link
        href="/university"
        className="border-border bg-surface hover:border-accent/40 hover:bg-hover focus-visible:outline-accent group flex min-h-11 items-center gap-3 rounded-xl border p-3.5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        <span className="border-border bg-subtle text-muted-foreground flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border">
          <GraduationCap
            aria-hidden="true"
            className="h-4 w-4"
          />
        </span>

        <span className="min-w-0 flex-1">
          <span className="text-foreground group-hover:text-accent block truncate text-sm font-medium transition-colors">
            Not linked to a university
          </span>
          <span className="text-muted-foreground mt-0.5 block text-xs leading-snug">
            Find your university and request access.
          </span>
        </span>

        <ChevronRight
          aria-hidden="true"
          className="text-muted-foreground/70 group-hover:text-accent h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5"
        />
      </Link>
    );
  }

  const { context, home } = data;
  const universityLabel =
    context.university.shortName ?? context.university.name;

  return (
    <Link
      href="/university"
      className="border-border bg-surface hover:border-accent/40 hover:bg-hover focus-visible:outline-accent group flex items-start gap-3 rounded-xl border p-3.5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      <span className="bg-accent-soft text-accent flex h-9 w-9 shrink-0 items-center justify-center rounded-lg">
        <GraduationCap
          aria-hidden="true"
          className="h-4 w-4"
        />
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          <span className="text-foreground group-hover:text-accent truncate text-sm font-semibold transition-colors">
            {universityLabel}
          </span>
          <ChevronRight
            aria-hidden="true"
            className="text-muted-foreground/70 group-hover:text-accent h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5"
          />
        </span>

        {context.identity ? (
          <span className="text-muted-foreground mt-0.5 block font-mono text-xs tabular-nums">
            {context.identity.studentId}
          </span>
        ) : null}

        <span className="text-muted-foreground mt-1 block truncate text-xs">
          {home ? `Home class: ${home.className}` : "No home class assigned"}
        </span>
      </span>
    </Link>
  );
}

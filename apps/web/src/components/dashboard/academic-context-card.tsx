import Link from "next/link";
import { GraduationCap } from "lucide-react";

import {
  getMyHomeMembership,
  type HomeMembershipRow,
} from "@/lib/db/course-offerings";
import { getIdentityContext } from "@/lib/identity/get-identity-context";
import type { IdentityContext } from "@/lib/identity/derive-identity-context";

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
 * Compact academic-identity strip for the dashboard. Any failure renders
 * nothing rather than breaking the dashboard.
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
        className="border-border bg-card hover:bg-muted flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm transition-colors"
      >
        <GraduationCap
          aria-hidden="true"
          className="text-muted-foreground h-5 w-5 shrink-0"
        />
        <span className="min-w-0">
          <span className="font-medium">Not linked to a university yet</span>
          <span className="text-muted-foreground block text-xs">
            Find your university and request access from its operator.
          </span>
        </span>
      </Link>
    );
  }

  const { context, home } = data;

  return (
    <Link
      href="/university"
      className="border-border bg-card hover:bg-muted flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm transition-colors"
    >
      <GraduationCap
        aria-hidden="true"
        className="text-accent h-5 w-5 shrink-0"
      />
      <span className="min-w-0">
        <span className="font-medium">
          {context.university.shortName ?? context.university.name}
          {context.identity ? (
            <span className="text-muted-foreground font-normal">
              {" "}
              · {context.identity.studentId}
            </span>
          ) : null}
        </span>
        <span className="text-muted-foreground block text-xs">
          {home
            ? `Home class: ${home.className}`
            : "No home class assigned yet"}
          {" · "}
          View academic identity
        </span>
      </span>
    </Link>
  );
}

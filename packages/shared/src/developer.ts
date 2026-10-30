/**
 * Developer allowlist parsing.
 *
 * The list is an operational secret in the sense that it is server-only, but
 * the parser itself is pure so it can be covered by unit tests. A malformed
 * non-empty entry invalidates the whole list: a typo must fail closed rather
 * than silently granting access to the remaining addresses.
 */

const MAX_EMAIL_LENGTH = 254;
const MAX_ENTRIES = 100;
const EMAIL_PATTERN = /^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/;

export type DeveloperAllowlist =
  | { status: "ok"; emails: readonly string[] }
  | { status: "missing" }
  | { status: "invalid" };

export function normalizeDeveloperEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function parseDeveloperEmails(
  raw: string | null | undefined,
): DeveloperAllowlist {
  if (!raw || raw.trim().length === 0) {
    return { status: "missing" };
  }

  const entries = raw
    .split(",")
    .map((entry) => normalizeDeveloperEmail(entry))
    .filter((entry) => entry.length > 0);

  if (entries.length === 0) {
    return { status: "missing" };
  }

  if (entries.length > MAX_ENTRIES) {
    return { status: "invalid" };
  }

  const emails = new Set<string>();

  for (const entry of entries) {
    if (entry.length > MAX_EMAIL_LENGTH || !EMAIL_PATTERN.test(entry)) {
      return { status: "invalid" };
    }

    emails.add(entry);
  }

  return { status: "ok", emails: [...emails] };
}

/** Case-insensitive allowlist check that fails closed on any non-ok config. */
export function isAllowlistedDeveloperEmail(
  email: string | null | undefined,
  allowlist: DeveloperAllowlist,
): boolean {
  if (allowlist.status !== "ok" || !email) {
    return false;
  }

  return allowlist.emails.includes(normalizeDeveloperEmail(email));
}

/**
 * Landing paths per account kind. Developer accounts operate the console, not
 * the student workspace, so they land on and are steered toward /developer.
 */
export const DEVELOPER_HOME_PATH = "/developer";
export const MEMBER_HOME_PATH = "/dashboard";

/**
 * Workspace path prefixes that serve student-facing features only. Used as a
 * routing rule (not an authorization decision) to keep developer accounts out
 * of the student area; every page still enforces its own auth requirements.
 */
const STUDENT_WORKSPACE_PREFIXES = [
  "/dashboard",
  "/assignments",
  "/classes",
  "/leave-requests",
  "/sessions",
  "/submit",
  "/my-assignments",
] as const;

export function isStudentWorkspacePath(pathname: string): boolean {
  return STUDENT_WORKSPACE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

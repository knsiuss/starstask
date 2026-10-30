import "server-only";

import { redirect } from "next/navigation";

import {
  DEVELOPER_HOME_PATH,
  isAllowlistedDeveloperEmail,
  MEMBER_HOME_PATH,
  parseDeveloperEmails,
} from "@starstask/shared";

import { forbidden, unauthorized } from "@/lib/api/errors";
import { getSessionUser, type SessionUser } from "@/lib/auth/session";
import { buildLoginPath } from "@/lib/security/redirect";

/**
 * Internal developer access is deliberately independent of every application
 * role. The only trust signal is the email on the session Supabase verified
 * with `auth.getUser()`; a platform admin is not a developer unless the
 * allowlist says so, and missing or malformed configuration denies everyone.
 */
export type DeveloperAccess =
  | { status: "allowed"; session: SessionUser }
  | { status: "unauthenticated" }
  | { status: "denied" }
  | { status: "unconfigured" };

function getAllowlist() {
  return parseDeveloperEmails(process.env.DEVELOPER_EMAILS);
}

/**
 * Allowlist check for cosmetic navigation only (nav items, menu entries).
 * Every developer page and API still re-checks through `getDeveloperAccess`,
 * so a stale render or a tampered client can never gain access from this.
 */
export function isDeveloperEmail(email: string | null | undefined): boolean {
  const allowlist = parseDeveloperEmails(process.env.DEVELOPER_EMAILS);

  return (
    allowlist.status === "ok" && isAllowlistedDeveloperEmail(email, allowlist)
  );
}

/**
 * Post-sign-in landing path for a signed-in account: developer accounts belong
 * in the console, everyone else in the student workspace.
 */
export function resolveSignedInHomePath(
  email: string | null | undefined,
): string {
  return isDeveloperEmail(email) ? DEVELOPER_HOME_PATH : MEMBER_HOME_PATH;
}

export async function getDeveloperAccess(): Promise<DeveloperAccess> {
  const allowlist = getAllowlist();

  // Check configuration before the session so an operator with a typo gets a
  // clear, closed state instead of a login loop that cannot succeed.
  if (allowlist.status !== "ok") {
    return { status: "unconfigured" };
  }

  const session = await getSessionUser();

  if (!session) {
    return { status: "unauthenticated" };
  }

  if (!isAllowlistedDeveloperEmail(session.user.email, allowlist)) {
    return { status: "denied" };
  }

  return { status: "allowed", session };
}

/**
 * Page guard. Unauthenticated visitors are sent to login with a safe return
 * path; authenticated non-developers get the caller's access-denied UI.
 */
export async function requireDeveloperPageAccess(
  nextPath: string,
): Promise<Exclude<DeveloperAccess, { status: "unauthenticated" }>> {
  const access = await getDeveloperAccess();

  if (access.status === "unauthenticated") {
    redirect(buildLoginPath(nextPath));
  }

  return access;
}

/**
 * Route-handler guard. Every developer API re-runs this independently; none of
 * them rely on the page guard or on the UI hiding a link.
 */
export async function requireDeveloperApiAccess(): Promise<SessionUser> {
  const access = await getDeveloperAccess();

  if (access.status === "unauthenticated") {
    throw unauthorized();
  }

  if (access.status !== "allowed") {
    throw forbidden();
  }

  return access.session;
}

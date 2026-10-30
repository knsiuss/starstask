import "server-only";

import { notFound, redirect } from "next/navigation";

import { isPlatformAdmin } from "@/lib/db/classes";
import { buildLoginPath } from "@/lib/security/redirect";
import { getSessionUser, type SessionUser } from "@/lib/auth/session";

/**
 * Requires a verified session with the platform admin role.
 *
 * Call this after the Supabase configuration check. The role comes from the
 * `is_platform_admin()` database function on the caller's own session, never
 * from a client-supplied value.
 */
export async function requirePlatformAdmin(path: string): Promise<SessionUser> {
  const session = await getSessionUser();

  if (!session) {
    redirect(buildLoginPath(path));
  }

  if (!(await isPlatformAdmin())) {
    notFound();
  }

  return session;
}

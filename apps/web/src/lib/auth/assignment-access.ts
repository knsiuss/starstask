import "server-only";

import { redirect } from "next/navigation";

import { getSessionUser, type SessionUser } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/env/public";
import { buildLoginPath } from "@/lib/security/redirect";

export async function requireAssignmentPageSession(
  nextPath: string,
): Promise<SessionUser | null> {
  if (!isSupabaseConfigured()) {
    return null;
  }

  const session = await getSessionUser();

  if (!session) {
    redirect(buildLoginPath(nextPath));
  }

  return session;
}

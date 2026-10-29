import "server-only";

import { forbidden, notFound, unauthorized } from "@/lib/api/errors";
import { getSessionUser, type SessionUser } from "@/lib/auth/session";
import {
  getClassBySlug,
  getClassRole,
  isPlatformAdmin,
  type ClassRole,
  type ClassSummary,
} from "@/lib/db/classes";

/** Resolves the session or fails with 401. */
export async function requireSession(): Promise<SessionUser> {
  const session = await getSessionUser();

  if (!session) {
    throw unauthorized();
  }

  return session;
}

/** Resolves a class by slug or fails with 404. */
export async function requireClass(slug: string): Promise<ClassSummary> {
  const found = await getClassBySlug(slug);

  if (!found) {
    throw notFound();
  }

  return found;
}

export type ClassContext = {
  session: SessionUser;
  class: ClassSummary;
  role: ClassRole;
};

/** Requires a signed-in user who may manage the class. */
export async function requireClassManager(slug: string): Promise<ClassContext> {
  const session = await requireSession();
  const found = await requireClass(slug);
  const role = await getClassRole(found.id);

  if (!role.canManage) {
    throw forbidden();
  }

  return { session, class: found, role };
}

/** Requires a signed-in member of the class (admins are members too). */
export async function requireClassMember(slug: string): Promise<ClassContext> {
  const session = await requireSession();
  const found = await requireClass(slug);
  const role = await getClassRole(found.id);

  if (!role.isMember) {
    throw forbidden();
  }

  return { session, class: found, role };
}

/** Requires the platform administrator role. */
export async function requirePlatformAdmin(): Promise<SessionUser> {
  const session = await requireSession();

  if (!(await isPlatformAdmin())) {
    throw forbidden();
  }

  return session;
}

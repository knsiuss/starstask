import "server-only";

import { ApiError, forbidden, notFound, unauthorized } from "@/lib/api/errors";
import { getSessionUser, type SessionUser } from "@/lib/auth/session";
import { getClassRole, isPlatformAdmin } from "@/lib/db/classes";
import { DataAccessError } from "@/lib/db/assignments";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ClassAdminPermissionCode } from "@starstask/contracts";
import { CLASS_ADMIN_PERMISSION_CODES } from "@starstask/contracts";

export type ClassAuthzClass = {
  id: string;
  slug: string;
  name: string;
  universityId: string | null;
};

export type ClassAuthz =
  | { ok: true; via: "platform_admin" | "class_assignment" }
  | {
      ok: false;
      reason: "class_not_found" | "class_unlinked" | "permission_missing";
    };

/**
 * Central class-RBAC predicate for the Phase 5I academic domains.
 *
 * Every sensitive read and all writes route through here. Authorization is
 * always evaluated server-side from the caller's own session:
 * `has_class_permission()` runs on the caller's JWT, and the platform-admin
 * short-circuit comes from `is_platform_admin()`. Client-supplied roles or
 * user ids are never trusted.
 *
 * A class with `university_id IS NULL` is a legacy, tenant-unlinked class:
 * new-model operations are rejected with `class_unlinked` instead of running
 * against a NULL tenant key.
 */
export async function authorizeClassPermission(
  classId: string,
  permission: ClassAdminPermissionCode,
): Promise<ClassAuthz> {
  const supabase = await createSupabaseServerClient();
  const { data: classRow, error: classError } = await supabase
    .from("classes")
    .select("id, university_id")
    .eq("id", classId)
    .maybeSingle();

  if (classError) {
    throw new DataAccessError("Could not load the class", classError.code);
  }

  if (!classRow) {
    return { ok: false, reason: "class_not_found" };
  }

  if (!classRow.university_id) {
    return { ok: false, reason: "class_unlinked" };
  }

  const [platformAdmin, allowed] = await Promise.all([
    isPlatformAdmin(),
    hasClassPermission(classId, permission),
  ]);

  if (platformAdmin) {
    return { ok: true, via: "platform_admin" };
  }

  if (allowed) {
    return { ok: true, via: "class_assignment" };
  }

  return { ok: false, reason: "permission_missing" };
}

/** RPC wrapper; fails closed (throws) instead of returning false on error. */
export async function hasClassPermission(
  classId: string,
  permission: ClassAdminPermissionCode,
): Promise<boolean> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("has_class_permission", {
    p_class_id: classId,
    p_permission: permission,
  });

  if (error) {
    throw new DataAccessError("Could not verify class permission", error.code);
  }

  return data === true;
}

/** True when the caller holds at least one new-model permission on the class. */
export async function hasAnyClassPermission(classId: string): Promise<boolean> {
  const results = await Promise.all(
    CLASS_ADMIN_PERMISSION_CODES.map((code) =>
      hasClassPermission(classId, code),
    ),
  );

  return results.some(Boolean);
}

export type PageAccess =
  | {
      ok: true;
      session: SessionUser;
      classRow: {
        id: string;
        slug: string;
        name: string;
        universityId: string;
      };
      via: "platform_admin" | "class_assignment";
    }
  | { ok: false; reason: "not_found" | "unlinked" | "forbidden" };

/**
 * Page guard for the new academic admin pages.
 *
 * Unlike the API-route guard this never throws for expected denials — pages
 * render either a tenant-unlinked notice (`unlinked`) or `notFound()`
 * (`forbidden` / `not_found`) without leaking which classes exist.
 */
export async function resolveClassPermissionForPage(
  slug: string,
  permission: ClassAdminPermissionCode,
): Promise<PageAccess> {
  const session = await getSessionUser();

  if (!session) {
    return { ok: false, reason: "forbidden" };
  }

  const supabase = await createSupabaseServerClient();
  const { data: classRow, error } = await supabase
    .from("classes")
    .select("id, slug, name, university_id")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    throw new DataAccessError("Could not load the class", error.code);
  }

  if (!classRow) {
    return { ok: false, reason: "not_found" };
  }

  if (!classRow.university_id) {
    return { ok: false, reason: "unlinked" };
  }

  const authz = await authorizeClassPermission(classRow.id, permission);

  if (!authz.ok) {
    return { ok: false, reason: "forbidden" };
  }

  return {
    ok: true,
    session,
    classRow: {
      id: classRow.id,
      slug: classRow.slug,
      name: classRow.name,
      universityId: classRow.university_id,
    },
    via: authz.via,
  };
}

export type MemberPageAccess =
  | {
      ok: true;
      session: SessionUser;
      classRow: {
        id: string;
        slug: string;
        name: string;
        universityId: string | null;
      };
      via: "class_member" | "class_assignment" | "platform_admin";
    }
  | { ok: false; reason: "not_found" | "unlinked" | "forbidden" };

/**
 * Page guard for member-visible academic pages (read-only content any class
 * member may see). `unlinked` is reported instead of rendering tenant data.
 */
export async function resolveClassMemberForPage(
  slug: string,
): Promise<MemberPageAccess> {
  const session = await getSessionUser();

  if (!session) {
    return { ok: false, reason: "forbidden" };
  }

  const supabase = await createSupabaseServerClient();
  const { data: classRow, error } = await supabase
    .from("classes")
    .select("id, slug, name, university_id")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    throw new DataAccessError("Could not load the class", error.code);
  }

  if (!classRow) {
    return { ok: false, reason: "not_found" };
  }

  const classRowSummary = {
    id: classRow.id,
    slug: classRow.slug,
    name: classRow.name,
    universityId: classRow.university_id,
  };

  const [role, anyPermission] = await Promise.all([
    getClassRole(classRow.id),
    hasAnyClassPermission(classRow.id),
  ]);

  if (role.isPlatformAdmin) {
    return {
      ok: true,
      session,
      classRow: classRowSummary,
      via: "platform_admin",
    };
  }

  if (anyPermission) {
    return {
      ok: true,
      session,
      classRow: classRowSummary,
      via: "class_assignment",
    };
  }

  if (role.isMember) {
    return {
      ok: true,
      session,
      classRow: classRowSummary,
      via: "class_member",
    };
  }

  return { ok: false, reason: "forbidden" };
}

export type RequiredClassContext = {
  session: SessionUser;
  class: ClassAuthzClass;
  via: "platform_admin" | "class_assignment";
};

/**
 * Route-handler guard: resolves the session, the class by slug, and the
 * permission — or throws the matching ApiError (401/403/404/409).
 */
export async function requireClassPermission(
  slug: string,
  permission: ClassAdminPermissionCode,
): Promise<RequiredClassContext> {
  const session = await getSessionUser();

  if (!session) {
    throw unauthorized();
  }

  const supabase = await createSupabaseServerClient();
  const { data: classRow, error: classError } = await supabase
    .from("classes")
    .select("id, slug, name, university_id")
    .eq("slug", slug)
    .maybeSingle();

  if (classError) {
    throw new DataAccessError("Could not load the class", classError.code);
  }

  if (!classRow) {
    throw notFound();
  }

  if (!classRow.university_id) {
    throw new ApiError(
      409,
      "class_unlinked",
      "This class is not linked to a university yet. Academic administration becomes available once the platform links it.",
    );
  }

  const authz = await authorizeClassPermission(classRow.id, permission);

  if (!authz.ok) {
    if (authz.reason === "class_unlinked") {
      throw new ApiError(
        409,
        "class_unlinked",
        "This class is not linked to a university yet.",
      );
    }

    throw forbidden();
  }

  return {
    session,
    class: {
      id: classRow.id,
      slug: classRow.slug,
      name: classRow.name,
      universityId: classRow.university_id,
    },
    via: authz.via,
  };
}

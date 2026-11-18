import {
  buildCanonicalClassIdentity,
  classJoinOrCreateSchema,
} from "@starstask/contracts";
import { z } from "zod";

import { requireSession } from "@/features/classes/class-access";
import { ApiError, serviceUnavailable } from "@/lib/api/errors";
import { apiSuccess, handleRouteError } from "@/lib/api/responses";
import { isSupabaseConfigured } from "@/lib/env/public";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const lookupSchema = z.union([
  classJoinOrCreateSchema,
  z.object({
    className: z.string().trim().min(2).max(120),
  }),
]);

type ClassRow = {
  id: string;
  slug: string;
  name: string;
  class_code: string | null;
  semester: string;
  academic_year: string;
  join_policy: string;
};

type SubjectRow = {
  id: string;
  class_id: string;
  name: string;
  code: string | null;
};

export type ClassLookupMatch = {
  id: string;
  slug: string;
  name: string;
  classCode: string | null;
  semester: string;
  academicYear: string;
  joinPolicy: string;
  isMember: boolean;
  subjects: Array<{ id: string; name: string; code: string | null }>;
};

function sanitizePostgrestFilterValue(value: string): string {
  return value.replace(/[,()*\\]/g, "").trim();
}

/**
 * Looks up existing active classes and their active subjects without creating
 * a class or modifying membership.
 */
export async function POST(request: Request) {
  try {
    if (!isSupabaseConfigured()) {
      throw serviceUnavailable();
    }

    const session = await requireSession();

    await enforceRateLimit({
      action: "classes:lookup",
      identifier: session.user.id,
      limit: 30,
      windowSeconds: 60,
    });

    const rawBody = (await request.json().catch(() => null)) as unknown;
    const parsed = lookupSchema.safeParse(rawBody);

    if (!parsed.success) {
      throw new ApiError(422, "validation_error", "Enter a valid class code.");
    }

    const admin = createSupabaseAdminClient();
    const matches = new Map<string, ClassRow>();

    if ("classCode" in parsed.data) {
      const identity = buildCanonicalClassIdentity(parsed.data);
      const code = sanitizePostgrestFilterValue(
        parsed.data.classCode.trim().toUpperCase(),
      );

      const [bySlug, byCode] = await Promise.all([
        admin
          .from("classes")
          .select(
            "id, slug, name, class_code, semester, academic_year, join_policy",
          )
          .eq("status", "active")
          .eq("slug", identity.slug)
          .limit(5),
        code
          ? admin
              .from("classes")
              .select(
                "id, slug, name, class_code, semester, academic_year, join_policy",
              )
              .eq("status", "active")
              .or(`class_code.ilike.${code},name.ilike.%${code}%`)
              .limit(10)
          : Promise.resolve({ data: [] as ClassRow[] }),
      ]);

      for (const row of (bySlug.data ?? []) as ClassRow[]) {
        matches.set(row.id, row);
      }

      for (const row of (byCode.data ?? []) as ClassRow[]) {
        matches.set(row.id, row);
      }
    } else {
      const term = sanitizePostgrestFilterValue(parsed.data.className.trim());

      if (!term) {
        throw new ApiError(
          422,
          "validation_error",
          "Enter a valid class code.",
        );
      }

      const { data } = await admin
        .from("classes")
        .select(
          "id, slug, name, class_code, semester, academic_year, join_policy",
        )
        .eq("status", "active")
        .or(`slug.ilike.${term},class_code.ilike.${term},name.ilike.%${term}%`)
        .limit(10);

      for (const row of (data ?? []) as ClassRow[]) {
        matches.set(row.id, row);
      }
    }

    const classRows = [...matches.values()];

    if (classRows.length === 0) {
      return apiSuccess({ found: false, matches: [] as ClassLookupMatch[] });
    }

    const classIds = classRows.map((row) => row.id);
    const [membershipsRes, subjectsRes] = await Promise.all([
      admin
        .from("class_members")
        .select("class_id")
        .eq("user_id", session.user.id)
        .in("class_id", classIds),
      admin
        .from("class_subjects")
        .select("id, class_id, name, code")
        .in("class_id", classIds)
        .eq("status", "active")
        .order("name", { ascending: true }),
    ]);

    const memberClassIds = new Set(
      (membershipsRes.data ?? []).map(
        (row) => (row as { class_id: string }).class_id,
      ),
    );

    const subjectsByClass = new Map<string, ClassLookupMatch["subjects"]>();

    for (const row of (subjectsRes.data ?? []) as SubjectRow[]) {
      if (row.id === row.class_id) {
        continue;
      }
      const list = subjectsByClass.get(row.class_id) ?? [];
      list.push({ id: row.id, name: row.name, code: row.code });
      subjectsByClass.set(row.class_id, list);
    }

    const payload: ClassLookupMatch[] = classRows.map((row) => {
      const isMember = memberClassIds.has(row.id);

      return {
        id: row.id,
        slug: row.slug,
        name: row.name,
        classCode: row.class_code,
        semester: row.semester,
        academicYear: row.academic_year,
        joinPolicy: row.join_policy,
        isMember,
        subjects:
          row.join_policy === "invitation" && !isMember
            ? []
            : (subjectsByClass.get(row.id) ?? []),
      };
    });

    return apiSuccess({ found: true, matches: payload });
  } catch (error) {
    return handleRouteError(error);
  }
}

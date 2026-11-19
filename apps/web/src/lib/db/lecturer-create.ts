import "server-only";

import { DataAccessError } from "@/lib/db/assignments";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type CreateClassAsLecturerInput = {
  slug: string;
  name: string;
  courseName: string;
  semester: string;
  academicYear: string;
  description: string;
  institution?: string;
  lecturerName?: string;
  classCode?: string;
  universityId?: string;
};

/**
 * Kebab-case slug from a free-form class name.
 *
 * `buildCanonicalClassIdentity` in @starstask/contracts derives the slug from
 * (semester, classCode, academicYear), which is the student cohort model. The
 * lecturer flow takes a free-form name instead, so the slug is derived the
 * same way JOIN does for free-form names: lowercase, non-alphanumerics become
 * hyphens, trimmed, capped at 80 chars, with a digit-only fallback for names
 * that produce an empty key.
 */
export function slugifyLecturerClassName(name: string): string {
  const key = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  if (key.length >= 3) {
    return key;
  }

  const digits =
    name
      .match(/[a-zA-Z0-9]+/g)
      ?.join("")
      .toLowerCase() ?? "";
  const padded = `${digits}${"0".repeat(Math.max(0, 3 - digits.length))}`;

  return padded.slice(0, 80);
}

/**
 * Creates a class for the signed-in lecturer persona.
 *
 * Live authorization, membership resolution, and the multi-university check
 * all live in `create_class_as_lecturer`. The RPC raises 22023 with the
 * message "multiple university memberships; pass p_university_id" when the
 * caller has more than one active lecturer membership and did not pass
 * p_university_id; the route maps that to a 422 the UI renders as a picker.
 *
 * The hand-written Database type does not declare create_class_as_lecturer,
 * so the call site narrows with a single `as never` cast, mirroring how
 * isLecturer and claim_lecturer_persona call RPCs missing from it. join_policy
 * is intentionally not passed: the RPC has no such parameter.
 *
 * `DataAccessError.message` carries the provider message so the route can
 * substring-match it without plumbing; the route logs only the code and never
 * forwards the provider message to the client.
 */
export async function createClassAsLecturer(
  input: CreateClassAsLecturerInput,
): Promise<{ classId: string }> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc(
    "create_class_as_lecturer" as never,
    {
      p_proposed_slug: input.slug,
      p_proposed_name: input.name,
      p_course_name: input.courseName,
      p_semester: input.semester,
      p_academic_year: input.academicYear,
      p_description: input.description,
      p_institution: input.institution ?? null,
      p_lecturer_name: input.lecturerName ?? null,
      p_proposed_class_code: input.classCode ?? null,
      p_university_id: input.universityId ?? null,
    } as never,
  );

  if (error || data === null) {
    const code = error?.code;
    const message = error?.message ?? "Could not create the class";

    throw new DataAccessError(message, code);
  }

  return { classId: data as string };
}

import "server-only";

import { DataAccessError } from "@/lib/db/assignments";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type OfferingRow = {
  id: string;
  classId: string;
  courseId: string;
  courseName: string;
  courseCode: string | null;
  academicYearId: string | null;
  semesterId: string | null;
  lecturerName: string | null;
  status: string;
};

type OfferingQueryRow = {
  id: string;
  class_id: string;
  course_id: string;
  academic_year_id: string | null;
  semester_id: string | null;
  lecturer_name: string | null;
  status: string;
  courses: { name: string; code: string | null } | null;
};

function mapOffering(row: OfferingQueryRow): OfferingRow {
  return {
    id: row.id,
    classId: row.class_id,
    courseId: row.course_id,
    courseName: row.courses?.name ?? "Unknown course",
    courseCode: row.courses?.code ?? null,
    academicYearId: row.academic_year_id,
    semesterId: row.semester_id,
    lecturerName: row.lecturer_name,
    status: row.status,
  };
}

const OFFERING_COLUMNS =
  "id, class_id, course_id, academic_year_id, semester_id, lecturer_name, status, courses!course_offerings_course_id_fkey ( name, code )";

/**
 * Offerings of one class, newest first. Readable by any university member;
 * the catalogue scope decision (global vs per-university) is intentionally not
 * locked here — rows are returned as stored, unfiltered by university.
 */
export async function listOfferingsForClass(
  classId: string,
): Promise<OfferingRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("course_offerings")
    .select(OFFERING_COLUMNS)
    .eq("class_id", classId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new DataAccessError("Could not load course offerings", error.code);
  }

  return ((data ?? []) as unknown as OfferingQueryRow[]).map(mapOffering);
}

/**
 * Open offerings across a university — the read side of offering discovery.
 * Enrollment itself stays admin/invite-driven; this list grants nothing.
 */
export async function listOpenOfferingsForUniversity(
  universityId: string,
  limit = 50,
): Promise<OfferingRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("course_offerings")
    .select(OFFERING_COLUMNS)
    .eq("university_id", universityId)
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new DataAccessError("Could not load open offerings", error.code);
  }

  return ((data ?? []) as unknown as OfferingQueryRow[]).map(mapOffering);
}

/** Active enrollment counts per offering; zero-filled for empty offerings. */
export async function countActiveEnrollments(
  offeringIds: string[],
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();

  if (offeringIds.length === 0) {
    return counts;
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("enrollments")
    .select("offering_id")
    .in("offering_id", offeringIds)
    .eq("status", "active");

  if (error) {
    throw new DataAccessError("Could not count enrollments", error.code);
  }

  for (const row of data ?? []) {
    counts.set(row.offering_id, (counts.get(row.offering_id) ?? 0) + 1);
  }

  return counts;
}

export type MyEnrollmentRow = {
  id: string;
  status: string;
  source: string;
  enrolledAt: string;
  droppedAt: string | null;
  offeringId: string;
  classId: string;
  courseName: string;
  courseCode: string | null;
  offeringStatus: string;
};

type MyEnrollmentQueryRow = {
  id: string;
  status: string;
  source: string;
  enrolled_at: string;
  dropped_at: string | null;
  offering_id: string;
  course_offerings: {
    class_id: string;
    status: string;
    courses: { name: string; code: string | null } | null;
  } | null;
};

/**
 * The caller's enrollments across all of their personas. Retake-safe by
 * design: each row references its own offering; nothing here mutates a home
 * class.
 */
export async function listMyEnrollments(): Promise<MyEnrollmentRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data: identityRows, error: identityError } = await supabase
    .from("student_identities")
    .select("id");

  if (identityError) {
    throw new DataAccessError(
      "Could not load your academic identities",
      identityError.code,
    );
  }

  const identityIds = (identityRows ?? []).map((row) => row.id);

  if (identityIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("enrollments")
    .select(
      "id, status, source, enrolled_at, dropped_at, offering_id, course_offerings!inner ( class_id, status, courses!inner ( name, code ) )",
    )
    .in("student_identity_id", identityIds)
    .order("enrolled_at", { ascending: false });

  if (error) {
    throw new DataAccessError("Could not load your enrollments", error.code);
  }

  const rows = (data ?? []) as unknown as MyEnrollmentQueryRow[];

  return rows.flatMap((row) => {
    const offering = row.course_offerings;

    if (!offering) {
      return [];
    }

    return [
      {
        id: row.id,
        status: row.status,
        source: row.source,
        enrolledAt: row.enrolled_at,
        droppedAt: row.dropped_at,
        offeringId: row.offering_id,
        classId: offering.class_id,
        courseName: offering.courses?.name ?? "Unknown course",
        courseCode: offering.courses?.code ?? null,
        offeringStatus: offering.status,
      },
    ];
  });
}

export type HomeMembershipRow = {
  id: string;
  classId: string;
  className: string;
  classSlug: string;
  joinedAt: string;
};

/**
 * The caller's single home-class membership (DB-enforced one active home per
 * identity). Read-only; no transfer or change flow exists in 5I.
 */
export async function getMyHomeMembership(): Promise<HomeMembershipRow | null> {
  const supabase = await createSupabaseServerClient();
  const { data: identityRows, error: identityError } = await supabase
    .from("student_identities")
    .select("id");

  if (identityError) {
    throw new DataAccessError(
      "Could not load your academic identities",
      identityError.code,
    );
  }

  const identityIds = (identityRows ?? []).map((row) => row.id);

  if (identityIds.length === 0) {
    return null;
  }

  const { data, error } = await supabase
    .from("class_memberships")
    .select(
      "id, class_id, joined_at, classes!class_memberships_class_same_university ( name, slug )",
    )
    .in("student_identity_id", identityIds)
    .eq("is_home", true)
    .is("left_at", null)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new DataAccessError("Could not load your home class", error.code);
  }

  if (!data) {
    return null;
  }

  const row = data as unknown as {
    id: string;
    class_id: string;
    joined_at: string;
    classes: { name: string; slug: string } | null;
  };

  if (!row.classes) {
    return null;
  }

  return {
    id: row.id,
    classId: row.class_id,
    className: row.classes.name,
    classSlug: row.classes.slug,
    joinedAt: row.joined_at,
  };
}

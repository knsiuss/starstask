import "server-only";

import { DataAccessError } from "@/lib/db/assignments";
import { recordServiceRoleAudit } from "@/lib/db/audit";

/**
 * Grading CSV publish (ADR-002 approved 2026-11-05).
 * Format: student_id,course_code,score,grade_letter,semester_code,academic_year_code
 * Flow: uploaded -> verifying (import) -> published (entries published=true, batch published_at set).
 * Published batches are immutable (no overwrite).
 */
export type GradeCsvRow = {
  studentId: string;
  courseCode: string;
  score: number;
  gradeLetter: string;
  semesterCode: string;
  academicYearCode: string;
};

export function parseGradeCsv(text: string): GradeCsvRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) throw new DataAccessError("CSV empty", "22023");
  const header = lines[0]?.split(",").map((h) => h.trim()) ?? [];
  const expected = [
    "student_id",
    "course_code",
    "score",
    "grade_letter",
    "semester_code",
    "academic_year_code",
  ];
  if (expected.some((e, i) => header[i] !== e)) {
    throw new DataAccessError(
      `CSV header must be: ${expected.join(",")}`,
      "22023",
    );
  }
  if (lines.length - 1 > 1000) {
    throw new DataAccessError("CSV max 1000 rows", "22023");
  }
  return lines.slice(1).map((line, i) => {
    const [
      studentId,
      courseCode,
      scoreRaw,
      gradeLetter,
      semesterCode,
      academicYearCode,
    ] = line.split(",").map((c) => c.trim());
    const score = scoreRaw ? Number(scoreRaw) : Number.NaN;
    if (
      !studentId ||
      !courseCode ||
      !scoreRaw ||
      Number.isNaN(score) ||
      score < 0 ||
      score > 100
    ) {
      throw new DataAccessError(`Invalid row ${i + 2}`, "22023");
    }
    return {
      studentId: studentId!,
      courseCode: courseCode!,
      score,
      gradeLetter: gradeLetter ?? "",
      semesterCode: semesterCode ?? "",
      academicYearCode: academicYearCode ?? "",
    };
  });
}

export async function publishGradeBatch(
  client: Parameters<typeof recordServiceRoleAudit>[0],
  actorId: string,
  batchId: string,
  universityId: string,
): Promise<"published" | "already_published" | "not_found"> {
  const { data: batch, error: selectError } = await client
    .from("grade_batches")
    .select("id, status")
    .eq("id", batchId)
    .eq("university_id", universityId)
    .maybeSingle();

  if (selectError) {
    throw new DataAccessError("Could not load batch", selectError.code);
  }

  if (!batch) return "not_found";
  if (batch.status === "published") return "already_published";

  // Publish entries before marking the batch published so a transient failure
  // never leaves the batch stuck in "already_published" with unpublished rows.
  const { error: entriesError } = await client
    .from("grade_entries")
    .update({ published: true })
    .eq("batch_id", batchId)
    .eq("university_id", universityId);

  if (entriesError) {
    throw new DataAccessError(
      "Could not publish grade entries",
      entriesError.code,
    );
  }

  const now = new Date().toISOString();
  const { data: updatedBatch, error: batchError } = await client
    .from("grade_batches")
    .update({ status: "published", published_at: now })
    .eq("id", batchId)
    .eq("university_id", universityId)
    .neq("status", "published")
    .select("id")
    .maybeSingle();

  if (batchError) {
    throw new DataAccessError("Could not publish batch", batchError.code);
  }

  if (!updatedBatch) return "already_published";

  await recordServiceRoleAudit(client, {
    actorId,
    action: "grade_batch_published",
    entityType: "grade_batch",
    entityId: batchId,
    classId: null,
    universityId,
  });

  return "published";
}

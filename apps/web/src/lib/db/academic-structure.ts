import "server-only";

import { DataAccessError } from "@/lib/db/assignments";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import type { AcademicUnitRow } from "@/lib/academic/unit-tree";

export type AcademicYearRow = {
  id: string;
  code: string;
  name: string;
  startDate: string;
  endDate: string;
  status: string;
  isCurrent: boolean;
};

export type SemesterRow = {
  id: string;
  academicYearId: string;
  code: string;
  name: string;
  sequenceNo: number;
  startDate: string | null;
  endDate: string | null;
  status: string;
};

/**
 * Units of one university, parents before children at each depth level.
 * Read-only; writes go through service_role by platform operators only.
 */
export async function listAcademicUnits(
  universityId: string,
): Promise<AcademicUnitRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("academic_units")
    .select("id, parent_id, code, name, unit_type, status")
    .eq("university_id", universityId)
    .order("name", { ascending: true });

  if (error) {
    throw new DataAccessError("Could not load academic units", error.code);
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    parentId: row.parent_id,
    code: row.code,
    name: row.name,
    unitType: row.unit_type,
    status: row.status,
  }));
}

export async function listAcademicYears(
  universityId: string,
): Promise<AcademicYearRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("academic_years")
    .select("id, code, name, start_date, end_date, status, is_current")
    .eq("university_id", universityId)
    .order("start_date", { ascending: false });

  if (error) {
    throw new DataAccessError("Could not load academic years", error.code);
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    code: row.code,
    name: row.name,
    startDate: row.start_date,
    endDate: row.end_date,
    status: row.status,
    isCurrent: row.is_current,
  }));
}

export async function listSemesters(
  universityId: string,
  academicYearId?: string,
): Promise<SemesterRow[]> {
  const supabase = await createSupabaseServerClient();
  let request = supabase
    .from("semesters")
    .select(
      "id, academic_year_id, code, name, sequence_no, start_date, end_date, status",
    )
    .eq("university_id", universityId)
    .order("sequence_no", { ascending: true });

  if (academicYearId) {
    request = request.eq("academic_year_id", academicYearId);
  }

  const { data, error } = await request;

  if (error) {
    throw new DataAccessError("Could not load semesters", error.code);
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    academicYearId: row.academic_year_id,
    code: row.code,
    name: row.name,
    sequenceNo: row.sequence_no,
    startDate: row.start_date,
    endDate: row.end_date,
    status: row.status,
  }));
}

export type ClassAcademicLink = {
  universityId: string | null;
  academicUnitId: string | null;
  academicYearId: string | null;
  semesterId: string | null;
  entryYear: number | null;
  code: string | null;
};

/**
 * The new-model tenant keys on a class row. Legacy classes return all-NULL —
 * callers must treat that as "not linked", never as a tenant value.
 */
export async function getClassAcademicLink(
  classId: string,
): Promise<ClassAcademicLink | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("classes")
    .select(
      "university_id, academic_unit_id, academic_year_id, semester_id, entry_year, code",
    )
    .eq("id", classId)
    .maybeSingle();

  if (error) {
    throw new DataAccessError(
      "Could not load the class academic link",
      error.code,
    );
  }

  if (!data) {
    return null;
  }

  return {
    universityId: data.university_id,
    academicUnitId: data.academic_unit_id,
    academicYearId: data.academic_year_id,
    semesterId: data.semester_id,
    entryYear: data.entry_year,
    code: data.code,
  };
}

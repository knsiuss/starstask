import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Lecturers may only manage the courses assigned to them. A non-lecturer class
 * admin keeps class-wide access; that path is covered by the existing suites.
 *
 * Requires the same disposable Supabase env as the other integration suites.
 */
const url = process.env.SUPABASE_TEST_URL;
const anonKey = process.env.SUPABASE_TEST_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY;
const hasEnv = Boolean(url && anonKey && serviceRoleKey);

const suffix = Date.now().toString(36);
const password = `test-${crypto.randomUUID()}`;

type TestUser = { id: string; client: SupabaseClient };

let admin: SupabaseClient;
let universityId = "";
let classId = "";
let courseId = "";
let ownSubjectId = "";
let otherSubjectId = "";
let lecturerA: TestUser;
let lecturerB: TestUser;
let lecturerC: TestUser;
let reporter: TestUser;
let foreignAssignmentId = "";
let reportId = "";
let lecturerCSubjectId = "";

async function createUser(label: string): Promise<TestUser> {
  const email = `scope-${suffix}-${label}@example.test`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) {
    throw new Error(`Could not create ${label}: ${error?.message}`);
  }

  const client = createClient(url!, anonKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: signInError } = await client.auth.signInWithPassword({
    email,
    password,
  });
  if (signInError) {
    throw new Error(`Could not sign in ${label}: ${signInError.message}`);
  }

  return { id: data.user.id, client };
}

describe.skipIf(!hasEnv)("lecturer course scope", () => {
  beforeAll(async () => {
    admin = createClient(url!, serviceRoleKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: university, error: universityError } = await admin
      .from("universities")
      .insert({
        slug: `scope-uni-${suffix}`,
        name: `Scope University ${suffix}`,
        status: "active",
      })
      .select("id")
      .single();
    if (universityError || !university) {
      throw new Error(`Could not seed university: ${universityError?.message}`);
    }
    universityId = university.id;

    const courseName = `Scope Course ${suffix}`;
    const { data: course, error: courseError } = await admin
      .from("courses")
      .insert({ name: courseName, code: `SC-${suffix}` })
      .select("id")
      .single();
    if (courseError || !course) {
      throw new Error(`Could not seed course: ${courseError?.message}`);
    }
    courseId = course.id;

    const { data: klass, error: classError } = await admin
      .from("classes")
      .insert({
        slug: `scope-class-${suffix}`,
        name: `Scope Class ${suffix}`,
        description: "Lecturer course scope regression fixture.",
        course_id: courseId,
        course_name: courseName,
        semester: "1",
        academic_year: "2026/2027",
        status: "active",
      })
      .select("id")
      .single();
    if (classError || !klass) {
      throw new Error(`Could not seed class: ${classError?.message}`);
    }
    classId = klass.id;

    lecturerA = await createUser("lecturer-a");
    lecturerB = await createUser("lecturer-b");
    lecturerC = await createUser("lecturer-c");
    reporter = await createUser("reporter");

    const { error: membershipError } = await admin
      .from("university_memberships")
      .insert(
        [lecturerA, lecturerB, lecturerC, reporter].map((user) => ({
          user_id: user.id,
          university_id: universityId,
          role: user.id === reporter.id ? "student" : "lecturer",
          status: "active",
        })),
      );
    if (membershipError) {
      throw new Error(`Could not seed memberships: ${membershipError.message}`);
    }

    // lecturerC is deliberately not a member or admin yet: the trigger must
    // create both when a course is assigned to them.
    const { error: memberError } = await admin.from("class_members").insert(
      [lecturerA, lecturerB, reporter].map((user) => ({
        class_id: classId,
        user_id: user.id,
        joined_via: "admin_assignment",
      })),
    );
    if (memberError) {
      throw new Error(`Could not seed class members: ${memberError.message}`);
    }

    const { error: adminError } = await admin.from("class_admins").insert([
      { class_id: classId, user_id: lecturerA.id },
      { class_id: classId, user_id: lecturerB.id },
    ]);
    if (adminError) {
      throw new Error(`Could not seed class admin: ${adminError.message}`);
    }

    const { data: subjects, error: subjectError } = await admin
      .from("class_subjects")
      .insert([
        {
          class_id: classId,
          name: "Lecturer A course",
          lecturer_name: "Lecturer A",
          lecturer_user_id: lecturerA.id,
        },
        {
          class_id: classId,
          name: "Lecturer B course",
          lecturer_name: "Lecturer B",
          lecturer_user_id: lecturerB.id,
        },
      ])
      .select();
    if (subjectError || !subjects || subjects.length !== 2) {
      throw new Error(`Could not seed subjects: ${subjectError?.message}`);
    }
    const ownSubject = subjects.find((s) => s.name === "Lecturer A course");
    const otherSubject = subjects.find((s) => s.name === "Lecturer B course");
    if (!ownSubject || !otherSubject) {
      throw new Error("Could not identify the seeded subjects");
    }
    ownSubjectId = ownSubject.id;
    otherSubjectId = otherSubject.id;

    const { data: assignment, error: assignmentError } = await admin
      .from("assignments")
      .insert({
        title: "Another lecturer's assignment",
        description: "Scope fixture.",
        course_id: courseId,
        class_id: classId,
        subject_id: otherSubjectId,
        user_id: lecturerB.id,
        lecturer_name: "Lecturer B",
        assignment_type: "individual",
        status: "published",
      })
      .select("id")
      .single();
    if (assignmentError || !assignment) {
      throw new Error(`Could not seed assignment: ${assignmentError?.message}`);
    }
    foreignAssignmentId = assignment.id;

    const { data: report, error: reportError } = await admin
      .from("assignment_reports")
      .insert({
        assignment_id: foreignAssignmentId,
        reporter_id: reporter.id,
        class_id: classId,
        reason: "wrong_details",
      })
      .select("id")
      .single();
    if (reportError || !report) {
      throw new Error(`Could not seed report: ${reportError?.message}`);
    }
    reportId = report.id;
  });

  afterAll(async () => {
    if (!admin) return;

    if (reportId) {
      await admin.from("assignment_reports").delete().eq("id", reportId);
    }
    if (foreignAssignmentId) {
      await admin.from("assignments").delete().eq("id", foreignAssignmentId);
    }
    if (classId) {
      await admin.from("class_subjects").delete().eq("class_id", classId);
      await admin.from("class_members").delete().eq("class_id", classId);
      await admin.from("class_admins").delete().eq("class_id", classId);
    }
    if (lecturerCSubjectId) {
      await admin.from("class_subjects").delete().eq("id", lecturerCSubjectId);
      await admin
        .from("class_members")
        .delete()
        .eq("class_id", classId)
        .eq("user_id", lecturerC.id);
    }
    if (universityId) {
      await admin
        .from("university_memberships")
        .delete()
        .eq("university_id", universityId);
    }
    if (classId) {
      await admin.from("classes").delete().eq("id", classId);
    }
    if (courseId) {
      await admin.from("courses").delete().eq("id", courseId);
    }
    if (universityId) {
      await admin.from("universities").delete().eq("id", universityId);
    }
    for (const user of [lecturerA, lecturerB, lecturerC, reporter]) {
      if (user) {
        await admin.auth.admin.deleteUser(user.id);
      }
    }
  });

  it("lets a lecturer manage only their own course in a class they administer", async () => {
    const own = await lecturerA.client.rpc("can_manage_subject", {
      p_class_id: classId,
      p_subject_id: ownSubjectId,
    });
    const other = await lecturerA.client.rpc("can_manage_subject", {
      p_class_id: classId,
      p_subject_id: otherSubjectId,
    });

    expect(own.error).toBeNull();
    expect(own.data).toBe(true);
    expect(other.error).toBeNull();
    expect(other.data).toBe(false);
  });

  it("auto-publishes a lecturer's assignment on their own course only", async () => {
    const own = await lecturerA.client.rpc("submit_class_assignment", {
      p_class_id: classId,
      p_subject_id: ownSubjectId,
      p_title: "Own course material",
      p_description: "Should be published without moderation.",
      p_assignment_type: "individual",
    });
    expect(own.error).toBeNull();
    expect(typeof own.data).toBe("string");

    if (typeof own.data === "string") {
      const { data } = await admin
        .from("assignments")
        .select("status, subject_id")
        .eq("id", own.data)
        .single();
      expect(data?.status).toBe("published");
      await admin.from("assignments").delete().eq("id", own.data);
    }

    const other = await lecturerA.client.rpc("submit_class_assignment", {
      p_class_id: classId,
      p_subject_id: otherSubjectId,
      p_title: "Not my course",
      p_description: "Must be refused.",
      p_assignment_type: "individual",
    });
    expect(other.error?.code).toBe("42501");
  });

  it("grants class admin automatically when a lecturer is assigned a course", async () => {
    const { data: subject, error: subjectError } = await admin
      .from("class_subjects")
      .insert({
        class_id: classId,
        name: "Lecturer C course",
        lecturer_name: "Lecturer C",
        lecturer_user_id: lecturerC.id,
      })
      .select("id")
      .single();
    if (subjectError || !subject) {
      throw new Error(`Could not assign course: ${subjectError?.message}`);
    }
    lecturerCSubjectId = subject.id;

    const { data: adminRow } = await admin
      .from("class_admins")
      .select("user_id")
      .eq("class_id", classId)
      .eq("user_id", lecturerC.id)
      .maybeSingle();
    expect(adminRow?.user_id).toBe(lecturerC.id);

    const own = await lecturerC.client.rpc("can_manage_subject", {
      p_class_id: classId,
      p_subject_id: lecturerCSubjectId,
    });
    const other = await lecturerC.client.rpc("can_manage_subject", {
      p_class_id: classId,
      p_subject_id: ownSubjectId,
    });

    expect(own.data).toBe(true);
    expect(other.data).toBe(false);
  });

  it("hides another lecturer's reader reports", async () => {
    const visibleToA = await lecturerA.client
      .from("assignment_reports")
      .select("id")
      .eq("id", reportId);
    const visibleToB = await lecturerB.client
      .from("assignment_reports")
      .select("id")
      .eq("id", reportId);

    expect(visibleToA.error).toBeNull();
    expect(visibleToA.data).toEqual([]);
    expect(visibleToB.error).toBeNull();
    expect(visibleToB.data).toHaveLength(1);
  });
});

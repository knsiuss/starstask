import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockFrom, mockCreateSupabaseServerClient } = vi.hoisted(() => {
  const from = vi.fn();
  const createClient = vi.fn(async () => ({ from }));
  return { mockFrom: from, mockCreateSupabaseServerClient: createClient };
});

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: mockCreateSupabaseServerClient,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(),
}));

import { DataAccessError } from "@/lib/db/assignments";
import {
  getMemberCourseAccess,
  listUserCourseAccessMap,
} from "@/lib/db/course-access";

function makeChain(result: { data: unknown; error: { code?: string } | null }) {
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    in: vi.fn(() => Promise.resolve(result)),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
    then: (
      onFulfilled?: (value: typeof result) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ) => Promise.resolve(result).then(onFulfilled, onRejected),
  };

  return chain;
}

describe("course-access fail-closed guards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws DataAccessError when class_members lookup fails in getMemberCourseAccess", async () => {
    mockFrom.mockImplementationOnce(() =>
      makeChain({ data: null, error: { code: "42501" } }),
    );

    await expect(
      getMemberCourseAccess("class-1", "user-1"),
    ).rejects.toBeInstanceOf(DataAccessError);
  });

  it("throws DataAccessError when member row does not exist in getMemberCourseAccess", async () => {
    mockFrom.mockImplementationOnce(() =>
      makeChain({ data: null, error: null }),
    );

    await expect(
      getMemberCourseAccess("class-1", "user-1"),
    ).rejects.toBeInstanceOf(DataAccessError);
  });

  it("throws DataAccessError when class_member_courses lookup fails for selected scope", async () => {
    mockFrom
      .mockImplementationOnce(() =>
        makeChain({ data: { course_scope: "selected" }, error: null }),
      )
      .mockImplementationOnce(() =>
        makeChain({ data: null, error: { code: "PGRST301" } }),
      );

    await expect(
      getMemberCourseAccess("class-1", "user-1"),
    ).rejects.toBeInstanceOf(DataAccessError);
  });

  it("returns allowedSubjectIds when scope is selected", async () => {
    mockFrom
      .mockImplementationOnce(() =>
        makeChain({ data: { course_scope: "selected" }, error: null }),
      )
      .mockImplementationOnce(() =>
        makeChain({
          data: [{ subject_id: "sub-1" }, { subject_id: "sub-2" }],
          error: null,
        }),
      );

    const access = await getMemberCourseAccess("class-1", "user-1");

    expect(access.scope).toBe("selected");
    expect([...access.allowedSubjectIds]).toEqual(["sub-1", "sub-2"]);
  });

  it("throws DataAccessError instead of returning empty map on error in listUserCourseAccessMap", async () => {
    mockFrom.mockImplementationOnce(() =>
      makeChain({ data: null, error: { code: "XX000" } }),
    );

    await expect(
      listUserCourseAccessMap("user-1", ["class-1"]),
    ).rejects.toBeInstanceOf(DataAccessError);
  });

  it("throws DataAccessError when class_member_courses fails in listUserCourseAccessMap", async () => {
    mockFrom
      .mockImplementationOnce(() =>
        makeChain({
          data: [{ class_id: "class-1", course_scope: "selected" }],
          error: null,
        }),
      )
      .mockImplementationOnce(() =>
        makeChain({ data: null, error: { code: "XX001" } }),
      );

    await expect(
      listUserCourseAccessMap("user-1", ["class-1"]),
    ).rejects.toBeInstanceOf(DataAccessError);
  });
});

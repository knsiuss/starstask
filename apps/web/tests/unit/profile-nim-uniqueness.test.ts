import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireSessionMock, updateMyProfileMock, joinOrCreateClassMock } =
  vi.hoisted(() => ({
    requireSessionMock: vi.fn(),
    updateMyProfileMock: vi.fn(),
    joinOrCreateClassMock: vi.fn(),
  }));

vi.mock("@/features/classes/class-access", () => ({
  requireSession: requireSessionMock,
}));

vi.mock("@/lib/db/profiles", () => ({
  updateMyProfile: updateMyProfileMock,
  joinOrCreateClass: joinOrCreateClassMock,
  setMyAvatarUrl: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));

vi.mock("@/lib/storage/avatars", () => ({
  AVATAR_BUCKET: "avatars",
  buildAvatarStoragePath: vi.fn(),
  validateAvatarFile: vi.fn(),
}));

import { ApiError } from "@/lib/api/errors";
import { DataAccessError } from "@/lib/db/assignments";
import { saveOnboardingProfile } from "@/features/profile/profile-service";

const INPUT = {
  persona: "student" as const,
  fullName: "Test Student",
  nickname: "Tester",
  nim: "241011400306",
  university: "Universitas Test",
  className: undefined,
};

const PROFILE = {
  id: "user-1",
  fullName: "Test Student",
  nickname: "Tester",
  nim: "241011400306",
  university: "Universitas Test",
  declaredClassName: null,
  avatarUrl: null,
  onboardedAt: "2026-10-29T00:00:00.000Z",
};

beforeEach(() => {
  requireSessionMock.mockReset();
  updateMyProfileMock.mockReset();
  joinOrCreateClassMock.mockReset();
  requireSessionMock.mockResolvedValue({ user: { id: "user-1" } });
});

describe("saveOnboardingProfile", () => {
  it("reports a duplicate NIM as a nim field error", async () => {
    updateMyProfileMock.mockRejectedValue(
      new DataAccessError("Could not save your profile", "23505"),
    );

    const failure = await saveOnboardingProfile(INPUT, null).catch(
      (error: unknown) => error,
    );

    expect(failure).toBeInstanceOf(ApiError);
    expect(failure).toMatchObject({
      status: 409,
      code: "nim_taken",
      fieldErrors: { nim: expect.any(String) },
    });
    expect(joinOrCreateClassMock).not.toHaveBeenCalled();
  });

  it("saves the profile and reports the class outcome", async () => {
    updateMyProfileMock.mockResolvedValue(PROFILE);
    joinOrCreateClassMock.mockResolvedValue({ status: "no_match" });

    const result = await saveOnboardingProfile(
      { ...INPUT, className: "05TPLM002" },
      null,
    );

    expect(result.profile).toEqual(PROFILE);
    expect(result.classJoin).toEqual({ status: "no_match" });
    expect(joinOrCreateClassMock).toHaveBeenCalledWith("05TPLM002");
  });
});

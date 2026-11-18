import { describe, expect, it } from "vitest";

import {
  attendanceSyncExchangeRequestSchema,
  syncSessionPayloadSchema,
} from "@starstask/contracts";

import { mapAttendanceStatusToSyncStatus } from "@/lib/attendance-sync/roster";
import {
  ATTENDANCE_SYNC_TTL_MS,
  signAttendanceSyncToken,
  verifyAttendanceSyncToken,
} from "@/lib/attendance-sync/token";

const MEETING_ID = "11111111-1111-4111-8111-111111111111";
const CLASS_ID = "22222222-2222-4222-8222-222222222222";
const USER_ID = "33333333-3333-4333-8333-333333333333";

describe("attendance sync token", () => {
  it("signs and verifies a valid 15-minute token", () => {
    const nowMs = 1_760_000_000_000;
    const { code, expiresAt } = signAttendanceSyncToken(
      {
        meetingId: MEETING_ID,
        classId: CLASS_ID,
        issuedBy: USER_ID,
      },
      nowMs,
    );

    expect(expiresAt).toBe(
      new Date(nowMs + ATTENDANCE_SYNC_TTL_MS).toISOString(),
    );

    const verified = verifyAttendanceSyncToken(code, nowMs + 60_000);

    expect(verified).not.toBeNull();
    expect(verified?.meetingId).toBe(MEETING_ID);
    expect(verified?.classId).toBe(CLASS_ID);
    expect(verified?.issuedBy).toBe(USER_ID);
    expect(verified?.exp).toBe(nowMs + ATTENDANCE_SYNC_TTL_MS);
  });

  it("rejects an expired token", () => {
    const nowMs = 1_760_000_000_000;
    const { code } = signAttendanceSyncToken(
      {
        meetingId: MEETING_ID,
        classId: CLASS_ID,
        issuedBy: USER_ID,
      },
      nowMs,
    );

    expect(
      verifyAttendanceSyncToken(code, nowMs + ATTENDANCE_SYNC_TTL_MS),
    ).toBeNull();
    expect(
      verifyAttendanceSyncToken(code, nowMs + ATTENDANCE_SYNC_TTL_MS + 1_000),
    ).toBeNull();
  });

  it("rejects a tampered payload or signature", () => {
    const nowMs = 1_760_000_000_000;
    const { code } = signAttendanceSyncToken(
      {
        meetingId: MEETING_ID,
        classId: CLASS_ID,
        issuedBy: USER_ID,
      },
      nowMs,
    );

    const [encodedPayload, signature] = code.split(".");
    const tamperedPayload = Buffer.from(
      JSON.stringify({
        meetingId: MEETING_ID,
        classId: "99999999-9999-4999-8999-999999999999",
        issuedBy: USER_ID,
        exp: nowMs + ATTENDANCE_SYNC_TTL_MS,
        nonce: "tampered",
      }),
      "utf8",
    ).toString("base64url");

    expect(
      verifyAttendanceSyncToken(`${tamperedPayload}.${signature}`, nowMs),
    ).toBeNull();

    const flippedChar = signature?.startsWith("a") ? "b" : "a";
    const tamperedSignature = `${flippedChar}${signature?.slice(1) ?? ""}`;

    expect(
      verifyAttendanceSyncToken(
        `${encodedPayload}.${tamperedSignature}`,
        nowMs,
      ),
    ).toBeNull();
    expect(verifyAttendanceSyncToken("invalid-token", nowMs)).toBeNull();
    expect(verifyAttendanceSyncToken("a.b.c", nowMs)).toBeNull();
  });
});

describe("mapAttendanceStatusToSyncStatus", () => {
  it("maps StarsTask statuses to SIAKAD sync statuses", () => {
    expect(mapAttendanceStatusToSyncStatus("present")).toBe("hadir");
    expect(mapAttendanceStatusToSyncStatus("late")).toBe("hadir");
    expect(mapAttendanceStatusToSyncStatus("excused")).toBe("izin");
    expect(mapAttendanceStatusToSyncStatus("leave")).toBe("izin");
    expect(mapAttendanceStatusToSyncStatus("sick")).toBe("sakit");
    expect(mapAttendanceStatusToSyncStatus("absent")).toBe("alpa");
    expect(mapAttendanceStatusToSyncStatus("not_recorded")).toBe("alpa");
    expect(mapAttendanceStatusToSyncStatus("unmarked")).toBe("alpa");
    expect(mapAttendanceStatusToSyncStatus(null)).toBe("alpa");
  });
});

describe("attendance sync contracts", () => {
  it("validates sync exchange request and response payload", () => {
    expect(
      attendanceSyncExchangeRequestSchema.safeParse({ code: "short" }).success,
    ).toBe(false);
    expect(
      attendanceSyncExchangeRequestSchema.safeParse({
        code: "valid-looking-sync-token",
      }).success,
    ).toBe(true);

    const payloadResult = syncSessionPayloadSchema.safeParse({
      meetingId: MEETING_ID,
      meetingTitle: "Pertemuan 1 - Pengantar",
      className: "TI-4A",
      expiresAt: "2026-11-18T08:30:00.000Z",
      students: [
        { nim: "2024001", displayName: "Andi Pratama", status: "hadir" },
        { nim: null, displayName: "Budi Santoso", status: "alpa" },
      ],
    });

    expect(payloadResult.success).toBe(true);
  });
});

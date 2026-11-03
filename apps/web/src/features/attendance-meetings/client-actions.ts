"use client";

/**
 * Client-side helpers for the attendance meeting API.
 *
 * The endpoints themselves live under
 * `/api/classes/[slug]/attendance/meetings/[id]`, and every one of them
 * re-checks the caller's class-admin role on the server.
 */

/** Opens a scheduled meeting so students can check in. */
export async function requestOpenAttendanceMeeting(
  classSlug: string,
  sessionId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const response = await fetch(
    `/api/classes/${classSlug}/attendance/meetings/${sessionId}/open`,
    { method: "POST" },
  );

  if (response.ok) {
    return { ok: true };
  }

  const body = (await response.json().catch(() => null)) as {
    error?: { message?: string };
  } | null;

  return {
    ok: false,
    message: body?.error?.message ?? "Could not open attendance.",
  };
}

import { createHash } from "node:crypto";

import { attendanceSyncExchangeRequestSchema } from "@starstask/contracts";

import { ApiError, notFound, serviceUnavailable } from "@/lib/api/errors";
import { handleRouteError } from "@/lib/api/responses";
import { getAttendanceSyncSessionPayload } from "@/lib/attendance-sync/roster";
import { verifyAttendanceSyncToken } from "@/lib/attendance-sync/token";
import { isSupabaseConfigured } from "@/lib/env/public";
import {
  enforceRateLimit,
  getClientIdentifier,
} from "@/lib/security/rate-limit";
import { isServiceRoleConfigured } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function withCors(response: Response): Response {
  const headers = new Headers(response.headers);

  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    headers.set(key, value);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

/** Exchanges a short-lived HMAC sync code for the meeting's attendance roster. */
export async function POST(request: Request) {
  try {
    const clientIp = getClientIdentifier(request);

    await enforceRateLimit({
      action: "attendance:sync:ip",
      identifier: clientIp,
      limit: 60,
      windowSeconds: 300,
    });

    const rawBody = (await request.json().catch(() => null)) as unknown;
    const parsed = attendanceSyncExchangeRequestSchema.safeParse(rawBody);

    if (!parsed.success) {
      throw new ApiError(400, "invalid_request", "Sync code is required.");
    }

    const tokenHash = createHash("sha256")
      .update(parsed.data.code)
      .digest("hex")
      .slice(0, 24);

    await enforceRateLimit({
      action: "attendance:sync:token",
      identifier: tokenHash,
      limit: 30,
      windowSeconds: 300,
    });

    const tokenPayload = verifyAttendanceSyncToken(parsed.data.code);

    if (!tokenPayload) {
      throw new ApiError(
        401,
        "invalid_sync_code",
        "Sync code is invalid or expired.",
      );
    }

    if (!isSupabaseConfigured() || !isServiceRoleConfigured()) {
      throw serviceUnavailable();
    }

    const sessionPayload = await getAttendanceSyncSessionPayload(
      tokenPayload.meetingId,
      tokenPayload.classId,
      new Date(tokenPayload.exp).toISOString(),
    );

    if (!sessionPayload) {
      throw notFound();
    }

    return Response.json(
      { data: sessionPayload },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
          ...CORS_HEADERS,
        },
      },
    );
  } catch (error) {
    return withCors(await handleRouteError(error));
  }
}

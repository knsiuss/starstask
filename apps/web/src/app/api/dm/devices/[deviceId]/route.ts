import { NextResponse } from "next/server";
import { z } from "zod";

import { ApiError } from "@/lib/api/errors";
import { getSessionUser } from "@/lib/auth/session";
import { DataAccessError } from "@/lib/db/assignments";
import { revokeOwnDevice } from "@/lib/db/dm-devices";
import { enforceRateLimit } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ deviceId: string }> };

const deviceIdSchema = z.string().trim().min(1).max(128);

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const session = await getSessionUser();

    if (!session) {
      return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    }

    await enforceRateLimit({
      action: "dm:devices:delete",
      identifier: session.user.id,
      limit: 30,
      windowSeconds: 60,
      onBackendFailure: "closed",
    });

    const { deviceId } = await params;
    const parsedId = deviceIdSchema.safeParse(deviceId);

    if (!parsedId.success) {
      return NextResponse.json({ error: "Invalid device ID" }, { status: 400 });
    }

    const result = await revokeOwnDevice(session.user.id, parsedId.data);

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }

    if (error instanceof DataAccessError) {
      if (error.code === "PGRST116") {
        return NextResponse.json(
          { error: "Device not found" },
          { status: 404 },
        );
      }

      if (error.code === "42501") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    return NextResponse.json(
      { error: "Could not revoke device" },
      { status: 500 },
    );
  }
}

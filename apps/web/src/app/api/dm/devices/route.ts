import { NextResponse } from "next/server";
import { z } from "zod";

import { ApiError } from "@/lib/api/errors";
import { getSessionUser } from "@/lib/auth/session";
import { DataAccessError } from "@/lib/db/assignments";
import {
  getConversationDeviceKeys,
  listOwnDevices,
  upsertOwnDevice,
} from "@/lib/db/dm-devices";
import {
  enforceRateLimit,
  getClientIdentifier,
} from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

const conversationIdSchema = z.string().uuid();

const registerDeviceSchema = z.object({
  deviceId: z.string().trim().min(1).max(128),
  deviceLabel: z.string().trim().min(1).max(120),
  identityPublicKey: z.string().trim().min(1).max(1024),
  signedPrekeyPublic: z.string().trim().min(1).max(1024),
  oneTimePrekeys: z
    .array(z.string().trim().min(1).max(1024))
    .max(100)
    .optional(),
});

function handleRouteFailure(error: unknown, fallbackMessage: string) {
  if (error instanceof ApiError) {
    return NextResponse.json(
      { error: error.message },
      { status: error.status },
    );
  }

  if (error instanceof SyntaxError) {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 },
    );
  }

  if (error instanceof DataAccessError) {
    if (error.code === "42501") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (error.code === "PGRST116") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (error.code === "22023") {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
  }

  return NextResponse.json({ error: fallbackMessage }, { status: 500 });
}

export async function GET(request: Request) {
  try {
    await enforceRateLimit({
      action: "dm:devices:get",
      identifier: getClientIdentifier(request),
      limit: 120,
      windowSeconds: 60,
      onBackendFailure: "closed",
    });

    const session = await getSessionUser();

    if (!session) {
      return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    }

    const url = new URL(request.url);
    const conversationIdParam = url.searchParams.get("conversationId");

    if (conversationIdParam !== null) {
      const parsedId = conversationIdSchema.safeParse(conversationIdParam);

      if (!parsedId.success) {
        return NextResponse.json(
          { error: "Invalid conversation ID" },
          { status: 400 },
        );
      }

      const devices = await getConversationDeviceKeys(
        parsedId.data,
        session.user.id,
      );

      return NextResponse.json({ devices });
    }

    const devices = await listOwnDevices(session.user.id);

    return NextResponse.json({ devices });
  } catch (error) {
    return handleRouteFailure(error, "Could not load devices");
  }
}

export async function POST(request: Request) {
  try {
    await enforceRateLimit({
      action: "dm:devices:post",
      identifier: getClientIdentifier(request),
      limit: 30,
      windowSeconds: 60,
      onBackendFailure: "closed",
    });

    const session = await getSessionUser();

    if (!session) {
      return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    }

    const body: unknown = await request.json();
    const parsed = registerDeviceSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid device payload" },
        { status: 400 },
      );
    }

    const device = await upsertOwnDevice(session.user.id, parsed.data);

    return NextResponse.json({ device });
  } catch (error) {
    return handleRouteFailure(error, "Could not register device");
  }
}

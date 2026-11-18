import { NextResponse } from "next/server";
import { z } from "zod";

import { ApiError } from "@/lib/api/errors";
import { getSessionUser } from "@/lib/auth/session";
import { DataAccessError } from "@/lib/db/assignments";
import {
  listRecipientSenderKeys,
  upsertSenderKeyEnvelopes,
} from "@/lib/db/dm-sender-keys";
import {
  enforceRateLimit,
  getClientIdentifier,
} from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

const conversationIdSchema = z.string().uuid();
const deviceIdSchema = z.string().trim().min(1).max(128);

const senderKeyEnvelopeSchema = z.object({
  ownerDeviceId: z.string().trim().min(1).max(128),
  recipientUserId: z.string().uuid(),
  recipientDeviceId: z.string().trim().min(1).max(128),
  keyId: z.string().trim().min(1).max(128),
  encryptedSenderKey: z.string().trim().min(1).max(8000),
});

const upsertSenderKeysSchema = z.object({
  envelopes: z.array(senderKeyEnvelopeSchema).min(1).max(200),
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

export async function GET(request: Request, { params }: Params) {
  try {
    await enforceRateLimit({
      action: "dm:sender-keys:get",
      identifier: getClientIdentifier(request),
      limit: 120,
      windowSeconds: 60,
      onBackendFailure: "closed",
    });

    const session = await getSessionUser();

    if (!session) {
      return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    }

    const { id } = await params;
    const parsedId = conversationIdSchema.safeParse(id);

    if (!parsedId.success) {
      return NextResponse.json(
        { error: "Invalid conversation ID" },
        { status: 400 },
      );
    }

    const url = new URL(request.url);
    const deviceIdParam = url.searchParams.get("deviceId");
    let deviceId: string | undefined;

    if (deviceIdParam !== null) {
      const parsedDeviceId = deviceIdSchema.safeParse(deviceIdParam);

      if (!parsedDeviceId.success) {
        return NextResponse.json(
          { error: "Invalid device ID" },
          { status: 400 },
        );
      }

      deviceId = parsedDeviceId.data;
    }

    const senderKeys = await listRecipientSenderKeys(
      parsedId.data,
      session.user.id,
      deviceId,
    );

    return NextResponse.json({ senderKeys });
  } catch (error) {
    return handleRouteFailure(error, "Could not load sender keys");
  }
}

export async function POST(request: Request, { params }: Params) {
  try {
    await enforceRateLimit({
      action: "dm:sender-keys:post",
      identifier: getClientIdentifier(request),
      limit: 60,
      windowSeconds: 60,
      onBackendFailure: "closed",
    });

    const session = await getSessionUser();

    if (!session) {
      return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    }

    const { id } = await params;
    const parsedId = conversationIdSchema.safeParse(id);

    if (!parsedId.success) {
      return NextResponse.json(
        { error: "Invalid conversation ID" },
        { status: 400 },
      );
    }

    const body: unknown = await request.json();
    const parsed = upsertSenderKeysSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid sender key envelopes" },
        { status: 400 },
      );
    }

    const stored = await upsertSenderKeyEnvelopes(
      parsedId.data,
      session.user.id,
      parsed.data.envelopes,
    );

    return NextResponse.json(
      { ok: true, count: stored.length },
      { status: 201 },
    );
  } catch (error) {
    return handleRouteFailure(error, "Could not store sender keys");
  }
}

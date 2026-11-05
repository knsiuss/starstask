import { NextResponse } from "next/server";

import { ApiError } from "@/lib/api/errors";
import { getOwnPublicKey, upsertOwnPublicKey } from "@/lib/db/direct-messages";
import {
  enforceRateLimit,
  getClientIdentifier,
} from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await enforceRateLimit({
      action: "dm:keys:get",
      identifier: getClientIdentifier(request),
      limit: 120,
      windowSeconds: 60,
      onBackendFailure: "closed",
    });

    const publicKey = await getOwnPublicKey();

    return NextResponse.json({ publicKey });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }
    return NextResponse.json({ error: "Could not load key" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    await enforceRateLimit({
      action: "dm:keys:put",
      identifier: getClientIdentifier(request),
      limit: 30,
      windowSeconds: 60,
      onBackendFailure: "closed",
    });

    const body = await request.json();
    const publicKey = body?.publicKey;

    if (
      typeof publicKey !== "string" ||
      publicKey.length === 0 ||
      publicKey.length > 500
    ) {
      return NextResponse.json(
        { error: "Invalid public key" },
        { status: 400 },
      );
    }

    await upsertOwnPublicKey(publicKey);

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }
    return NextResponse.json({ error: "Could not save key" }, { status: 500 });
  }
}

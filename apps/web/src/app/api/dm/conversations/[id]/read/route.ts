import { NextResponse } from "next/server";

import { ApiError } from "@/lib/api/errors";
import { markConversationRead } from "@/lib/db/dm-v2";
import {
  enforceRateLimit,
  getClientIdentifier,
} from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await enforceRateLimit({
      action: "dm:read",
      identifier: getClientIdentifier(req),
      limit: 120,
      windowSeconds: 60,
      onBackendFailure: "closed",
    });

    const { id } = await params;
    await markConversationRead(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }
    return NextResponse.json({ error: "Could not mark read" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";

import { ApiError } from "@/lib/api/errors";
import { blockUser, getConversationPeerId } from "@/lib/db/direct-messages";
import {
  enforceRateLimit,
  getClientIdentifier,
} from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    await enforceRateLimit({
      action: "dm:block",
      identifier: getClientIdentifier(request),
      limit: 30,
      windowSeconds: 60,
      onBackendFailure: "closed",
    });

    const { id } = await params;
    const peerId = await getConversationPeerId(id);

    await blockUser(peerId);

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }

    const code =
      error instanceof Error && "code" in error
        ? String((error as { code?: unknown }).code)
        : "50000";

    if (code === "42501") {
      return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    }

    return NextResponse.json({ error: "Could not block" }, { status: 500 });
  }
}

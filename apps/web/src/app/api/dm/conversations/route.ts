import { NextResponse } from "next/server";

import { ApiError } from "@/lib/api/errors";
import {
  getOrCreateConversation,
  listConversations,
  searchUsers,
} from "@/lib/db/direct-messages";
import {
  enforceRateLimit,
  getClientIdentifier,
} from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await enforceRateLimit({
      action: "dm:conversations:list",
      identifier: getClientIdentifier(request),
      limit: 120,
      windowSeconds: 60,
      onBackendFailure: "closed",
    });

    const url = new URL(request.url);
    const query = url.searchParams.get("q");

    if (query !== null) {
      const users = await searchUsers(query);

      return NextResponse.json({ users });
    }

    const conversations = await listConversations();

    return NextResponse.json({ conversations });
  } catch (error) {
    // Rate-limit and other ApiErrors keep their status and safe message.
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

    return NextResponse.json(
      { error: "Could not load chats" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    await enforceRateLimit({
      action: "dm:conversations:create",
      identifier: getClientIdentifier(request),
      limit: 60,
      windowSeconds: 60,
      onBackendFailure: "closed",
    });

    const body = await request.json();
    const otherUserId = body?.otherUserId;

    if (typeof otherUserId !== "string" || !otherUserId) {
      return NextResponse.json({ error: "Missing user" }, { status: 400 });
    }

    const id = await getOrCreateConversation(otherUserId);

    return NextResponse.json({ id });
  } catch (error) {
    // Rate-limit and other ApiErrors keep their status and safe message.
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

    if (code === "42501" || code === "22023") {
      return NextResponse.json(
        { error: "Could not open chat" },
        { status: 403 },
      );
    }

    return NextResponse.json({ error: "Could not open chat" }, { status: 500 });
  }
}

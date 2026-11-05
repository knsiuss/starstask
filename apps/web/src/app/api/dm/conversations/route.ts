import { NextResponse } from "next/server";

import {
  getOrCreateConversation,
  listConversations,
  searchUsers,
} from "@/lib/db/direct-messages";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const query = url.searchParams.get("q");

    if (query !== null) {
      const users = await searchUsers(query);

      return NextResponse.json({ users });
    }

    const conversations = await listConversations();

    return NextResponse.json({ conversations });
  } catch (error) {
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
    const body = await request.json();
    const otherUserId = body?.otherUserId;

    if (typeof otherUserId !== "string" || !otherUserId) {
      return NextResponse.json({ error: "Missing user" }, { status: 400 });
    }

    const id = await getOrCreateConversation(otherUserId);

    return NextResponse.json({ id });
  } catch (error) {
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

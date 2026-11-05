import { NextResponse } from "next/server";

import { markConversationRead } from "@/lib/db/dm-v2";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  await markConversationRead(id);
  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";

import { getTyping, setTyping } from "@/lib/db/dm-v2";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return NextResponse.json({ typing: await getTyping(id) });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json();
  await setTyping(id, Boolean(body?.isTyping));
  return NextResponse.json({ ok: true });
}

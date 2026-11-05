import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; messageId: string }> },
) {
  const { id, messageId } = await params;
  const body = await req.json();
  const emoji = String(body?.emoji ?? "").slice(0, 8);
  if (!emoji)
    return NextResponse.json({ error: "emoji required" }, { status: 400 });
  const supabase = (await createSupabaseServerClient()) as any;
  const { data: userData } = await supabase.auth.getUser();
  const me = userData.user?.id;
  if (!me)
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { data: msg } = await supabase
    .from("dm_messages")
    .select("reactions")
    .eq("id", messageId)
    .eq("conversation_id", id)
    .single();
  const reactions = { ...(msg?.reactions ?? {}), [me]: emoji };
  await supabase.from("dm_messages").update({ reactions }).eq("id", messageId);
  return NextResponse.json({ ok: true });
}

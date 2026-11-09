import { NextResponse } from "next/server";

import { isAuthorizedCronRequest } from "@/lib/security/cron-auth";
import { createSupabaseNotificationEventStore } from "@/lib/push/event-store";
import { runNotificationEvents } from "@/lib/push/event-scheduler";
import { createWebPushSender } from "@/lib/push/sender";
import { getPushConfig } from "@/lib/push/config";
import { isServiceRoleConfigured } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** QStash worker: dispatch notification_events (retry via QStash). */
export async function POST(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const config = getPushConfig();
  if (!config || !isServiceRoleConfigured()) {
    return NextResponse.json({ ok: true, skipped: true });
  }
  const summary = await runNotificationEvents({
    store: createSupabaseNotificationEventStore(),
    sender: createWebPushSender(config),
    limit: 50,
  });
  return NextResponse.json({ ok: true, summary });
}

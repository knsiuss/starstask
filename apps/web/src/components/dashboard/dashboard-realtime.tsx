"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * Dashboard auto-refresh via Supabase Realtime.
 *
 * Subscribes to INSERT/UPDATE/DELETE on the dashboard source tables
 * (published in supabase_realtime) and refreshes the server components
 * when they change — no manual reload needed. Refreshes are debounced
 * (3s) so a burst of writes (e.g. mass check-ins) causes at most one
 * refresh per window instead of a refresh storm.
 */
const DEBOUNCE_MS = 3000;

const TABLES = [
  "assignments",
  "discussion_sessions",
  "class_memberships",
] as const;

export function DashboardRealtime() {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const channel = supabase.channel("dashboard");

    const scheduleRefresh = () => {
      if (timer.current) {
        return;
      }
      timer.current = setTimeout(() => {
        timer.current = null;
        router.refresh();
      }, DEBOUNCE_MS);
    };

    for (const table of TABLES) {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        scheduleRefresh,
      );
    }

    void channel.subscribe();

    return () => {
      if (timer.current) {
        clearTimeout(timer.current);
      }
      void supabase.removeChannel(channel);
    };
  }, [router]);

  return null;
}

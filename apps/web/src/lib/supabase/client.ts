"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getSupabaseConfig } from "@/lib/env/public";
import type { Database } from "@/types/database";

let browserClient: SupabaseClient<Database> | undefined;

/**
 * Browser Supabase client. Only the publishable key is used here; every query
 * still passes through Row Level Security.
 */
export function createSupabaseBrowserClient(): SupabaseClient<Database> {
  if (browserClient) {
    return browserClient;
  }

  const { url, key } = getSupabaseConfig();

  browserClient = createBrowserClient<Database>(url, key);

  return browserClient;
}

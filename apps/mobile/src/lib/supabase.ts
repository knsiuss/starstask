import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase client for the mobile shell.
 *
 * Same project as web. PKCE is forced because Google OAuth inside a WebView
 * is blocked by Google (disallowed_useragent): the login must leave the
 * WebView through a Custom Tab and return through a deep link, where the
 * code is exchanged here. Session detection from the URL stays manual.
 */

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as
  string | undefined;

export function isSupabaseConfigured(): boolean {
  return Boolean(supabaseUrl && supabaseKey);
}

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured()) {
    return null;
  }

  if (!client) {
    client = createClient(supabaseUrl as string, supabaseKey as string, {
      auth: {
        flowType: "pkce",
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });
  }

  return client;
}

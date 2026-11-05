import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { Platform } from "react-native";

/**
 * Supabase client for the Expo shell.
 *
 * Same project as web. PKCE is forced because Google OAuth inside a
 * WebView is blocked by Google: login goes through expo-auth-session +
 * the system browser and returns through the `starstask://` deep link,
 * where the code is exchanged here. Session persists in AsyncStorage.
 *
 * Env: EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY
 * (public anon key only — never the service role key).
 */

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL as
  | string
  | undefined;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY as
  | string
  | undefined;

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
        storage: AsyncStorage,
      },
    });
  }

  return client;
}

export function isNativePlatform(): boolean {
  return Platform.OS === "ios" || Platform.OS === "android";
}

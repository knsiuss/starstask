import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";

import { getSupabase } from "./supabase";

/**
 * Google sign-in for the native shell.
 *
 * Google blocks OAuth inside a WebView, so the provider URL is opened in a
 * Custom Tab (system browser) and the app returns through a deep link
 * (`id.starstask.mobile://auth/callback?code=...`). The code is then
 * exchanged for a session with PKCE, following the official Supabase
 * Capacitor pattern. On web this is a no-op: the browser app does its own
 * redirect flow.
 */

export function isAuthDeepLink(url: string): boolean {
  return url.startsWith("id.starstask.mobile://auth/callback");
}

export async function signInWithGoogle(): Promise<void> {
  const supabase = getSupabase();

  if (!supabase) {
    throw new Error("Supabase is not configured for this build.");
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      skipBrowserRedirect: true,
      redirectTo: "id.starstask.mobile://auth/callback",
    },
  });

  if (error || !data.url) {
    throw error ?? new Error("Could not start Google sign-in.");
  }

  await Browser.open({ url: data.url });
}

export async function handleAuthDeepLink(url: string): Promise<void> {
  const supabase = getSupabase();

  if (!supabase || !isAuthDeepLink(url)) {
    return;
  }

  const { error } = await supabase.auth.exchangeCodeForSession(url);

  if (error) {
    throw error;
  }

  await Browser.close();
}

export function isNativeAuthAvailable(): boolean {
  return Capacitor.isNativePlatform();
}

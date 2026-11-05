import * as AuthSession from "expo-auth-session";
import { Linking } from "react-native";

import { getSupabase } from "./supabase";

/**
 * Google sign-in for the Expo shell.
 *
 * Google blocks OAuth inside a WebView, so the provider URL is opened
 * in the system browser and the app returns through the
 * `starstask://auth/callback` deep link, where the PKCE code is
 * exchanged for a session — the same pattern the Capacitor shell used.
 */

export function isAuthDeepLink(url: string): boolean {
  return url.startsWith("starstask://auth/callback");
}

export async function signInWithGoogle(): Promise<void> {
  const supabase = getSupabase();

  if (!supabase) {
    throw new Error("Supabase is not configured for this build.");
  }

  const redirectTo = AuthSession.makeRedirectUri({
    scheme: "starstask",
    path: "auth/callback",
  });

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      skipBrowserRedirect: true,
      redirectTo,
    },
  });

  if (error || !data.url) {
    throw error ?? new Error("Could not start Google sign-in.");
  }

  await Linking.openURL(data.url);
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
}

/**
 * Native Google sign-in entry point called from MainActivity after
 * Credential Manager + Firebase Auth succeed. The Firebase ID token is
 * traded for a Supabase session — the user never leaves the app.
 */
export async function signInWithNativeGoogleIdToken(
  idToken: string,
): Promise<void> {
  const supabase = getSupabase();

  if (!supabase) {
    throw new Error("Supabase is not configured for this build.");
  }

  const { error } = await supabase.auth.signInWithIdToken({
    provider: "google",
    token: idToken,
  });

  if (error) {
    throw error;
  }
}

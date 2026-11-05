/**
 * StarsTask Mobile entry (Capacitor).
 *
 * Shell only for now: auth (Google via Custom Tab + PKCE deep link) and
 * native push registration. Feature screens land in Fase 2 of
 * docs/ANDROID_ROADMAP.md.
 */
import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { SplashScreen } from "@capacitor/splash-screen";

import { handleAuthDeepLink, signInWithGoogle } from "./lib/auth";
import { registerNativePush } from "./lib/push";
import { getSupabase, isSupabaseConfigured } from "./lib/supabase";

const app = document.querySelector<HTMLDivElement>("#app");

function render(state: "loading" | "signed-out" | "signed-in" | "error"): void {
  if (!app) {
    return;
  }

  if (state === "loading") {
    app.textContent = "StarsTask Mobile — loading…";
    return;
  }

  if (state === "signed-in") {
    app.textContent = "StarsTask Mobile — signed in";
    return;
  }

  if (state === "error") {
    app.textContent = "StarsTask Mobile — sign-in failed, try again";
    return;
  }

  app.innerHTML =
    '<button id="login" type="button">Sign in with Google</button>';
  document
    .querySelector<HTMLButtonElement>("#login")
    ?.addEventListener("click", () => {
      void signInWithGoogle().catch(() => render("error"));
    });
}

async function refreshSession(): Promise<void> {
  const supabase = getSupabase();

  if (!supabase) {
    render(isSupabaseConfigured() ? "signed-out" : "error");
    return;
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  render(session ? "signed-in" : "signed-out");

  if (session) {
    await registerNativePush({
      onToken: (token) => console.log("[push] token", token),
      onNotificationTap: (url) => {
        if (url) {
          console.log("[push] tap", url);
        }
      },
    });
  }
}

render("loading");

if (Capacitor.isNativePlatform()) {
  void SplashScreen.hide();
}

void App.addListener("appUrlOpen", (event) => {
  void handleAuthDeepLink(event.url)
    .then(refreshSession)
    .catch(() => render("error"));
});

const supabase = getSupabase();
supabase?.auth.onAuthStateChange((_event, session) => {
  render(session ? "signed-in" : "signed-out");
});

void refreshSession();

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
import { formatTime, loadDashboard } from "./lib/dashboard";
import { registerNativePush } from "./lib/push";
import { getSupabase, isSupabaseConfigured } from "./lib/supabase";

const app = document.querySelector<HTMLDivElement>("#app");

function renderDashboard(
  data: Awaited<ReturnType<typeof loadDashboard>>,
): void {
  if (!app) {
    return;
  }

  const sessions =
    data.todaySessions.length === 0
      ? "<p>No sessions today.</p>"
      : `<ul>${data.todaySessions
          .map(
            (session) =>
              `<li>${session.subjectName ?? session.title} ${formatTime(session.startsAt)}-${formatTime(session.endsAt)} ${session.checkInStatus ?? "not recorded"}</li>`,
          )
          .join("")}</ul>`;

  const assignments =
    data.upcomingAssignments.length === 0
      ? "<p>No upcoming assignments.</p>"
      : `<ul>${data.upcomingAssignments
          .map(
            (assignment) =>
              `<li>${assignment.subjectName ?? ""} ${assignment.title}${assignment.deadline ? ` — ${formatTime(assignment.deadline)}` : ""}</li>`,
          )
          .join("")}</ul>`;

  app.innerHTML = `<h1>StarsTask Mobile</h1><h2>Today</h2>${sessions}<h2>Upcoming assignments</h2>${assignments}`;
}

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
    const userId = sessionUserId();

    if (userId) {
      void loadDashboard(userId)
        .then(renderDashboard)
        .catch(() => {
          app.textContent = "StarsTask Mobile — dashboard failed to load";
        });
    }

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

let currentUserId: string | null = null;

function sessionUserId(): string | null {
  return currentUserId;
}

async function refreshSession(): Promise<void> {
  const supabase = getSupabase();

  if (!supabase) {
    currentUserId = null;
    render(isSupabaseConfigured() ? "signed-out" : "error");
    return;
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  currentUserId = session?.user.id ?? null;
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
  currentUserId = session?.user.id ?? null;
  render(session ? "signed-in" : "signed-out");
});

void refreshSession();

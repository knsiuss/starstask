/**
 * StarsTask Mobile entry (Capacitor).
 *
 * Auth (Google via Custom Tab + PKCE deep link), native push, GPS
 * check-in with offline queue, attachment upload, and document opening.
 * Full feature parity lands in Fase 2 of docs/ANDROID_ROADMAP.md.
 */
import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { SplashScreen } from "@capacitor/splash-screen";
import { Browser } from "@capacitor/browser";

import { handleAuthDeepLink, signInWithGoogle } from "./lib/auth";
import { checkInToSession, syncQueuedCheckIns } from "./lib/checkin";
import { formatTime, loadDashboard } from "./lib/dashboard";
import { listAttachments, openAttachment } from "./lib/document";
import { registerNativePush, sendNativeTokenToServer } from "./lib/push";
import { getSupabase, isSupabaseConfigured } from "./lib/supabase";
import { uploadAttachmentFile } from "./lib/upload";

const app = document.querySelector<HTMLDivElement>("#app");

/**
 * Dashboard fields (titles, subject names) are user-controlled. They are
 * interpolated into innerHTML templates, so every interpolated value must
 * be escaped; ids used in query selectors are UUIDs returned by the
 * server and are safe as attribute values after the same escaping.
 */
function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/**
 * Report uncaught JS errors to the log (visible in Logcat and, when the
 * native bridge is attached, forwarded to Crashlytics). Messages are
 * logged verbatim from the runtime — never include tokens or personal
 * data at call sites.
 */
function installErrorReporting(): void {
  window.addEventListener("error", (event) => {
    console.error("[js-error]", event.message, event.filename, event.lineno);
  });
  window.addEventListener("unhandledrejection", (event) => {
    const reason =
      event.reason instanceof Error
        ? event.reason.message
        : String(event.reason);
    console.error("[js-unhandled-rejection]", reason);
  });
}

installErrorReporting();

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
          .map((session) => {
            const hasLocation =
              session.checkInLatitude !== null &&
              session.checkInLongitude !== null;
            const action = session.checkInStatus
              ? ` ${escapeHtml(session.checkInStatus)}`
              : hasLocation
                ? ` <button type="button" data-checkin="${escapeHtml(session.id)}">Check in</button>`
                : " no check-in point";

            return `<li>${escapeHtml(session.subjectName ?? session.title)} ${formatTime(session.startsAt)}-${formatTime(session.endsAt)}${action}</li>`;
          })
          .join("")}</ul>`;

  const assignments =
    data.upcomingAssignments.length === 0
      ? "<p>No upcoming assignments.</p>"
      : `<ul>${data.upcomingAssignments
          .map(
            (assignment) =>
              `<li>${escapeHtml(assignment.subjectName ?? "")} ${escapeHtml(assignment.title)}${assignment.deadline ? ` — ${formatTime(assignment.deadline)}` : ""} <button type="button" data-attach="${escapeHtml(assignment.id)}">Attach file</button> <span data-attachments="${escapeHtml(assignment.id)}"></span></li>`,
          )
          .join("")}</ul><input id="file-picker" type="file" hidden />`;

  app.innerHTML = `<h1>StarsTask Mobile</h1><h2>Today</h2>${sessions}<h2>Upcoming assignments</h2>${assignments}`;
  app
    .querySelectorAll<HTMLButtonElement>("[data-checkin]")
    .forEach((button) => {
      button.addEventListener("click", () => {
        const sessionId = button.dataset.checkin;
        const userId = sessionUserId();

        if (!sessionId || !userId) {
          return;
        }

        button.disabled = true;
        void checkInToSession(sessionId, userId)
          .then((result) => {
            app
              .querySelector(`[data-checkin="${sessionId}"]`)
              ?.replaceWith(
                document.createTextNode(
                  result.ok ? ` ${result.status}` : ` ${result.message}`,
                ),
              );
          })
          .catch(() => {
            button.disabled = false;
          });
      });
    });

  const filePicker = app.querySelector<HTMLInputElement>("#file-picker");
  let attachTarget: string | null = null;

  app.querySelectorAll<HTMLButtonElement>("[data-attach]").forEach((button) => {
    button.addEventListener("click", () => {
      attachTarget = button.dataset.attach ?? null;
      filePicker?.click();
    });
  });

  filePicker?.addEventListener("change", () => {
    const file = filePicker.files?.[0];
    const userId = sessionUserId();

    if (!file || !attachTarget || !userId) {
      return;
    }

    const assignmentId = attachTarget;
    filePicker.value = "";
    void uploadAttachmentFile(userId, assignmentId, file).then((result) => {
      if (!result.ok) {
        renderDashboardError(result.message);
        return;
      }

      void refreshDashboard();
    });
  });

  void Promise.all(
    data.upcomingAssignments.map(async (assignment) => {
      const attachments = await listAttachments(assignment.id);
      const slot = app.querySelector(`[data-attachments="${assignment.id}"]`);

      if (!slot || attachments.length === 0) {
        return;
      }

      for (const attachment of attachments) {
        const openButton = document.createElement("button");
        openButton.type = "button";
        openButton.textContent = `Open ${attachment.filename}`;
        openButton.addEventListener("click", () => {
          void openAttachment(attachment.storagePath).catch(() => {
            renderDashboardError("Could not open the attachment.");
          });
        });
        slot.append(openButton, " ");
      }
    }),
  );
}

function renderDashboardError(message: string): void {
  if (!app) {
    return;
  }

  const notice = document.createElement("p");
  notice.textContent = message;
  app.append(notice);
}

async function refreshDashboard(): Promise<void> {
  const userId = sessionUserId();

  if (!userId) {
    return;
  }

  const data = await loadDashboard(userId).catch(() => null);

  if (data) {
    renderDashboard(data);
  }
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
      onToken: (token) => {
        if (session.access_token) {
          void sendNativeTokenToServer(token, session.access_token);
        }
      },
      onNotificationTap: (url) => {
        // The shell has no router for web destinations: open the tapped
        // notification's internal path in a Custom Tab on the web origin,
        // the same pattern attachments and OAuth already use.
        void openNotificationDestination(url).catch(() => undefined);
      },
    });
  }
}

/**
 * Opens a tapped notification's destination. Server payloads carry
 * internal paths (e.g. /sessions/<uuid>); anything that is not a safe
 * internal path is ignored instead of opened.
 */
async function openNotificationDestination(url: string | null): Promise<void> {
  if (!url || !url.startsWith("/") || url.startsWith("//")) {
    return;
  }

  const origin =
    (import.meta.env.VITE_API_BASE_URL as string | undefined) ??
    "https://starstask.vercel.app";

  await Browser.open({ url: `${origin}${url}` });
}

render("loading");

if (Capacitor.isNativePlatform()) {
  // Native back button: go back in history instead of exiting the app.
  App.addListener("backButton", ({ canGoBack }) => {
    if (canGoBack) {
      window.history.back();
    } else {
      void App.exitApp();
    }
  });

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

window.addEventListener("online", () => {
  void syncQueuedCheckIns()
    .then((synced) => {
      if (synced > 0) {
        return refreshDashboard();
      }
      return undefined;
    })
    .catch(() => undefined);
});

void refreshSession();
void syncQueuedCheckIns().catch(() => undefined);

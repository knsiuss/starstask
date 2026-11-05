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

import { handleAuthDeepLink, signInWithGoogle } from "./lib/auth";
import { checkInToSession, syncQueuedCheckIns } from "./lib/checkin";
import { formatTime, loadDashboard } from "./lib/dashboard";
import { listAttachments, openAttachment } from "./lib/document";
import { registerNativePush, sendNativeTokenToServer } from "./lib/push";
import { getSupabase, isSupabaseConfigured } from "./lib/supabase";
import { uploadAttachmentFile } from "./lib/upload";

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
          .map((session) => {
            const hasLocation =
              session.checkInLatitude !== null &&
              session.checkInLongitude !== null;
            const action = session.checkInStatus
              ? ` ${session.checkInStatus}`
              : hasLocation
                ? ` <button type="button" data-checkin="${session.id}">Check in</button>`
                : " no check-in point";

            return `<li>${session.subjectName ?? session.title} ${formatTime(session.startsAt)}-${formatTime(session.endsAt)}${action}</li>`;
          })
          .join("")}</ul>`;

  const assignments =
    data.upcomingAssignments.length === 0
      ? "<p>No upcoming assignments.</p>"
      : `<ul>${data.upcomingAssignments
          .map(
            (assignment) =>
              `<li>${assignment.subjectName ?? ""} ${assignment.title}${assignment.deadline ? ` — ${formatTime(assignment.deadline)}` : ""} <button type="button" data-attach="${assignment.id}">Attach file</button> <span data-attachments="${assignment.id}"></span></li>`,
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

import { useEffect, useState } from "react";
import {
  Button,
  FlatList,
  Linking,
  ScrollView,
  Text,
  View,
} from "react-native";

import { handleAuthDeepLink, isAuthDeepLink, signInWithGoogle } from "../src/lib/auth";
import { checkInToSession, syncQueuedCheckIns } from "../src/lib/checkin";
import { formatTime, loadDashboard, type DashboardData } from "../src/lib/dashboard";
import { listAttachments, openAttachment } from "../src/lib/document";
import { registerNativePush, sendNativeTokenToServer } from "../src/lib/push";
import { getSupabase, isSupabaseConfigured } from "../src/lib/supabase";
import { pickAndUploadAttachment } from "../src/lib/upload";

/**
 * StarsTask mobile home: today's sessions with GPS check-in plus the
 * nearest upcoming assignments with attachment upload. Same Supabase
 * project, same RPCs, and same offline check-in queue as the previous
 * Capacitor shell — now in native React Native (Expo).
 */

type State = "loading" | "signed-out" | "signed-in" | "error";

export default function Home() {
  const [state, setState] = useState<State>("loading");
  const [userId, setUserId] = useState<string | null>(null);
  const [data, setData] = useState<DashboardData | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function refreshSession() {
    const supabase = getSupabase();

    if (!supabase) {
      setUserId(null);
      setState(isSupabaseConfigured() ? "signed-out" : "error");
      return;
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();

    setUserId(session?.user.id ?? null);
    setState(session ? "signed-in" : "signed-out");

    if (session) {
      await registerNativePush({
        onToken: (token) => {
          if (session.access_token) {
            void sendNativeTokenToServer(token, session.access_token);
          }
        },
        onNotificationTap: (url) => {
          void openNotificationDestination(url).catch(() => undefined);
        },
      });
    }
  }

  async function refreshDashboard(id: string) {
    const dashboard = await loadDashboard(id).catch(() => null);

    if (dashboard) {
      setData(dashboard);
    }
  }

  useEffect(() => {
    void refreshSession();
    void syncQueuedCheckIns().catch(() => undefined);

    const supabase = getSupabase();
    const subscription = supabase?.auth.onAuthStateChange(
      (_event, session) => {
        setUserId(session?.user.id ?? null);
        setState(session ? "signed-in" : "signed-out");
      },
    ).data.subscription;

    const urlSubscription = Linking.addEventListener("url", (event) => {
      if (isAuthDeepLink(event.url)) {
        void handleAuthDeepLink(event.url)
          .then(refreshSession)
          .catch(() => setState("error"));
      }
    });

    return () => {
      subscription?.unsubscribe();
      urlSubscription.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (state === "signed-in" && userId) {
      void refreshDashboard(userId);
    }
  }, [state, userId]);

  if (state === "loading") {
    return (
      <View style={styles.root}>
        <Text>StarsTask Mobile — loading…</Text>
      </View>
    );
  }

  if (state === "signed-out") {
    return (
      <View style={styles.root}>
        <Text style={styles.h1}>StarsTask Mobile</Text>
        <Button
          title="Sign in with Google"
          onPress={() => {
            void signInWithGoogle().catch(() => setState("error"));
          }}
        />
      </View>
    );
  }

  if (state === "error") {
    return (
      <View style={styles.root}>
        <Text>StarsTask Mobile — sign-in failed, try again</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.h1}>StarsTask Mobile</Text>
      {message ? <Text style={styles.error}>{message}</Text> : null}
      <Text style={styles.h2}>Today</Text>
      {data && data.todaySessions.length > 0 ? (
        <FlatList
          data={data.todaySessions}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const hasLocation =
              item.checkInLatitude !== null && item.checkInLongitude !== null;
            return (
              <View style={styles.row}>
                <Text style={styles.rowText}>
                  {item.subjectName ?? item.title}{" "}
                  {formatTime(item.startsAt)}-{formatTime(item.endsAt)}
                  {item.checkInStatus ? ` ${item.checkInStatus}` : ""}
                </Text>
                {!item.checkInStatus && hasLocation && userId ? (
                  <Button
                    title="Check in"
                    onPress={() => {
                      void checkInToSession(item.id, userId).then((result) => {
                        setMessage(
                          result.ok
                            ? `Checked in (${result.status})`
                            : result.message,
                        );
                        void refreshDashboard(userId);
                      });
                    }}
                  />
                ) : null}
              </View>
            );
          }}
        />
      ) : (
        <Text>No sessions today.</Text>
      )}
      <Text style={styles.h2}>Upcoming assignments</Text>
      {data && data.upcomingAssignments.length > 0 ? (
        <FlatList
          data={data.upcomingAssignments}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <AssignmentRow
              assignment={item}
              userId={userId}
              onUploaded={() => {
                if (userId) void refreshDashboard(userId);
              }}
              onError={setMessage}
            />
          )}
        />
      ) : (
        <Text>No upcoming assignments.</Text>
      )}
    </ScrollView>
  );
}

function AssignmentRow({
  assignment,
  userId,
  onUploaded,
  onError,
}: {
  assignment: DashboardData["upcomingAssignments"][number];
  userId: string | null;
  onUploaded: () => void;
  onError: (message: string) => void;
}) {
  const [attachments, setAttachments] = useState<
    { id: string; filename: string; storagePath: string }[]
  >([]);

  useEffect(() => {
    void listAttachments(assignment.id).then(setAttachments);
  }, [assignment.id]);

  return (
    <View style={styles.row}>
      <Text style={styles.rowText}>
        {assignment.subjectName ?? ""} {assignment.title}
        {assignment.deadline ? ` — ${formatTime(assignment.deadline)}` : ""}
      </Text>
      {userId ? (
        <Button
          title="Attach file"
          onPress={() => {
            void pickAndUploadAttachment(userId, assignment.id).then(
              (result) => {
                if (result.ok) {
                  onUploaded();
                } else {
                  onError(result.message);
                }
              },
            );
          }}
        />
      ) : null}
      {attachments.map((attachment) => (
        <Button
          key={attachment.id}
          title={`Open ${attachment.filename}`}
          onPress={() => {
            void openAttachment(attachment.storagePath).catch(() =>
              onError("Could not open the attachment."),
            );
          }}
        />
      ))}
    </View>
  );
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
    (process.env.EXPO_PUBLIC_API_BASE_URL as string | undefined) ??
    "https://starstask.vercel.app";

  await Linking.openURL(`${origin}${url}`);
}

const styles = {
  root: { flex: 1, backgroundColor: "#fafaf8" as const },
  content: { padding: 20, gap: 12 },
  h1: { fontSize: 24, fontWeight: "700" as const, color: "#18181b" },
  h2: { fontSize: 18, fontWeight: "600" as const, color: "#18181b", marginTop: 8 },
  row: { paddingVertical: 10, gap: 6, borderBottomWidth: 1, borderBottomColor: "#e4e4e7" },
  rowText: { fontSize: 15, color: "#27272a" },
  error: { color: "#dc2626", fontSize: 14 },
};

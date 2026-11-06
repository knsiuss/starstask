import { useEffect, useState } from "react";
import {
  Button,
  FlatList,
  Image,
  Linking,
  Pressable,
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
      <WelcomeScreen
        onSignIn={() => {
          void signInWithGoogle().catch(() => setState("error"));
        }}
      />
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

/**
 * Signed-out welcome screen. The primary action is Google sign-in;
 * feature rows explain what the app does and also start sign-in,
 * since every feature requires an account.
 */
function WelcomeScreen({ onSignIn }: { onSignIn: () => void }) {
  const features = [
    {
      glyph: "◎",
      label: "GPS check-in with offline queue",
    },
    {
      glyph: "▦",
      label: "Deadlines and class schedules",
    },
    {
      glyph: "⚿",
      label: "Encrypted direct messages",
    },
  ];

  return (
    <ScrollView
      style={styles.welcomeRoot}
      contentContainerStyle={styles.welcomeContent}
    >
      <View style={styles.glowTop} />
      <View style={styles.glowBottom} />

      <View style={styles.logoBadge}>
        <Image
          source={require("../assets/icon.png")}
          style={styles.logoImage}
          resizeMode="contain"
        />
      </View>

      <Text style={styles.welcomeTitle}>Welcome Back</Text>
      <Text style={styles.welcomeSubtitle}>
        Pick up where you left off — keep your classes and tasks in one
        place.
      </Text>

      <Pressable
        style={styles.googleButton}
        onPress={onSignIn}
        accessibilityRole="button"
        accessibilityLabel="Continue with Google"
      >
        <Image
          source={require("../assets/google-g.png")}
          style={styles.googleMark}
          resizeMode="contain"
        />
        <Text style={styles.googleLabel}>Continue with Google</Text>
        <Text style={styles.arrow}>→</Text>
      </Pressable>

      <View style={styles.dividerRow}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>or</Text>
        <View style={styles.dividerLine} />
      </View>

      {features.map((feature) => (
        <Pressable
          key={feature.label}
          style={styles.featureRow}
          onPress={onSignIn}
          accessibilityRole="button"
          accessibilityLabel={feature.label}
        >
          <View style={styles.featureBadge}>
            <Text style={styles.featureGlyph}>{feature.glyph}</Text>
          </View>
          <Text style={styles.featureLabel}>{feature.label}</Text>
          <Text style={styles.arrow}>›</Text>
        </Pressable>
      ))}

      <Text style={styles.secureNote}>
        Secure sign-in via Google · No password stored
      </Text>
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
  welcomeRoot: { flex: 1, backgroundColor: "#eef6ff" as const },
  welcomeContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 72,
    paddingBottom: 40,
    alignItems: "center" as const,
  },
  glowTop: {
    position: "absolute" as const,
    top: -80,
    left: -60,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: "rgba(147,197,253,0.35)",
  },
  glowBottom: {
    position: "absolute" as const,
    bottom: -100,
    right: -80,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: "rgba(125,211,252,0.28)",
  },
  logoBadge: {
    width: 96,
    height: 96,
    borderRadius: 28,
    backgroundColor: "#ffffff",
    alignItems: "center" as const,
    justifyContent: "center" as const,
    shadowColor: "#3b82f6",
    shadowOpacity: 0.35,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
    marginBottom: 28,
  },
  logoImage: { width: 72, height: 72 },
  welcomeTitle: {
    fontSize: 34,
    fontWeight: "800" as const,
    color: "#0f2a5c",
    textAlign: "center" as const,
  },
  welcomeSubtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: "#64748b",
    textAlign: "center" as const,
    marginTop: 10,
    marginBottom: 32,
    paddingHorizontal: 12,
  },
  googleButton: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    alignSelf: "stretch" as const,
    backgroundColor: "#dbeafe",
    borderRadius: 999,
    paddingVertical: 16,
    paddingHorizontal: 22,
    gap: 12,
    shadowColor: "#3b82f6",
    shadowOpacity: 0.25,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  googleMark: { width: 22, height: 22 },
  googleLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: "700" as const,
    color: "#0f2a5c",
  },
  arrow: { fontSize: 20, color: "#0f2a5c", fontWeight: "600" as const },
  dividerRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    alignSelf: "stretch" as const,
    marginVertical: 22,
    gap: 14,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: "#cbd5e1" },
  dividerText: { fontSize: 13, color: "#94a3b8" },
  featureRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    alignSelf: "stretch" as const,
    backgroundColor: "#ffffff",
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 14,
    marginBottom: 12,
    shadowColor: "#64748b",
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  featureBadge: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#eff6ff",
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  featureGlyph: { fontSize: 20, color: "#2563eb", fontWeight: "700" as const },
  featureLabel: { flex: 1, fontSize: 15, color: "#1e3a5f", fontWeight: "500" as const },
  secureNote: {
    fontSize: 12,
    color: "#64748b",
    textAlign: "center" as const,
    marginTop: 20,
  },
};

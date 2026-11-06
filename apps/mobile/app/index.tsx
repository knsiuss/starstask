import * as AuthSession from "expo-auth-session";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Button,
  FlatList,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  handleAuthDeepLink,
  isAuthDeepLink,
  signInWithGoogle,
} from "../src/lib/auth";
import { checkInToSession, syncQueuedCheckIns } from "../src/lib/checkin";
import {
  formatTime,
  loadDashboard,
  type DashboardData,
} from "../src/lib/dashboard";
import { listAttachments, openAttachment } from "../src/lib/document";
import { registerNativePush, sendNativeTokenToServer } from "../src/lib/push";
import { getSupabase, isSupabaseConfigured } from "../src/lib/supabase";
import { colors, radius, spacing } from "../src/lib/theme";
import { pickAndUploadAttachment } from "../src/lib/upload";

/**
 * StarsTask mobile home, mirroring the web dashboard structure:
 * greeting header with stats summary, stat cards, my classes,
 * today's sessions with GPS check-in, and upcoming assignments.
 * Same Supabase project, same RPCs, and same offline check-in queue
 * as the previous Capacitor shell — now in native React Native (Expo).
 */

type State = "loading" | "signed-out" | "signed-in" | "error";

function greetingFor(now: Date): string {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Jakarta",
      hour: "numeric",
      hourCycle: "h23",
    }).format(now),
  );

  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function firstName(displayName: string | null): string {
  const cleaned = displayName?.trim().replace(/^@+/, "");

  if (!cleaned) return "Welcome";

  const first = cleaned.split(/\s+/)[0];

  return first && first.length > 1 ? first : cleaned;
}

export default function Home() {
  const [state, setState] = useState<State>("loading");
  const [userId, setUserId] = useState<string | null>(null);
  const [data, setData] = useState<DashboardData | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
    const subscription = supabase?.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user.id ?? null);
      setState(session ? "signed-in" : "signed-out");
    }).data.subscription;

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
        <Text style={styles.muted}>StarsTask Mobile — loading…</Text>
      </View>
    );
  }

  if (state === "signed-out") {
    return (
      <LoginScreen
        busy={busy}
        onSignIn={() => {
          setBusy(true);
          void signInWithGoogle()
            .catch(() => setState("error"))
            .finally(() => setBusy(false));
        }}
      />
    );
  }

  if (state === "error") {
    return (
      <View style={styles.root}>
        <View style={styles.loginWrap}>
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>Sign-in failed</Text>
            <Text style={styles.errorBody}>
              Something went wrong. Check your connection and try again.
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => void refreshSession()}
              style={({ pressed }) => [
                styles.retryButton,
                pressed && styles.googleButtonPressed,
              ]}
            >
              <Text style={styles.retryButtonText}>Try again</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  const now = new Date();
  const stats = data?.stats ?? {
    totalTasks: 0,
    dueSoon: 0,
    pastDeadline: 0,
    classCount: 0,
  };
  const summaryParts: string[] = [];

  if (stats.dueSoon > 0) {
    summaryParts.push(
      `${stats.dueSoon} task${stats.dueSoon === 1 ? "" : "s"} due in the next 7 days`,
    );
  }

  if (stats.pastDeadline > 0) {
    summaryParts.push(
      `${stats.pastDeadline} past deadline${stats.pastDeadline === 1 ? "" : "s"}`,
    );
  }

  const dateLabel = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jakarta",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(now);

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
    >
      <View style={styles.headerCard}>
        <Text style={styles.greeting}>{greetingFor(now)},</Text>
        <Text style={styles.name}>{firstName(data?.displayName ?? null)}</Text>
        <Text style={styles.summary}>
          {summaryParts.length > 0
            ? `You have ${summaryParts.join(" and ")}.`
            : "Here is an overview of your academic activities today."}
        </Text>
        <View style={styles.headerFooter}>
          <Text style={styles.headerMeta}>{dateLabel}</Text>
        </View>
      </View>

      <View style={styles.statGrid}>
        <StatCard
          label="Total assignments"
          value={stats.totalTasks}
          tone="accent"
        />
        <StatCard
          label="Due soon"
          value={stats.dueSoon}
          tone="warning"
        />
        <StatCard
          label="Past deadline"
          value={stats.pastDeadline}
          tone="danger"
        />
        <StatCard
          label="My classes"
          value={stats.classCount}
          tone="success"
        />
      </View>

      {message ? <Text style={styles.error}>{message}</Text> : null}

      {data && data.classes.length > 0 ? (
        <>
          <Text style={styles.sectionTitle}>My classes</Text>
          <View style={styles.card}>
            <FlatList
              data={data.classes}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <View style={styles.row}>
                  <Text style={styles.rowTitle}>{item.name}</Text>
                </View>
              )}
            />
          </View>
        </>
      ) : null}

      <Text style={styles.sectionTitle}>Today</Text>
      {data && data.todaySessions.length > 0 ? (
        <View style={styles.card}>
          <FlatList
            data={data.todaySessions}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => {
              const hasLocation =
                item.checkInLatitude !== null && item.checkInLongitude !== null;
              return (
                <View style={styles.row}>
                  <View style={styles.rowBody}>
                    <Text style={styles.rowTitle}>
                      {item.subjectName ?? item.title}
                    </Text>
                    <Text style={styles.rowMeta}>
                      {formatTime(item.startsAt)}-{formatTime(item.endsAt)}
                      {item.checkInStatus ? ` · ${item.checkInStatus}` : ""}
                    </Text>
                  </View>
                  {!item.checkInStatus && hasLocation && userId ? (
                    <View style={styles.smallButton}>
                      <Button
                        title="Check in"
                        color={colors.accent}
                        onPress={() => {
                          void checkInToSession(item.id, userId).then(
                            (result) => {
                              setMessage(
                                result.ok
                                  ? `Checked in (${result.status})`
                                  : result.message,
                              );
                              void refreshDashboard(userId);
                            },
                          );
                        }}
                      />
                    </View>
                  ) : null}
                </View>
              );
            }}
          />
        </View>
      ) : (
        <Text style={styles.muted}>No sessions today.</Text>
      )}

      <Text style={styles.sectionTitle}>Upcoming assignments</Text>
      {data && data.upcomingAssignments.length > 0 ? (
        <View style={styles.card}>
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
        </View>
      ) : (
        <Text style={styles.muted}>No upcoming assignments.</Text>
      )}
    </ScrollView>
  );
}

const LOGIN_FEATURES = [
  "GPS check-in with offline queue",
  "Deadlines and class schedules",
  "Encrypted direct messages",
] as const;

/**
 * Sign-in screen: logo, tagline, Google button, feature rows.
 * Uses the shared web design tokens (src/lib/theme.ts) so it looks
 * like the web app; the press scale and fade-in keep it feeling native.
 */
function LoginScreen({
  busy,
  onSignIn,
}: {
  busy: boolean;
  onSignIn: () => void;
}) {
  const fade = useRef(new Animated.Value(0)).current;
  const rise = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 350, useNativeDriver: true }),
      Animated.timing(rise, { toValue: 0, duration: 350, useNativeDriver: true }),
    ]).start();
  }, [fade, rise]);

  return (
    <View style={styles.root}>
      <Animated.View
        style={[
          styles.loginWrap,
          { opacity: fade, transform: [{ translateY: rise }] },
        ]}
      >
        <View style={styles.logoMark}>
          <Image
            source={require("../assets/icon.png")}
            style={styles.logoImage}
            resizeMode="contain"
            accessibilityLabel="StarsTask logo"
          />
        </View>
        <Text style={styles.title}>StarsTask</Text>
        <Text style={styles.subtitle}>
          Your classes, assignments, and attendance — in your pocket.
        </Text>

        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: busy, busy }}
          disabled={busy}
          onPress={onSignIn}
          style={({ pressed }) => [
            styles.googleButton,
            pressed && styles.googleButtonPressed,
            busy && styles.googleButtonDisabled,
          ]}
        >
          <View style={styles.googleGlyph}>
            <Text style={styles.googleGlyphText}>G</Text>
          </View>
          {busy ? (
            <ActivityIndicator
              size="small"
              color={colors.foreground}
            />
          ) : (
            <Text style={styles.googleButtonText}>Continue with Google</Text>
          )}
        </Pressable>

        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>why StarsTask</Text>
          <View style={styles.dividerLine} />
        </View>

        <View style={styles.featureList}>
          {LOGIN_FEATURES.map((feature) => (
            <View
              key={feature}
              style={styles.featureRow}
            >
              <View style={styles.featureIcon}>
                <Text style={styles.featureIconText}>✓</Text>
              </View>
              <Text style={styles.featureText}>{feature}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.footnote}>
          Secure sign-in via Google · no password stored
        </Text>
      </Animated.View>
    </View>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "accent" | "warning" | "danger" | "success";
}) {
  const toneStyles = {
    accent: { backgroundColor: colors.accentSoft },
    warning: { backgroundColor: "#fbf3e4" },
    danger: { backgroundColor: "#fbeded" },
    success: { backgroundColor: "#ecfdf5" },
  }[tone];

  return (
    <View style={[styles.statCard, toneStyles]}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
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
      <View style={styles.rowBody}>
        <Text style={styles.rowTitle}>{assignment.title}</Text>
        <Text style={styles.rowMeta}>
          {assignment.subjectName ?? ""}
          {assignment.deadline ? ` · ${formatTime(assignment.deadline)}` : ""}
        </Text>
        {attachments.length > 0 ? (
          <Text style={styles.rowMeta}>
            {attachments.length} attachment{attachments.length > 1 ? "s" : ""}
          </Text>
        ) : null}
      </View>
      <View style={styles.rowActions}>
        {userId ? (
          <Button
            title="Attach"
            color={colors.accent}
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
            title="Open"
            color={colors.accent}
            onPress={() => {
              void openAttachment(attachment.storagePath).catch(() =>
                onError("Could not open the attachment."),
              );
            }}
          />
        ))}
      </View>
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

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, gap: spacing.md },
  loginWrap: {
    flex: 1,
    justifyContent: "center",
    padding: spacing.lg,
    gap: spacing.sm,
    backgroundColor: colors.background,
  },
  logoMark: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
    shadowColor: "#18181b",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 1,
  },
  logoImage: {
    width: 48,
    height: 48,
  },
  googleButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    minHeight: 52,
    backgroundColor: colors.accent,
    borderRadius: radius.full,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.lg,
    shadowColor: "#18181b",
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 2,
  },
  googleButtonPressed: {
    backgroundColor: colors.accentHover,
    transform: [{ scale: 0.97 }],
  },
  googleButtonDisabled: { opacity: 0.6 },
  googleGlyph: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  googleGlyphText: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.accent,
  },
  googleButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.accentForeground,
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { fontSize: 12, color: colors.mutedForeground },
  featureList: { marginTop: spacing.md, gap: spacing.sm },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  featureIcon: {
    width: 28,
    height: 28,
    borderRadius: 9,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  featureIconText: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.accent,
  },
  featureText: { flex: 1, fontSize: 14, color: colors.foreground },
  errorCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
    alignItems: "center",
  },
  errorTitle: { fontSize: 17, fontWeight: "600", color: colors.foreground },
  errorBody: {
    fontSize: 14,
    color: colors.mutedForeground,
    lineHeight: 20,
    textAlign: "center",
  },
  retryButton: {
    marginTop: spacing.sm,
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    justifyContent: "center",
    backgroundColor: colors.accent,
    borderRadius: radius.full,
  },
  retryButtonText: { fontSize: 15, fontWeight: "600", color: colors.accentForeground },
  footnote: {
    fontSize: 12,
    color: colors.mutedForeground,
    marginTop: spacing.lg,
    textAlign: "center",
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: colors.foreground,
    letterSpacing: -0.5,
  },
  subtitle: { fontSize: 15, color: colors.mutedForeground, lineHeight: 22 },
  primaryButton: { marginTop: spacing.md },
  headerCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: 4,
  },
  greeting: { fontSize: 14, fontWeight: "500", color: colors.mutedForeground },
  name: {
    fontSize: 26,
    fontWeight: "700",
    color: colors.foreground,
    letterSpacing: -0.5,
  },
  summary: {
    fontSize: 14,
    color: colors.mutedForeground,
    lineHeight: 20,
    marginTop: 4,
  },
  headerFooter: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm + 4,
    marginTop: spacing.sm,
  },
  headerMeta: { fontSize: 13, color: colors.mutedForeground },
  statGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  statCard: {
    flexBasis: "48%",
    flexGrow: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: 2,
  },
  statLabel: { fontSize: 12, fontWeight: "500", color: colors.mutedForeground },
  statValue: {
    fontSize: 26,
    fontWeight: "700",
    color: colors.foreground,
    letterSpacing: -0.5,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: colors.foreground,
    marginTop: spacing.sm,
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowBody: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 15, fontWeight: "600", color: colors.foreground },
  rowMeta: { fontSize: 13, color: colors.mutedForeground },
  rowActions: { gap: spacing.sm },
  smallButton: { minWidth: 110 },
  muted: { fontSize: 14, color: colors.mutedForeground },
  error: { color: colors.danger, fontSize: 14 },
});

package id.starstask.mobile

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalContext
import id.starstask.mobile.data.CheckInResult
import id.starstask.mobile.data.PendingCheckIn
import id.starstask.mobile.data.SupabaseProvider
import id.starstask.mobile.data.capturePositionDetailed
import id.starstask.mobile.data.CaptureOutcome
import id.starstask.mobile.data.captureFailureMessage
import id.starstask.mobile.data.checkInToSession
import id.starstask.mobile.data.loadAttendanceIdentity
import id.starstask.mobile.data.ensureReminderChannel
import id.starstask.mobile.data.hasLocationPermission
import id.starstask.mobile.data.loadMyProfile
import id.starstask.mobile.data.permissionsOnboardingSeenFlow
import id.starstask.mobile.ui.screens.ProfileOnboardingScreen
import id.starstask.mobile.data.queueOfflineCheckin
import id.starstask.mobile.data.setPermissionsOnboardingSeen
import id.starstask.mobile.data.syncPushRegistration
import id.starstask.mobile.data.syncQueuedCheckIns
import id.starstask.mobile.ui.navigation.StarsTaskNavHost
import id.starstask.mobile.ui.screens.SplashScreen
import id.starstask.mobile.ui.screens.WelcomeScreen
import id.starstask.mobile.ui.screens.PermissionOnboardingScreen
import id.starstask.mobile.data.setThemeMode
import id.starstask.mobile.data.themeModeFlow
import id.starstask.mobile.ui.theme.StarsTaskTheme
import androidx.compose.foundation.isSystemInDarkTheme
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.auth.handleDeeplinks
import io.github.jan.supabase.auth.status.SessionStatus
import kotlinx.coroutines.launch

/**
 * Entry point. Native Compose UI over the same Supabase backend as web.
 * Google OAuth opens in a Custom Tab and returns through the
 * `starstask://auth/callback` deep link (handled in onCreate/onNewIntent).
 */
class MainActivity : ComponentActivity() {
    val pendingPushUrl = androidx.compose.runtime.mutableStateOf<String?>(null)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        SupabaseProvider.client.handleDeeplinks(intent)
        ensureReminderChannel(this)
        pendingPushUrl.value = intent.getStringExtra(StarsTaskMessagingService.EXTRA_PUSH_URL)
        enableEdgeToEdge()
        setContent {
            val systemDark = isSystemInDarkTheme()
            val themeModeFlowLocal = androidx.compose.runtime.remember { themeModeFlow(this@MainActivity) }
            val themeMode by themeModeFlowLocal.collectAsState(initial = null)
            val darkTheme = when (themeMode) {
                "dark" -> true
                "light" -> false
                else -> systemDark
            }
            StarsTaskTheme(darkTheme = darkTheme) {
                val activity = this@MainActivity
                StarsTaskApp(pendingPushUrl = activity.pendingPushUrl)
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        SupabaseProvider.client.handleDeeplinks(intent)
        setIntent(intent)
        pendingPushUrl.value = intent.getStringExtra(StarsTaskMessagingService.EXTRA_PUSH_URL)
    }
}

@Composable
fun StarsTaskApp(pendingPushUrl: androidx.compose.runtime.MutableState<String?>) {
    val auth = remember { SupabaseProvider.client.auth }
    val sessionStatus by auth.sessionStatus.collectAsState(initial = SessionStatus.Initializing)
    val session = (sessionStatus as? SessionStatus.Authenticated)?.session
    val userId = session?.user?.id
    val userEmail = session?.user?.email
    val memberSince = null as String?
    val scope = rememberCoroutineScope()
    val context = LocalContext.current

    val onboardingSeenFlowLocal = androidx.compose.runtime.remember { permissionsOnboardingSeenFlow(context) }
    val onboardingSeen by onboardingSeenFlowLocal.collectAsState(initial = null)
    var profileReady by androidx.compose.runtime.mutableStateOf<Boolean?>(null)

    LaunchedEffect(userId) {
        if (userId != null) {
            profileReady = null
            // Never let the gate hang: any load failure is treated as
            // "not onboarded" and surfaces the recovery form instead of a
            // permanent splash.
            profileReady = runCatching {
                kotlinx.coroutines.withTimeout(8_000) {
                    loadMyProfile()?.onboardedAt?.isNotBlank() == true
                }
            }.getOrDefault(false)
        } else {
            profileReady = null
        }
    }

    // Retry offline check-ins whenever the app foregrounds.
    LaunchedEffect(userId) {
        if (userId != null) {
            scope.launch { syncQueuedCheckIns(context, userId) }
        }
    }

    // Re-register the FCM token if the user opted in (covers rotation and
    // reinstalls). No-op when push is off.
    LaunchedEffect(userId) {
        if (userId != null) {
            scope.launch { runCatching { syncPushRegistration(context) } }
        }
    }

    var showSplash by remember { mutableStateOf(true) }
    if (showSplash) {
        SplashScreen(onExit = { showSplash = false })
        return
    }

    if (sessionStatus is SessionStatus.Initializing) {
        SplashScreen(onExit = {})
        return
    }

    if (userId == null) {
        WelcomeScreen(
            scope = scope,
            context = context,
        )
        return
    }

    val pushUrl = pendingPushUrl.value

    // Onboarding flags still loading — hold the splash briefly, then let
    // whatever is available decide: timeout path marks profileReady=false.
    val onboardingSeenState = onboardingSeen
    if (onboardingSeenState == null) {
        SplashScreen(onExit = { showSplash = true })
        return
    }

    if (profileReady == false) {
        ProfileOnboardingScreen(userId = userId, email = userEmail, onDone = { profileReady = true })
        return
    }

    if (!onboardingSeenState) {
        PermissionOnboardingScreen(
            userId = userId,
            onDone = {
                scope.launch { runCatching { setPermissionsOnboardingSeen(context, true) } }
            },
        )
        return
    }

    StarsTaskNavHost(
        userId = userId,
        userEmail = userEmail,
        memberSince = memberSince,
        pushUrl = pushUrl,
        onPushUrlConsumed = { pendingPushUrl.value = null },
        onCheckIn = { sessionId ->
            scope.launch { checkIn(context, sessionId, userId) }
        },
        onSignOut = {
            scope.launch {
                // Drop this device's push registration so the old account stops
                // receiving notifications here, and wipe all cached read models —
                // they hold the previous account's data. E2EE keys and queued
                // check-ins stay: they are device-local, restored by sign-in.
                runCatching { id.starstask.mobile.data.unregisterAllPush(context) }
                id.starstask.mobile.data.clearDiskCache(context)
                auth.signOut()
            }
        },
    )
}

private suspend fun checkIn(
    context: android.content.Context,
    sessionId: String,
    userId: String,
): CheckInResult {
    // GPS capture + full RPC params; failures queue offline.
    if (!hasLocationPermission(context)) {
        return CheckInResult(false, null, "Location permission needed.")
    }
    val outcome = capturePositionDetailed(context)
    val fix = when (outcome) {
        is CaptureOutcome.Fix -> outcome.position
        is CaptureOutcome.Failed -> return CheckInResult(false, null, captureFailureMessage(outcome.reason))
    }
    // Only transport/RPC failures are retryable; a server rejection is final.
    val result = try {
        checkInToSession(
            userId = userId,
            sessionId = sessionId,
            latitude = fix.latitude,
            longitude = fix.longitude,
            accuracyM = fix.accuracyM,
            capturedAtMs = fix.capturedAtMs,
        )
    } catch (_: Exception) {
        val identity = runCatching { loadAttendanceIdentity(userId) }.getOrNull()
        queueOfflineCheckin(
            context,
            PendingCheckIn(
                id = "",
                sessionId = sessionId,
                userId = userId,
                latitude = fix.latitude,
                longitude = fix.longitude,
                accuracyM = fix.accuracyM,
                fullName = identity?.fullName.orEmpty(),
                nim = identity?.nim.orEmpty(),
                capturedAtMs = fix.capturedAtMs,
                timeFromGnss = fix.timeFromGnss,
                deviceClockAuto = fix.deviceClockAuto,
                deviceTimeMs = fix.deviceTimeMs,
                provider = fix.provider,
                sessionKind = "meeting",
            ),
        )
        return CheckInResult(false, null, "Check-in tersimpan offline — akan disinkronkan saat ada jaringan.")
    }
    return result
}

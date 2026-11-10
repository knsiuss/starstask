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
import id.starstask.mobile.data.capturePosition
import id.starstask.mobile.data.checkInToSession
import id.starstask.mobile.data.hasLocationPermission
import id.starstask.mobile.data.queueOfflineCheckin
import id.starstask.mobile.data.syncQueuedCheckIns
import id.starstask.mobile.ui.navigation.StarsTaskNavHost
import id.starstask.mobile.ui.screens.SplashScreen
import id.starstask.mobile.ui.screens.WelcomeScreen
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
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        SupabaseProvider.client.handleDeeplinks(intent)
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
                StarsTaskApp()
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        SupabaseProvider.client.handleDeeplinks(intent)
    }
}

@Composable
fun StarsTaskApp() {
    val auth = remember { SupabaseProvider.client.auth }
    val sessionStatus by auth.sessionStatus.collectAsState(initial = SessionStatus.Initializing)
    val session = (sessionStatus as? SessionStatus.Authenticated)?.session
    val userId = session?.user?.id
    val userEmail = session?.user?.email
    val memberSince = null as String?
    val scope = rememberCoroutineScope()
    val context = LocalContext.current

    // Retry offline check-ins whenever the app foregrounds.
    LaunchedEffect(userId) {
        if (userId != null) {
            scope.launch { syncQueuedCheckIns(context) }
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

    StarsTaskNavHost(
        userId = userId,
        userEmail = userEmail,
        memberSince = memberSince,
        onCheckIn = { sessionId ->
            scope.launch { checkIn(context, sessionId, userId) }
        },
        onSignOut = {
            scope.launch { auth.signOut() }
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
    val position = capturePosition(context)
        ?: return CheckInResult(false, null, "Location unavailable.")
    val accuracyM = position.third
    val result = try {
        checkInToSession(
            userId = userId,
            sessionId = sessionId,
            latitude = position.first,
            longitude = position.second,
            accuracyM = accuracyM,
        )
    } catch (_: Exception) {
        null
    }
    if (result == null || !result.ok) {
        queueOfflineCheckin(
            context,
            PendingCheckIn(
                id = "",
                sessionId = sessionId,
                userId = userId,
                latitude = position.first,
                longitude = position.second,
                accuracyM = accuracyM,
                fullName = "",
                nim = "",
                capturedAt = "",
            ),
        )
    }
    return result ?: CheckInResult(false, null, "Check-in failed — will sync when online.")
}

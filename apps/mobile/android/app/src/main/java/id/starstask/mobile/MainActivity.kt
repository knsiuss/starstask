package id.starstask.mobile

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import id.starstask.mobile.data.CheckInResult
import id.starstask.mobile.data.PendingCheckIn
import id.starstask.mobile.data.SupabaseProvider
import id.starstask.mobile.data.capturePosition
import id.starstask.mobile.data.checkInToSession
import id.starstask.mobile.data.hasLocationPermission
import id.starstask.mobile.data.queueOfflineCheckin
import id.starstask.mobile.data.syncQueuedCheckIns
import id.starstask.mobile.ui.screens.AttendanceScreen
import id.starstask.mobile.ui.screens.HomeScreen
import id.starstask.mobile.ui.screens.MessagesScreen
import id.starstask.mobile.ui.screens.SettingsScreen
import id.starstask.mobile.ui.theme.Accent
import id.starstask.mobile.ui.theme.Foreground
import id.starstask.mobile.ui.theme.MutedForeground
import id.starstask.mobile.ui.theme.StarsTaskTheme
import io.github.jan.supabase.auth.Auth
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.auth.handleDeeplinks
import io.github.jan.supabase.auth.providers.Google
import io.github.jan.supabase.auth.status.SessionStatus
import io.github.jan.supabase.postgrest.postgrest
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
            StarsTaskTheme {
                StarsTaskApp()
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        SupabaseProvider.client.handleDeeplinks(intent)
    }
}

private enum class Tab(val label: String) { HOME("Home"), CLASSES("Classes"), ATTENDANCE("Attend"), ASSIGNMENTS("Tasks"), MESSAGES("Chat"), MORE("More"), SETTINGS("Settings") }

@Composable
fun StarsTaskApp() {
    val auth = remember { SupabaseProvider.client.auth }
    val sessionStatus by auth.sessionStatus.collectAsState(initial = SessionStatus.Initializing)
    val session = (sessionStatus as? SessionStatus.Authenticated)?.session
    val userId = session?.user?.id
    var tab by remember { mutableStateOf(Tab.HOME) }
    val scope = rememberCoroutineScope()
    val context = LocalContext.current

    // Retry offline check-ins whenever the app foregrounds.
    LaunchedEffect(userId) {
        if (userId != null) {
            scope.launch { syncQueuedCheckIns(context) }
        }
    }

    if (sessionStatus is SessionStatus.Initializing) {
        Column(
            modifier = Modifier.fillMaxSize().padding(24.dp),
            verticalArrangement = Arrangement.Center,
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Text("StarsTask Mobile — loading…", color = MutedForeground)
        }
        return
    }

    if (userId == null) {
        Column(
            modifier = Modifier.fillMaxSize().padding(24.dp),
            verticalArrangement = Arrangement.Center,
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Text(
                "Welcome Back",
                style = MaterialTheme.typography.headlineLarge,
                color = Foreground,
            )
            Text(
                "Pick up where you left off — keep your classes and tasks in one place.",
                color = MutedForeground,
                style = MaterialTheme.typography.bodyMedium,
                modifier = Modifier.padding(top = 8.dp, bottom = 24.dp),
            )
            Button(
                onClick = { scope.launch { auth.signInWith(Google) } },
                colors = ButtonDefaults.buttonColors(containerColor = Accent),
                modifier = Modifier.fillMaxWidth(0.85f),
            ) { Text("Continue with Google") }
            Spacer(Modifier.height(16.dp))
            Text("Secure sign-in via Google · No password stored", color = MutedForeground)
        }
        return
    }

    Scaffold(
        bottomBar = {
            NavigationBar {
                Tab.entries.forEach { t ->
                    NavigationBarItem(
                        selected = tab == t,
                        onClick = { tab = t },
                        label = { Text(t.label) },
                        icon = { Text(t.label.first().toString()) },
                    )
                }
            }
        },
    ) { padding ->
        androidx.compose.foundation.layout.Box(Modifier.padding(padding)) {
            when (tab) {
                Tab.HOME -> HomeScreen(
                    userId = userId,
                    userEmail = session?.user?.email,
                    onCheckIn = { sessionId ->
                        scope.launch { checkIn(context, sessionId, userId) }
                    },
                    onOpenTasks = { tab = Tab.ASSIGNMENTS },
                    onOpenMessages = { tab = Tab.MESSAGES },
                    onOpenSchedule = { tab = Tab.ATTENDANCE },
                    onOpenClasses = { tab = Tab.CLASSES },
                    onNewAssignment = { tab = Tab.ASSIGNMENTS },
                )
                Tab.CLASSES -> id.starstask.mobile.ui.screens.ClassesScreen(userId = userId)
                Tab.ATTENDANCE -> AttendanceScreen(userId = userId)
                Tab.ASSIGNMENTS -> id.starstask.mobile.ui.screens.AssignmentsScreen(userId = userId)
                Tab.MESSAGES -> MessagesScreen(userId = userId)
                Tab.MORE -> id.starstask.mobile.ui.screens.MoreScreen(
                    onSchedule = { tab = Tab.ATTENDANCE },
                    onLeave = { tab = Tab.ATTENDANCE },
                    onNotifications = { tab = Tab.ATTENDANCE },
                    onSettings = { tab = Tab.SETTINGS },
                )
                Tab.SETTINGS -> SettingsScreen(
                    onSignOut = {
                        scope.launch {
                            auth.signOut()
                        }
                    },
                )
            }
        }
    }
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

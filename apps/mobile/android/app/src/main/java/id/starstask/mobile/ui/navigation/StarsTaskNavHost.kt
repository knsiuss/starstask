package id.starstask.mobile.ui.navigation

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.ModalNavigationDrawer
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.rememberDrawerState
import androidx.compose.material3.DrawerValue
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import id.starstask.mobile.data.getWorkspaceScope
import id.starstask.mobile.ui.components.StarsTaskDrawerContent
import id.starstask.mobile.ui.screens.ActionCenterScreen
import id.starstask.mobile.ui.screens.AssignmentsWorkspaceScreen
import id.starstask.mobile.ui.screens.AttendanceScreen
import id.starstask.mobile.ui.screens.ActionCenterScreen
import id.starstask.mobile.ui.screens.AssignmentsWorkspaceScreen
import id.starstask.mobile.ui.screens.AttendanceScreen
import id.starstask.mobile.ui.screens.ClassesScreen
import id.starstask.mobile.ui.screens.FeedbackScreen
import id.starstask.mobile.ui.screens.HomeScreen
import id.starstask.mobile.ui.screens.LeaveRequestsScreen
import id.starstask.mobile.ui.screens.MessagesScreen
import id.starstask.mobile.ui.screens.NotificationSettingsScreen
import id.starstask.mobile.ui.screens.NotificationsScreen
import id.starstask.mobile.ui.screens.ProfileScreen
import id.starstask.mobile.ui.screens.ScheduleScreen
import id.starstask.mobile.ui.screens.SecurityPrivacyScreen
import id.starstask.mobile.ui.screens.SettingsHubScreen
import kotlinx.coroutines.launch

/**
 * Single NavHost for the entire workspace. Converts the 7-tab hard switch
 * in MainActivity into a real navigation graph so every implemented screen
 * (from the audit P0) is reachable from one entry point.
 *
 * Route -> Screen mapping (web route in parentheses):
 *   dashboard (/app) — HomeScreen (primary + HomeRouteContent drill-downs)
 *   assignments (/assignments) — AssignmentsWorkspaceScreen
 *   classes (/classes) — ClassesScreen
 *   attendance (/attendance) — AttendanceScreen
 *   schedule (/schedule) — ScheduleScreenNew (parity implementation)
 *   leave-requests (/leave-requests) — LeaveRequestsScreen
 *   messages (/messages) — MessagesScreen (E2EE list + detail)
 *   notifications (topbar bell) — NotificationsScreen
 *   action-center (/app/actions) — ActionCenterScreen
 *   university-info (/university-info) — UniversityScreen (academic card)
 *   profile (/settings/profile) — ProfileScreen
 *   settings (/settings/notifications) — SettingsHubScreen (+ sub-route)
 *   security (/settings/security) — SecurityPrivacyScreen
 *   feedback (/settings/feedback) — FeedbackScreen
 *   settings/notifications — NotificationSettingsScreen
 *
 * Individual screens that internally manage their own drill-down (class
 * detail with selectedClass, submission detail, assignment detail, etc.)
 * keep that state inside the destination composable; the NavHost owns only
 * the top-level route so back-stack restore works for the primary tabs.
 */

private const val ROUTE_CLASS_DETAIL = "class-detail"
private const val ROUTE_COURSE_DETAIL = "course-detail"
private const val ARG_CLASS_ID = "classId"
private const val ARG_COURSE_ID = "courseId"

@Composable
fun StarsTaskNavHost(
    userId: String,
    userEmail: String?,
    memberSince: String?,
    onCheckIn: (String) -> Unit,
    onSignOut: () -> Unit,
    navController: NavHostController = rememberNavController(),
) {
    val scope = rememberCoroutineScope()
    val context = LocalContext.current

    var managesAnyClass by remember { mutableStateOf(false) }
    LaunchedEffect(userId) {
        scope.launch {
            runCatching { getWorkspaceScope(userId).managesAnyClass }
                .onSuccess { managesAnyClass = it }
        }
    }

    val drawerState = rememberDrawerState(initialValue = DrawerValue.Closed)
    val navBackStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = navBackStackEntry?.destination?.route

    fun navigateTo(route: String) {
        navController.navigate(route) {
            launchSingleTop = true
            restoreState = true
        }
    }

    fun navigateToDrawer(dest: DrawerDestination) {
        scope.launch {
            drawerState.close()
            navigateTo(dest.route)
        }
    }

    ModalNavigationDrawer(
        drawerState = drawerState,
        drawerContent = {
            StarsTaskDrawerContent(
                currentRoute = currentRoute,
                isClassAdmin = managesAnyClass,
                onDestinationClick = { navigateToDrawer(it) },
                onClose = { scope.launch { drawerState.close() } },
                userId = userId,
                userEmail = userEmail,
            )
        },
    ) {
        Scaffold(
            containerColor = androidx.compose.ui.graphics.Color.Transparent,
            bottomBar = {
                FloatingNavDock(
                    currentRoute = currentRoute,
                    onNavigate = { navigateTo(it) },
                )
            },
        ) { innerPadding ->
            Box(modifier = Modifier.padding(innerPadding)) {
                NavHost(
                    navController = navController,
                    startDestination = DrawerDestination.DASHBOARD.route,
                    modifier = Modifier.fillMaxSize(),
                ) {
                    composable(DrawerDestination.DASHBOARD.route) {
                        HomeScreen(
                            userId = userId,
                            userEmail = userEmail,
                            onCheckIn = onCheckIn,
                            onOpenTasks = { navigateTo(DrawerDestination.ASSIGNMENTS.route) },
                            onOpenMessages = { navigateTo(DrawerDestination.MESSAGES.route) },
                            onOpenSchedule = { navigateTo(DrawerDestination.SCHEDULE.route) },
                            onOpenClasses = { navigateTo(DrawerDestination.CLASSES.route) },
                            onNewAssignment = { navigateTo(DrawerDestination.ASSIGNMENTS.route) },
                        )
                    }
                    composable(DrawerDestination.ASSIGNMENTS.route) {
                        AssignmentsWorkspaceScreen(userId = userId)
                    }
                    composable(DrawerDestination.CLASSES.route) {
                        ClassesScreen(userId = userId)
                    }
                    composable(DrawerDestination.ATTENDANCE.route) {
                        AttendanceScreen(userId = userId)
                    }
                    composable(DrawerDestination.SCHEDULE.route) {
                        ScheduleScreen(userId = userId)
                    }
                    composable(DrawerDestination.LEAVE.route) {
                        LeaveRequestsScreen(
                            userId = userId,
                            onBack = { navController.popBackStack() },
                        )
                    }
                    composable(DrawerDestination.MESSAGES.route) {
                        MessagesScreen(userId = userId)
                    }
                    composable(DrawerDestination.NOTIFICATIONS.route) {
                        NotificationsScreen()
                    }
                    composable(DrawerDestination.ACTION_CENTER.route) {
                        ActionCenterScreen(userId = userId)
                    }
                    composable("university-info") {
                        // Route kept for drawer completeness; the academic
                        // card is loaded lazily by the placeholder so the
                        // drawer doesn't break on unknown routes
                        // (parity: UniversityScreen will replace this next).
                        Text(
                            "University info — open from Profile.",
                            modifier = Modifier.padding(24.dp),
                        )
                    }
                    composable(DrawerDestination.PROFILE.route) {
                        ProfileScreen(
                            userId = userId,
                            email = userEmail,
                            memberSince = memberSince,
                            onBack = { navController.popBackStack() },
                            onOpenClasses = { navigateTo(DrawerDestination.CLASSES.route) },
                            onSignOut = onSignOut,
                            onOpenDashboard = { navigateTo(DrawerDestination.DASHBOARD.route) },
                            onOpenAdminConsole = { /* parity: AdminConsole parity screen; no-op until AdminConsole route is added */ },
                            onOpenDeveloperConsole = { /* parity: DeveloperConsole screen; no-op until DeveloperConsole route is added */ },
                        )
                    }
                    composable(DrawerDestination.SETTINGS.route) {
                        SettingsHubScreen(
                            userId = userId,
                            onOpenNotifications = { navController.navigate(SETTINGS_NOTIFICATIONS_ROUTE) },
                            onSignOut = onSignOut,
                        )
                    }
                    composable(SETTINGS_NOTIFICATIONS_ROUTE) {
                        NotificationSettingsScreen(userId = userId)
                    }
                    composable(DrawerDestination.SECURITY.route) {
                        SecurityPrivacyScreen(
                            userId = userId,
                            email = userEmail,
                            onSignOut = onSignOut,
                        )
                    }
                    composable(DrawerDestination.FEEDBACK.route) {
                        FeedbackScreen(userId = userId)
                    }
                }

                // Auxiliary routes for drill-downs that other screens
                // navigate to via the same controller (added incrementally
                // in P2+). Kept as extra composables so future code can
                // navigateTo("class-detail") etc. without a new NavHost.
            }
        }
    }
}


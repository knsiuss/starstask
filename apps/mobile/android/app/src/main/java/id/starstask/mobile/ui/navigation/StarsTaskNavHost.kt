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
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import id.starstask.mobile.data.getWorkspaceScope
import id.starstask.mobile.ui.components.StarsTaskDrawerContent
import id.starstask.mobile.ui.screens.ActionCenterScreen
import id.starstask.mobile.ui.screens.AdminConsoleScreen
import id.starstask.mobile.ui.screens.AssignmentsWorkspaceScreen
import id.starstask.mobile.ui.screens.AttendanceScreen
import id.starstask.mobile.ui.screens.ClassesScreen
import id.starstask.mobile.ui.screens.DeveloperConsoleScreen
import id.starstask.mobile.ui.screens.FeedbackScreen
import id.starstask.mobile.ui.screens.GradesScreen
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

private const val ROUTE_ADMIN_CONSOLE = "admin-console"
private const val ASSIGNMENTS_WITH_ARG_ROUTE = "assignments?openRequest={openRequest}"
private const val ASSIGNMENTS_OPEN_REQUEST_ROUTE = "assignments?openRequest=true"
private const val ROUTE_DEVELOPER_CONSOLE = "developer-console"
private const val ROUTE_GRADES = "grades/{classId}"

/**
 * Single NavHost for the workspace. Admin and Developer consoles are
 * reachable only through Profile (platform-admin surfaces); they are not
 * additional bottom-dock tabs.
 */
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
                            onNewAssignment = { navigateTo(ASSIGNMENTS_OPEN_REQUEST_ROUTE) },
                            onOpenNotifications = { navigateTo(DrawerDestination.NOTIFICATIONS.route) },
                            onOpenLeave = { navigateTo(DrawerDestination.LEAVE.route) },
                        )
                    }
                    composable(
                        ASSIGNMENTS_WITH_ARG_ROUTE,
                        arguments = listOf(androidx.navigation.navArgument("openRequest") {
                            type = androidx.navigation.NavType.BoolType
                            defaultValue = false
                        }),
                    ) { entry ->
                        val autoOpenRequest = entry.arguments?.getBoolean("openRequest") == true
                        AssignmentsWorkspaceScreen(userId = userId, autoOpenRequest = autoOpenRequest)
                    }
                    composable(DrawerDestination.CLASSES.route) {
                        ClassesScreen(
                            userId = userId,
                            onOpenGrades = { classId -> navController.navigate("grades/$classId") },
                        )
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
                            onOpenDrawer = { scope.launch { drawerState.open() } },
                            onOpenNotifications = { navigateTo(DrawerDestination.NOTIFICATIONS.route) },
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
                            onOpenAdminConsole = { navController.navigate(ROUTE_ADMIN_CONSOLE) },
                            onOpenDeveloperConsole = { navController.navigate(ROUTE_DEVELOPER_CONSOLE) },
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
                    composable(ROUTE_ADMIN_CONSOLE) {
                        AdminConsoleScreen(onBack = { navController.popBackStack() })
                    }
                    composable(ROUTE_DEVELOPER_CONSOLE) {
                        DeveloperConsoleScreen(onBack = { navController.popBackStack() })
                    }
                    composable(
                        route = ROUTE_GRADES,
                        arguments = listOf(androidx.navigation.navArgument("classId") { type = androidx.navigation.NavType.StringType }),
                    ) { entry ->
                        val classId = entry.arguments?.getString("classId").orEmpty()
                        GradesScreen(classId = classId, onBack = { navController.popBackStack() })
                    }
                }
            }
        }
    }
}

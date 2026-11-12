package id.starstask.mobile.ui.navigation

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.expandVertically
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.shrinkVertically
import androidx.compose.animation.core.tween
import androidx.compose.material3.ModalNavigationDrawer
import androidx.compose.material3.Scaffold
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
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import id.starstask.mobile.data.getWorkspaceScope
import id.starstask.mobile.data.loadWorkspaceContext
import id.starstask.mobile.ui.components.StarsTaskDrawerContent
import id.starstask.mobile.ui.components.StarsTaskTopBar
import id.starstask.mobile.ui.screens.ActionCenterScreen
import id.starstask.mobile.ui.screens.AdminConsoleScreen
import id.starstask.mobile.ui.screens.AssignmentsWorkspaceScreen
import id.starstask.mobile.ui.screens.AttendanceScreen
import id.starstask.mobile.ui.screens.AttendanceCoursesAllScreen
import id.starstask.mobile.ui.screens.CourseAttendanceDetailScreen
import id.starstask.mobile.ui.screens.AttendanceSessionDetailScreen
import id.starstask.mobile.ui.screens.ClassesScreen
import id.starstask.mobile.ui.screens.DeveloperConsoleScreen
import id.starstask.mobile.ui.screens.FeedbackScreen
import id.starstask.mobile.ui.screens.GradesScreen
import id.starstask.mobile.ui.screens.HomeScreen
import id.starstask.mobile.ui.screens.LeaveRequestsScreen
import id.starstask.mobile.ui.screens.NotificationSettingsScreen
import id.starstask.mobile.ui.screens.NotificationsScreen
import id.starstask.mobile.ui.screens.ProfileScreen
import id.starstask.mobile.ui.screens.ScheduleScreen
import id.starstask.mobile.ui.screens.SecurityPrivacyScreen
import id.starstask.mobile.ui.screens.SettingsHubScreen
import kotlinx.coroutines.launch

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
    pushUrl: String? = null,
    onPushUrlConsumed: () -> Unit = {},
    navController: NavHostController = rememberNavController(),
) {
    val scope = rememberCoroutineScope()

    LaunchedEffect(pushUrl) {
        val target = routeForPushUrl(pushUrl)
        if (target != null) {
            navController.navigate(target) { launchSingleTop = true }
        }
        onPushUrlConsumed()
    }

    var managesAnyClass by remember { mutableStateOf(false) }
    var unreadNotifications by remember { mutableStateOf<Int?>(null) }
    var leaveFormOpen by remember { mutableStateOf(false) }
    LaunchedEffect(userId) {
        scope.launch {
            runCatching { getWorkspaceScope(userId).managesAnyClass }
                .onSuccess { managesAnyClass = it }
        }
        scope.launch {
            unreadNotifications = runCatching { loadWorkspaceContext()?.unreadNotifications }.getOrNull()
        }
    }

    val drawerState = rememberDrawerState(initialValue = DrawerValue.Closed)
    val navBackStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = navBackStackEntry?.destination?.route

    fun refreshUnread() {
        scope.launch {
            unreadNotifications = runCatching { loadWorkspaceContext()?.unreadNotifications }.getOrNull()
        }
    }

    // The leave screen owns its sub-destinations (List/Detail/Form); it tells
    // the host about the fullscreen form so the dock can hide there.
    LaunchedEffect(currentRoute) {
        leaveFormOpen = false
        refreshUnread()
    }

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
            topBar = {
                StarsTaskTopBar(
                    unreadCount = unreadNotifications,
                    onOpenDrawer = { scope.launch { drawerState.open() } },
                    onOpenNotifications = { navigateTo(DrawerDestination.NOTIFICATIONS.route) },
                )
            },
            bottomBar = {
                AnimatedVisibility(
                    visible = baseRoute(currentRoute) != baseRoute(DrawerDestination.LEAVE.route) || !leaveFormOpen,
                    enter = fadeIn(animationSpec = tween(250)) + expandVertically(animationSpec = tween(250)),
                    exit = fadeOut(animationSpec = tween(250)) + shrinkVertically(animationSpec = tween(250)),
                ) {
                    FloatingNavDock(
                        currentRoute = currentRoute,
                        onNavigate = { navigateTo(it) },
                    )
                }
            },
        ) { innerPadding ->
            // Top inset only: the dock floats above content. The Scaffold's
            // bottom padding would paint a Background-striped strip behind
            // the floating glass dock and spoil the translucency.
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(top = innerPadding.calculateTopPadding()),
            ) {
                NavHost(
                    navController = navController,
                    startDestination = DrawerDestination.DASHBOARD.route,
                    modifier = Modifier.fillMaxSize(),
                    enterTransition = {
                        androidx.compose.animation.slideInHorizontally(animationSpec = androidx.compose.animation.core.tween(280, easing = id.starstask.mobile.ui.theme.EasingOutCubic)) { fullWidth -> fullWidth / 4 } +
                            androidx.compose.animation.fadeIn(androidx.compose.animation.core.tween(220, easing = id.starstask.mobile.ui.theme.EasingStandard))
                    },
                    exitTransition = {
                        androidx.compose.animation.slideOutHorizontally(animationSpec = androidx.compose.animation.core.tween(200, easing = id.starstask.mobile.ui.theme.EasingStandard)) { -it / 8 } +
                            androidx.compose.animation.fadeOut(androidx.compose.animation.core.tween(160))
                    },
                    popEnterTransition = {
                        androidx.compose.animation.slideInHorizontally(animationSpec = androidx.compose.animation.core.tween(280, easing = id.starstask.mobile.ui.theme.EasingOutCubic)) { -it / 4 } +
                            androidx.compose.animation.fadeIn(androidx.compose.animation.core.tween(220))
                    },
                    popExitTransition = {
                        androidx.compose.animation.slideOutHorizontally(animationSpec = androidx.compose.animation.core.tween(200, easing = id.starstask.mobile.ui.theme.EasingStandard)) { it / 4 } +
                            androidx.compose.animation.fadeOut(androidx.compose.animation.core.tween(160))
                    },
                ) {
                    composable(DrawerDestination.DASHBOARD.route) {
                        HomeScreen(
                            userId = userId,
                            userEmail = userEmail,
                            onCheckIn = onCheckIn,
                            onOpenTasks = { navigateTo(DrawerDestination.ASSIGNMENTS.route) },
                            onOpenMessages = null,
                            onOpenSchedule = { navigateTo(DrawerDestination.SCHEDULE.route) },
                            onNewAssignment = { navigateTo(ASSIGNMENTS_OPEN_REQUEST_ROUTE) },
                            onOpenAttendance = { navigateTo(DrawerDestination.ATTENDANCE.route) },
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
                        AttendanceScreen(
                            userId = userId,
                            onOpenCourse = { (subjectId, name, code) ->
                                navController.navigate("attendance/course/${routeArg(subjectId)}/${routeArg(name)}/${routeArg(code ?: "-")}/-")
                            },
                            onOpenSession = { sid -> navController.navigate("attendance/session/${routeArg(sid)}") },
                            onViewAllCourses = { navigateTo(ATTENDANCE_COURSES_ROUTE) },
                            onManageClass = { navigateTo(DrawerDestination.CLASSES.route) },
                            onBrowseClasses = { navigateTo(DrawerDestination.CLASSES.route) },
                        )
                    }
                    composable(ATTENDANCE_COURSES_ROUTE) {
                        AttendanceCoursesAllScreen(
                            userId = userId,
                            onBack = { navController.popBackStack() },
                            onOpenCourse = { (subjectId, name, code) ->
                                navController.navigate("attendance/course/${routeArg(subjectId)}/${routeArg(name)}/${routeArg(code ?: "-")}/-")
                            },
                        )
                    }
                    composable(
                        ATTENDANCE_COURSE_ROUTE,
                        arguments = listOf(
                            androidx.navigation.navArgument("subjectId") { type = androidx.navigation.NavType.StringType },
                            androidx.navigation.navArgument("courseName") { type = androidx.navigation.NavType.StringType },
                            androidx.navigation.navArgument("courseCode") { type = androidx.navigation.NavType.StringType },
                            androidx.navigation.navArgument("className") { type = androidx.navigation.NavType.StringType },
                        ),
                    ) { entry ->
                        val subjectId = entry.arguments?.getString("subjectId").orEmpty()
                        val courseName = entry.arguments?.getString("courseName").orEmpty()
                        val courseCode = entry.arguments?.getString("courseCode")?.takeIf { it != "-" }
                        val className = entry.arguments?.getString("className")?.takeIf { it != "-" }
                        CourseAttendanceDetailScreen(
                            userId = userId,
                            subjectId = subjectId,
                            courseName = courseName,
                            courseCode = courseCode,
                            className = className,
                            onBack = { navController.popBackStack() },
                            onEntryClick = { sid -> navController.navigate("attendance/session/${routeArg(sid)}") },
                        )
                    }
                    composable(
                        ATTENDANCE_SESSION_ROUTE,
                        arguments = listOf(androidx.navigation.navArgument("sessionId") { type = androidx.navigation.NavType.StringType }),
                    ) { entry ->
                        val sessionId = entry.arguments?.getString("sessionId").orEmpty()
                        AttendanceSessionDetailScreen(
                            userId = userId,
                            sessionId = sessionId,
                            onBack = { navController.popBackStack() },
                        )
                    }
                    composable(DrawerDestination.SCHEDULE.route) {
                        ScheduleScreen(userId = userId)
                    }
                    composable(DrawerDestination.LEAVE.route) {
                        LeaveRequestsScreen(
                            userId = userId,
                            onOpenDrawer = { scope.launch { drawerState.open() } },
                            onSubScreenChange = { leaveFormOpen = it },
                        )
                    }
                    composable(DrawerDestination.NOTIFICATIONS.route) {
                        NotificationsScreen(
                            userId = userId,
                            onOpenUrl = { url ->
                                val target = routeForPushUrl(url, fallback = DrawerDestination.NOTIFICATIONS.route)!!
                                navController.navigate(target) { launchSingleTop = true }
                            },
                            onMarkedRead = { refreshUnread() },
                        )
                    }
                    composable(DrawerDestination.ACTION_CENTER.route) {
                        ActionCenterScreen(
                            userId = userId,
                            onOpenAttendanceCourse = { subjectId, name, code, className ->
                                navController.navigate(
                                    "attendance/course/${routeArg(subjectId)}/${routeArg(name)}/${routeArg(code ?: "-")}/${routeArg(className ?: "-")}",
                                )
                            },
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
                            onOpenAdminConsole = { navController.navigate(ADMIN_CONSOLE_ROUTE) },
                            onOpenDeveloperConsole = { navController.navigate(DEVELOPER_CONSOLE_ROUTE) },
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
                    composable(ADMIN_CONSOLE_ROUTE) {
                        AdminConsoleScreen(onBack = { navController.popBackStack() })
                    }
                    composable(DEVELOPER_CONSOLE_ROUTE) {
                        DeveloperConsoleScreen(onBack = { navController.popBackStack() })
                    }
                    composable(
                        route = GRADES_ROUTE,
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

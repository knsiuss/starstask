package id.starstask.mobile.ui.navigation

/** Base (unparameterized) route id, e.g. "assignments?openRequest={openRequest}" -> "assignments". */
fun baseRoute(route: String?): String? = route?.substringBefore('?')

/** Optional "View all" target: full course list for the semester. */
const val ATTENDANCE_COURSES_ROUTE = "attendance/courses"

/** `attendance/course/{subjectId}/{courseName}/{courseCode}/{className}` */
const val ATTENDANCE_COURSE_ROUTE = "attendance/course/{subjectId}/{courseName}/{courseCode}/{className}"

/** `attendance/session/{sessionId}` */
const val ATTENDANCE_SESSION_ROUTE = "attendance/session/{sessionId}"

/** Platform-admin surface, reachable only from Profile. */
const val ADMIN_CONSOLE_ROUTE = "admin-console"

/** Developer console, reachable only from Profile. */
const val DEVELOPER_CONSOLE_ROUTE = "developer-console"

/** `grades/{classId}` */
const val GRADES_ROUTE = "grades/{classId}"

const val ASSIGNMENTS_WITH_ARG_ROUTE = "assignments?openRequest={openRequest}"
const val ASSIGNMENTS_OPEN_REQUEST_ROUTE = "assignments?openRequest=true"

/** Url-encode a single route segment. */
fun routeArg(value: String): String = java.net.URLEncoder.encode(value, "UTF-8")

/**
 * Map a server push/notification URL to an in-app route.
 * Returns [fallback] when the URL is missing or unmatched: pass null for
 * push payloads (unknown target = ignore), or NOTIFICATIONS.route for the
 * inbox tap (fall back to the inbox the user came from).
 * DM routes intentionally land on notifications while DMs are hidden.
 */
fun routeForPushUrl(url: String?, fallback: String? = null): String? {
    val u = url?.trim().orEmpty()
    if (u.isEmpty()) return fallback
    return when {
        u.startsWith("/assignments") -> DrawerDestination.ASSIGNMENTS.route
        u.startsWith("/leave-requests") -> DrawerDestination.LEAVE.route
        u.startsWith("/messages") -> DrawerDestination.NOTIFICATIONS.route
        u.startsWith("/notifications") -> DrawerDestination.NOTIFICATIONS.route
        u.startsWith("/schedule") -> DrawerDestination.SCHEDULE.route
        u.startsWith("/actions") || u.startsWith("/app/actions") -> DrawerDestination.ACTION_CENTER.route
        u.startsWith("/classes") || u.startsWith("/app/classes") -> DrawerDestination.CLASSES.route
        u.startsWith("/attendance") -> DrawerDestination.ATTENDANCE.route
        else -> fallback
    }
}

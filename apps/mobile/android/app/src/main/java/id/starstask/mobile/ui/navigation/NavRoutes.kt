package id.starstask.mobile.ui.navigation

/** Base (unparameterized) route id, e.g. "assignments?openRequest={openRequest}" -> "assignments". */
fun baseRoute(route: String?): String? = route?.substringBefore('?')

/** Optional "View all" target: full course list for the semester. */
const val ATTENDANCE_COURSES_ROUTE = "attendance/courses"

/** `attendance/course/{subjectId}/{courseName}/{courseCode}/{className}` */
const val ATTENDANCE_COURSE_ROUTE = "attendance/course/{subjectId}/{courseName}/{courseCode}/{className}"

/** `attendance/session/{sessionId}` */
const val ATTENDANCE_SESSION_ROUTE = "attendance/session/{sessionId}"

/** Url-encode a single route segment. */
fun routeArg(value: String): String = java.net.URLEncoder.encode(value, "UTF-8")

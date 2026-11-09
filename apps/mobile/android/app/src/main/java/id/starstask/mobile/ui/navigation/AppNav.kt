package id.starstask.mobile.ui.navigation

import id.starstask.mobile.ui.icons.Lucide

import androidx.compose.ui.graphics.vector.ImageVector

/**
 * Centralized native routes, mapped 1:1 from the web workspace sidebar
 * (`apps/web/src/components/layout/workspace-nav.tsx`). Web routes stay
 * authoritative server-side; these strings are Android-internal only.
 * All icons use Lucide (outline, stroke 2, round caps) so the set is
 * uniform — active state is shown via pill background + tint, not by
 * swapping to a filled glyph.
 */
enum class DrawerDestination(
    val route: String,
    val label: String,
    val icon: ImageVector,
    val inBottomBar: Boolean = false,
    val bottomBarLabel: String = label,
) {
    DASHBOARD("dashboard", "Dashboard", Lucide.LayoutDashboard, inBottomBar = true),
    ASSIGNMENTS("assignments", "Assignments", Lucide.ClipboardList, inBottomBar = true),
    CLASSES("classes", "My Classes", Lucide.GraduationCap),
    ATTENDANCE("attendance", "Attendance", Lucide.CalendarCheck, inBottomBar = true),
    SCHEDULE("schedule", "Schedule", Lucide.CalendarDays, inBottomBar = true),

    /**
     * Web route `/leave-requests`, labeled "Absence Requests" on web.
     * Android bottom bar displays "Absence" per the reference screenshot;
     * backend identifiers unchanged.
     */
    LEAVE(
        "leave-requests",
        "Leave Requests",
        Lucide.ClipboardPen,
        inBottomBar = true,
        bottomBarLabel = "Absence",
    ),
    MESSAGES("messages", "Messages", Lucide.MessageCircle),
    NOTIFICATIONS("notifications", "Notifications", Lucide.Bell),

    /** Web route `/app/actions`; rendered only for class admins. */
    ACTION_CENTER("action-center", "Action Center", Lucide.CircleCheck),
    PROFILE("profile", "Profile", Lucide.CircleUserRound),
    SETTINGS("settings", "Settings", Lucide.Settings),
    SECURITY("security", "Security & Privacy", Lucide.ShieldCheck),
    FEEDBACK("feedback", "Feedback", Lucide.MessageSquare),
}

val studyDestinations: List<DrawerDestination> = listOf(
    DrawerDestination.DASHBOARD,
    DrawerDestination.ASSIGNMENTS,
    DrawerDestination.CLASSES,
    DrawerDestination.ATTENDANCE,
    DrawerDestination.SCHEDULE,
    DrawerDestination.LEAVE,
    DrawerDestination.MESSAGES,
    DrawerDestination.ACTION_CENTER,
)

val accountDestinations: List<DrawerDestination> = listOf(
    DrawerDestination.PROFILE,
    DrawerDestination.SETTINGS,
    DrawerDestination.SECURITY,
    DrawerDestination.FEEDBACK,
)

/** Internal route below Settings (web nested page /settings/notifications). */
const val SETTINGS_NOTIFICATIONS_ROUTE = "settings/notifications"

package id.starstask.mobile.ui.screens

import androidx.compose.ui.graphics.vector.ImageVector
import id.starstask.mobile.ui.icons.Lucide

/**
 * Dashboard icons, mirroring the lucide-react components used in
 * `apps/web/src/components/dashboard/` (stat-cards, quick-actions, header).
 * Values are [Lucide] glyphs, not Material icons.
 */
object HomeIcons {
    val Assignments: ImageVector = Lucide.ClipboardList
    val DueSoon: ImageVector = Lucide.CalendarClock
    val PastDeadline: ImageVector = Lucide.TriangleAlert
    val Classes: ImageVector = Lucide.GraduationCap
    val CheckIn: ImageVector = Lucide.CalendarCheck
    val SubmitTask: ImageVector = Lucide.ClipboardList
    val TodaySchedule: ImageVector = Lucide.CalendarDays
    val OpenMessages: ImageVector = Lucide.MessageCircle
    val NewAssignment: ImageVector = Lucide.Plus
}

package id.starstask.mobile.data

import kotlinx.coroutines.flow.Flow

// ---------------------------------------------------------------------------
// Repository pattern (spec Phase 2): single entry point for dashboard data.
// The ViewModel depends on this instead of calling data functions directly,
// so the data source can change without touching presentation.
// ---------------------------------------------------------------------------

class DashboardRepository {
    suspend fun dashboard(userId: String) = loadDashboard(userId)
    suspend fun schedule(userId: String) = loadSchedule(userId)
    suspend fun leaveRequests(userId: String) = loadLeaveRequests(userId)
    suspend fun notifications() = loadNotifications()
    suspend fun invitations(userId: String, email: String?) = loadInvitations(userId, email)
    suspend fun academicCard(userId: String) = loadAcademicCard(userId)
    suspend fun nextSchedule(userId: String) = loadNextSchedule(userId)
    // loadUpcomingSchedule was never implemented; upcoming work comes
    // from the Calendar loader (web listCalendarEvents mirror).
    suspend fun upcomingSchedule(userId: String): List<NextScheduleItem> {
        val next = loadNextSchedule(userId)
        return if (next != null) listOf(next) else emptyList()
    }
    suspend fun myWeek(userId: String, weekOffset: Int) = loadMyWeek(userId, weekOffset)
    /** Web parity: debounced tick on dashboard source-table changes. */
    fun changes(): Flow<Unit> = dashboardChanges()
}

package id.starstask.mobile.ui.screens

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import id.starstask.mobile.data.AcademicCard
import id.starstask.mobile.data.DashboardData
import id.starstask.mobile.data.DashboardRepository
import id.starstask.mobile.data.Invitation
import id.starstask.mobile.data.LeaveRequest
import id.starstask.mobile.data.MyWeekData
import id.starstask.mobile.data.NextScheduleItem
import id.starstask.mobile.data.NotificationRow
import id.starstask.mobile.data.ScheduleEntry
import id.starstask.mobile.data.loadAcademicCard
import id.starstask.mobile.data.loadDashboard
import id.starstask.mobile.data.loadInvitations
import id.starstask.mobile.data.loadLeaveRequests
import id.starstask.mobile.data.loadMyWeek
import id.starstask.mobile.data.loadNextSchedule
import id.starstask.mobile.data.loadNotifications
import id.starstask.mobile.data.loadSchedule
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withTimeoutOrNull

/** Single source of truth for dashboard state (spec: MVVM + StateFlow). */
data class DashboardUiState(
    val data: DashboardData? = null,
    val schedule: List<ScheduleEntry> = emptyList(),
    val leaveRequests: List<LeaveRequest> = emptyList(),
    val notifications: List<NotificationRow> = emptyList(),
    val invitations: List<Invitation> = emptyList(),
    val academicCard: AcademicCard? = null,
    val nextSchedule: NextScheduleItem? = null,
    val upcomingSchedule: List<NextScheduleItem> = emptyList(),
    val week: MyWeekData? = null,
    val weekOffset: Int = 0,
    val loading: Boolean = true,
    val refreshing: Boolean = false,
    val error: String? = null,
    val weekError: String? = null,
)

class DashboardViewModel(
    private val repository: DashboardRepository = DashboardRepository(),
) : ViewModel() {
    private val _state = MutableStateFlow(DashboardUiState())
    val state: StateFlow<DashboardUiState> = _state.asStateFlow()

    private var userId: String? = null
    private var userEmail: String? = null

    fun start(userId: String, userEmail: String?) {
        if (this.userId == userId) return
        this.userId = userId
        this.userEmail = userEmail
        refresh()
    }

    fun startCached(userId: String, userEmail: String?) {
        if (this.userId == userId && _state.value.data != null) return
        this.userId = userId
        this.userEmail = userEmail
        // Only fetch if we have no cached data; subsequent navigations
        // keep the StateFlow alive because the ViewModel is activity-scoped.
        if (_state.value.data == null) refresh()
    }

    fun refresh() {
        val uid = userId ?: return
        viewModelScope.launch {
            _state.value = _state.value.copy(refreshing = true)
            loadAll(uid, userEmail)
            loadWeek(uid)
            _state.value = _state.value.copy(loading = false, refreshing = false)
        }
    }

    fun setWeekOffset(offset: Int) {
        val uid = userId ?: return
        _state.value = _state.value.copy(weekOffset = offset)
        viewModelScope.launch { loadWeek(uid) }
    }

    fun retryWeek() {
        val uid = userId ?: return
        viewModelScope.launch { loadWeek(uid) }
    }

    private suspend fun loadAll(uid: String, email: String?) {
        var firstError: String? = null
        suspend fun <T> timed(label: String, block: suspend () -> T): T? =
            withTimeoutOrNull(15000) {
                runCatching { block() }
                    .onFailure { android.util.Log.e("DashboardVM", "load $label failed", it) }
                    .getOrNull()
            }
        val s = _state.value
        timed("dashboard") { _state.value = s.copy(data = repository.dashboard(uid)) }
            ?: run { firstError = "Could not load dashboard stats." }
        timed("schedule") { _state.value = _state.value.copy(schedule = repository.schedule(uid)) }
            ?: run { firstError = firstError ?: "Could not load schedule." }
        timed("leave") { _state.value = _state.value.copy(leaveRequests = repository.leaveRequests(uid)) }
            ?: run { firstError = firstError ?: "Could not load absence requests." }
        timed("notifications") { _state.value = _state.value.copy(notifications = repository.notifications()) }
            ?: run { firstError = firstError ?: "Could not load notifications." }
        timed("invitations") { _state.value = _state.value.copy(invitations = repository.invitations(uid, email)) }
            ?: run { firstError = firstError ?: "Could not load invitations." }
        timed("academic") { _state.value = _state.value.copy(academicCard = repository.academicCard(uid)) }
        timed("nextSchedule") { _state.value = _state.value.copy(nextSchedule = repository.nextSchedule(uid)) }
        timed("upcomingSchedule") { _state.value = _state.value.copy(upcomingSchedule = repository.upcomingSchedule(uid)) }
        _state.value = _state.value.copy(error = firstError)
    }

    private suspend fun loadWeek(uid: String) {
        _state.value = _state.value.copy(weekError = null)
        runCatching { repository.myWeek(uid, _state.value.weekOffset) }
            .onSuccess { _state.value = _state.value.copy(week = it) }
            .onFailure { _state.value = _state.value.copy(weekError = "Could not load this week.") }
    }

    fun setInvitations(invitations: List<Invitation>) {
        _state.value = _state.value.copy(invitations = invitations)
    }
}

package id.starstask.mobile.ui.screens

import id.starstask.mobile.ui.theme.Spacing

import id.starstask.mobile.ui.icons.Lucide
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.material3.pulltorefresh.rememberPullToRefreshState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import id.starstask.mobile.data.LeaveRequest
import id.starstask.mobile.data.formatLeaveDate
import id.starstask.mobile.data.formatLeaveDateRange
import id.starstask.mobile.data.leaveDayCount
import id.starstask.mobile.data.leaveReasonLabel
import id.starstask.mobile.data.leaveStatusLabel
import id.starstask.mobile.data.loadLeaveRequests
import id.starstask.mobile.ui.components.BadgeVariant
import id.starstask.mobile.ui.components.StarsTaskBadge
import id.starstask.mobile.ui.components.WebAlert
import id.starstask.mobile.ui.components.WebButton
import id.starstask.mobile.ui.components.WebButtonVariant
import id.starstask.mobile.ui.components.WebInput
import id.starstask.mobile.ui.theme.Accent
import id.starstask.mobile.ui.theme.AccentSoft
import id.starstask.mobile.ui.theme.Band
import id.starstask.mobile.ui.theme.Border
import id.starstask.mobile.ui.theme.Danger
import id.starstask.mobile.ui.theme.DangerSoft
import id.starstask.mobile.ui.theme.Foreground
import id.starstask.mobile.ui.theme.Muted
import id.starstask.mobile.ui.theme.MutedForeground
import id.starstask.mobile.ui.theme.SuccessSoft
import id.starstask.mobile.ui.theme.Surface

sealed class LeaveDestination {
    object List : LeaveDestination()
    data class Detail(val requestId: String) : LeaveDestination()
    data class Form(val requestId: String?) : LeaveDestination()
}

@Composable
fun LeaveRequestsScreen(
    userId: String,
    onBack: () -> Unit,
) {
    var destination by remember { mutableStateOf<LeaveDestination>(LeaveDestination.List) }
    var refreshTick by remember { mutableIntStateOf(0) }

    when (val dest = destination) {
        LeaveDestination.List -> LeaveRequestsListScreen(
            userId = userId,
            onBack = onBack,
            refreshTick = refreshTick,
            onNewRequest = { destination = LeaveDestination.Form(null) },
            onRequestClick = { destination = LeaveDestination.Detail(it.id) },
        )
        is LeaveDestination.Detail -> LeaveRequestDetailScreen(
            userId = userId,
            requestId = dest.requestId,
            onBack = { destination = LeaveDestination.List },
            onEdit = { destination = LeaveDestination.Form(dest.requestId) },
            onChanged = { refreshTick++ },
        )
        is LeaveDestination.Form -> LeaveRequestFormScreen(
            userId = userId,
            requestId = dest.requestId,
            onBack = { destination = LeaveDestination.List },
            onSaved = {
                refreshTick++
                destination = LeaveDestination.List
            },
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun LeaveRequestsListScreen(
    userId: String,
    onBack: () -> Unit,
    refreshTick: Int,
    onNewRequest: () -> Unit,
    onRequestClick: (LeaveRequest) -> Unit,
) {
    var requests by remember { mutableStateOf<List<LeaveRequest>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }
    var refreshing by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var reloadTick by remember { mutableIntStateOf(0) }
    var statusFilter by remember { mutableStateOf<String?>(null) }
    var searchQuery by remember { mutableStateOf("") }

    LaunchedEffect(userId, reloadTick, refreshTick) {
        loading = true
        error = null
        try {
            requests = loadLeaveRequests(userId)
        } catch (_: Exception) {
            error = "Could not load leave requests."
        }
        loading = false
        refreshing = false
    }

    val pullState = rememberPullToRefreshState()
    PullToRefreshBox(
        state = pullState,
        isRefreshing = refreshing,
        onRefresh = {
            refreshing = true
            reloadTick++
        },
        modifier = Modifier.fillMaxSize(),
    ) {
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = Spacing.Section, vertical = Spacing.Xl),
            verticalArrangement = Arrangement.spacedBy(Spacing.Xxl),
        ) {
            item(key = "header") {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(12.dp))
                            .background(AccentSoft)
                            .size(40.dp),
                        contentAlignment = Alignment.Center,
                    ) {
                        Icon(Lucide.CalendarDays, contentDescription = null, tint = Accent)
                    }
                    Column(modifier = Modifier.padding(start = 12.dp)) {
                        Text(
                            "Leave Requests",
                            style = MaterialTheme.typography.headlineSmall,
                            color = Foreground,
                            fontWeight = FontWeight.SemiBold,
                        )
                        Text(
                            "Submit and track your leave requests for class activities.",
                            style = MaterialTheme.typography.bodySmall,
                            color = MutedForeground,
                        )
                    }
                }
            }

            item(key = "new") {
                WebButton(
                    label = "New Leave Request",
                    onClick = onNewRequest,
                    modifier = Modifier.fillMaxWidth(),
                    icon = Lucide.Plus,
                )
            }

            if (loading) {
                item(key = "loading") {
                    val rowsCount = 3
                    Column(verticalArrangement = Arrangement.spacedBy(Spacing.Md)) {
                        repeat(rowsCount) { id.starstask.mobile.ui.components.WebSkeletonCard() }
                    }
                }
            } else if (error != null) {
                item(key = "error") {
                    Column(verticalArrangement = Arrangement.spacedBy(Spacing.Md)) {
                        WebAlert(message = error!!)
                        WebButton(label = "Retry", onClick = { reloadTick++ }, variant = WebButtonVariant.SECONDARY)
                    }
                }
            } else {
                val filteredRequests = requests.filter { request ->
                    (statusFilter == null || request.status == statusFilter) &&
                        (searchQuery.isBlank() ||
                            request.reference.contains(searchQuery.trim(), ignoreCase = true) ||
                            request.className.contains(searchQuery.trim(), ignoreCase = true))
                }
                item(key = "stats") {
                    LeaveStatsGrid(requests)
                }
                item(key = "filters") {
                    Column(verticalArrangement = Arrangement.spacedBy(Spacing.Md)) {
                        WebInput(
                            value = searchQuery,
                            onValueChange = { searchQuery = it },
                            label = "Search reference or class",
                        )
                        Row(
                            horizontalArrangement = Arrangement.spacedBy(Spacing.Md),
                            modifier = Modifier
                                .fillMaxWidth()
                                .horizontalScroll(rememberScrollState()),
                        ) {
                            FilterChip(
                                selected = statusFilter == null,
                                onClick = { statusFilter = null },
                                label = { Text("All") },
                            )
                            listOf("submitted", "approved", "rejected", "draft", "forwarded", "cancelled")
                                .forEach { status ->
                                    FilterChip(
                                        selected = statusFilter == status,
                                        onClick = { statusFilter = status },
                                        label = { Text(leaveStatusLabel(status)) },
                                    )
                                }
                        }
                    }
                }
                item(key = "your-requests-heading") {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            "Your Requests",
                            style = MaterialTheme.typography.titleMedium,
                            color = Foreground,
                            fontWeight = FontWeight.SemiBold,
                        )
                        Box(
                            modifier = Modifier
                                .padding(start = 8.dp)
                                .clip(RoundedCornerShape(999.dp))
                                .background(Muted)
                                .padding(horizontal = Spacing.Lg, vertical = 3.dp),
                        ) {
                            Text(
                                "${filteredRequests.size} ${if (filteredRequests.size == 1) "request" else "requests"}",
                                style = MaterialTheme.typography.labelSmall,
                                color = MutedForeground,
                            )
                        }
                    }
                }
                if (filteredRequests.isEmpty()) {
                    item(key = "empty") {
                        LeaveEmptyState(onNewRequest = onNewRequest)
                    }
                } else {
                    items(filteredRequests, key = { it.id }) { request ->
                        LeaveRequestCard(request = request, onClick = { onRequestClick(request) })
                    }
                }
                item(key = "forwarded-info") {
                    ForwardedInfoCard()
                }
            }
        }
    }
}

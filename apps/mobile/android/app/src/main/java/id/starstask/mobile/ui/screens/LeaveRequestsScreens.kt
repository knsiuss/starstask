package id.starstask.mobile.ui.screens

import id.starstask.mobile.ui.theme.Spacing

import id.starstask.mobile.ui.icons.Lucide

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextFieldDefaults
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import id.starstask.mobile.data.LeaveRequest
import id.starstask.mobile.data.loadLeaveRequests
import id.starstask.mobile.data.loadWorkspaceContext
import id.starstask.mobile.ui.components.GradientPillButton
import id.starstask.mobile.ui.components.WebAlert
import id.starstask.mobile.ui.components.WebButton
import id.starstask.mobile.ui.components.WebButtonVariant
import id.starstask.mobile.ui.screens.dashboard.DashTopBar
import id.starstask.mobile.ui.theme.LocalDarkTheme
import id.starstask.mobile.ui.theme.mockColors

sealed class LeaveDestination {
    object List : LeaveDestination()
    data class Detail(val requestId: String) : LeaveDestination()
    data class Form(val requestId: String?) : LeaveDestination()
}

@Composable
fun LeaveRequestsScreen(
    userId: String,
    onOpenDrawer: () -> Unit = {},
    onOpenNotifications: () -> Unit = {},
) {
    var destination by remember { mutableStateOf<LeaveDestination>(LeaveDestination.List) }
    var refreshTick by remember { mutableIntStateOf(0) }

    when (val dest = destination) {
        LeaveDestination.List -> LeaveRequestsListScreen(
            userId = userId,
            refreshTick = refreshTick,
            onOpenDrawer = onOpenDrawer,
            onOpenNotifications = onOpenNotifications,
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
    refreshTick: Int,
    onOpenDrawer: () -> Unit,
    onOpenNotifications: () -> Unit,
    onNewRequest: () -> Unit,
    onRequestClick: (LeaveRequest) -> Unit,
) {
    val palette = mockColors()
    val darkMode = LocalDarkTheme.current
    var requests by remember { mutableStateOf<List<LeaveRequest>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }
    var refreshing by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var reloadTick by remember { mutableIntStateOf(0) }
    var statusFilter by remember { mutableStateOf<String?>(null) }
    var searchQuery by remember { mutableStateOf("") }
    var showFilter by remember { mutableStateOf(false) }
    var unreadCount by remember { mutableStateOf<Int?>(null) }

    LaunchedEffect(Unit) {
        unreadCount = loadWorkspaceContext()?.unreadNotifications
    }

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
    LeaveBackdrop {
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
                    .padding(start = Spacing.Section, end = Spacing.Section, top = Spacing.Sm, bottom = 104.dp),
                verticalArrangement = Arrangement.spacedBy(Spacing.Xxl),
            ) {
                item(key = "topbar") {
                    DashTopBar(
                        isDark = darkMode,
                        unreadCount = unreadCount,
                        onOpenDrawer = onOpenDrawer,
                        onToggleTheme = {},
                        onOpenNotifications = onOpenNotifications,
                        showThemeToggle = false,
                    )
                }
                item(key = "header") {
                    Column(verticalArrangement = Arrangement.spacedBy(Spacing.Xxs)) {
                        Text(
                            "Leave Requests",
                            color = palette.ink,
                            fontSize = 30.sp,
                            lineHeight = 36.sp,
                            fontWeight = FontWeight.Bold,
                            letterSpacing = (-0.5).sp,
                        )
                        Text(
                            "Submit and track your leave requests for class activities.",
                            color = palette.muted,
                            fontSize = 15.sp,
                            lineHeight = 21.sp,
                        )
                    }
                }
                item(key = "new") {
                    GradientPillButton(
                        label = "New Leave Request",
                        onClick = onNewRequest,
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
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(Spacing.Lg),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            OutlinedTextField(
                                value = searchQuery,
                                onValueChange = { searchQuery = it },
                                placeholder = { Text("Search reference or class", color = palette.muted) },
                                leadingIcon = { Icon(Lucide.Search, contentDescription = null, tint = palette.muted) },
                                singleLine = true,
                                shape = RoundedCornerShape(999.dp),
                                textStyle = MaterialTheme.typography.bodyMedium,
                                colors = TextFieldDefaults.colors(
                                    focusedContainerColor = palette.chip,
                                    unfocusedContainerColor = palette.chip,
                                    disabledContainerColor = palette.chip,
                                    focusedIndicatorColor = palette.cardBorder,
                                    unfocusedIndicatorColor = palette.cardBorder,
                                    cursorColor = palette.accent,
                                ),
                                modifier = Modifier.weight(1f).heightIn(min = 48.dp),
                            )
                            Box(
                                modifier = Modifier
                                    .size(48.dp)
                                    .clip(RoundedCornerShape(999.dp))
                                    .background(palette.card)
                                    .clickable { showFilter = true },
                                contentAlignment = Alignment.Center,
                            ) {
                                Icon(Lucide.SlidersHorizontal, contentDescription = "Filter by status", tint = palette.ink, modifier = Modifier.size(20.dp))
                                if (statusFilter != null) {
                                    Box(
                                        modifier = Modifier
                                            .align(Alignment.TopEnd)
                                            .padding(top = 10.dp, end = 10.dp)
                                            .size(8.dp)
                                            .clip(RoundedCornerShape(999.dp))
                                            .background(palette.accent),
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
                                color = palette.ink,
                                fontWeight = FontWeight.SemiBold,
                            )
                            Box(
                                modifier = Modifier
                                    .padding(start = 8.dp)
                                    .clip(RoundedCornerShape(999.dp))
                                    .background(palette.chip)
                                    .padding(horizontal = Spacing.Lg, vertical = 3.dp),
                            ) {
                                Text(
                                    "${filteredRequests.size} ${if (filteredRequests.size == 1) "request" else "requests"}",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = palette.muted,
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
                    item(key = "approval-info") {
                        LeaveApprovalInfoCard()
                    }
                }
            }
        }
    }

    if (showFilter) {
        LeaveFilterSheet(
            selected = statusFilter,
            onSelect = { statusFilter = it },
            onDismiss = { showFilter = false },
        )
    }
}

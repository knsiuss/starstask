package id.starstask.mobile.ui.screens

// Instagram-style notification inbox (glossy iOS-light): sticky Today /
// Yesterday / Earlier groups, unread dot + semibold title, empty state,
// tap = open payload url + mark read, bell badge count cleared from host
// via onMarkedRead callback.

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
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
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.material3.pulltorefresh.rememberPullToRefreshState
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import id.starstask.mobile.data.NotificationRow
import id.starstask.mobile.data.loadNotifications
import id.starstask.mobile.data.markAllNotificationsRead
import id.starstask.mobile.data.markNotificationRead
import id.starstask.mobile.ui.icons.Lucide
import id.starstask.mobile.ui.theme.mockColors
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NotificationsScreen(
    userId: String,
    onOpenUrl: (String) -> Unit,
    onMarkedRead: () -> Unit,
) {
    val palette = mockColors()
    val scope = rememberCoroutineScope()
    val context = androidx.compose.ui.platform.LocalContext.current
    var rows by remember { mutableStateOf<List<NotificationRow>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    var markingAll by remember { mutableStateOf(false) }
    var reloadTick by remember { mutableStateOf(0) }
    var refreshing by remember { mutableStateOf(false) }

    fun persistRows(next: List<NotificationRow>) {
        id.starstask.mobile.data.writeDiskCache(
            context, userId, "notifications.list", next,
            kotlinx.serialization.builtins.ListSerializer(NotificationRow.serializer()),
        )
    }

    LaunchedEffect(userId) {
        rows = id.starstask.mobile.data.readDiskCache(
            context, userId, "notifications.list",
            kotlinx.serialization.builtins.ListSerializer(NotificationRow.serializer()),
        ) ?: emptyList()
    }

    LaunchedEffect(userId, reloadTick) {
        if (!refreshing) loading = true
        val freshResult = runCatching { loadNotifications() }
        freshResult.onSuccess { fresh ->
            rows = fresh
            persistRows(fresh)
            error = null
        }.onFailure {
            if (rows.isEmpty()) error = "Could not load notifications."
        }
        loading = false
        refreshing = false
    }

    fun markOne(id: String) {
        rows = rows.map { if (it.id == id) it.copy(readAt = "now") else it }
        persistRows(rows)
        onMarkedRead()
        scope.launch { runCatching { markNotificationRead(id) } }
    }

    fun markAll() {
        markingAll = true
        rows = rows.map { it.copy(readAt = it.readAt ?: "now") }
        persistRows(rows)
        onMarkedRead()
        scope.launch {
            runCatching { markAllNotificationsRead() }
            markingAll = false
        }
    }

    val today = java.time.LocalDate.now()
    val groups = rows
        .map { row -> row to groupKey(today, row.createdAt) }
        .groupBy({ it.second }, { it.first })

    val pullState = rememberPullToRefreshState()
    Box(modifier = Modifier.fillMaxSize().background(id.starstask.mobile.ui.theme.mockPageBrush())) {
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
            modifier = Modifier.fillMaxSize(),
            contentPadding = androidx.compose.foundation.layout.PaddingValues(start = 16.dp, end = 16.dp, top = 12.dp, bottom = 112.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            item(key = "header") {
                Row(
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 4.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    Text(
                        "Notifications",
                        color = palette.ink,
                        fontSize = 28.sp,
                        lineHeight = 34.sp,
                        fontWeight = FontWeight.SemiBold,
                        modifier = Modifier.weight(1f),
                    )
                    val hasUnread = rows.any { it.readAt == null }
                    if (hasUnread) {
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(999.dp))
                                .background(palette.accentSofter)
                                .clickable(enabled = !markingAll) { markAll() }
                                .padding(horizontal = 14.dp, vertical = 8.dp),
                        ) {
                            Text(
                                if (markingAll) "Marking…" else "Mark all read",
                                color = palette.accent,
                                fontSize = 13.sp,
                                fontWeight = FontWeight.SemiBold,
                            )
                        }
                    }
                }
            }

            if (error != null) {
                item(key = "error") {
                    Text(error!!, color = palette.riskFg, fontSize = 13.sp, modifier = Modifier.padding(horizontal = 4.dp))
                }
            }

            if (loading && rows.isEmpty()) {
                item(key = "loading") {
                    Box(modifier = Modifier.fillMaxWidth().padding(vertical = 40.dp), contentAlignment = Alignment.Center) {
                        id.starstask.mobile.ui.components.StaggerDots(color = palette.accent)
                    }
                }
            } else if (rows.isEmpty()) {
                item(key = "empty") {
                    Column(
                        modifier = Modifier.fillMaxWidth().padding(vertical = 48.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(10.dp),
                    ) {
                        Box(
                            modifier = Modifier
                                .size(64.dp)
                                .clip(RoundedCornerShape(999.dp))
                                .background(palette.chip),
                            contentAlignment = Alignment.Center,
                        ) {
                            Icon(Lucide.Bell, contentDescription = null, tint = palette.muted, modifier = Modifier.size(28.dp))
                        }
                        Text("No notifications yet.", color = palette.ink, fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
                        Text(
                            "Assignment deadlines, announcements, and class activity will appear here.",
                            color = palette.muted,
                            fontSize = 13.sp,
                            lineHeight = 19.sp,
                        )
                    }
                }
            }

            listOf("Today" to groups["today"].orEmpty(), "Yesterday" to groups["yesterday"].orEmpty(), "Earlier" to groups["earlier"].orEmpty()).forEach { (label, group) ->
                if (group.isNotEmpty()) {
                    item(key = "h-$label") {
                        Text(
                            label,
                            color = palette.muted,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.SemiBold,
                            modifier = Modifier.padding(start = 4.dp, top = 6.dp),
                        )
                    }
                    group.forEach { row ->
                        item(key = row.id) {
                            NotificationRowCard(
                                row = row,
                                palette = palette,
                                onOpen = {
                                    markOne(row.id)
                                    val target = row.url?.trim().takeUnless { it.isNullOrEmpty() } ?: "/notifications"
                                    onOpenUrl(target)
                                },
                            )
                        }
                    }
                }
            }
        }
        }
    }
}

@Composable
private fun NotificationRowCard(
    row: id.starstask.mobile.data.NotificationRow,
    palette: id.starstask.mobile.ui.theme.MockPalette,
    onOpen: () -> Unit,
) {
    val unread = row.readAt == null
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(20.dp))
            .background(if (unread) palette.accentSofter else palette.card)
            .border(1.dp, palette.cardBorder, RoundedCornerShape(20.dp))
            .clickable(onClick = onOpen)
            .padding(horizontal = 14.dp, vertical = 14.dp),
        verticalAlignment = Alignment.Top,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Box(
            modifier = Modifier
                .padding(top = 4.dp)
                .size(9.dp)
                .clip(RoundedCornerShape(999.dp))
                .background(if (unread) palette.accent else palette.hairline),
        )
        Column(verticalArrangement = Arrangement.spacedBy(3.dp), modifier = Modifier.weight(1f)) {
            Text(
                row.title,
                color = palette.ink,
                fontSize = 15.sp,
                lineHeight = 20.sp,
                fontWeight = if (unread) FontWeight.SemiBold else FontWeight.Medium,
                maxLines = 2,
            )
            if (row.body.isNotEmpty()) {
                Text(
                    row.body,
                    color = palette.muted,
                    fontSize = 13.sp,
                    lineHeight = 18.sp,
                    maxLines = 3,
                )
            }
        }
        if (!row.url.isNullOrBlank()) {
            Icon(
                Lucide.ChevronRight,
                contentDescription = null,
                tint = palette.muted,
                modifier = Modifier.size(18.dp).padding(top = 2.dp),
            )
        }
    }
}

private fun groupKey(today: java.time.LocalDate, createdAt: String): String {
    val date = runCatching { java.time.LocalDate.parse(createdAt.take(10)) }.getOrNull() ?: return "earlier"
    return when (date) {
        today -> "today"
        today.minusDays(1) -> "yesterday"
        else -> "earlier"
    }
}

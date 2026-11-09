package id.starstask.mobile.ui.screens

import id.starstask.mobile.ui.theme.Spacing

import id.starstask.mobile.ui.components.WebSectionTitle
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
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
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import id.starstask.mobile.R
import id.starstask.mobile.data.AcademicCard
import id.starstask.mobile.data.DashboardClass
import id.starstask.mobile.data.DashboardData
import id.starstask.mobile.data.DashboardSession
import id.starstask.mobile.data.Invitation
import id.starstask.mobile.data.LeaveRequest
import id.starstask.mobile.data.NextScheduleItem
import id.starstask.mobile.data.NotificationRow
import id.starstask.mobile.data.ScheduleEntry
import id.starstask.mobile.data.acceptPendingInvitation
import id.starstask.mobile.data.declineInvitation
import id.starstask.mobile.data.formatDateShort
import id.starstask.mobile.data.formatTime
import id.starstask.mobile.data.jakartaDate
import id.starstask.mobile.data.loadAcademicCard
import id.starstask.mobile.data.loadDashboard
import id.starstask.mobile.data.loadInvitations
import id.starstask.mobile.data.loadLeaveRequests
import id.starstask.mobile.data.loadNextSchedule
import id.starstask.mobile.data.loadNotifications
import id.starstask.mobile.data.loadSchedule
import id.starstask.mobile.ui.theme.Accent
import id.starstask.mobile.ui.theme.AccentSoft
import id.starstask.mobile.ui.theme.Band
import id.starstask.mobile.ui.theme.Border
import id.starstask.mobile.ui.theme.Danger
import id.starstask.mobile.ui.theme.DangerSoft
import id.starstask.mobile.ui.theme.Foreground
import id.starstask.mobile.ui.theme.MutedFill
import id.starstask.mobile.ui.theme.MutedForeground
import id.starstask.mobile.ui.theme.StarsTaskTheme
import id.starstask.mobile.ui.theme.Subtle
import id.starstask.mobile.ui.theme.Surface
import id.starstask.mobile.ui.theme.Warning
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

// Live-preview entry points: open Design mode (split pane) in Android
// Studio and every edit below re-renders instantly without a device.
@Preview(showBackground = true, name = "Home â€” header + stats + actions")
@Composable
fun HomeComponentsPreview() {
    StarsTaskTheme {
        Column(
            modifier = Modifier.padding(Spacing.Section),
            verticalArrangement = Arrangement.spacedBy(Spacing.Xl),
        ) {
            DashboardHeader(
                greeting = "Good morning",
                name = "StarsTask member",
                summaryParts = listOf("2 sessions today", "1 assignment due"),
                dateLabel = "Friday, 6 November 2026",
                now = java.time.ZonedDateTime.of(
                    2026, 11, 6, 8, 30,
                    0, 0, java.time.ZoneId.of("Asia/Jakarta"),
                ),
            )
            WebSectionTitle(text = "Overview")
            Row(
                horizontalArrangement = Arrangement.spacedBy(Spacing.Lg),
                modifier = Modifier.fillMaxWidth(),
            ) {
                StatCard(
                    label = "Sessions",
                    value = 2,
                    icon = TasksIcon,
                    tone = "default",
                    modifier = Modifier.weight(1f),
                )
                StatCard(
                    label = "Due soon",
                    value = 1,
                    icon = DueIcon,
                    tone = "warning",
                    modifier = Modifier.weight(1f),
                )
            }
            QuickActions(
                onCheckIn = {},
                onOpenTasks = {},
                onOpenMessages = {},
            )
        }
    }
}

@Preview(showBackground = true, name = "Home â€” stat card tones")
@Composable
fun StatCardTonesPreview() {
    StarsTaskTheme {
        Column(
            modifier = Modifier.padding(Spacing.Section),
            verticalArrangement = Arrangement.spacedBy(Spacing.Lg),
        ) {
            StatCard(label = "Default", value = 3, icon = TasksIcon, tone = "default")
            StatCard(label = "Warning", value = 1, icon = DueIcon, tone = "warning")
            StatCard(label = "Danger", value = 2, icon = WarningIcon, tone = "danger")
            StatCard(label = "Success", value = 5, icon = ClassesIcon, tone = "success")
        }
    }
}


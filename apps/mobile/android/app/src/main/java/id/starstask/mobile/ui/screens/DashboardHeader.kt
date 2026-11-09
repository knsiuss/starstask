package id.starstask.mobile.ui.screens

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
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
import id.starstask.mobile.ui.components.BrandMark
import id.starstask.mobile.ui.icons.Lucide
import id.starstask.mobile.ui.theme.AccentSoft
import id.starstask.mobile.ui.theme.DisplayName
import id.starstask.mobile.ui.theme.Greeting
import id.starstask.mobile.ui.theme.Summary
import id.starstask.mobile.ui.theme.Spacing
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

@Composable
fun DashboardHeader(
    greeting: String,
    name: String,
    summaryParts: List<String>,
    dateLabel: String,
    now: java.time.ZonedDateTime,
    modifier: Modifier = Modifier,
) {
    var clock by remember { mutableStateOf(now) }

    LaunchedEffect(Unit) {
        while (true) {
            delay(60_000)
            clock = java.time.ZonedDateTime.now(java.time.ZoneId.systemDefault())
        }
    }

    val clockLabel = clock.format(java.time.format.DateTimeFormatter.ofPattern("HH:mm"))
    val zoneLabel = when (clock.zone.id) {
        "Asia/Jakarta" -> "WIB"
        "Asia/Makassar" -> "WITA"
        "Asia/Jayapura" -> "WIT"
        "UTC" -> "UTC"
        else -> java.util.TimeZone.getTimeZone(clock.zone.id).getDisplayName(
            false,
            java.util.TimeZone.SHORT,
            java.util.Locale.getDefault(),
        )
    }

    Column(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(Spacing.Section))
            .border(1.dp, Border, RoundedCornerShape(Spacing.Section))
            .background(Surface),
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Spacing.Section)),
        ) {
            // Web header gradient: accent-soft â†’ band â†’ surface, right half.
            Box(
                modifier = Modifier
                    .fillMaxWidth(0.5f)
                    .align(Alignment.CenterEnd)
                    .background(
                        Brush.horizontalGradient(
                            listOf(AccentSoft, Band, Surface),
                        ),
                    ),
            )
            Row(
                modifier = Modifier.fillMaxWidth().padding(Spacing.Block),
                verticalAlignment = Alignment.Top,
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text("$greeting,", color = MutedForeground, style = Greeting)
                    Text(name, style = DisplayName, color = Foreground)
                    Text(
                        if (summaryParts.isNotEmpty()) "You have ${summaryParts.joinToString(" and ")}."
                        else "Here is an overview of your academic activities today.",
                        color = MutedForeground,
                        style = Summary,
                    )
                }
                BrandMark(sizeDp = 88, modifier = Modifier.padding(start = Spacing.Section))
            }
        }
        HorizontalDivider(
            color = Border,
            modifier = Modifier.padding(horizontal = Spacing.Block),
        )
        Row(
            horizontalArrangement = Arrangement.spacedBy(Spacing.Page),
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.padding(horizontal = Spacing.Block, vertical = Spacing.Xxl),
        ) {
            Row(
                horizontalArrangement = Arrangement.spacedBy(Spacing.Sm),
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.weight(1f),
            ) {
                Box(
                    modifier = Modifier.clip(RoundedCornerShape(999.dp)).background(AccentSoft).size(28.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(HomeIcons.TodaySchedule, contentDescription = null, tint = Accent, modifier = Modifier.size(14.dp))
                }
                Text(
                    dateLabel,
                    color = MutedForeground,
                    style = MaterialTheme.typography.bodyMedium,
                    maxLines = 1,
                    overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis,
                )
            }
            Row(
                horizontalArrangement = Arrangement.spacedBy(Spacing.Sm),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Box(
                    modifier = Modifier.clip(RoundedCornerShape(999.dp)).background(AccentSoft).size(28.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(HomeIcons.DueSoon, contentDescription = null, tint = Accent, modifier = Modifier.size(14.dp))
                }
                Text(clockLabel, color = Foreground, style = MaterialTheme.typography.bodyMedium, fontWeight = androidx.compose.ui.text.font.FontWeight.SemiBold, maxLines = 1)
                Text(zoneLabel, color = MutedForeground, style = MaterialTheme.typography.bodyMedium, maxLines = 1)
            }
        }
    }
}


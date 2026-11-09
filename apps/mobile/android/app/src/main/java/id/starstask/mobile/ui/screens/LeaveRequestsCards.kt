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
import id.starstask.mobile.ui.components.WebCard
import id.starstask.mobile.ui.components.WebCompactCard
import id.starstask.mobile.ui.theme.Accent
import id.starstask.mobile.ui.theme.AccentSoft
import id.starstask.mobile.ui.theme.Band
import id.starstask.mobile.ui.theme.Border
import id.starstask.mobile.ui.theme.Danger
import id.starstask.mobile.ui.theme.DangerSoft
import id.starstask.mobile.ui.theme.Foreground
import id.starstask.mobile.ui.theme.Muted
import id.starstask.mobile.ui.theme.MutedForeground
import id.starstask.mobile.ui.theme.Success
import id.starstask.mobile.ui.theme.SuccessSoft
import id.starstask.mobile.ui.theme.Surface

@Composable
fun LeaveStatsGrid(requests: List<LeaveRequest>) {
    val stats = listOf(
        LeaveStat("Pending", requests.count { it.status == "submitted" }, Lucide.Send, AccentSoft, Accent),
        LeaveStat("Approved", requests.count { it.status == "approved" }, Lucide.CircleCheck, SuccessSoft, Success),
        LeaveStat("Rejected", requests.count { it.status == "rejected" }, Lucide.XCircle, DangerSoft, Danger),
        LeaveStat("Draft", requests.count { it.status == "draft" }, Lucide.FileText, Muted, MutedForeground),
    )
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.Lg)) {
        stats.chunked(2).forEach { row ->
            Row(horizontalArrangement = Arrangement.spacedBy(Spacing.Lg)) {
                row.forEach { stat ->
                    LeaveStatCard(stat, modifier = Modifier.weight(1f))
                }
            }
        }
    }
}

data class LeaveStat(
    val label: String,
    val count: Int,
    val icon: ImageVector,
    val background: Color,
    val foreground: Color,
)

@Composable
fun LeaveStatCard(stat: LeaveStat, modifier: Modifier = Modifier) {
    WebCompactCard(modifier = modifier, padding = 12.dp) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.Lg),
        ) {
            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(10.dp))
                    .background(stat.background)
                    .size(36.dp),
                contentAlignment = Alignment.Center,
            ) {
                Icon(stat.icon, contentDescription = null, tint = stat.foreground, modifier = Modifier.size(18.dp))
            }
            Column {
                Text(stat.label, style = MaterialTheme.typography.bodySmall, color = MutedForeground)
                Text(
                    "${stat.count}",
                    style = MaterialTheme.typography.headlineSmall,
                    color = Foreground,
                    fontWeight = FontWeight.Bold,
                )
            }
        }
    }
}

@Composable
fun LeaveEmptyState(onNewRequest: () -> Unit) {
    WebCard(modifier = Modifier.fillMaxWidth()) {
        Column(
            modifier = Modifier.fillMaxWidth(),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(14.dp))
                    .background(AccentSoft)
                    .size(48.dp),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    Lucide.CalendarDays,
                    contentDescription = null,
                    tint = Accent,
                    modifier = Modifier.size(24.dp),
                )
            }
            Text(
                "No leave requests yet",
                style = MaterialTheme.typography.titleMedium,
                color = Foreground,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.padding(top = 12.dp),
            )
            Text(
                "You haven't submitted any leave requests. Create a new request to get started.",
                style = MaterialTheme.typography.bodySmall,
                color = MutedForeground,
                modifier = Modifier.padding(top = 4.dp),
            )
            WebButton(
                label = "New Leave Request",
                onClick = onNewRequest,
                modifier = Modifier.padding(top = 16.dp),
                icon = Lucide.Plus,
            )
        }
    }
}

@Composable
fun ForwardedInfoCard() {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(Band)
            .padding(Spacing.Xl),
        horizontalArrangement = Arrangement.spacedBy(Spacing.Md),
    ) {
        Icon(
            Lucide.Info,
            contentDescription = null,
            tint = Accent,
            modifier = Modifier.size(16.dp),
        )
        Text(
            "Forwarded means your class admin put the request into a package for the lecturer. " +
                "It does not mean the leave was approved, and StarsTask cannot tell you whether the lecturer has read it.",
            style = MaterialTheme.typography.bodySmall,
            color = MutedForeground,
        )
    }
}


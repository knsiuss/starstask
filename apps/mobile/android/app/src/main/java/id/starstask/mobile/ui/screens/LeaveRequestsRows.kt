package id.starstask.mobile.ui.screens

import id.starstask.mobile.ui.icons.Lucide

import id.starstask.mobile.ui.theme.Spacing

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
import id.starstask.mobile.ui.theme.SuccessSoft
import id.starstask.mobile.ui.theme.Surface

@Composable
fun LeaveRequestCard(
    request: LeaveRequest,
    onClick: () -> Unit,
) {
    WebCompactCard(modifier = Modifier.fillMaxWidth(), onClick = onClick, padding = 14.dp) {
        Column {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.Top,
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    if (request.reference.isNotBlank()) {
                        Text(
                            request.reference,
                            style = MaterialTheme.typography.labelSmall,
                            color = MutedForeground,
                        )
                    }
                    Text(
                        request.className,
                        style = MaterialTheme.typography.titleSmall,
                        color = Foreground,
                        fontWeight = FontWeight.SemiBold,
                    )
                    if (request.subjectNames.isNotEmpty()) {
                        Text(
                            request.subjectNames.joinToString(", "),
                            style = MaterialTheme.typography.bodySmall,
                            color = MutedForeground,
                        )
                    }
                }
                LeaveStatusBadge(request.status)
            }
            val days = leaveDayCount(request.leaveStart, request.leaveEnd)
            Text(
                formatLeaveDateRange(request.leaveStart, request.leaveEnd) +
                    if (days > 0) " · $days ${if (days == 1) "day" else "days"}" else "",
                style = MaterialTheme.typography.bodySmall,
                color = MutedForeground,
                modifier = Modifier.padding(top = 8.dp),
            )
            Text(
                leaveReasonLabel(request.reason),
                style = MaterialTheme.typography.bodySmall,
                color = MutedForeground,
            )
            Row(
                horizontalArrangement = Arrangement.spacedBy(Spacing.Xl),
                modifier = Modifier.padding(top = 4.dp),
            ) {
                Text(
                    "${request.evidenceCount} ${if (request.evidenceCount == 1) "file" else "files"}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MutedForeground,
                )
                if (request.submittedAt != null) {
                    Text(
                        "Submitted ${formatLeaveDate(request.submittedAt)}",
                        style = MaterialTheme.typography.bodySmall,
                        color = MutedForeground,
                    )
                }
            }
            if (request.status == "forwarded") {
                Text(
                    "Forwarded${request.forwardedAt?.let { " on ${formatLeaveDate(it)}" } ?: ""} — this records the hand-off, not a decision.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MutedForeground,
                    modifier = Modifier.padding(top = 6.dp),
                )
            }
            if (request.status == "cancelled") {
                Text(
                    "Cancelled${request.cancelledAt?.let { " on ${formatLeaveDate(it)}" } ?: ""}" +
                        (request.cancelledByName?.let { " by $it" } ?: ""),
                    style = MaterialTheme.typography.bodySmall,
                    color = MutedForeground,
                    modifier = Modifier.padding(top = 6.dp),
                )
            }
        }
    }
}

@Composable
fun LeaveStatusBadge(status: String, modifier: Modifier = Modifier) {
    val variant = when (status) {
        "submitted", "forwarded" -> BadgeVariant.ACCENT
        "approved" -> BadgeVariant.SUCCESS
        "rejected" -> BadgeVariant.DANGER
        "revision_requested" -> BadgeVariant.WARNING
        else -> BadgeVariant.NEUTRAL
    }
    StarsTaskBadge(
        label = leaveStatusLabel(status),
        variant = variant,
        modifier = modifier,
    )
}

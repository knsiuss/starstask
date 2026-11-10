package id.starstask.mobile.ui.screens

import id.starstask.mobile.ui.theme.Spacing

import androidx.compose.foundation.border
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import id.starstask.mobile.data.LeaveRequest
import id.starstask.mobile.data.formatLeaveDate
import id.starstask.mobile.data.formatLeaveDateRange
import id.starstask.mobile.data.leaveDayCount
import id.starstask.mobile.data.leaveReasonLabel
import id.starstask.mobile.data.leaveStatusLabel
import id.starstask.mobile.ui.components.BadgeVariant
import id.starstask.mobile.ui.components.StarsTaskBadge
import id.starstask.mobile.ui.theme.DashRadiusTile
import id.starstask.mobile.ui.theme.dashColors

@Composable
fun LeaveRequestCard(
    request: LeaveRequest,
    onClick: () -> Unit,
) {
    val palette = dashColors()
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(DashRadiusTile)
            .background(palette.card)
            .border(1.dp, palette.cardBorder, DashRadiusTile)
            .clickable(onClick = onClick)
            .padding(Spacing.Block),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = androidx.compose.ui.Alignment.Top,
        ) {
            Column(modifier = Modifier.weight(1f)) {
                if (request.reference.isNotBlank()) {
                    Text(
                        request.reference,
                        style = MaterialTheme.typography.labelSmall,
                        color = palette.muted,
                    )
                }
                Text(
                    request.className,
                    style = MaterialTheme.typography.titleSmall,
                    color = palette.text,
                    fontWeight = FontWeight.SemiBold,
                )
                if (request.subjectNames.isNotEmpty()) {
                    Text(
                        request.subjectNames.joinToString(", "),
                        style = MaterialTheme.typography.bodySmall,
                        color = palette.muted,
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
            color = palette.muted,
            modifier = Modifier.padding(top = 8.dp),
        )
        Text(
            leaveReasonLabel(request.reason),
            style = MaterialTheme.typography.bodySmall,
            color = palette.muted,
        )
        Row(
            horizontalArrangement = Arrangement.spacedBy(Spacing.Xl),
            modifier = Modifier.padding(top = 4.dp),
        ) {
            Text(
                "${request.evidenceCount} ${if (request.evidenceCount == 1) "file" else "files"}",
                style = MaterialTheme.typography.bodySmall,
                color = palette.muted,
            )
            if (request.submittedAt != null) {
                Text(
                    "Submitted ${formatLeaveDate(request.submittedAt)}",
                    style = MaterialTheme.typography.bodySmall,
                    color = palette.muted,
                )
            }
        }
        if (request.status == "forwarded") {
            Text(
                "Forwarded${request.forwardedAt?.let { " on ${formatLeaveDate(it)}" } ?: ""} — this records the hand-off, not a decision.",
                style = MaterialTheme.typography.bodySmall,
                color = palette.muted,
                modifier = Modifier.padding(top = 6.dp),
            )
        }
        if (request.status == "cancelled") {
            Text(
                "Cancelled${request.cancelledAt?.let { " on ${formatLeaveDate(it)}" } ?: ""}" +
                    (request.cancelledByName?.let { " by $it" } ?: ""),
                style = MaterialTheme.typography.bodySmall,
                color = palette.muted,
                modifier = Modifier.padding(top = 6.dp),
            )
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

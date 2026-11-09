package id.starstask.mobile.ui.screens

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import id.starstask.mobile.data.LeaveHistoryEntry
import id.starstask.mobile.data.LeaveRequest
import id.starstask.mobile.data.formatLeaveDate
import id.starstask.mobile.ui.theme.Foreground
import id.starstask.mobile.ui.theme.MutedForeground

// Status explanation texts (web leave detail). Extracted to keep detail screen <300 lines.

@Composable
fun LeaveStatusExplanation(request: LeaveRequest, decision: LeaveHistoryEntry?) {
    Text(
        "These are three different dates. StarsTask never copies one into another.",
        style = MaterialTheme.typography.bodySmall,
        color = MutedForeground,
    )
    if (request.status == "submitted") {
        Text(
            "Request submitted. Your class admin will review it. If it is approved, the sessions covered by these dates become excused.",
            style = MaterialTheme.typography.bodySmall,
            color = MutedForeground,
        )
    }
    if (request.status == "approved") {
        Text(
            "Absence approved" +
                (decision?.actorName?.let { " by $it" } ?: "") +
                (decision?.createdAt?.let { " on ${formatLeaveDate(it)}" } ?: "") +
                ". Sessions covered by these dates are marked excused. An excused session is not counted as present.",
            style = MaterialTheme.typography.bodySmall,
            color = MutedForeground,
        )
    }
    if (request.status == "rejected") {
        Text(
            "Absence rejected" +
                (decision?.actorName?.let { " by $it" } ?: "") +
                (decision?.createdAt?.let { " on ${formatLeaveDate(it)}" } ?: "") +
                ". Attendance is unchanged. The decision note, if any, is in the history below.",
            style = MaterialTheme.typography.bodySmall,
            color = MutedForeground,
        )
    }
    if (request.status == "forwarded") {
        Text(
            "Forwarded${request.forwardedAt?.let { " on ${formatLeaveDate(it)}" } ?: ""}. " +
                "This records the hand-off to the lecturer, not a decision.",
            style = MaterialTheme.typography.bodySmall,
            color = MutedForeground,
        )
    }
    if (request.status == "cancelled") {
        Text(
            "Cancelled${request.cancelledAt?.let { " on ${formatLeaveDate(it)}" } ?: ""}" +
                (request.cancelledByName?.let { " by $it" } ?: "") + ".",
            style = MaterialTheme.typography.bodySmall,
            color = MutedForeground,
        )
        if (!request.cancellationNote.isNullOrBlank()) {
            Text(request.cancellationNote, style = MaterialTheme.typography.bodyMedium, color = Foreground)
        }
    }
}

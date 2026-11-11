package id.starstask.mobile.ui.screens

import id.starstask.mobile.ui.theme.Spacing

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import id.starstask.mobile.data.LeaveRequest
import id.starstask.mobile.data.leaveReviewNoteError
import id.starstask.mobile.data.reviewLeaveRequest
import id.starstask.mobile.data.userFacingMessage
import id.starstask.mobile.ui.components.WebButton
import id.starstask.mobile.ui.components.WebButtonVariant
import id.starstask.mobile.ui.components.WebCard
import id.starstask.mobile.ui.components.WebCardHeader
import id.starstask.mobile.ui.components.WebInput
import id.starstask.mobile.ui.components.StartaskSuccessDialog
import id.starstask.mobile.ui.theme.MutedForeground
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch

// Manager review card (web leave review). Extracted from LeaveRequestDetailScreen.

@Composable
fun LeaveReviewCard(
    request: LeaveRequest,
    reviewNote: String,
    onReviewNoteChange: (String) -> Unit,
    reviewBusy: Boolean,
    onReviewBusyChange: (Boolean) -> Unit,
    onReviewNoteClear: () -> Unit,
    onMessage: (String) -> Unit,
    onChanged: () -> Unit,
    onReload: () -> Unit,
    scope: CoroutineScope,
) {
    var successTitle by androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateOf<String?>(null) }
    var successSummary by androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateOf("") }
    WebCard {
        WebCardHeader(
            title = "Review this request",
            description = "Check that the request is complete and the evidence is legible, then record a decision. Approving also marks the covered sessions excused.",
        )
        WebInput(value = reviewNote, onValueChange = onReviewNoteChange, label = "Review note", enabled = !reviewBusy)
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.Md)) {
            WebButton(
                label = "Approve absence",
                onClick = {
                    onReviewBusyChange(true)
                    scope.launch {
                        runCatching { reviewLeaveRequest(request.id, "approved", reviewNote.ifBlank { null }) }
                            .onSuccess { successTitle = "Leave Approved"; successSummary = "Attendance excused for the covered sessions."; onReviewNoteClear(); onChanged(); onReload() }
                            .onFailure { e -> onMessage(userFacingMessage(e, "Could not record decision.")) }
                        onReviewBusyChange(false)
                    }
                },
                enabled = !reviewBusy,
            )
            WebButton(
                label = "Reject",
                onClick = {
                    leaveReviewNoteError("rejected", reviewNote)?.let { onMessage(it); return@WebButton }
                    onReviewBusyChange(true)
                    scope.launch {
                        runCatching { reviewLeaveRequest(request.id, "rejected", reviewNote.ifBlank { null }) }
                            .onSuccess { successTitle = "Leave Rejected"; successSummary = "The student has been notified."; onReviewNoteClear(); onChanged(); onReload() }
                            .onFailure { e -> onMessage(userFacingMessage(e, "Could not record decision.")) }
                        onReviewBusyChange(false)
                    }
                },
                variant = WebButtonVariant.SECONDARY,
                enabled = !reviewBusy,
            )
            WebButton(
                label = "Revision",
                onClick = {
                    leaveReviewNoteError("revision_requested", reviewNote)?.let { onMessage(it); return@WebButton }
                    onReviewBusyChange(true)
                    scope.launch {
                        runCatching { reviewLeaveRequest(request.id, "revision_requested", reviewNote.ifBlank { null }) }
                            .onSuccess { successTitle = "Revision Requested"; successSummary = "The student has been asked to update their request."; onReviewNoteClear(); onChanged(); onReload() }
                            .onFailure { e -> onMessage(userFacingMessage(e, "Could not record decision.")) }
                        onReviewBusyChange(false)
                    }
                },
                variant = WebButtonVariant.GHOST,
                enabled = !reviewBusy,
            )
        }
        Text(
            "Review note is required to reject or return for revision.",
            color = MutedForeground,
            style = MaterialTheme.typography.bodySmall,
        )
    }
    val st = successTitle
    if (st != null) {
        StartaskSuccessDialog(
            title = st,
            summary = successSummary,
            primaryLabel = "Done",
            onPrimary = { successTitle = null },
            onDismiss = { successTitle = null },
        )
    }
}

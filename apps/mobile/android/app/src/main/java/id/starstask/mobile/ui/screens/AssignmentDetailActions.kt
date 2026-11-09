package id.starstask.mobile.ui.screens

import id.starstask.mobile.ui.theme.Spacing

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.unit.dp
import id.starstask.mobile.data.MyAssignmentReport
import id.starstask.mobile.data.moderateAssignment
import id.starstask.mobile.data.saveAssignment
import id.starstask.mobile.data.setAssignmentCompletion
import id.starstask.mobile.data.unsaveAssignment
import id.starstask.mobile.ui.components.WebButton
import id.starstask.mobile.ui.components.WebButtonVariant
import id.starstask.mobile.ui.theme.MutedForeground
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch

// Save / completion / report actions (web assignment detail). Extracted to keep detail <300 lines.

@Composable
fun AssignmentDetailActions(
    userId: String,
    assignmentId: String,
    saved: Boolean,
    onSavedChange: (Boolean) -> Unit,
    saveBusy: Boolean,
    onSaveBusyChange: (Boolean) -> Unit,
    completed: Boolean,
    onCompletedChange: (Boolean) -> Unit,
    completionBusy: Boolean,
    onCompletionBusyChange: (Boolean) -> Unit,
    isOwner: Boolean,
    isPublished: Boolean,
    myReport: MyAssignmentReport?,
    onShowReport: () -> Unit,
    onMessage: (String) -> Unit,
    scope: CoroutineScope,
) {
    Row(horizontalArrangement = Arrangement.spacedBy(Spacing.Md)) {
        WebButton(
            label = if (saved) "Saved ✓" else "Save",
            variant = WebButtonVariant.SECONDARY,
            onClick = {
                onSaveBusyChange(true)
                scope.launch {
                    try {
                        if (saved) {
                            unsaveAssignment(userId, assignmentId)
                            onSavedChange(false)
                        } else {
                            saveAssignment(userId, assignmentId)
                            onSavedChange(true)
                        }
                    } catch (_: Exception) {
                        onMessage("Could not update saved state.")
                    } finally {
                        onSaveBusyChange(false)
                    }
                }
            },
            enabled = !saveBusy,
        )
    }
    Row(horizontalArrangement = Arrangement.spacedBy(Spacing.Md)) {
        WebButton(
            label = if (completed) "Done ✓" else "Mark as done",
            variant = WebButtonVariant.SECONDARY,
            onClick = {
                if (completionBusy) return@WebButton
                onCompletionBusyChange(true)
                scope.launch {
                    try {
                        setAssignmentCompletion(userId, assignmentId, !completed)
                        onCompletedChange(!completed)
                    } catch (_: Exception) {
                        onMessage("Could not update completion.")
                    } finally {
                        onCompletionBusyChange(false)
                    }
                }
            },
            enabled = !completionBusy,
        )
    }
    if (!isOwner && isPublished) {
        WebButton(label = "Report a problem", onClick = onShowReport, variant = WebButtonVariant.GHOST)
        if (myReport != null) {
            Text("Your report: ${myReport.reason} · ${myReport.status}", color = MutedForeground, style = MaterialTheme.typography.bodySmall)
        }
    }
    // Moderation (class admin for own class, platform admin for anything;
    // the RPC is the authority, so the button is safe to show when published).
    if (isPublished) {
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.Md)) {
            WebButton(label = "Unpublish", variant = WebButtonVariant.DANGER, onClick = {
                scope.launch {
                    val err = moderateAssignment(assignmentId, "unpublish")
                    onMessage(err ?: "Unpublished.")
                }
            })
            WebButton(label = "Archive", variant = WebButtonVariant.SECONDARY, onClick = {
                scope.launch {
                    val err = moderateAssignment(assignmentId, "archive")
                    onMessage(err ?: "Archived.")
                }
            })
            WebButton(label = "Restore", variant = WebButtonVariant.SECONDARY, onClick = {
                scope.launch {
                    val err = moderateAssignment(assignmentId, "restore")
                    onMessage(err ?: "Restored.")
                }
            })
        }
    }
}

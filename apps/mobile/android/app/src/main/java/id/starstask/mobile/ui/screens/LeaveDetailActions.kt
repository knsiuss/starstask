package id.starstask.mobile.ui.screens

import id.starstask.mobile.ui.icons.Lucide

import id.starstask.mobile.ui.theme.Spacing

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import id.starstask.mobile.data.LeaveRequest
import id.starstask.mobile.data.cancelLeaveRequestById
import id.starstask.mobile.data.leaveFailureMessage
import id.starstask.mobile.data.submitLeaveRequestById
import id.starstask.mobile.ui.components.WebButton
import id.starstask.mobile.ui.components.WebButtonVariant
import id.starstask.mobile.ui.components.WebInput
import id.starstask.mobile.ui.theme.Danger
import id.starstask.mobile.ui.theme.MutedForeground
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch

// Lucide.Pencil/Submit/Cancel actions + cancel dialog (web leave detail actions).

@Composable
fun LeaveDetailActions(
    request: LeaveRequest,
    editable: Boolean,
    canCancel: Boolean,
    busy: Boolean,
    onBusyChange: (Boolean) -> Unit,
    onEdit: () -> Unit,
    onShowCancel: () -> Unit,
    onMessage: (String) -> Unit,
    onChanged: () -> Unit,
    onReload: () -> Unit,
    scope: CoroutineScope,
) {
    Row(horizontalArrangement = Arrangement.spacedBy(Spacing.Lg)) {
        if (editable) {
            WebButton(label = "Lucide.Pencil", onClick = onEdit, modifier = Modifier.weight(1f))
            WebButton(
                label = "Submit",
                onClick = {
                    scope.launch {
                        onBusyChange(true)
                        runCatching { submitLeaveRequestById(request.id) }
                            .onSuccess { onMessage("Submitted."); onChanged(); onReload() }
                            .onFailure { e -> onMessage(leaveFailureMessage(e)) }
                        onBusyChange(false)
                    }
                },
                modifier = Modifier.weight(1f),
                enabled = !busy,
            )
        }
        if (canCancel) {
            WebButton(label = "Cancel request", onClick = onShowCancel, variant = WebButtonVariant.SECONDARY, modifier = Modifier.weight(1f), enabled = !busy)
        }
    }
}

@Composable
fun LeaveCancelDialog(
    requestId: String?,
    onDismiss: () -> Unit,
    onBusyChange: (Boolean) -> Unit,
    onMessage: (String) -> Unit,
    onChanged: () -> Unit,
    onReload: () -> Unit,
    scope: CoroutineScope,
) {
    var note by remember { mutableStateOf("") }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Cancel this leave request?") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(Spacing.Md)) {
                Text(
                    "This withdraws the request. A forwarded request can no longer be cancelled.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MutedForeground,
                )
                WebInput(
                    value = note,
                    onValueChange = { note = it },
                    label = "Note (optional)",
                    singleLine = false,
                )
            }
        },
        confirmButton = {
            WebButton(
                label = "Cancel request",
                variant = WebButtonVariant.DANGER,
                onClick = {
                    val target = requestId ?: return@WebButton
                    onDismiss()
                    scope.launch {
                        onBusyChange(true)
                        runCatching { cancelLeaveRequestById(target, note.trim().ifBlank { null }) }
                            .onSuccess { onMessage("Cancelled."); onChanged(); onReload() }
                            .onFailure { e -> onMessage(leaveFailureMessage(e)) }
                        onBusyChange(false)
                    }
                },
            )
        },
        dismissButton = {
            WebButton(label = "Keep it", onClick = onDismiss, variant = WebButtonVariant.GHOST)
        },
    )
}

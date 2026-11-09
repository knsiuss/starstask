package id.starstask.mobile.ui.screens

import id.starstask.mobile.ui.icons.Lucide

import id.starstask.mobile.ui.theme.Spacing

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import id.starstask.mobile.data.LeaveEvidence
import id.starstask.mobile.data.LeaveHistoryEntry
import id.starstask.mobile.data.LeaveRequest
import id.starstask.mobile.data.LEAVE_EVIDENCE_MAX_FILES
import id.starstask.mobile.data.cancelLeaveRequestById
import id.starstask.mobile.data.confirmLeaveOcr
import id.starstask.mobile.data.formatLeaveDate
import id.starstask.mobile.data.formatLeaveDateRange
import id.starstask.mobile.data.isLeaveRequestCancellable
import id.starstask.mobile.data.isLeaveRequestEditable
import id.starstask.mobile.data.leaveDayCount
import id.starstask.mobile.data.leaveFailureMessage
import id.starstask.mobile.data.leaveReasonLabel
import id.starstask.mobile.data.leaveReviewNoteError
import id.starstask.mobile.data.listLeaveEvidence
import id.starstask.mobile.data.listLeaveHistory
import id.starstask.mobile.data.loadLeaveRequestById
import id.starstask.mobile.data.loadMyLeaveClasses
import id.starstask.mobile.data.openLeaveEvidence
import id.starstask.mobile.data.queryPickedFile
import id.starstask.mobile.data.readPickedHeader
import id.starstask.mobile.data.removeLeaveEvidence
import id.starstask.mobile.data.reviewLeaveRequest
import id.starstask.mobile.data.submitLeaveRequestById
import id.starstask.mobile.data.uploadLeaveEvidence
import id.starstask.mobile.data.validateStagedEvidence
import id.starstask.mobile.ui.components.WebAlert
import id.starstask.mobile.ui.components.WebButton
import id.starstask.mobile.ui.components.WebButtonVariant
import id.starstask.mobile.ui.components.WebCompactCard
import id.starstask.mobile.ui.theme.Accent
import id.starstask.mobile.ui.theme.Border
import id.starstask.mobile.ui.theme.Danger
import id.starstask.mobile.ui.theme.Foreground
import id.starstask.mobile.ui.theme.MutedForeground
import id.starstask.mobile.ui.theme.Surface
import kotlinx.coroutines.launch

/**
 * Leave request detail, mirroring the web request page: the three dates kept
 * separate, evidence with signed-URL open, append-only history, and the
 * actions the student is allowed to take in the current status.
 */
fun formatEvidenceSize(bytes: Long): String {
    if (bytes < 1024) return "$bytes B"
    if (bytes < 1024 * 1024) return "%.1f KB".format(bytes / 1024.0)
    return "%.1f MB".format(bytes / (1024.0 * 1024.0))
}

@Composable
fun LeaveOcrSection(
    request: LeaveRequest,
    busy: Boolean,
    onConfirm: (Map<String, String>) -> Unit,
) {
    var confirmed by remember(request.id) { mutableStateOf(request.fieldSources.toMutableMap()) }
    val suggestionFields = listOf(
        "leaveStartDate" to "Absence start",
        "leaveEndDate" to "Absence end",
        "documentIssueDate" to "Document issue date",
        "studentName" to "Student name",
        "documentType" to "Document type",
    )
    val hasSuggestion = suggestionFields.any { (key, _) -> !request.ocrResult[key].isNullOrBlank() }
    val dateKeys = setOf("leaveStartDate", "leaveEndDate", "documentIssueDate")
    WebCompactCard(modifier = Modifier.fillMaxWidth()) {
        Column(verticalArrangement = Arrangement.spacedBy(Spacing.Md)) {
            Text(
                "Document reader",
                style = MaterialTheme.typography.titleSmall,
                color = Foreground,
                fontWeight = FontWeight.SemiBold,
            )
            Text(
                when (request.ocrStatus) {
                    "not_run" -> "No document has been read yet. Upload a PDF and StarsTask will offer the dates it finds for you to confirm."
                    "pending" -> "The document is being read. You can keep working."
                    "unsupported" -> "This file could not be read automatically — it is probably a scan or an image. Nothing is blocked; the values on this page are the ones you entered."
                    "failed" -> "The reader failed on this document. Enter the details by hand."
                    "succeeded" -> if (hasSuggestion) {
                        "Suggestions below come from your document. Confirm only the ones that match it."
                    } else {
                        "The document was read, but no usable dates were found. Enter the details by hand."
                    }
                    else -> "The document reader status is unknown."
                },
                style = MaterialTheme.typography.bodySmall,
                color = MutedForeground,
            )
            if (hasSuggestion) {
                suggestionFields.forEach { (key, label) ->
                    val value = request.ocrResult[key]
                    if (!value.isNullOrBlank()) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween,
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text(label, style = MaterialTheme.typography.labelSmall, color = MutedForeground)
                                Text(
                                    if (key in dateKeys) formatLeaveDate(value) else value,
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = Foreground,
                                )
                                val source = confirmed[key]
                                if (source != null) {
                                    Text(
                                        when (source) {
                                            "ocr" -> "Confirmed from the document"
                                            "ocr_corrected" -> "Corrected by you"
                                            else -> "Entered by you"
                                        },
                                        style = MaterialTheme.typography.labelSmall,
                                        color = MutedForeground,
                                    )
                                }
                            }
                            WebButton(
                                label = "Use",
                                onClick = { confirmed = confirmed.toMutableMap().apply { this[key] = "ocr" } },
                                variant = WebButtonVariant.LINK,
                                enabled = !busy,
                            )
                        }
                    }
                }
                Text(
                    "Read from the document, not verified. Reading a document is not a check that it is genuine.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MutedForeground,
                )
                WebButton(
                    label = "Confirm my values",
                    onClick = { onConfirm(confirmed) },
                    modifier = Modifier.fillMaxWidth(),
                    enabled = !busy && confirmed.isNotEmpty(),
                )
            }
        }
    }
}

fun historyActionLabel(action: String): String =
    when (action) {
        "created" -> "Created"
        "updated" -> "Updated"
        "submitted" -> "Submitted"
        "resubmitted" -> "Resubmitted"
        "approved" -> "Approved"
        "rejected" -> "Rejected"
        "revision_requested" -> "Revision requested"
        "forwarded" -> "Forwarded"
        "cancelled" -> "Cancelled"
        "evidence_added" -> "Document added"
        "evidence_removed" -> "Document removed"
        "ocr_recorded" -> "Document read"
        else -> action.replaceFirstChar { it.uppercase() }
    }

@Composable
fun LeaveHistorySection(history: List<LeaveHistoryEntry>) {
    WebCompactCard(modifier = Modifier.fillMaxWidth()) {
        Column(verticalArrangement = Arrangement.spacedBy(Spacing.Md)) {
            Text(
                "History",
                style = MaterialTheme.typography.titleSmall,
                color = Foreground,
                fontWeight = FontWeight.SemiBold,
            )
            if (history.isEmpty()) {
                Text("No history yet.", style = MaterialTheme.typography.bodySmall, color = MutedForeground)
            }
            history.forEach { entry ->
                Column {
                    Text(
                        historyActionLabel(entry.action) +
                            (entry.actorName?.let { " · $it" } ?: "") +
                            (entry.createdAt?.let { " · ${formatLeaveDate(it)}" } ?: ""),
                        style = MaterialTheme.typography.bodyMedium,
                        color = Foreground,
                    )
                    if (!entry.note.isNullOrBlank()) {
                        Text(entry.note, style = MaterialTheme.typography.bodySmall, color = MutedForeground)
                    }
                }
            }
        }
    }
}

package id.starstask.mobile.ui.screens

import id.starstask.mobile.ui.theme.Spacing

import id.starstask.mobile.ui.icons.Lucide

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
import id.starstask.mobile.ui.theme.mockColors
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.ui.draw.clip
import id.starstask.mobile.ui.theme.Danger
import kotlinx.coroutines.launch

@Composable
fun LeaveDetailCard(request: LeaveRequest, isOwner: Boolean = true) {
    val palette = mockColors()
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(palette.card)
            .border(1.dp, palette.cardBorder, RoundedCornerShape(12.dp))
            .padding(Spacing.Block),
        verticalArrangement = Arrangement.spacedBy(Spacing.Md),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.Top,
        ) {
            Column(modifier = Modifier.weight(1f)) {
                if (request.reference.isNotBlank()) {
                    Text(request.reference, style = MaterialTheme.typography.labelSmall, color = palette.muted)
                }
                Text(
                    if (!isOwner && request.studentName.isNotBlank()) {
                        "${request.studentName}'s leave request"
                    } else {
                        "Leave Request"
                    },
                    style = MaterialTheme.typography.titleMedium,
                    color = palette.ink,
                    fontWeight = FontWeight.SemiBold,
                )
                Text(
                    request.className,
                    style = MaterialTheme.typography.bodySmall,
                    color = palette.muted,
                )
            }
            LeaveStatusBadge(request.status)
        }
        val days = leaveDayCount(request.leaveStart, request.leaveEnd)
        DetailRow(
            "Leave dates",
            formatLeaveDateRange(request.leaveStart, request.leaveEnd) +
                if (days > 0) " · $days ${if (days == 1) "day" else "days"}" else "",
        )
        DetailRow("Reason", leaveReasonLabel(request.reason))
        DetailRow(
            "Courses",
            if (request.subjectNames.isNotEmpty()) {
                request.subjectNames.joinToString(", ")
            } else {
                "Whole class — no specific course"
            },
        )
        DetailRow("Document issue date", formatLeaveDate(request.documentIssueDate))
        if (request.submittedAt != null) {
            DetailRow("Submitted", formatLeaveDate(request.submittedAt))
        }
        if (!request.explanation.isNullOrBlank()) {
            DetailRow("Explanation", request.explanation)
        }
    }
}

@Composable
fun DetailRow(label: String, value: String) {
    val palette = mockColors()
    Column {
        Text(label, style = MaterialTheme.typography.labelSmall, color = palette.muted)
        Text(value, style = MaterialTheme.typography.bodyMedium, color = palette.ink)
    }
}

@Composable
fun LeaveEvidenceSection(
    evidence: List<LeaveEvidence>,
    editable: Boolean,
    busy: Boolean,
    onAdd: () -> Unit,
    onOpen: (LeaveEvidence) -> Unit,
    onRemove: (LeaveEvidence) -> Unit,
) {
    val palette = mockColors()
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(palette.card)
            .border(1.dp, palette.cardBorder, RoundedCornerShape(12.dp))
            .padding(Spacing.Block),
        verticalArrangement = Arrangement.spacedBy(Spacing.Md),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                "Supporting documents",
                style = MaterialTheme.typography.titleSmall,
                color = palette.ink,
                fontWeight = FontWeight.SemiBold,
            )
            if (editable) {
                WebButton(
                    label = "Add",
                    onClick = onAdd,
                    variant = WebButtonVariant.LINK,
                    enabled = !busy,
                    icon = Lucide.Paperclip,
                )
            }
        }
        if (evidence.isEmpty()) {
            Text(
                "No documents attached yet. PDF, JPG, or PNG, up to 10 MB each.",
                style = MaterialTheme.typography.bodySmall,
                color = palette.muted,
            )
        }
        evidence.forEach { item ->
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.Md),
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(item.originalFilename, style = MaterialTheme.typography.bodyMedium, color = palette.ink, maxLines = 1)
                    Text(formatEvidenceSize(item.fileSize), style = MaterialTheme.typography.bodySmall, color = palette.muted)
                }
                IconButton(onClick = { onOpen(item) }) {
                    Icon(Lucide.ExternalLink, contentDescription = "Open", tint = palette.accent)
                }
                if (editable) {
                    IconButton(onClick = { onRemove(item) }, enabled = !busy) {
                        Icon(Lucide.Trash2, contentDescription = "Remove", tint = Danger)
                    }
                }
            }
        }
    }
}


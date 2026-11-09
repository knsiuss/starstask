package id.starstask.mobile.ui.screens

import id.starstask.mobile.ui.theme.Spacing

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Checkbox
import androidx.compose.material3.Text
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import id.starstask.mobile.data.ClassDetail
import id.starstask.mobile.data.LeaveRequest
import id.starstask.mobile.data.completeLeaveForwarding
import id.starstask.mobile.data.downloadLeaveEvidenceBytes
import id.starstask.mobile.data.generateLeaveCompletePdf
import id.starstask.mobile.data.generateLeaveSummaryPdf
import id.starstask.mobile.data.leaveReportFilename
import id.starstask.mobile.data.listLeaveEvidence
import id.starstask.mobile.data.loadLeaveReportRows
import id.starstask.mobile.ui.components.WebCard
import id.starstask.mobile.ui.components.WebAlert
import id.starstask.mobile.ui.components.WebButton
import id.starstask.mobile.ui.components.WebInput
import id.starstask.mobile.ui.theme.Danger
import id.starstask.mobile.ui.theme.Foreground
import id.starstask.mobile.ui.theme.MutedForeground
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch

// Forward package panel (web leave forwarding). Extracted to keep ClassLeaveScreen <300 lines.

@Composable
fun LeaveForwardPanel(
    clazz: ClassDetail,
    submittedRows: List<LeaveRequest>,
    selectedForwardIds: Set<String>,
    onSelectionChange: (Set<String>) -> Unit,
    recipientName: String,
    onRecipientNameChange: (String) -> Unit,
    recipientEmail: String,
    onRecipientEmailChange: (String) -> Unit,
    reportFormat: String,
    onReportFormatChange: (String) -> Unit,
    forwardingBusy: Boolean,
    forwardError: String?,
    onForwardError: (String?) -> Unit,
    idempotencyKey: String,
    onIdempotencyKeyChange: (String) -> Unit,
    context: android.content.Context,
    scope: CoroutineScope,
    onDone: (String) -> Unit,
    onReload: () -> Unit,
) {
    WebCard {
        Column(modifier = Modifier.padding(Spacing.Xs), verticalArrangement = Arrangement.spacedBy(Spacing.Md)) {
            Text("Forward package", style = MaterialTheme.typography.titleMedium, color = Foreground)
            Text(
                "Select submitted requests, name the lecturer, and generate the package on this device. " +
                    "The file is saved to your device — StarsTask does not email it, and the lecturer has not confirmed receipt.",
                color = MutedForeground,
                style = MaterialTheme.typography.bodySmall,
            )
            submittedRows.forEach { row ->
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Checkbox(
                        checked = selectedForwardIds.contains(row.id),
                        onCheckedChange = {
                            onSelectionChange(
                                if (selectedForwardIds.contains(row.id)) selectedForwardIds - row.id else selectedForwardIds + row.id,
                            )
                        },
                    )
                    Text("${row.reference} · ${row.studentName.ifBlank { "Student" }}", color = Foreground, style = MaterialTheme.typography.bodySmall)
                }
            }
            WebInput(value = recipientName, onValueChange = onRecipientNameChange, label = "Lecturer name")
            WebInput(value = recipientEmail, onValueChange = onRecipientEmailChange, label = "Lecturer email (optional)")
            Row(horizontalArrangement = Arrangement.spacedBy(Spacing.Md)) {
                listOf("summary" to "Summary", "complete" to "Complete").forEach { (value, label) ->
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Checkbox(checked = reportFormat == value, onCheckedChange = { onReportFormatChange(value) })
                        Text(label, color = Foreground, style = MaterialTheme.typography.bodySmall)
                    }
                }
            }
            if (forwardError != null) WebAlert(message = forwardError)
            WebButton(
                label = if (forwardingBusy) "Generating…" else "Generate + record",
                onClick = {
                    val ids = selectedForwardIds.toList()
                    val recipient = recipientName.trim()
                    if (ids.isEmpty()) { onForwardError("Select at least one request."); return@WebButton }
                    if (recipient.isEmpty()) { onForwardError("Enter the lecturer's name."); return@WebButton }
                    val email = recipientEmail.trim()
                    if (email.isNotEmpty() && !email.contains("@")) { onForwardError("Enter a valid email address."); return@WebButton }
                    onForwardError(null)
                    scope.launch {
                        try {
                            val reportRows = loadLeaveReportRows(clazz.id, ids)
                            if (reportRows.size != ids.size) throw IllegalStateException("Some selected requests no longer exist.")
                            if (reportRows.any { it.status != "submitted" }) throw IllegalStateException("Some selected requests are no longer awaiting forwarding.")
                            val filename = leaveReportFilename(clazz.name, reportFormat)
                            val bytes = if (reportFormat == "complete") {
                                val evidenceByRequest = mutableMapOf<String, List<Pair<String, ByteArray?>>>()
                                reportRows.forEach { reportRow ->
                                    val evidence = listLeaveEvidence(reportRow.id)
                                    evidenceByRequest[reportRow.id] = evidence.map { item -> item.originalFilename to downloadLeaveEvidenceBytes(item.storagePath) }
                                }
                                generateLeaveCompletePdf(clazz.name, recipient, "A class admin", reportRows, evidenceByRequest).bytes
                            } else {
                                generateLeaveSummaryPdf(clazz.name, recipient, "A class admin", reportRows)
                            }
                            val outFile = java.io.File(context.cacheDir, filename)
                            outFile.writeBytes(bytes)
                            val uri = androidx.core.content.FileProvider.getUriForFile(context, context.packageName + ".fileprovider", outFile)
                            val completion = completeLeaveForwarding(clazz.id, ids, recipient, email.ifBlank { null }, filename, reportFormat, idempotencyKey)
                            onIdempotencyKeyChange(java.util.UUID.randomUUID().toString())
                            onSelectionChange(emptySet())
                            onReload()
                            context.startActivity(android.content.Intent(android.content.Intent.ACTION_SEND).apply {
                                type = "application/pdf"
                                putExtra(android.content.Intent.EXTRA_STREAM, uri)
                                putExtra(android.content.Intent.EXTRA_SUBJECT, filename)
                                addFlags(android.content.Intent.FLAG_GRANT_READ_URI_PERMISSION)
                            })
                            onDone("Package ${completion.reference} recorded (${completion.requestCount} requests). Share the PDF with the lecturer.")
                        } catch (e: Exception) {
                            onForwardError("Could not generate the package: ${e.message}")
                        }
                    }
                },
                enabled = !forwardingBusy,
            )
        }
    }
}

package id.starstask.mobile.ui.screens

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import id.starstask.mobile.data.Assignment
import id.starstask.mobile.data.formatTime
import id.starstask.mobile.data.listAttachments
import id.starstask.mobile.data.openAttachment
import id.starstask.mobile.data.uploadAttachment
import id.starstask.mobile.ui.theme.Accent
import id.starstask.mobile.ui.theme.Foreground
import id.starstask.mobile.ui.theme.MutedForeground
import id.starstask.mobile.ui.theme.Surface
import kotlinx.coroutines.launch

/**
 * Assignment detail mirroring the web detail page: title, deadline,
 * status, class, and attachment upload/open.
 */
@Composable
fun AssignmentDetailScreen(
    userId: String,
    assignment: Assignment,
    onBack: () -> Unit,
) {
    var attachments by remember { mutableStateOf<List<id.starstask.mobile.data.AttachmentRef>>(emptyList()) }
    var message by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    val context = LocalContext.current

    LaunchedEffect(assignment.id) {
        attachments = listAttachments(assignment.id)
    }

    val picker = rememberLauncherForActivityResult(
        ActivityResultContracts.OpenDocument(),
    ) { uri: Uri? ->
        if (uri == null || busy) return@rememberLauncherForActivityResult
        busy = true
        scope.launch {
            val result = uploadAttachment(context, userId, assignment.id, uri)
            message = if (result.ok) "Attached ${result.filename}" else result.message
            if (result.ok) attachments = listAttachments(assignment.id)
            busy = false
        }
    }

    Column(modifier = Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        OutlinedButton(onClick = onBack) { Text("← Back") }
        Text(assignment.title, style = MaterialTheme.typography.headlineSmall, color = Foreground)
        Text(
            (assignment.className ?: "") + (assignment.deadline?.let { " · ${formatTime(it)}" } ?: ""),
            color = MutedForeground,
            style = MaterialTheme.typography.bodyMedium,
        )
        Text("Status: ${assignment.status}", color = MutedForeground, style = MaterialTheme.typography.bodySmall)
        if (message != null) Text(message!!, color = Accent)
        Button(
            onClick = { picker.launch(arrayOf("application/pdf", "image/*", "*/*")) },
            enabled = !busy,
            colors = ButtonDefaults.buttonColors(containerColor = Accent),
        ) { Text(if (busy) "Uploading…" else "Attach file") }

        Text("Attachments", style = MaterialTheme.typography.titleMedium, color = Foreground)
        LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            items(attachments, key = { it.id }) { attachment ->
                Card(colors = CardDefaults.cardColors(containerColor = Surface), shape = RoundedCornerShape(12.dp), modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text(attachment.filename, color = Foreground)
                        OutlinedButton(
                            onClick = {
                                scope.launch {
                                    runCatching { openAttachment(context, attachment.storagePath) }
                                        .onFailure { message = "Could not open the attachment." }
                                }
                            },
                        ) { Text("Open") }
                    }
                }
            }
        }
    }
}

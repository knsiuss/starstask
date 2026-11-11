package id.starstask.mobile.ui.screens

// Minimal 1:1 DM conversation. Mirrors the web chat pane enough to be
// useful: history (decrypted on-device), a send box, and mark-read on open.

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import id.starstask.mobile.data.DmConversation
import id.starstask.mobile.data.DmMessage
import id.starstask.mobile.data.formatTime
import id.starstask.mobile.data.loadDmMessages
import id.starstask.mobile.data.markDmRead
import id.starstask.mobile.data.sendDmMessage
import id.starstask.mobile.ui.components.WebButton
import id.starstask.mobile.ui.components.WebButtonVariant
import id.starstask.mobile.ui.components.WebInput
import id.starstask.mobile.ui.theme.Accent
import id.starstask.mobile.ui.theme.Foreground
import id.starstask.mobile.ui.theme.MutedForeground
import id.starstask.mobile.ui.theme.Surface
import kotlinx.coroutines.launch

@Composable
fun DmChatScreen(
    userId: String,
    conversation: DmConversation,
    onBack: () -> Unit,
    onSent: () -> Unit = {},
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var messages by remember { mutableStateOf<List<DmMessage>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    var draft by remember { mutableStateOf("") }
    var sending by remember { mutableStateOf(false) }
    var reloadTick by remember { mutableStateOf(0) }

    LaunchedEffect(conversation.id, reloadTick) {
        loading = true
        error = null
        try {
            messages = loadDmMessages(context, conversation.id)
            runCatching { markDmRead(conversation.id, userId) }
        } catch (_: Exception) {
            error = "Could not load this conversation."
        } finally {
            loading = false
        }
    }

    Column(
        modifier = Modifier.fillMaxSize().padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            WebButton(label = "←", onClick = onBack, variant = WebButtonVariant.GHOST)
            Column(modifier = Modifier.weight(1f)) {
                Text(conversation.otherName, color = Foreground, style = MaterialTheme.typography.titleMedium, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text("End-to-end encrypted", color = MutedForeground, style = MaterialTheme.typography.bodySmall)
            }
        }

        if (error != null) {
            Text(error!!, color = Foreground)
        } else if (loading) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                CircularProgressIndicator(modifier = Modifier.size(16.dp))
                Text("Decrypting…", color = MutedForeground, style = MaterialTheme.typography.bodySmall)
            }
        } else if (messages.isEmpty()) {
            Text("No messages yet. Say hello.", color = MutedForeground, style = MaterialTheme.typography.bodySmall)
        } else {
            LazyColumn(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(8.dp),
                reverseLayout = true,
            ) {
                items(messages.reversed(), key = { it.id.ifEmpty { it.hashCode().toString() } }) { message ->
                    val mine = message.senderId == userId
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = if (mine) Arrangement.End else Arrangement.Start,
                    ) {
                        Surface(
                            color = if (mine) Accent else Surface,
                            shape = RoundedCornerShape(14.dp),
                            modifier = Modifier.width(androidx.compose.ui.unit.Dp(280f)),
                        ) {
                            Column(modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp)) {
                                Text(
                                    message.plaintext ?: "Encrypted message",
                                    color = if (mine) androidx.compose.ui.graphics.Color.White else Foreground,
                                    style = MaterialTheme.typography.bodyMedium,
                                )
                                Text(
                                    formatTime(message.createdAt),
                                    color = if (mine) androidx.compose.ui.graphics.Color.White.copy(alpha = 0.75f) else MutedForeground,
                                    style = MaterialTheme.typography.labelSmall,
                                )
                            }
                        }
                    }
                }
            }
        }

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            WebInput(
                value = draft,
                onValueChange = { draft = it },
                label = "Message",
                modifier = Modifier.weight(1f),
                singleLine = true,
                enabled = !sending,
            )
            WebButton(
                label = if (sending) "…" else "Send",
                onClick = {
                    val text = draft.trim()
                    if (text.isEmpty() || sending) return@WebButton
                    sending = true
                    scope.launch {
                        try {
                            sendDmMessage(context, userId, conversation.id, text)
                            draft = ""
                            reloadTick++
                            onSent()
                        } catch (_: Exception) {
                            error = "Message could not be sent. Try again."
                        } finally {
                            sending = false
                        }
                    }
                },
                enabled = draft.isNotBlank() && !sending,
            )
        }
    }
}

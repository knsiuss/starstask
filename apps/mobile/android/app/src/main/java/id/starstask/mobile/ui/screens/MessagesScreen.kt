package id.starstask.mobile.ui.screens

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import id.starstask.mobile.ui.theme.Foreground
import id.starstask.mobile.ui.theme.MutedForeground
import id.starstask.mobile.ui.theme.Surface

/**
 * E2EE DM list. The native DmChat data layer already decrypts
 * on-device (DmCrypto + DmKeys); this screen surfaces that path.
 */
@Composable
fun MessagesScreen(userId: String) {
    // E2EE DM list (P0 wiring). The native DmChat data layer already
    // decrypts on-device (DmCrypto + DmKeys); this screen surfaces it.
    val context = androidx.compose.ui.platform.LocalContext.current
    var conversations by remember { mutableStateOf<List<id.starstask.mobile.data.DmConversation>>(emptyList()) }
    var openId by remember { mutableStateOf<String?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var loading by remember { mutableStateOf(true) }

    LaunchedEffect(userId) {
        try {
            conversations = id.starstask.mobile.data.listDmConversations(context, userId)
        } catch (e: Exception) {
            error = "Could not load chats."
        } finally {
            loading = false
        }
    }

    val openConversation = conversations.firstOrNull { it.id == openId }
    if (openConversation != null) {
        DmChatScreen(
            userId = userId,
            conversation = openConversation,
            onBack = { openId = null },
        )
        return
    }

    Column(modifier = Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text("Messages", style = MaterialTheme.typography.headlineSmall, color = Foreground)
        Text(
            "End-to-end encrypted — decrypted on this device only.",
            color = MutedForeground,
            style = MaterialTheme.typography.bodySmall,
        )
        if (loading) {
            Text("Loading conversations…", color = MutedForeground)
        } else if (error != null) {
            Text(error!!, color = Foreground)
        } else if (conversations.isEmpty()) {
            Text("No conversations yet. Start one from the web or by searching a classmate.", color = MutedForeground)
        } else {
            LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp), contentPadding = androidx.compose.foundation.layout.PaddingValues(bottom = 112.dp)) {
                items(conversations, key = { it.id }) { conversation ->
                    Card(
                        colors = CardDefaults.cardColors(containerColor = Surface),
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier.fillMaxWidth().clickable { openId = conversation.id },
                    ) {
                        Column(modifier = Modifier.padding(16.dp)) {
                            Text(conversation.otherName, color = Foreground)
                            if (conversation.lastPlaintext != null) {
                                Text(conversation.lastPlaintext, color = MutedForeground, style = MaterialTheme.typography.bodySmall, maxLines = 1)
                            } else {
                                Text("Encrypted message", color = MutedForeground, style = MaterialTheme.typography.bodySmall)
                            }
                            if (conversation.unreadCount > 0) {
                                Text("${conversation.unreadCount} unread", color = id.starstask.mobile.ui.theme.Accent, style = MaterialTheme.typography.bodySmall)
                            }
                        }
                    }
                }
            }
        }
    }
}

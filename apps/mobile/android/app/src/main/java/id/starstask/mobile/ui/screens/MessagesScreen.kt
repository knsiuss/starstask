package id.starstask.mobile.ui.screens

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Column as _Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.background
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.text.font.FontWeight
import id.starstask.mobile.ui.components.WebSkeletonCard
import id.starstask.mobile.ui.theme.mockColors
import id.starstask.mobile.ui.theme.mockPageBrush

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

    val palette = mockColors()
    Column(
        modifier = Modifier.fillMaxSize().background(mockPageBrush()).padding(horizontal = 16.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text("Messages", color = palette.ink, fontSize = 30.sp, lineHeight = 36.sp, fontWeight = FontWeight.SemiBold)
        Text(
            "End-to-end encrypted — decrypted on this device only.",
            color = palette.muted,
            fontSize = 14.sp,
            lineHeight = 19.sp,
        )
        if (loading) {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                repeat(3) { WebSkeletonCard() }
            }
        } else if (error != null) {
            Text(error!!, color = palette.riskFg)
        } else if (conversations.isEmpty()) {
            Text("No conversations yet. Start one from the web or by searching a classmate.", color = palette.muted)
        } else {
            LazyColumn(verticalArrangement = Arrangement.spacedBy(10.dp), contentPadding = androidx.compose.foundation.layout.PaddingValues(bottom = 112.dp)) {
                items(conversations, key = { it.id }) { conversation ->
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(12.dp))
                            .background(palette.card)
                            .clickable { openId = conversation.id }
                            .padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(4.dp),
                    ) {
                        Text(conversation.otherName, color = palette.ink, fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
                        if (conversation.lastPlaintext != null) {
                            Text(conversation.lastPlaintext, color = palette.muted, fontSize = 13.sp, lineHeight = 18.sp, maxLines = 1)
                        } else {
                            Text("Encrypted message", color = palette.muted, fontSize = 13.sp)
                        }
                        if (conversation.unreadCount > 0) {
                            Text("${conversation.unreadCount} unread", color = palette.accent, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                        }
                    }
                }
            }
        }
    }
}

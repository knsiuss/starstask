package id.starstask.mobile.ui.screens

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
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import id.starstask.mobile.data.loadConversations
import id.starstask.mobile.ui.theme.Foreground
import id.starstask.mobile.ui.theme.MutedForeground
import id.starstask.mobile.ui.theme.Surface

/**
 * Conversation list. Message bodies are end-to-end encrypted and are
 * never decrypted with a native implementation in this shell — the
 * list shows participants only, matching the "no plaintext" posture.
 */
@Composable
fun MessagesScreen(userId: String) {
    var conversations by remember { mutableStateOf<List<id.starstask.mobile.data.Conversation>>(emptyList()) }
    var error by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(userId) {
        try {
            conversations = loadConversations(userId)
        } catch (e: Exception) {
            error = "Could not load chats."
        }
    }

    Column(modifier = Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text("Messages", style = MaterialTheme.typography.headlineSmall, color = Foreground)
        Text(
            "🔒 Encrypted direct messages — open a conversation on web to read them.",
            color = MutedForeground,
            style = MaterialTheme.typography.bodySmall,
        )
        if (error != null) Text(error!!, color = Foreground)
        LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            items(conversations, key = { it.id }) { conversation ->
                Card(
                    colors = CardDefaults.cardColors(containerColor = Surface),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text(conversation.otherName, color = Foreground)
                        Text("🔒 Encrypted", color = MutedForeground, style = MaterialTheme.typography.bodySmall)
                    }
                }
            }
        }
    }
}

@Composable
fun SettingsScreen(onSignOut: () -> Unit) {
    Column(modifier = Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text("Settings", style = MaterialTheme.typography.headlineSmall, color = Foreground)
        Text(
            "Secure sign-in via Google · No password stored",
            color = MutedForeground,
            style = MaterialTheme.typography.bodySmall,
        )
        OutlinedButton(onClick = onSignOut) { Text("Sign out") }
    }
}

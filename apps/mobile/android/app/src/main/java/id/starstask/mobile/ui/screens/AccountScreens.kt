package id.starstask.mobile.ui.screens

import id.starstask.mobile.ui.theme.Spacing

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.MaterialTheme
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
import id.starstask.mobile.data.SupabaseProvider
import id.starstask.mobile.data.backupDeviceKey
import id.starstask.mobile.data.ensurePublishedDeviceKey
import id.starstask.mobile.data.restoreDeviceKey
import id.starstask.mobile.data.safetyFingerprint
import id.starstask.mobile.data.decodeJsonArray
import id.starstask.mobile.data.userFacingMessage
import id.starstask.mobile.ui.components.BadgeTone
import id.starstask.mobile.ui.components.WebBadge
import id.starstask.mobile.ui.components.WebCard
import id.starstask.mobile.ui.components.WebCardDescription
import id.starstask.mobile.ui.components.WebCardTitle
import id.starstask.mobile.ui.components.WebPrimaryButton
import id.starstask.mobile.ui.components.WebSecondaryButton
import id.starstask.mobile.ui.components.WebInput
import id.starstask.mobile.ui.theme.Foreground
import id.starstask.mobile.ui.theme.MutedForeground
import id.starstask.mobile.ui.theme.Surface
import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.query.Order
import kotlinx.coroutines.launch
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put

@Composable
fun SecurityPrivacyScreen(
    userId: String,
    email: String?,
    onSignOut: () -> Unit,
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var status by remember { mutableStateOf("pending") }
    var fingerprint by remember { mutableStateOf<String?>(null) }
    var backupPassphrase by remember { mutableStateOf("") }
    var restorePassphrase by remember { mutableStateOf("") }
    var backupStatus by remember { mutableStateOf("") }
    var restoreStatus by remember { mutableStateOf("") }

    LaunchedEffect(userId) {
        try {
            val publicKey = ensurePublishedDeviceKey(context, userId)
            fingerprint = safetyFingerprint(publicKey)
            status = "ready"
        } catch (_: Exception) {
            status = "error"
        }
    }

    Column(
        modifier = Modifier.fillMaxSize().padding(Spacing.Section),
        verticalArrangement = Arrangement.spacedBy(Spacing.Section),
    ) {
        Text("Security & Privacy", style = MaterialTheme.typography.headlineSmall, color = Foreground)
        WebCard(modifier = Modifier.fillMaxWidth()) {
            WebCardTitle("End-to-end encryption")
            WebCardDescription(
                "Your messages are protected with end-to-end encryption. Only you and " +
                    "the people you chat with can read them.",
            )
            Text(
                when (status) {
                    "ready" -> "Status: Active on this device."
                    "error" -> "Status: Could not load. Reload the page to retry."
                    else -> "Status: Setting up…"
                },
                color = Foreground,
                style = MaterialTheme.typography.bodyMedium,
            )
        }
        WebCard(modifier = Modifier.fillMaxWidth()) {
            WebCardTitle("This device")
            WebCardDescription(
                "Each device has its own key. The private half never leaves this " +
                    "device. Compare the fingerprint below with the person you chat " +
                    "with to verify it is really them.",
            )
            Text(
                fingerprint ?: "Loading fingerprint…",
                color = Foreground,
                style = MaterialTheme.typography.bodyMedium,
            )
        }
        WebCard(modifier = Modifier.fillMaxWidth()) {
            WebCardTitle("Backup & recovery")
            WebCardDescription(
                "Back up your key with a passphrase to use on another device. The " +
                    "server stores the backup encrypted — it cannot read it.",
            )
            WebInput(
                value = backupPassphrase,
                onValueChange = { backupPassphrase = it; backupStatus = "" },
                label = "Passphrase for backup (12+ chars)",
            )
            WebSecondaryButton(
                "Back up key",
                onClick = {
                    scope.launch {
                        runCatching { backupDeviceKey(context, userId, backupPassphrase) }
                            .onSuccess {
                                backupStatus = "Backup saved — the server cannot read it."
                                backupPassphrase = ""
                            }
                            .onFailure { backupStatus = userFacingMessage(it, "Backup failed — try again.") }
                    }
                },
            )
            if (backupStatus.isNotBlank()) {
                Text(backupStatus, color = MutedForeground, style = MaterialTheme.typography.bodySmall)
            }
            Text(
                "On a new device, restore with the same passphrase.",
                color = MutedForeground,
                style = MaterialTheme.typography.bodySmall,
            )
            WebInput(
                value = restorePassphrase,
                onValueChange = { restorePassphrase = it; restoreStatus = "" },
                label = "Recovery passphrase",
            )
            WebPrimaryButton(
                "Restore on this device",
                onClick = {
                    scope.launch {
                        runCatching { restoreDeviceKey(context, userId, restorePassphrase) }
                            .onSuccess {
                                restoreStatus = "Key restored on this device. Direct messages are temporarily disabled."
                                restorePassphrase = ""
                                status = "ready"
                            }
                            .onFailure { restoreStatus = "Restore failed — check your passphrase and try again." }
                    }
                },
            )
            if (restoreStatus.isNotBlank()) {
                Text(restoreStatus, color = MutedForeground, style = MaterialTheme.typography.bodySmall)
            }
        }
        WebCard(modifier = Modifier.fillMaxWidth()) {
            WebCardTitle("Devices & sessions")
            WebCardDescription(
                "You are signed in on this device (${email ?: userId.take(8) + "…"}). " +
                    "If you start using a new device, restore your key there with " +
                    "the passphrase above — no separate session list to manage.",
            )
            WebSecondaryButton("Sign out", onClick = onSignOut)
        }
    }
}


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
import androidx.compose.material3.OutlinedTextField
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
import id.starstask.mobile.data.contentOrNull
import id.starstask.mobile.data.decodeJsonArray
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


data class FeedbackEntry(
    val id: String,
    val category: String,
    val message: String,
    val status: String,
    val createdAt: String,
)

val feedbackCategories = listOf("bug", "confusing", "idea", "other")

val feedbackCategoryLabels = mapOf(
    "bug" to "Something is broken",
    "confusing" to "A screen was confusing",
    "idea" to "An idea for improving StarsTask",
    "other" to "Something else",
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FeedbackScreen(userId: String) {
    val scope = rememberCoroutineScope()
    var category by remember { mutableStateOf("idea") }
    var expanded by remember { mutableStateOf(false) }
    var message by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    var notice by remember { mutableStateOf<String?>(null) }
    var entries by remember { mutableStateOf<List<FeedbackEntry>>(emptyList()) }
    var loadError by remember { mutableStateOf<String?>(null) }

    suspend fun loadEntries() {
        entries = runCatching {
            SupabaseProvider.client.postgrest.from("feedback_entries").select {
                filter { eq("user_id", userId) }
                order("created_at", Order.DESCENDING)
                limit(10)
            }.decodeJsonArray().mapNotNull { row ->
                val obj = row.jsonObject
                val id = obj["id"]?.jsonPrimitive?.content ?: return@mapNotNull null
                FeedbackEntry(
                    id = id,
                    category = obj["category"]?.jsonPrimitive?.content ?: "other",
                    message = obj["message"]?.jsonPrimitive?.content ?: "",
                    status = obj["status"]?.jsonPrimitive?.content ?: "open",
                    createdAt = obj["created_at"]?.jsonPrimitive?.content ?: "",
                )
            }
        }.onFailure { loadError = "Could not load your feedback." }.getOrDefault(emptyList())
    }

    LaunchedEffect(userId) { loadEntries() }

    LazyColumn(
        modifier = Modifier.fillMaxSize().padding(Spacing.Section),
        verticalArrangement = Arrangement.spacedBy(Spacing.Xl),
    ) {
        item {
            Text("Feedback", style = MaterialTheme.typography.headlineSmall, color = Foreground)
            Text(
                "Report a broken screen, a confusing step, or an idea.",
                color = MutedForeground,
                style = MaterialTheme.typography.bodyMedium,
            )
        }
        item {
            ExposedDropdownMenuBox(expanded = expanded, onExpandedChange = { expanded = !expanded }) {
                OutlinedTextField(
                    value = feedbackCategoryLabels[category] ?: category,
                    onValueChange = {},
                    readOnly = true,
                    label = { Text("Category") },
                    trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded) },
                    modifier = Modifier.fillMaxWidth().menuAnchor(),
                )
                ExposedDropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
                    feedbackCategories.forEach { option ->
                        DropdownMenuItem(
                            text = { Text(feedbackCategoryLabels[option] ?: option) },
                            onClick = { category = option; expanded = false },
                        )
                    }
                }
            }
        }
        item {
            WebInput(
                value = message,
                onValueChange = { message = it; notice = null },
                label = "Message (min. 10 characters)",
                singleLine = false,
                minLines = 4,
            )
        }
        if (notice != null) {
            item { Text(notice!!, color = Foreground, style = MaterialTheme.typography.bodySmall) }
        }
        item {
            WebPrimaryButton(
                if (busy) "Saving…" else "Send feedback",
                onClick = {
                    if (message.trim().length < 10) {
                        notice = "Message must be at least 10 characters."
                        return@WebPrimaryButton
                    }
                    scope.launch {
                        busy = true
                        runCatching {
                            SupabaseProvider.client.postgrest.from("feedback_entries").insert(
                                buildJsonObject {
                                    put("user_id", JsonPrimitive(userId))
                                    put("category", JsonPrimitive(category))
                                    put("message", JsonPrimitive(message.trim()))
                                    put("page_path", kotlinx.serialization.json.JsonNull)
                                },
                            )
                        }.onSuccess {
                            message = ""
                            notice = "Thanks — your feedback was saved."
                            loadEntries()
                        }.onFailure {
                            notice = "Could not save feedback. Please try again."
                        }
                        busy = false
                    }
                },
                enabled = !busy,
            )
        }
        if (loadError != null) {
            item { Text(loadError!!, color = Foreground) }
        }
        if (entries.isEmpty() && loadError == null) {
            item { Text("No feedback yet.", color = MutedForeground) }
        }
        items(entries, key = { it.id }) { entry ->
            WebCard(modifier = Modifier.fillMaxWidth()) {
                Row(horizontalArrangement = Arrangement.spacedBy(Spacing.Md)) {
                    WebCardTitle(feedbackCategoryLabels[entry.category] ?: entry.category)
                    WebBadge(
                        entry.status.replaceFirstChar { it.uppercase() },
                        when (entry.status) {
                            "reviewing" -> BadgeTone.ACCENT
                            "resolved" -> BadgeTone.SUCCESS
                            else -> BadgeTone.NEUTRAL
                        },
                    )
                }
                Text(entry.message, color = Foreground, style = MaterialTheme.typography.bodyMedium)
                WebCardDescription(entry.createdAt.take(10))
            }
        }
    }
}

package id.starstask.mobile.ui.screens

import id.starstask.mobile.ui.theme.Spacing

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.Text
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import id.starstask.mobile.data.ClassDetail
import id.starstask.mobile.data.csvForReports
import id.starstask.mobile.data.listAssignmentPage
import id.starstask.mobile.ui.theme.Foreground
import id.starstask.mobile.ui.theme.MutedForeground
import id.starstask.mobile.ui.components.WebAlert
import id.starstask.mobile.ui.components.WebButton
import id.starstask.mobile.ui.components.WebButtonVariant
import id.starstask.mobile.ui.components.WebCard
import id.starstask.mobile.ui.components.WebScreenHeader
import kotlinx.coroutines.launch

// Reader reports (web /app/classes/[slug]/reports). Leave review is in ClassLeaveScreen.kt.

@Composable
fun ClassReportsScreen(clazz: ClassDetail, onBack: () -> Unit) {
    var csvText by remember { mutableStateOf("") }
    var error by remember { mutableStateOf<String?>(null) }
    var loading by remember { mutableStateOf(false) }
    LaunchedEffect(clazz.id) {
        loading = true
        runCatching {
            csvText = csvForReports(listAssignmentPage(classId = clazz.id, sort = "newest", page = 1, pageSize = 50).items)
        }.onFailure { error = "Could not load reports: ${it.message}" }
        loading = false
    }

    Column(modifier = Modifier.fillMaxSize().padding(Spacing.Section), verticalArrangement = Arrangement.spacedBy(Spacing.Xl)) {
        WebButton(label = "← Back", onClick = onBack, variant = WebButtonVariant.GHOST)
        WebScreenHeader(title = "Reader reports — ${clazz.name}", subtitle = "CSV export, same columns as web")
        if (loading) Text("Loading…", color = MutedForeground)
        if (error != null) WebAlert(message = error!!)
        if (csvText.isNotBlank()) {
            WebCard {
                Text(
                    csvText.take(2000),
                    modifier = Modifier.padding(Spacing.Xl),
                    color = Foreground,
                    style = MaterialTheme.typography.bodySmall,
                )
            }
            Text(
                "CSV rendered inline (same columns as web export). Copy from the text above.",
                color = MutedForeground,
                style = MaterialTheme.typography.bodySmall,
            )
        }
    }
}


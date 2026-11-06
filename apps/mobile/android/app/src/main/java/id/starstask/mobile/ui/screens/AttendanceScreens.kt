package id.starstask.mobile.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
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
import id.starstask.mobile.data.AttendanceHistoryEntry
import id.starstask.mobile.data.RecapSummary
import id.starstask.mobile.data.formatTime
import id.starstask.mobile.data.loadAttendanceHistory
import id.starstask.mobile.data.summarizeRecap
import id.starstask.mobile.ui.theme.Accent
import id.starstask.mobile.ui.theme.Foreground
import id.starstask.mobile.ui.theme.MutedForeground
import id.starstask.mobile.ui.theme.Surface

/**
 * Personal attendance history + semester recap for the signed-in
 * student, mirroring the web recap summary (present/absent/excused
 * counts and percentage). The full class sheet stays manager-only
 * on the server (class_attendance_recap); students see their own rows.
 */
@Composable
fun AttendanceScreen(userId: String) {
    var history by remember { mutableStateOf<List<AttendanceHistoryEntry>>(emptyList()) }
    var error by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(userId) {
        try {
            history = loadAttendanceHistory(userId)
        } catch (_: Exception) {
            error = "Could not load your attendance history."
        }
    }

    val recap = remember(history) { summarizeRecap(history) }

    Column(modifier = Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        ScreenTitle("Attendance")
        RecapCard(recap)
        if (error != null) Text(error!!, color = Foreground)
        LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            items(history, key = { it.sessionId }) { entry ->
                Card(colors = CardDefaults.cardColors(containerColor = Surface), shape = RoundedCornerShape(12.dp), modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Text(entry.title, color = Foreground)
                        Text(
                            "${entry.className ?: ""} · ${formatTime(entry.startsAt)}",
                            color = MutedForeground,
                            style = MaterialTheme.typography.bodySmall,
                        )
                        Text(
                            "Status: ${entry.status}${entry.checkedInAt?.let { " · ${formatTime(it)}" } ?: ""}",
                            color = if (entry.status == "present") Accent else MutedForeground,
                            style = MaterialTheme.typography.bodySmall,
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun RecapCard(recap: RecapSummary) {
    Card(colors = CardDefaults.cardColors(containerColor = Surface), shape = RoundedCornerShape(12.dp), modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("Semester recap", color = Foreground, style = MaterialTheme.typography.titleMedium)
            Row(horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
                Text("Present", color = MutedForeground, style = MaterialTheme.typography.bodySmall)
                Text("${recap.present}", color = Foreground)
            }
            Row(horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
                Text("Absent", color = MutedForeground, style = MaterialTheme.typography.bodySmall)
                Text("${recap.absent}", color = Foreground)
            }
            Row(horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
                Text("Excused", color = MutedForeground, style = MaterialTheme.typography.bodySmall)
                Text("${recap.excused}", color = Foreground)
            }
            Row(horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
                Text("Rate", color = MutedForeground, style = MaterialTheme.typography.bodySmall)
                Text("${recap.percentage}%", color = Accent)
            }
        }
    }
}

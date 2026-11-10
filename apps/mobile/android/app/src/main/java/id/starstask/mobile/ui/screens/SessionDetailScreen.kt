package id.starstask.mobile.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import id.starstask.mobile.data.SessionRow
import id.starstask.mobile.data.formatTime
import id.starstask.mobile.ui.theme.Accent
import id.starstask.mobile.ui.theme.Foreground
import id.starstask.mobile.ui.theme.MutedForeground

/** Session detail with GPS check-in (capture + RPC; handled by caller). */
@Composable
fun SessionDetailScreen(
    session: SessionRow,
    onBack: () -> Unit,
    onCheckIn: (String) -> Unit,
) {
    Column(modifier = Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        OutlinedButton(onClick = onBack) { Text("← Back") }
        Text(session.title, style = MaterialTheme.typography.headlineSmall, color = Foreground)
        Text(session.className ?: "", color = MutedForeground)
        Text(
            "${formatTime(session.startsAt)}-${formatTime(session.endsAt)}",
            color = MutedForeground,
        )
        Text("Status: ${session.status}", color = MutedForeground)
        Button(
            onClick = { onCheckIn(session.id) },
            colors = ButtonDefaults.buttonColors(containerColor = Accent),
        ) { Text("Check in (GPS)") }
    }
}

package id.starstask.mobile.ui.screens

import id.starstask.mobile.ui.icons.Lucide

import id.starstask.mobile.ui.theme.Spacing

import android.Manifest
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import id.starstask.mobile.data.ActiveMeeting
import id.starstask.mobile.data.AttendanceIdentity
import id.starstask.mobile.data.capturePosition
import id.starstask.mobile.data.checkInLegacySession
import id.starstask.mobile.data.checkInToSession
import id.starstask.mobile.ui.components.StatusBadge
import id.starstask.mobile.data.formatDateShort
import id.starstask.mobile.data.formatTime
import id.starstask.mobile.data.hasLocationPermission
import id.starstask.mobile.ui.components.WebAlert
import id.starstask.mobile.ui.theme.Accent
import id.starstask.mobile.ui.theme.AccentSoft
import id.starstask.mobile.ui.theme.Border
import id.starstask.mobile.ui.theme.Danger
import id.starstask.mobile.ui.theme.Foreground
import id.starstask.mobile.ui.theme.MutedForeground
import id.starstask.mobile.ui.theme.Success
import id.starstask.mobile.ui.theme.Surface
import kotlinx.coroutines.launch

@Composable
fun PhaseBadge(open: Boolean, phase: String) {
    val label = when (phase) {
        "open" -> "Open"
        "before" -> "Not opened yet"
        "closed" -> "Closed"
        else -> "Not opened"
    }
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(999.dp))
            .background(if (open) id.starstask.mobile.ui.theme.SuccessSoft else id.starstask.mobile.ui.theme.Muted)
            .padding(horizontal = Spacing.Md, vertical = 3.dp),
    ) {
        Text(
            label,
            color = if (open) Success else MutedForeground,
            style = MaterialTheme.typography.labelSmall,
        )
    }
}

@Composable
fun MeetingLine(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    text: String,
) {
    Row(
        horizontalArrangement = Arrangement.spacedBy(Spacing.Sm),
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier.padding(top = 2.dp),
    ) {
        Icon(icon, contentDescription = null, tint = MutedForeground, modifier = Modifier.size(14.dp))
        Text(text, color = MutedForeground, style = MaterialTheme.typography.bodySmall)
    }
}

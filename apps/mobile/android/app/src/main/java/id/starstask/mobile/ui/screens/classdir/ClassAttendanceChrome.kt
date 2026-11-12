package id.starstask.mobile.ui.screens.classdir

// In-screen glossy sub-page scaffold for the Attendance tab pushes: mock page
// backdrop, back row, title, scrollable body.

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.layout.height
import id.starstask.mobile.ui.components.StaggerDots
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import id.starstask.mobile.ui.icons.Lucide
import id.starstask.mobile.ui.theme.mockColors

@Composable
internal fun GlossyBackSurface(
    title: String,
    subtitle: String?,
    onBack: () -> Unit,
    content: @Composable () -> Unit,
) {
    val palette = mockColors()
    Box(modifier = Modifier.fillMaxSize().background(id.starstask.mobile.ui.theme.mockPageBrush())) {
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = androidx.compose.foundation.layout.PaddingValues(
                start = 16.dp, end = 16.dp, top = 12.dp, bottom = 32.dp,
            ),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            item(key = "back") {
                Box(
                    modifier = Modifier
                        .size(40.dp)
                        .background(palette.card, RoundedCornerShape(999.dp))
                        .padding(0.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    androidx.compose.material3.IconButton(onClick = onBack) {
                        Icon(Lucide.ArrowLeft, contentDescription = "Back", tint = palette.ink, modifier = Modifier.size(20.dp))
                    }
                }
            }
            item(key = "header") {
                Column(verticalArrangement = Arrangement.spacedBy(4.dp), modifier = Modifier.padding(start = 4.dp)) {
                    Text(
                        title,
                        color = palette.ink,
                        fontSize = 24.sp,
                        fontWeight = androidx.compose.ui.text.font.FontWeight.Bold,
                        lineHeight = 28.sp,
                    )
                    if (!subtitle.isNullOrBlank()) {
                        Text(subtitle, color = palette.muted, fontSize = 13.sp, lineHeight = 18.sp)
                    }
                }
            }
            item(key = "body") {
                content()
            }
        }
    }
}

@Composable
internal fun GlossyLoadingRow() {
    val palette = mockColors()
    Box(modifier = Modifier.fillMaxWidth().padding(vertical = 24.dp), contentAlignment = Alignment.Center) {
    }
}

@Composable
internal fun GlossyErrorRow(message: String, onRetry: () -> Unit) {
    val palette = mockColors()
    Column(verticalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.padding(top = 8.dp)) {
        Text(message, color = palette.muted, fontSize = 13.sp, lineHeight = 19.sp)
        androidx.compose.foundation.layout.Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            androidx.compose.material3.TextButton(onClick = onRetry) {
                Text("Retry", color = palette.accent, fontWeight = androidx.compose.ui.text.font.FontWeight.SemiBold)
            }
        }
    }
}

internal fun formatMeetingDateTimeFull(iso: String): String = runCatching {
    val parsed = java.time.OffsetDateTime.parse(iso)
    java.time.format.DateTimeFormatter.ofPattern("EEEE, d MMMM yyyy · HH:mm", java.util.Locale.getDefault())
        .format(parsed)
}.getOrElse { iso.take(16).replace('T', ' ') }

internal fun formatAttendanceStatusLabel(status: String): String = when (status) {
    "present" -> "Present"
    "late" -> "Late"
    "excused" -> "Excused"
    "sick" -> "Sick"
    "absent" -> "Absent"
    "not_recorded" -> "Not recorded"
    "not_applicable" -> "Not applicable"
    else -> status.replaceFirstChar { it.uppercase() }
}

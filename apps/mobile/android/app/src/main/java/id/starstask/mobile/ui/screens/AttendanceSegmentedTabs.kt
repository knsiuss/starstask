package id.starstask.mobile.ui.screens

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import id.starstask.mobile.ui.theme.DurationSoftMs
import id.starstask.mobile.ui.theme.Spacing
import id.starstask.mobile.ui.theme.mockColors

// Segmented pill tabs (mock palette). Selected = accentSoft, 200ms
// tween; container keeps its position stable across switches.
@Composable
fun AttendanceSegmentedTabs(
    selected: String,
    onSelect: (String) -> Unit,
) {
    val palette = mockColors()
    Row(
        modifier = Modifier
            .clip(RoundedCornerShape(999.dp))
            .background(palette.card)
            .padding(4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        listOf("Check-in" to "checkin", "History" to "history").forEach { (label, key) ->
            val active = key == selected
            val bg by animateColorAsState(
                if (active) palette.accentSoft else androidx.compose.ui.graphics.Color.Transparent,
                animationSpec = tween(DurationSoftMs),
                label = "attendanceTab",
            )
            val fg by animateColorAsState(
                if (active) palette.accent else palette.muted,
                animationSpec = tween(DurationSoftMs),
                label = "attendanceTabText",
            )
            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(999.dp))
                    .background(bg)
                    .clickable { onSelect(key) }
                    .padding(horizontal = Spacing.Section, vertical = Spacing.Sm),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    label,
                    color = fg,
                    style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Medium),
                )
            }
        }
    }
}

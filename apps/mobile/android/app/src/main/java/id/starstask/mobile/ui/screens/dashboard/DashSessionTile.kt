package id.starstask.mobile.ui.screens.dashboard

// Grouped pastel session row for the "Upcoming Sessions" section: colored
// icon tile, thin accent bar, title + time · class code, trailing chevron.

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import id.starstask.mobile.data.ScheduleEntry
import id.starstask.mobile.data.formatTime
import id.starstask.mobile.ui.icons.Lucide
import id.starstask.mobile.ui.theme.DashRadiusTile
import id.starstask.mobile.ui.theme.dashColors

private enum class SessionTileTone { BLUE, PURPLE, GREEN }

private data class SessionStyle(
    val tileBackground: androidx.compose.ui.graphics.Color,
    val tileForeground: androidx.compose.ui.graphics.Color,
    val accentBar: androidx.compose.ui.graphics.Color,
    val icon: androidx.compose.ui.graphics.vector.ImageVector,
)

private fun toneFor(key: String?): SessionTileTone {
    val h = (key ?: "").hashCode() and Int.MAX_VALUE
    return when (h % 3) {
        0 -> SessionTileTone.BLUE
        1 -> SessionTileTone.PURPLE
        else -> SessionTileTone.GREEN
    }
}

@Composable
fun DashSessionTile(
    entry: ScheduleEntry,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val palette = dashColors()
    val tone = toneFor(entry.subjectNameOrClass())
    val style = when (tone) {
        SessionTileTone.BLUE -> SessionStyle(palette.tileBlueBackground, palette.tileBlueForeground, palette.sessionAccentBlue, Lucide.GraduationCap)
        SessionTileTone.PURPLE -> SessionStyle(palette.tilePurpleBackground, palette.tilePurpleForeground, palette.sessionAccentPurple, Lucide.Briefcase)
        SessionTileTone.GREEN -> SessionStyle(palette.tileGreenBackground, palette.tileGreenForeground, palette.sessionAccentGreen, Lucide.TrendingUp)
    }
    val colorBar = style.accentBar
    val iconVector = style.icon
    val tileBackground = style.tileBackground
    val tileForeground = style.tileForeground

    Row(
        modifier = modifier
            .fillMaxWidth()
            .clip(DashRadiusTile)
            .background(palette.card)
            .clickable(onClick = onClick)
            .padding(vertical = 14.dp, horizontal = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Box(
            modifier = Modifier.width(3.dp).height(56.dp).clip(RoundedCornerShape(999.dp)).background(colorBar),
        )
        Box(
            modifier = Modifier.size(48.dp).clip(RoundedCornerShape(14.dp)).background(tileBackground),
            contentAlignment = Alignment.Center,
        ) {
            Icon(iconVector, contentDescription = null, tint = tileForeground, modifier = Modifier.size(24.dp))
        }
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(entry.title, color = palette.text, fontSize = 16.sp, fontWeight = androidx.compose.ui.text.font.FontWeight.SemiBold, maxLines = 2, lineHeight = 20.sp)
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Icon(Lucide.Clock, contentDescription = null, tint = palette.muted, modifier = Modifier.size(14.dp))
                Text(
                    "${formatTime(entry.startsAt)} · ${entry.classCode ?: entry.className ?: ""}".trimEnd(),
                    color = palette.muted,
                    fontSize = 13.sp,
                    maxLines = 1,
                )
            }
        }
        Box(
            modifier = Modifier.size(32.dp).clip(RoundedCornerShape(999.dp)).background(palette.card),
            contentAlignment = Alignment.Center,
        ) {
            Icon(Lucide.ChevronRight, contentDescription = "Open session", tint = palette.muted, modifier = Modifier.size(18.dp))
        }
    }
}

private fun ScheduleEntry.subjectNameOrClass(): String = classCode ?: className ?: title

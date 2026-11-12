package id.starstask.mobile.ui.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp
import id.starstask.mobile.ui.icons.Lucide
import id.starstask.mobile.ui.theme.Accent
import id.starstask.mobile.ui.theme.AccentSoft
import id.starstask.mobile.ui.theme.Border
import id.starstask.mobile.ui.theme.Foreground
import id.starstask.mobile.ui.theme.Surface

/**
 * Mirrors web `QuickActions` (components/dashboard/quick-actions.tsx): five
 * pills in a horizontally scrolling row with 8dp gaps. Web:
 * `border-border bg-surface hover:bg-accent-soft hover:text-accent
 * flex shrink-0 items-center gap-2 rounded-full border px-4 py-2
 * text-sm font-medium transition-all active:scale-95`.
 * Native: pressed = accent-soft + accent text, scale-95 via graphicsLayer.
 */
@Composable
fun QuickActions(
    onCheckIn: () -> Unit,
    onOpenTasks: () -> Unit,
    onOpenMessages: (() -> Unit)? = null,
    onOpenSchedule: () -> Unit = {},
    onNewAssignment: () -> Unit = {},
) {
    val palette = id.starstask.mobile.ui.theme.dashColors()
    androidx.compose.foundation.layout.Box(modifier = Modifier.fillMaxWidth().height(36.dp)) {
        Row(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
            verticalAlignment = androidx.compose.ui.Alignment.CenterVertically,
        ) {
            QuickActionPill(Lucide.CalendarCheck, "Check in now", onClick = onCheckIn)
            QuickActionPill(Lucide.ClipboardList, "Submit task", onClick = onOpenTasks)
            QuickActionPill(Lucide.CalendarDays, "Today's schedule", onClick = onOpenSchedule)
            if (onOpenMessages != null) {
                QuickActionPill(Lucide.MessageCircle, "Open messages", onClick = onOpenMessages)
            }
            QuickActionPill(Lucide.Plus, "New assignment", onClick = onNewAssignment)
            // End spacer so the last pill has breathing room when scrolled.
            androidx.compose.foundation.layout.Box(modifier = Modifier.size(width = 8.dp, height = 1.dp))
        }
        // Fade the right edge so the clipped pill reads as "more to the right",
        // not as a cut-off widget.
        androidx.compose.foundation.layout.Box(
            modifier = Modifier
                .align(Alignment.CenterEnd)
                .height(36.dp)
                .width(36.dp)
                .background(
                    androidx.compose.ui.graphics.Brush.horizontalGradient(
                        colors = listOf(androidx.compose.ui.graphics.Color.Transparent, palette.pageBackground),
                    ),
                ),
        )
    }
}

@Composable
fun QuickActionPill(
    icon: ImageVector,
    label: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val interactionSource = remember { MutableInteractionSource() }
    val pressed by interactionSource.collectIsPressedAsState()
    val pillBg = if (pressed) AccentSoft else Surface
    val pillFg = if (pressed) Accent else Foreground
    Row(
        modifier = modifier
            .clip(CircleShape)
            .border(1.dp, Border, CircleShape)
            .background(pillBg, CircleShape)
            .clickable(interactionSource = interactionSource, indication = null) { onClick() }
            .padding(horizontal = 16.dp, vertical = 8.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(icon, contentDescription = null, modifier = Modifier.size(16.dp), tint = pillFg)
        Text(
            label,
            color = pillFg,
            style = MaterialTheme.typography.bodyMedium.copy(fontWeight = androidx.compose.ui.text.font.FontWeight.Medium),
            maxLines = 1,
        )
    }
}

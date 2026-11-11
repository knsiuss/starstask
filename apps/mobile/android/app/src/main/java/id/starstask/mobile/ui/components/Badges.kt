package id.starstask.mobile.ui.components

import id.starstask.mobile.ui.theme.Spacing

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import id.starstask.mobile.ui.theme.Accent
import id.starstask.mobile.ui.theme.AccentSoft
import id.starstask.mobile.ui.theme.Border
import id.starstask.mobile.ui.theme.Danger
import id.starstask.mobile.ui.theme.DangerSoft
import id.starstask.mobile.ui.theme.Foreground
import id.starstask.mobile.ui.theme.Muted
import id.starstask.mobile.ui.theme.MutedForeground
import id.starstask.mobile.ui.theme.Success
import id.starstask.mobile.ui.theme.SuccessSoft
import id.starstask.mobile.ui.theme.Warning
import id.starstask.mobile.ui.theme.WarningSoft

enum class BadgeVariant { NEUTRAL, ACCENT, SUCCESS, WARNING, DANGER }

// Mirrors components/ui/badge.tsx (cva variants).
@Composable
fun StarsTaskBadge(
    label: String,
    variant: BadgeVariant = BadgeVariant.NEUTRAL,
    modifier: Modifier = Modifier,
) {
    val (bg, fg, bd) = when (variant) {
        BadgeVariant.NEUTRAL -> Triple(Muted, MutedForeground, Border)
        BadgeVariant.ACCENT -> Triple(AccentSoft, Accent, Color.Transparent)
        BadgeVariant.SUCCESS -> Triple(SuccessSoft, Success, Color.Transparent)
        BadgeVariant.WARNING -> Triple(WarningSoft, Warning, Color.Transparent)
        BadgeVariant.DANGER -> Triple(DangerSoft, Danger, Color.Transparent)
    }
    Row(
        modifier = modifier
            .background(bg, RoundedCornerShape(999.dp))
            .border(0.5.dp, bd, RoundedCornerShape(999.dp))
            .padding(horizontal = Spacing.Lg, vertical = Spacing.Xxs),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.Xs),
    ) {
        Text(
            text = label,
            color = fg,
            style = MaterialTheme.typography.labelSmall.copy(
                fontSize = 11.sp,
                fontWeight = FontWeight.Medium,
            ),
            maxLines = 1,
            softWrap = false,
        )
    }
}

// Deadline badge mirrors DeadlineBadge.tsx: label + formatted date in the device zone.
@Composable
fun DeadlineBadge(deadline: String?, modifier: Modifier = Modifier) {
    if (deadline.isNullOrBlank()) {
        StarsTaskBadge(label = "No deadline", variant = BadgeVariant.NEUTRAL, modifier = modifier)
        return
    }
    val state = id.starstask.mobile.data.getDeadlineState(deadline)
    val variant = when (state) {
        id.starstask.mobile.data.DeadlineState.OVERDUE -> BadgeVariant.DANGER
        id.starstask.mobile.data.DeadlineState.DUE_TODAY -> BadgeVariant.WARNING
        else -> BadgeVariant.ACCENT
    }
    StarsTaskBadge(
        label = "${id.starstask.mobile.data.deadlineStateLabel(state)} · ${id.starstask.mobile.data.formatDeadline(deadline)}",
        variant = variant,
        modifier = modifier,
    )
}

@Composable
fun StatusBadge(status: String, modifier: Modifier = Modifier) {
    val (label, variant) = when (status) {
        "published" -> "Published" to BadgeVariant.ACCENT
        "pending_review" -> "Pending" to BadgeVariant.WARNING
        "rejected" -> "Rejected" to BadgeVariant.DANGER
        "draft" -> "Draft" to BadgeVariant.NEUTRAL
        else -> status to BadgeVariant.NEUTRAL
    }
    StarsTaskBadge(label = label, variant = variant, modifier = modifier)
}

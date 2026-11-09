package id.starstask.mobile.ui.screens

import id.starstask.mobile.ui.icons.Lucide

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
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp
import id.starstask.mobile.ui.theme.Accent
import id.starstask.mobile.ui.theme.AccentSoft
import id.starstask.mobile.ui.theme.Border
import id.starstask.mobile.ui.theme.Danger
import id.starstask.mobile.ui.theme.DangerSoft
import id.starstask.mobile.ui.theme.Foreground
import id.starstask.mobile.ui.theme.MutedForeground
import id.starstask.mobile.ui.theme.RadiusPill
import id.starstask.mobile.ui.theme.Spacing
import id.starstask.mobile.ui.theme.StatHint
import id.starstask.mobile.ui.theme.StatLabel
import id.starstask.mobile.ui.theme.StatValue
import id.starstask.mobile.ui.theme.Success
import id.starstask.mobile.ui.theme.SuccessSoft
import id.starstask.mobile.ui.theme.Surface
import id.starstask.mobile.ui.theme.Warning
import id.starstask.mobile.ui.theme.WarningSoft

val TasksIcon: ImageVector = Lucide.FileText
val DueIcon: ImageVector = Lucide.CalendarClock
val WarningIcon: ImageVector = Lucide.TriangleAlert
val ClassesIcon: ImageVector = Lucide.GraduationCap

// Mirrors web StatCards (stat-cards.tsx): rounded-xl border bg-surface p-3
// shadow 0_1px_2px rgba(9,9,11,0.03); icon chip h-9 w-9 (sm 40) rounded-full
// with tone soft bg; value text-[22px] sm:text-[26px] semibold tracking-tight
// tabular-nums; hint text-[11px] muted hidden below sm; arrow circle 24px
// hidden below sm. Mobile has no sm breakpoint, so hint + arrow stay
// visible (they are the mobile card's action affordance).
@Composable
fun StatCard(
    label: String,
    value: Int,
    icon: ImageVector,
    tone: String,
    modifier: Modifier = Modifier,
    hint: String? = null,
    delta: Int = 0,
    onClick: (() -> Unit)? = null,
) {
    val toneBackground = when (tone) {
        "warning" -> WarningSoft
        "danger" -> DangerSoft
        "success" -> SuccessSoft
        else -> AccentSoft
    }
    val toneForeground = when (tone) {
        "warning" -> Warning
        "danger" -> Danger
        "success" -> Success
        else -> Accent
    }

    Card(
        modifier = modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = Surface),
        shape = RoundedCornerShape(12.dp),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
        onClick = onClick ?: {},
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween,
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 12.dp).fillMaxWidth(),
        ) {
            Box(
                modifier = Modifier
                    .padding(end = 10.dp)
                    .size(36.dp)
                    .clip(RoundedCornerShape(RadiusPill))
                    .background(toneBackground),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    imageVector = icon,
                    contentDescription = null,
                    tint = toneForeground,
                    modifier = Modifier.size(18.dp),
                )
            }
            Column(modifier = Modifier.weight(1f).padding(end = 10.dp)) {
                Text(
                    label,
                    color = MutedForeground,
                    style = StatLabel,
                    maxLines = 1,
                    overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis,
                )
                Row(
                    verticalAlignment = Alignment.Bottom,
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    Text(
                        formatCount(value),
                        style = StatValue,
                        color = Foreground,
                        maxLines = 1,
                    )
                    if (delta > 0) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(2.dp),
                        ) {
                            Icon(
                                imageVector = Lucide.TrendingUp,
                                contentDescription = null,
                                tint = Success,
                                modifier = Modifier.size(12.dp),
                            )
                            Text(
                                "+${formatCount(delta)}",
                                color = Success,
                                style = StatHint,
                                fontWeight = androidx.compose.ui.text.font.FontWeight.SemiBold,
                                maxLines = 1,
                            )
                        }
                    }
                }
                if (!hint.isNullOrBlank()) {
                    Text(
                        hint,
                        color = MutedForeground,
                        style = StatHint,
                        maxLines = 2,
                        overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis,
                    )
                }
            }
            if (onClick != null) {
                Box(
                    modifier = Modifier
                        .padding(top = 24.dp)
                        .size(24.dp)
                        .clip(RoundedCornerShape(RadiusPill))
                        .border(1.dp, Border, RoundedCornerShape(RadiusPill)),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(
                        imageVector = Lucide.ArrowRight,
                        contentDescription = null,
                        tint = MutedForeground,
                        modifier = Modifier.size(12.dp),
                    )
                }
            }
        }
    }
}

private fun formatCount(value: Int): String = when {
    value >= 1_000 -> {
        val k = value / 1000.0
        if (k % 1.0 == 0.0) "${k.toInt()}k" else String.format(java.util.Locale.US, "%.1fk", k).trimEnd('0').trimEnd('.') + "k"
    }
    else -> value.toString()
}

package id.starstask.mobile.ui.screens

import id.starstask.mobile.ui.theme.Spacing
import id.starstask.mobile.ui.icons.Lucide
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp
import id.starstask.mobile.ui.components.StatusBadge
import id.starstask.mobile.ui.theme.mockColors

// Course detail: web apps/web/src/app/(workspace)/attendance/courses/[courseId]/page.tsx
// (overview metrics + attendance summary + full session history). Membership is
// checked server-side by the same class-scoped query used by the list.
@Composable
internal fun AttendanceMetricsGrid(total: Int, present: Int, late: Int, absent: Int) {
    val palette = mockColors()
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.Lg)) {
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.Lg)) {
            OverviewCard("Total Sessions", total, Lucide.CalendarDays, palette.accentSoft, palette.accent, Modifier.weight(1f))
            OverviewCard("Present", present, Lucide.CircleCheck, palette.goodBg, palette.goodFg, Modifier.weight(1f))
        }
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.Lg)) {
            OverviewCard("Late", late, Lucide.Clock, palette.fairBg, palette.fairFg, Modifier.weight(1f))
            OverviewCard("Absent", absent, Lucide.XCircle, palette.riskBg, palette.riskFg, Modifier.weight(1f))
        }
    }
}

@Composable
fun OverviewCard(
    label: String,
    value: Int,
    icon: ImageVector,
    bg: Color,
    tint: Color,
    modifier: Modifier = Modifier,
) {
    val palette = mockColors()
    Box(
        modifier = modifier
            .border(1.dp, palette.cardBorder, RoundedCornerShape(12.dp))
            .background(palette.card)
            .padding(horizontal = Spacing.Xl, vertical = Spacing.Xl)
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.Lg),
        ) {
            Box(
                modifier = Modifier
                    .size(36.dp)
                    .clip(RoundedCornerShape(18.dp))
                    .background(bg),
                contentAlignment = Alignment.Center,
            ) {
                Icon(icon, contentDescription = null, tint = tint, modifier = Modifier.size(18.dp))
            }
            Column {
                Text(label, color = palette.muted, style = MaterialTheme.typography.bodySmall, maxLines = 1)
                Text(value.toString(), color = palette.ink, style = MaterialTheme.typography.headlineSmall)
            }
        }
    }
}

@Composable
internal fun AttendanceHistoryRow(
    title: String,
    subtitle: String,
    dateLine: String,
    timeLine: String,
    status: String,
    onClick: (() -> Unit)?,
) {
    val palette = mockColors()
    // Mirrors the screenshot: stacked rows inside one bordered box, not
    // separate cards. Status pill + chevron sit to the right of the title.
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .then(if (onClick != null) Modifier.clickable { onClick() } else Modifier)
            .padding(horizontal = Spacing.Xl, vertical = Spacing.Xl),
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Row(horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.Top) {
            Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(title, color = palette.ink, style = MaterialTheme.typography.bodyMedium, maxLines = 1)
                if (subtitle.isNotBlank()) {
                    Text(subtitle, color = palette.muted, style = MaterialTheme.typography.bodySmall, maxLines = 1)
                }
            }
            Icon(Lucide.ChevronRight, contentDescription = null, tint = palette.muted, modifier = Modifier.size(18.dp))
        }
        Text(dateLine, color = palette.ink, style = MaterialTheme.typography.bodySmall)
        Text(timeLine, color = palette.muted, style = MaterialTheme.typography.bodySmall)
        StatusBadge(status = status, modifier = Modifier.padding(top = 2.dp))
    }
}

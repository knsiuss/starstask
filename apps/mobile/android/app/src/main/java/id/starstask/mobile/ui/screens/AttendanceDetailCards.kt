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
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp
import id.starstask.mobile.data.AttendanceCounts
import id.starstask.mobile.data.AttendanceEntry
import id.starstask.mobile.data.formatAttendancePercentage
import id.starstask.mobile.data.formatDateShort
import id.starstask.mobile.data.formatTime
import id.starstask.mobile.data.loadStudentAttendance
import id.starstask.mobile.ui.components.StatusBadge
import id.starstask.mobile.ui.components.WebAlert
import id.starstask.mobile.ui.theme.Accent
import id.starstask.mobile.ui.theme.AccentSoft
import id.starstask.mobile.ui.theme.Border
import id.starstask.mobile.ui.theme.Danger
import id.starstask.mobile.ui.theme.DangerSoft
import id.starstask.mobile.ui.theme.Foreground
import id.starstask.mobile.ui.theme.MutedForeground
import id.starstask.mobile.ui.theme.Success
import id.starstask.mobile.ui.theme.SuccessSoft
import id.starstask.mobile.ui.theme.Surface
import id.starstask.mobile.ui.theme.Warning
import id.starstask.mobile.ui.theme.WarningSoft

// Course detail: web apps/web/src/app/(workspace)/attendance/courses/[courseId]/page.tsx
// (overview metrics + attendance summary + full session history). Membership is
// checked server-side by the same class-scoped query used by the list.
@Composable
internal fun AttendanceMetricsGrid(total: Int, present: Int, late: Int, absent: Int) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.Lg)) {
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.Lg)) {
            OverviewCard("Total Sessions", total, Lucide.CalendarDays, id.starstask.mobile.ui.theme.AccentSoft, id.starstask.mobile.ui.theme.Accent, Modifier.weight(1f))
            OverviewCard("Present", present, Lucide.CircleCheck, SuccessSoft, Success, Modifier.weight(1f))
        }
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.Lg)) {
            OverviewCard("Late", late, Lucide.Clock, WarningSoft, Warning, Modifier.weight(1f))
            OverviewCard("Absent", absent, Lucide.XCircle, DangerSoft, Danger, Modifier.weight(1f))
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
    // Mirrors the screenshot: light card with icon pill, label above value.
    Box(
        modifier = modifier
            .border(1.dp, Border, RoundedCornerShape(12.dp))
            .background(Surface)
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
                Text(label, color = MutedForeground, style = MaterialTheme.typography.bodySmall, maxLines = 1)
                Text(value.toString(), color = Foreground, style = MaterialTheme.typography.headlineSmall)
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
                Text(title, color = Foreground, style = MaterialTheme.typography.bodyMedium, maxLines = 1)
                if (subtitle.isNotBlank()) {
                    Text(subtitle, color = MutedForeground, style = MaterialTheme.typography.bodySmall, maxLines = 1)
                }
            }
            Icon(Lucide.ChevronRight, contentDescription = null, tint = MutedForeground, modifier = Modifier.size(18.dp))
        }
        Text(dateLine, color = Foreground, style = MaterialTheme.typography.bodySmall)
        Text(timeLine, color = MutedForeground, style = MaterialTheme.typography.bodySmall)
        StatusBadge(status = status, modifier = Modifier.padding(top = 2.dp))
    }
}

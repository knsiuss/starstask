package id.starstask.mobile.ui.screens

import id.starstask.mobile.ui.theme.Spacing

import id.starstask.mobile.ui.icons.Lucide

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import id.starstask.mobile.data.ManagedAttendanceClass
import id.starstask.mobile.ui.components.WebButton
import id.starstask.mobile.ui.components.WebButtonVariant
import id.starstask.mobile.ui.components.WebEmptyState
import id.starstask.mobile.ui.theme.mockColors

// Page header + Active Attendance card: 30.sp Bold ink title, 15.sp muted
// subtitle, 20.dp rounded cards, 1.dp cardBorder, no shadow.

@Composable
fun AttendancePageHeader(
    selectedTab: String,
    onSelectTab: (String) -> Unit,
) {
    val palette = mockColors()
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(
            "Attendance",
            color = palette.ink,
            fontSize = 30.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = (-0.5).sp,
            lineHeight = 36.sp,
        )
        Text(
            "Track your attendance across your enrolled courses.",
            color = palette.muted,
            fontSize = 15.sp,
            lineHeight = 21.sp,
        )
    }
    AttendanceSegmentedTabs(selected = selectedTab, onSelect = onSelectTab)
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun ActiveAttendanceCard(
    period: String?,
    managed: List<ManagedAttendanceClass>,
    onOpenManageClass: (ManagedAttendanceClass) -> Unit,
    onBrowseClasses: () -> Unit,
) {
    val palette = mockColors()
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(20.dp))
            .background(palette.card)
            .border(1.dp, palette.cardBorder, RoundedCornerShape(20.dp))
            .padding(horizontal = Spacing.Block, vertical = Spacing.Block),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Box(
                modifier = Modifier
                    .size(36.dp)
                    .clip(RoundedCornerShape(999.dp))
                    .background(palette.accentSoft),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    Lucide.CalendarDays,
                    contentDescription = null,
                    tint = palette.accent,
                    modifier = Modifier.size(20.dp),
                )
            }
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    "Active Attendance",
                    color = palette.muted,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Medium,
                )
                Text(
                    period ?: "No active semester",
                    color = palette.ink,
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Bold,
                    lineHeight = 26.sp,
                    maxLines = 2,
                    modifier = Modifier.padding(top = 2.dp),
                )
            }
        }
        if (managed.isNotEmpty()) {
            FlowRow(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                managed.take(3).forEach { managedClass ->
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(999.dp))
                            .background(palette.chip)
                            .clickable { onOpenManageClass(managedClass) }
                            .padding(horizontal = 12.dp, vertical = 10.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        Icon(
                            Lucide.Settings,
                            contentDescription = null,
                            tint = palette.accent,
                            modifier = Modifier.size(18.dp),
                        )
                        Text(
                            "Manage ${managedClass.slug.ifBlank { managedClass.name }}",
                            color = palette.ink,
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Medium,
                            maxLines = 1,
                            modifier = Modifier.weight(1f),
                        )
                        Icon(
                            Lucide.ChevronRight,
                            contentDescription = null,
                            tint = palette.muted,
                            modifier = Modifier.size(20.dp),
                        )
                    }
                }
                if (managed.size > 3) {
                    TextButton(onClick = onBrowseClasses) { Text("All classes") }
                }
            }
        }
    }
}

@Composable
fun NoClassesSection(onBrowseClasses: () -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.Md)) {
        WebEmptyState(
            title = "You have no classes yet",
            description =
                "Attendance is recorded per course session. Join a class first, " +
                    "then your courses and sessions appear here.",
        )
        WebButton(
            label = "Browse classes",
            onClick = onBrowseClasses,
            variant = WebButtonVariant.LINK,
        )
    }
}

package id.starstask.mobile.ui.screens.dashboard

// Calm greeting block: plain white grouped-card surface, tight type, one
// accent CTA. No gradient, no display-shouting caps — legible at a glance.

import androidx.compose.foundation.background
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
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import id.starstask.mobile.data.DashboardClass
import id.starstask.mobile.ui.icons.Lucide
import id.starstask.mobile.ui.theme.DashRadiusCard
import id.starstask.mobile.ui.theme.dashColors

@Composable
fun DashHero(
    displayName: String?,
    classes: List<DashboardClass>,
    onRequestTaskPublication: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val palette = dashColors()
    val shownName = displayName?.takeIf { it.isNotBlank() } ?: "Welcome"
    val now = java.time.ZonedDateTime.now(java.time.ZoneId.systemDefault())
    val greeting = when (now.hour) {
        in 0..11 -> "Good morning,"
        in 12..17 -> "Good afternoon,"
        else -> "Good evening,"
    }
    val classLine = classes
        .map { it.classCode?.takeIf { code -> code.isNotBlank() } ?: it.name }
        .filter { it.isNotBlank() }
        .joinToString(" · ")
    val managesAnyClass = classes.any { it.isAdmin }

    Column(
        modifier = modifier
            .fillMaxWidth()
            .clip(DashRadiusCard)
            .background(palette.card)
            .padding(horizontal = 20.dp, vertical = 18.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(greeting, color = palette.muted, fontSize = 15.sp, lineHeight = 20.sp)
                Text(
                    shownName,
                    color = palette.text,
                    fontSize = 26.sp,
                    lineHeight = 32.sp,
                    fontWeight = androidx.compose.ui.text.font.FontWeight.SemiBold,
                    letterSpacing = (-0.015).sp,
                    maxLines = 2,
                )
                if (classLine.isNotBlank()) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                        modifier = Modifier.padding(top = 4.dp),
                    ) {
                        Text(
                            classLine,
                            color = palette.muted,
                            fontSize = 13.sp,
                            lineHeight = 17.sp,
                            fontWeight = androidx.compose.ui.text.font.FontWeight.Medium,
                            maxLines = 1,
                            overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis,
                        )
                    }
                }
            }
        }

        Row(
            modifier = Modifier
                .clip(RoundedCornerShape(999.dp))
                .background(palette.accent)
                .clickable(onClick = onRequestTaskPublication)
                .padding(horizontal = 18.dp, vertical = 11.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Icon(Lucide.CalendarDays, contentDescription = null, tint = androidx.compose.ui.graphics.Color.White, modifier = Modifier.size(16.dp))
            Text(
                if (managesAnyClass) "Create Assignment" else "Request Task Publication",
                color = androidx.compose.ui.graphics.Color.White,
                fontSize = 14.sp,
                fontWeight = androidx.compose.ui.text.font.FontWeight.SemiBold,
                maxLines = 1,
            )
            Icon(Lucide.ChevronRight, contentDescription = null, tint = androidx.compose.ui.graphics.Color.White.copy(alpha = 0.8f), modifier = Modifier.size(14.dp))
        }
    }
}
